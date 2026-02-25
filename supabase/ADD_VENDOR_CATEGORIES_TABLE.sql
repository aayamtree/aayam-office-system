-- Safe migration: adds missing columns to vendor_categories if they don't exist
-- Run this in Supabase SQL Editor

-- Step 1: Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS vendor_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add missing columns safely (won't fail if they already exist)
ALTER TABLE vendor_categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'bg-gray-100 text-gray-800';
ALTER TABLE vendor_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE vendor_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Step 3: Seed the default categories
INSERT INTO vendor_categories (name, color, sort_order) VALUES
  ('Paper',        'bg-blue-100 text-blue-800',    1),
  ('Ink & Toner',  'bg-purple-100 text-purple-800', 2),
  ('Binding',      'bg-amber-100 text-amber-800',   3),
  ('Lamination',   'bg-green-100 text-green-800',   4),
  ('Machinery',    'bg-red-100 text-red-800',       5),
  ('Packaging',    'bg-gray-100 text-gray-800',     6),
  ('Other',        'bg-gray-100 text-gray-700',     99)
ON CONFLICT (name) DO NOTHING;

-- Step 4: Enable RLS
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;

-- Step 5: Policies (drop first to avoid duplicates)
DROP POLICY IF EXISTS "authenticated read vendor_categories" ON vendor_categories;
DROP POLICY IF EXISTS "admin manage vendor_categories" ON vendor_categories;

CREATE POLICY "authenticated read vendor_categories"
  ON vendor_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin manage vendor_categories"
  ON vendor_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Done! Check results:
SELECT * FROM vendor_categories ORDER BY sort_order;


-- Seed with the current hardcoded categories
INSERT INTO vendor_categories (name, color, sort_order) VALUES
  ('Paper',        'bg-blue-100 text-blue-800',    1),
  ('Ink & Toner',  'bg-purple-100 text-purple-800', 2),
  ('Binding',      'bg-amber-100 text-amber-800',   3),
  ('Lamination',   'bg-green-100 text-green-800',   4),
  ('Machinery',    'bg-red-100 text-red-800',       5),
  ('Packaging',    'bg-gray-100 text-gray-800',     6),
  ('Other',        'bg-gray-100 text-gray-700',     99)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories
CREATE POLICY "authenticated read vendor_categories"
  ON vendor_categories FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert/update/delete categories
CREATE POLICY "admin manage vendor_categories"
  ON vendor_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
