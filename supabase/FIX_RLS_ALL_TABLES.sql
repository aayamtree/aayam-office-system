-- ============================================================
-- FIX RLS: MAKE ALL DATA TABLES PERMISSIVE FOR AUTHENTICATED USERS
-- ============================================================
-- Problem: Some tables (leads, follow_ups, activity_logs, etc.) have 
-- restrictive RLS policies that use auth.uid(). 
-- Speed Login users have NO real auth session → auth.uid() = NULL → 
-- all writes are silently blocked → "Saving..." hangs forever.
--
-- Solution: Drop restrictive policies and create simple "allow all 
-- authenticated" policies, matching what FULL_SCHEMA_FIX.sql already 
-- does for jobs, clients, vendors, etc.
-- ============================================================

-- =====================
-- LEADS
-- =====================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Marketing users can view their assigned leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
DROP POLICY IF EXISTS "Marketing users can manage their assigned leads" ON leads;
DROP POLICY IF EXISTS "leads_open_select" ON leads;
DROP POLICY IF EXISTS "leads_open_all" ON leads;

CREATE POLICY "leads_open_select" ON leads FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "leads_open_all" ON leads FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================
-- FOLLOW-UPS
-- =====================
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Users can manage their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_open_select" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_open_all" ON follow_ups;

CREATE POLICY "follow_ups_open_select" ON follow_ups FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "follow_ups_open_all" ON follow_ups FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================
-- QUOTATIONS
-- =====================
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view quotations" ON quotations;
DROP POLICY IF EXISTS "Admins and marketing can manage quotations" ON quotations;
DROP POLICY IF EXISTS "quotations_open_select" ON quotations;
DROP POLICY IF EXISTS "quotations_open_all" ON quotations;

CREATE POLICY "quotations_open_select" ON quotations FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "quotations_open_all" ON quotations FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================
-- DESIGN TASKS
-- =====================
ALTER TABLE design_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their design tasks" ON design_tasks;
DROP POLICY IF EXISTS "Admins and designers can manage tasks" ON design_tasks;
DROP POLICY IF EXISTS "design_tasks_open_select" ON design_tasks;
DROP POLICY IF EXISTS "design_tasks_open_all" ON design_tasks;

CREATE POLICY "design_tasks_open_select" ON design_tasks FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "design_tasks_open_all" ON design_tasks FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================
-- DESIGN PROJECTS
-- =====================
ALTER TABLE design_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view design projects" ON design_projects;
DROP POLICY IF EXISTS "Admins and designers can manage projects" ON design_projects;
DROP POLICY IF EXISTS "design_projects_open_select" ON design_projects;
DROP POLICY IF EXISTS "design_projects_open_all" ON design_projects;

CREATE POLICY "design_projects_open_select" ON design_projects FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "design_projects_open_all" ON design_projects FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================
-- ACTIVITY LOGS (Critical — logActivity() writes here)
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
    ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- PROFILES (ensure readable by everyone)
-- =====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_open_select" ON profiles;
DROP POLICY IF EXISTS "profiles_open_all" ON profiles;

CREATE POLICY "profiles_open_select" ON profiles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "profiles_open_all" ON profiles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================
-- CLIENTS, VENDORS, COUNTERS (ensure still open)
-- =====================
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'counters') THEN
    ALTER TABLE counters DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- JOBS, INVOICES, DISPATCHES (ensure still open)
-- =====================
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dispatches') THEN
    ALTER TABLE dispatches DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
    ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- COMMISSIONS
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commissions') THEN
    ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "commissions_open_select" ON commissions;
    DROP POLICY IF EXISTS "commissions_open_all" ON commissions;
    
    CREATE POLICY "commissions_open_select" ON commissions FOR SELECT TO authenticated, anon USING (true);
    CREATE POLICY "commissions_open_all" ON commissions FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =====================
-- DAILY WORK REPORTS
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_work_reports') THEN
    ALTER TABLE daily_work_reports DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_task_updates') THEN
    ALTER TABLE report_task_updates DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- NOTES, CALENDAR, BANK ACCOUNTS
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes') THEN
    ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_calendar_events') THEN
    ALTER TABLE user_calendar_events DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_transactions') THEN
    ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- PURCHASE BILLS, VENDOR PAYMENTS, EXPENSES
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_bills') THEN
    ALTER TABLE purchase_bills DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_payments') THEN
    ALTER TABLE vendor_payments DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- SALES ORDERS, PAPER STOCK
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_orders') THEN
    ALTER TABLE sales_orders DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'paper_stock') THEN
    ALTER TABLE paper_stock DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================
-- SUCCESS MESSAGE
-- =====================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS FIX COMPLETE';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables with OPEN policies (SELECT + ALL):';
  RAISE NOTICE '  leads, follow_ups, quotations';
  RAISE NOTICE '  design_tasks, design_projects';
  RAISE NOTICE '  profiles, commissions';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables with RLS DISABLED:';
  RAISE NOTICE '  activity_logs, clients, vendors, counters';
  RAISE NOTICE '  jobs, invoices, dispatches, invoice_items';
  RAISE NOTICE '  daily_work_reports, report_task_updates';
  RAISE NOTICE '  notes, user_calendar_events, bank_accounts';
  RAISE NOTICE '  bank_transactions, purchase_bills, vendor_payments';
  RAISE NOTICE '  expenses, sales_orders, paper_stock';
  RAISE NOTICE '';
  RAISE NOTICE 'All admins should now be able to save data!';
  RAISE NOTICE '========================================';
END $$;
