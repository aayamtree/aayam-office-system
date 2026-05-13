-- ============================================================
-- ADD OPENING BALANCE TO VENDORS
-- Mirrors the pattern used on bank_accounts.
-- Purpose: capture what we already owe the vendor at the date
-- of onboarding them into the system (Zoho Books style).
-- ============================================================

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_date DATE;

COMMENT ON COLUMN vendors.opening_balance
  IS 'Amount owed to this vendor at the time of onboarding (>= 0). Added to outstanding_balance on creation.';
COMMENT ON COLUMN vendors.opening_balance_date
  IS 'As-of date for the opening balance figure.';

-- Back-fill: for existing rows, default opening_balance to 0 and leave the date NULL.
UPDATE vendors
SET opening_balance = COALESCE(opening_balance, 0)
WHERE opening_balance IS NULL;

SELECT 'Vendors.opening_balance + opening_balance_date ready' AS status;
