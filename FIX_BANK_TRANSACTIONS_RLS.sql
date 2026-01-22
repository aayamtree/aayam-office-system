-- Fix RLS policy for bank_transactions to allow inserts
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS insert_bank_transactions ON bank_transactions;
DROP POLICY IF EXISTS view_bank_transactions ON bank_transactions;
DROP POLICY IF EXISTS update_bank_transactions ON bank_transactions;
DROP POLICY IF EXISTS delete_bank_transactions ON bank_transactions;

-- Create new, simpler policies that work for all authenticated users
CREATE POLICY "Allow all for authenticated users" ON bank_transactions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Verify
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'bank_transactions';
