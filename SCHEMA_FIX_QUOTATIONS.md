-- Fix Quotations Permissions and Constraints
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items DISABLE ROW LEVEL SECURITY;

-- Allow fake Speed Admin ID
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_created_by_fkey;
