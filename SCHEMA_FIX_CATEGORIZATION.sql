-- =====================================================
-- FIX: Transaction Categorization Schema
-- This script handles two scenarios:
-- 1. If you already ran the incorrect schema that tried to add transaction_type
-- 2. Ensures the correct categorization_type column exists
-- =====================================================

-- Check if we have a conflicting transaction_type column with wrong constraints
-- The original transaction_type column should only have 'inflow'/'outflow' values
-- If it has 'expense'/'income' constraint, we need to fix it

-- STEP 1: Check if categorization_type already exists (from corrected schema)
-- If not, we need to:
-- a) Drop any incorrectly added transaction_type CHECK constraint
-- b) Add categorization_type column

-- Drop any check constraint on transaction_type that references 'expense' or 'income'
DO $$ 
BEGIN
    -- Get constraint name and drop if it's for expense/income
    DECLARE
        constraint_name TEXT;
    BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'bank_transactions'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%expense%';
        
        IF constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE bank_transactions DROP CONSTRAINT ' || constraint_name;
            RAISE NOTICE 'Dropped conflicting constraint: %', constraint_name;
        END IF;
    END;
END $$;

-- STEP 2: Add categorization_type if it doesn't exist
ALTER TABLE bank_transactions 
  ADD COLUMN IF NOT EXISTS categorization_type TEXT CHECK (categorization_type IN ('expense', 'income'));

-- STEP 3: Drop and recreate the index
DROP INDEX IF EXISTS idx_bank_transactions_transaction_type;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_categorization_type ON bank_transactions(categorization_type);

-- STEP 4: Verify the fix
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'bank_transactions' 
AND column_name IN ('transaction_type', 'categorization_type')
ORDER BY column_name;

RAISE NOTICE '✓ Schema fix complete! You should see both transaction_type (for inflow/outflow) and categorization_type (for expense/income) columns.';
