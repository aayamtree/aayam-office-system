-- =============================================
-- DIAGNOSTIC: Check Payment Tables Status
-- Run this to see what's missing
-- =============================================

-- Check if tables exist
SELECT 
  table_name,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('payments_received', 'vendor_payments')
ORDER BY table_name;

-- Check columns in payments_received (if it exists)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payments_received'
ORDER BY ordinal_position;

-- Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('record_payment_received', 'record_vendor_payment');

-- Check counters
SELECT * FROM counters WHERE id IN ('payment_received', 'vendor_payment');
