-- ============================================================
-- FIX BRANDS — SAFE / IDEMPOTENT
-- Run this if ADD_BRANDS_TABLE.sql failed with policy errors.
-- Safe to run multiple times.
-- ============================================================

-- 1. Create brands table (no-op if it already exists)
CREATE TABLE IF NOT EXISTS brands (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  client_id   UUID        REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, client_id)
);

-- 2. Add brand columns to jobs (no-op if they already exist)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS brand_id   UUID REFERENCES brands(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- 3. Seed from existing clients.brand_name text (skip duplicates)
INSERT INTO brands (name, client_id)
SELECT DISTINCT
  TRIM(INITCAP(REGEXP_REPLACE(part, '^#', ''))) AS name,
  id AS client_id
FROM clients,
  LATERAL UNNEST(
    STRING_TO_ARRAY(
      REGEXP_REPLACE(COALESCE(brand_name, ''), '#', ',', 'g'),
      ','
    )
  ) AS part
WHERE
  brand_name IS NOT NULL
  AND brand_name <> ''
  AND TRIM(REGEXP_REPLACE(part, '^#', '')) <> ''
ON CONFLICT (name, client_id) DO NOTHING;

-- 4. Enable RLS (idempotent)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies before recreating (safe re-run)
DROP POLICY IF EXISTS "brands_read"  ON brands;
DROP POLICY IF EXISTS "brands_write" ON brands;

-- 6. Recreate policies
CREATE POLICY "brands_read" ON brands
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "brands_write" ON brands
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'marketing', 'finance', 'designer')
    )
  );

-- 7. Verify — should show your existing brands
SELECT c.company, b.name AS brand
FROM brands b
JOIN clients c ON c.id = b.client_id
ORDER BY c.company, b.name;
