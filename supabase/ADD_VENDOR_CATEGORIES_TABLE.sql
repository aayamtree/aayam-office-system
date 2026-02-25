-- Create vendor_categories table for fully customizable categories
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS vendor_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT 'bg-gray-100 text-gray-800',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
