-- =====================================================
-- OPERATIONAL FINANCE SYSTEM - PHASE 1
-- Cash Tracking + Account Management
-- =====================================================

-- =====================================================
-- PART 1: Cash Accounts System
-- =====================================================

-- Cash accounts table (petty cash, cash registers, etc.)
CREATE TABLE IF NOT EXISTS cash_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE cash_accounts IS 'Cash registers and petty cash tracking';
COMMENT ON COLUMN cash_accounts.name IS 'e.g., Main Cash Register, Petty Cash';
COMMENT ON COLUMN cash_accounts.location IS 'e.g., Front Desk, Office Safe';

-- Cash transactions table
CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_account_id UUID REFERENCES cash_accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('in', 'out')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference VARCHAR(100),
    category VARCHAR(100),
    reference_type VARCHAR(50), -- 'payment', 'expense', 'adjustment'
    reference_id UUID,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    balance_after DECIMAL(15,2) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE cash_transactions IS 'All cash movements in/out';
COMMENT ON COLUMN cash_transactions.transaction_type IS 'in = money received, out = money paid';
COMMENT ON COLUMN cash_transactions.balance_after IS 'Cash balance after this transaction';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_txns_account ON cash_transactions(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_cash_txns_date ON cash_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_txns_reference ON cash_transactions(reference_type, reference_id);

-- =====================================================
-- PART 2: Update Payments Table
-- =====================================================

-- Add account linking to payments_received
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments_received' AND column_name = 'account_type') THEN
        ALTER TABLE payments_received ADD COLUMN account_type VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments_received' AND column_name = 'account_id') THEN
        ALTER TABLE payments_received ADD COLUMN account_id UUID;
    END IF;
END $$;

COMMENT ON COLUMN payments_received.account_type IS 'Type of account: bank or cash';
COMMENT ON COLUMN payments_received.account_id IS 'ID of bank_accounts or cash_accounts';

-- =====================================================
-- PART 3: Helper Functions
-- =====================================================

-- Function to update cash account balance
CREATE OR REPLACE FUNCTION update_cash_balance(
    p_account_id UUID,
    p_amount DECIMAL,
    p_operation VARCHAR -- 'add' or 'subtract'
)
RETURNS DECIMAL AS $$
DECLARE
    v_new_balance DECIMAL;
BEGIN
    UPDATE cash_accounts
    SET 
        current_balance = CASE
            WHEN p_operation = 'add' THEN current_balance + p_amount
            WHEN p_operation = 'subtract' THEN current_balance - p_amount
        END,
        updated_at = NOW()
    WHERE id = p_account_id
    RETURNING current_balance INTO v_new_balance;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to record cash transaction
CREATE OR REPLACE FUNCTION record_cash_transaction(
    p_account_id UUID,
    p_type VARCHAR,
    p_amount DECIMAL,
    p_description TEXT,
    p_reference VARCHAR DEFAULT NULL,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_txn_id UUID;
    v_new_balance DECIMAL;
BEGIN
    -- Update balance
    v_new_balance := update_cash_balance(p_account_id, p_amount, 
        CASE WHEN p_type = 'in' THEN 'add' ELSE 'subtract' END
    );
    
    -- Create transaction record
    INSERT INTO cash_transactions (
        cash_account_id, transaction_type, amount, description, 
        reference, transaction_date, balance_after
    ) VALUES (
        p_account_id, p_type, p_amount, p_description,
        p_reference, p_date, v_new_balance
    ) RETURNING id INTO v_txn_id;
    
    RETURN json_build_object(
        'success', true, 
        'transaction_id', v_txn_id, 
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 4: Create Default Accounts
-- =====================================================

-- Create default cash register if doesn't exist
INSERT INTO cash_accounts (name, location, opening_balance, current_balance)
SELECT 'Main Cash Register', 'Front Desk', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM cash_accounts WHERE name = 'Main Cash Register');

-- =====================================================
-- PART 5: RLS Policies
-- =====================================================

-- Enable RLS on cash accounts
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

-- Everyone can view cash accounts (authenticated users)
CREATE POLICY view_cash_accounts ON cash_accounts
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins/accounts can modify cash accounts
CREATE POLICY manage_cash_accounts ON cash_accounts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'account')
        )
    );

-- Everyone can view cash transactions
CREATE POLICY view_cash_transactions ON cash_transactions
    FOR SELECT
    TO authenticated
    USING (true);

-- Everyone can insert cash transactions
CREATE POLICY insert_cash_transactions ON cash_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('cash_accounts', 'cash_transactions');

-- Verify cash account exists
SELECT * FROM cash_accounts;

-- Check payments_received columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'payments_received'
AND column_name IN ('account_type', 'account_id');

-- =====================================================
-- SUCCESS!
-- If you see cash_accounts and cash_transactions tables,
-- and payments_received has account_type and account_id columns,
-- then schema is ready!
-- =====================================================
