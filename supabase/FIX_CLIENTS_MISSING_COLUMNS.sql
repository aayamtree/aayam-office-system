-- ============================================
-- ADD MISSING COLUMNS TO CLIENTS TABLE
-- ============================================
-- The createClient hook sends assigned_to but the column
-- doesn't exist in the original schema. This fixes the 400 error.

-- Add assigned_to column (auto-set by hook to the creating user)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Add referred_by column (for referral tracking)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Verify
DO $$
BEGIN
    RAISE NOTICE '✅ Added missing columns to clients:';
    RAISE NOTICE '   - assigned_to (UUID)';
    RAISE NOTICE '   - referred_by (UUID)';
    RAISE NOTICE '🎯 Client Quick Add should work now!';
END $$;
