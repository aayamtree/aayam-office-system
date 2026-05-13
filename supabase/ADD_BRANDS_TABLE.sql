-- ============================================================
-- ADD BRANDS TABLE
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create the brands table
--    Brand uniqueness is per-client: same brand name can exist for different clients
CREATE TABLE IF NOT EXISTS brands (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  client_id   UUID        REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, client_id)   -- "Alina" for Client A ≠ "Alina" for Client B
);

-- 2. Add brand columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS brand_id   UUID REFERENCES brands(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS brand_name TEXT; -- denormalized for fast display without join

-- 3. Seed brands from existing clients.brand_name text field
--    Parses comma/hashtag-separated names like "Tiger, Cobra" or "#tiger #cobra"
INSERT INTO brands (name, client_id)
SELECT DISTINCT
  TRIM(INITCAP(REGEXP_REPLACE(part, '^#', ''))) AS name,
  id AS client_id
FROM clients,
  LATERAL UNNEST(
    STRING_TO_ARRAY(
      REGEXP_REPLACE(brand_name, '#', ',', 'g'),
      ','
    )
  ) AS part
WHERE
  brand_name IS NOT NULL
  AND brand_name <> ''
  AND TRIM(REGEXP_REPLACE(part, '^#', '')) <> ''
ON CONFLICT (name, client_id) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read brands
CREATE POLICY "brands_read" ON brands
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow admin and marketing to insert/update brands
CREATE POLICY "brands_write" ON brands
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'marketing', 'finance')
    )
  );

-- 5. Verify
SELECT c.company, b.name AS brand
FROM brands b
JOIN clients c ON c.id = b.client_id
ORDER BY c.company, b.name;
