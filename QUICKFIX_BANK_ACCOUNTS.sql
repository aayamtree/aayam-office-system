-- QUICKFIX: Create bank_accounts table if missing
-- Run this in Supabase SQL Editor

-- Check if bank_accounts exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bank_accounts'
    ) THEN
        -- Create bank_accounts table
        CREATE TABLE bank_accounts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            bank_name VARCHAR(255),
            account_number VARCHAR(100),
            ifsc_code VARCHAR(20),
            account_type VARCHAR(50) CHECK (account_type IN ('current', 'savings', 'od', 'cc', 'cash')),
            opening_balance DECIMAL(15,2) DEFAULT 0,
            current_balance DECIMAL(15,2) DEFAULT 0,
            is_default BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

        -- Allow all authenticated users to view
        CREATE POLICY view_bank_accounts ON bank_accounts
            FOR SELECT TO authenticated USING (true);

        -- Allow admins/accounts to manage
        CREATE POLICY manage_bank_accounts ON bank_accounts
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'account')
                )
            );

        RAISE NOTICE 'bank_accounts table created successfully!';
    ELSE
        RAISE NOTICE 'bank_accounts table already exists.';
    END IF;
END $$;

-- Verify
SELECT 'bank_accounts' as table_name, COUNT(*) as row_count FROM bank_accounts;
SELECT 'cash_accounts' as table_name, COUNT(*) as row_count FROM cash_accounts;
