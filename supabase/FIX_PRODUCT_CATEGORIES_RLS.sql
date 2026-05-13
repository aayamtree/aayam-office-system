-- Fix RLS policies for product_categories table
-- Run this in Supabase SQL Editor

-- Enable RLS (if not already enabled)
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Allow all operations on product_categories" ON product_categories;
DROP POLICY IF EXISTS "product_categories_select" ON product_categories;
DROP POLICY IF EXISTS "product_categories_insert" ON product_categories;
DROP POLICY IF EXISTS "product_categories_update" ON product_categories;
DROP POLICY IF EXISTS "product_categories_delete" ON product_categories;

-- Allow SELECT for all authenticated users
CREATE POLICY "product_categories_select"
ON product_categories FOR SELECT
TO authenticated
USING (true);

-- Allow INSERT for authenticated users
CREATE POLICY "product_categories_insert"
ON product_categories FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow UPDATE for authenticated users
CREATE POLICY "product_categories_update"
ON product_categories FOR UPDATE
TO authenticated
USING (true);

-- Allow DELETE for authenticated users
CREATE POLICY "product_categories_delete"
ON product_categories FOR DELETE
TO authenticated
USING (true);

-- Verify the table structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'product_categories'
ORDER BY ordinal_position;
