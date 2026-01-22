-- =============================================
-- CREATE BANK_TRANSACTIONS TABLE
-- For Bank Statement Import & Reconciliation
-- =============================================

-- Create bank_transactions table for imported bank data
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('inflow', 'outflow')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    reference_type VARCHAR(50), -- 'payment_received', 'vendor_payment', 'ignored', etc.
    reference_id UUID, -- Links to payment/expense record if matched
    balance_after DECIMAL(15,2), -- Running balance after this transaction
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_txns_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_txns_date ON bank_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_txns_reference ON bank_transactions(reference_type, reference_id);

-- Add comments
COMMENT ON TABLE bank_transactions IS 'Imported bank statement transactions for reconciliation';
COMMENT ON COLUMN bank_transactions.transaction_type IS 'inflow = credit/deposit, outflow = debit/withdrawal';
COMMENT ON COLUMN bank_transactions.reference_type IS 'Type of linked record (payment_received, vendor_payment, ignored, etc.)';
COMMENT ON COLUMN bank_transactions.balance_after IS 'Bank balance after this transaction';

-- Enable RLS
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view
CREATE POLICY view_bank_transactions ON bank_transactions
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to insert (for import)
CREATE POLICY insert_bank_transactions ON bank_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow all authenticated users to update (for reconciliation matching)
CREATE POLICY update_bank_transactions ON bank_transactions
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow all authenticated users to delete
CREATE POLICY delete_bank_transactions ON bank_transactions
    FOR DELETE
    TO authenticated
    USING (true);

-- Verification
SELECT 'bank_transactions table created successfully!' as status;

-- Test query
SELECT COUNT(*) as transaction_count FROM bank_transactions;
