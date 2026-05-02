-- =============================================
-- BANK TRANSACTION: Add client_id link
-- Purpose: Link bank transactions to clients for payment allocation
-- No new tables — reuses existing payments_received
-- =============================================

-- 1. Add client_id to bank_transactions (single column, no clutter)
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 2. Index for fast lookup (client's transactions)
CREATE INDEX IF NOT EXISTS idx_bank_transactions_client_id
  ON bank_transactions(client_id);

-- Done. Payment allocations are stored in existing payments_received table.
-- Each allocation = one payments_received row (already handles invoice linking).
