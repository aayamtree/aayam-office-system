-- Notes board (2026-10-13): replies from tagged people, history of cleared notes,
-- and nudge tracking. Already applied to the aayam-fresh project.
CREATE TABLE IF NOT EXISTS public.note_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  status      text NOT NULL CHECK (status IN ('done', 'not_done', 'working')),
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_note_replies_note_id ON public.note_replies(note_id);

CREATE TABLE IF NOT EXISTS public.note_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         uuid,
  content         text NOT NULL,
  created_by      text,
  note_created_at timestamptz,
  tagged_users    uuid[] DEFAULT '{}',
  replies         jsonb DEFAULT '[]'::jsonb,
  cleared_by      text,
  cleared_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_note_history_cleared_at ON public.note_history(cleared_at DESC);

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.note_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.note_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.note_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
