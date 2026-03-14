-- ================================================
-- COMPLETE DATA RESET FOR FRESH START
-- ================================================
-- ⚠️  WARNING: Deletes ALL operational data!
-- ✅  Keeps: User profiles, bank accounts, settings
-- ================================================
-- HOW TO RUN:
--   Supabase → SQL Editor → paste → Run
-- ================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'payments_received', 'vendor_payments', 'purchase_bills', 'bank_transactions',
    'invoice_items', 'invoices', 'sales_orders',
    'design_tasks', 'design_projects', 'dispatches', 'jobs',
    'quotation_items', 'quotations', 'follow_ups', 'leads', 'clients',
    'paper_stock', 'vendors', 'designers',
    'activity_logs', 'notes', 'reminders',
    -- Counter tables (try all known names)
    'id_counters', 'counters', 'number_counters'
  ];
BEGIN
  SET session_replication_role = replica;
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE 'DELETE FROM ' || tbl;
      RAISE NOTICE 'Cleared: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (not in DB): %', tbl;
    END IF;
  END LOOP;
  SET session_replication_role = DEFAULT;
END $$;

-- ================================================
-- VERIFY — shows every table with its row count
-- ================================================
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(
         format('SELECT COUNT(*) AS c FROM %I', table_name),
         false, true, ''))
       )[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ================================================
-- WHAT REMAINS AFTER RESET
-- ================================================
-- ✅ User profiles (all logins intact)
-- ✅ Bank accounts & cash accounts
-- ✅ App settings (PairDrop URL, etc.)
-- ✅ EOD reports
-- ✅ Calendar events
-- ✅ RLS policies & permissions
-- ================================================
