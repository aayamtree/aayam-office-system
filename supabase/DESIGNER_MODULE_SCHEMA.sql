-- ============================================================
-- AAYAM OFFICE SYSTEM — DESIGNER MODULE SCHEMA
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. DESIGNER ATTENDANCE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS designer_attendance (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  designer_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  first_login_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_logout_time     TIMESTAMPTZ,
  last_heartbeat_time  TIMESTAMPTZ DEFAULT NOW(),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','logged_out','absent')),
  total_minutes_worked INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(designer_id, date)
);

ALTER TABLE designer_attendance ENABLE ROW LEVEL SECURITY;

-- Policies for designer_attendance
DROP POLICY IF EXISTS "attendance_select_own" ON designer_attendance;
CREATE POLICY "attendance_select_own" ON designer_attendance
  FOR SELECT USING (
    designer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "attendance_insert_own" ON designer_attendance;
CREATE POLICY "attendance_insert_own" ON designer_attendance
  FOR INSERT WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "attendance_update_own" ON designer_attendance;
CREATE POLICY "attendance_update_own" ON designer_attendance
  FOR UPDATE USING (designer_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. PRODUCT TYPES (for task creation)
-- Handles existing table by adding missing columns safely
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_types (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add 'category' column if it doesn't already exist (handles pre-existing table)
ALTER TABLE product_types
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

-- Add the CHECK constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'product_types_category_check'
  ) THEN
    ALTER TABLE product_types
      ADD CONSTRAINT product_types_category_check
      CHECK (category IN ('packaging','print','digital','other'));
  END IF;
END $$;

ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_types_select_all" ON product_types;
CREATE POLICY "product_types_select_all" ON product_types
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "product_types_insert_auth" ON product_types;
CREATE POLICY "product_types_insert_auth" ON product_types
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "product_types_update_admin" ON product_types;
CREATE POLICY "product_types_update_admin" ON product_types
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed product types (skip if already exists by name)
INSERT INTO product_types (name, category, is_active) VALUES
  ('BOX',               'packaging', true),
  ('POUCH',             'packaging', true),
  ('LABEL',             'packaging', true),
  ('BROCHURE',          'print',     true),
  ('VISITING CARD',     'print',     true),
  ('FLYER',             'print',     true),
  ('STICKER',           'print',     true),
  ('SOCIAL MEDIA POST', 'digital',   true),
  ('BANNER',            'digital',   true)
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 3. DESIGN TASKS (core task table)
-- Handles pre-existing table safely
-- ─────────────────────────────────────────────────────────────

-- Create with minimal columns only (id + timestamps always safe)
CREATE TABLE IF NOT EXISTS design_tasks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add all module columns safely (no-op if they already exist)
ALTER TABLE design_tasks
  ADD COLUMN IF NOT EXISTS task_code       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_id        UUID,
  ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS dimensions      TEXT,
  ADD COLUMN IF NOT EXISTS deadline        DATE,
  ADD COLUMN IF NOT EXISTS priority        TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS current_status  TEXT NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS rework_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_draft        BOOLEAN NOT NULL DEFAULT false;

-- Add CHECK constraints only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'design_tasks_priority_check'
  ) THEN
    ALTER TABLE design_tasks
      ADD CONSTRAINT design_tasks_priority_check
      CHECK (priority IN ('normal','urgent','critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'design_tasks_status_check'
  ) THEN
    ALTER TABLE design_tasks
      ADD CONSTRAINT design_tasks_status_check
      CHECK (current_status IN ('created','live','hold','review','rework','end'));
  END IF;
END $$;

ALTER TABLE design_tasks ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user can access a task
CREATE OR REPLACE FUNCTION can_access_design_task(task_row design_tasks)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN TRUE;
  END IF;
  RETURN (
    task_row.created_by = auth.uid()
    OR task_row.assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_transfers
      WHERE task_id = task_row.id AND transferred_by = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "tasks_select_own" ON design_tasks;
CREATE POLICY "tasks_select_own" ON design_tasks
  FOR SELECT USING (can_access_design_task(design_tasks.*));

DROP POLICY IF EXISTS "tasks_insert_auth" ON design_tasks;
CREATE POLICY "tasks_insert_auth" ON design_tasks
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','designer'))
  );

DROP POLICY IF EXISTS "tasks_update_own" ON design_tasks;
CREATE POLICY "tasks_update_own" ON design_tasks
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_design_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_design_tasks_updated_at ON design_tasks;
CREATE TRIGGER trg_design_tasks_updated_at
  BEFORE UPDATE ON design_tasks
  FOR EACH ROW EXECUTE FUNCTION update_design_tasks_updated_at();



-- ─────────────────────────────────────────────────────────────
-- 4. TASK STATUS HISTORY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_status_history (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_status_history
  ADD COLUMN IF NOT EXISTS task_id       UUID REFERENCES design_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_status   TEXT,
  ADD COLUMN IF NOT EXISTS to_status     TEXT,
  ADD COLUMN IF NOT EXISTS changed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reason        TEXT,
  ADD COLUMN IF NOT EXISTS rework_number INTEGER;

ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_history_select" ON task_status_history;
CREATE POLICY "status_history_select" ON task_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM design_tasks dt
      WHERE dt.id = task_id
      AND (dt.assigned_to = auth.uid() OR dt.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "status_history_insert" ON task_status_history;
CREATE POLICY "status_history_insert" ON task_status_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- 5. TASK TIME SESSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_time_sessions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_time_sessions
  ADD COLUMN IF NOT EXISTS task_id          UUID REFERENCES design_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS designer_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS session_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS pause_reason     TEXT;

ALTER TABLE task_time_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_sessions_select" ON task_time_sessions;
CREATE POLICY "time_sessions_select" ON task_time_sessions
  FOR SELECT USING (
    designer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "time_sessions_insert" ON task_time_sessions;
CREATE POLICY "time_sessions_insert" ON task_time_sessions
  FOR INSERT WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "time_sessions_update" ON task_time_sessions;
CREATE POLICY "time_sessions_update" ON task_time_sessions
  FOR UPDATE USING (designer_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 6. TASK TRANSFERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_transfers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_transfers
  ADD COLUMN IF NOT EXISTS task_id          UUID REFERENCES design_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS transferred_from UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_to   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS transferred_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason           TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE task_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers_select" ON task_transfers;
CREATE POLICY "transfers_select" ON task_transfers
  FOR SELECT USING (
    transferred_from = auth.uid()
    OR transferred_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "transfers_insert_admin" ON task_transfers;
CREATE POLICY "transfers_insert_admin" ON task_transfers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 7. DOSSIER ENTRIES (immutable audit trail)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dossier_entries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dossier_entries
  ADD COLUMN IF NOT EXISTS task_id    UUID REFERENCES design_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS entry_type TEXT,
  ADD COLUMN IF NOT EXISTS actor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_json  JSONB NOT NULL DEFAULT '{}';

-- Add entry_type CHECK constraint only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'dossier_entries_entry_type_check'
  ) THEN
    ALTER TABLE dossier_entries
      ADD CONSTRAINT dossier_entries_entry_type_check
      CHECK (entry_type IN (
        'TASK_CREATED','LIVE_STARTED','LIVE_PAUSED','HOLD_APPLIED',
        'TASK_TRANSFERRED','REVIEW_STARTED','REWORK_CREATED','TASK_ENDED',
        'STATUS_CHANGED'
      ));
  END IF;
END $$;

ALTER TABLE dossier_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_select" ON dossier_entries;
CREATE POLICY "dossier_select" ON dossier_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM design_tasks dt
      WHERE dt.id = task_id
      AND (dt.assigned_to = auth.uid() OR dt.created_by = auth.uid())
    )
  );

-- INSERT only — no UPDATE or DELETE policies (immutable audit trail)
DROP POLICY IF EXISTS "dossier_insert" ON dossier_entries;
CREATE POLICY "dossier_insert" ON dossier_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');



-- ─────────────────────────────────────────────────────────────
-- 8. HELPER FUNCTION: Generate task_code
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_task_code()
RETURNS TEXT AS $$
DECLARE
  today_str  TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  today_count INTEGER;
  code       TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM design_tasks
  WHERE task_code LIKE 'TASK-' || today_str || '-%';

  code := 'TASK-' || today_str || '-' || LPAD(today_count::TEXT, 3, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 9. HELPFUL VIEWS
-- ─────────────────────────────────────────────────────────────

-- Designer Status View (for admin dashboard)
CREATE OR REPLACE VIEW designer_status_view AS
SELECT
  p.id AS designer_id,
  p.full_name,
  p.email,
  COALESCE(da.status, 'absent') AS attendance_status,
  da.first_login_time,
  da.last_heartbeat_time,
  da.total_minutes_worked,
  dt.task_code AS current_task_code,
  dt.current_status AS current_task_status,
  dt.id AS current_task_id
FROM profiles p
LEFT JOIN designer_attendance da ON da.designer_id = p.id AND da.date = CURRENT_DATE
LEFT JOIN design_tasks dt ON dt.assigned_to = p.id AND dt.current_status IN ('live','hold','review','rework')
WHERE p.role = 'designer' AND p.is_active = true;

-- ─────────────────────────────────────────────────────────────
-- 10. INDEXES for performance
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_design_tasks_assigned_to    ON design_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_design_tasks_created_by     ON design_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_design_tasks_current_status ON design_tasks(current_status);
CREATE INDEX IF NOT EXISTS idx_dossier_entries_task_id     ON dossier_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_dossier_entries_created_at  ON dossier_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_sessions_task_id       ON task_time_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_transfers_task_id      ON task_transfers(task_id);
CREATE INDEX IF NOT EXISTS idx_attendance_designer_date    ON designer_attendance(designer_id, date);
