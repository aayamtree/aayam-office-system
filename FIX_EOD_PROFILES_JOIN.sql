-- ============================================================
-- FIX: EOD Admin view shows "0 Submitted"
--
-- ROOT CAUSE: daily_work_reports.user_id has a FK to auth.users
-- but NOT to profiles. The app query does:
--   user:profiles(id, full_name, role, email)
-- PostgREST can't find a relationship → entire query fails → 0 reports shown.
--
-- FIX: Add a FK from daily_work_reports.user_id → profiles.id
-- This lets PostgREST join daily_work_reports with profiles.
-- ============================================================

-- Step 1: Verify no orphan user_ids before adding FK
-- (reports whose user has no profile entry)
SELECT COUNT(*) as orphan_count
FROM daily_work_reports dwr
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = dwr.user_id
);

-- Step 2: Add the foreign key relationship
-- This tells PostgREST that user_id → profiles.id, enabling the join
ALTER TABLE daily_work_reports
  ADD CONSTRAINT fk_daily_work_reports_profiles
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Step 3: Reload PostgREST schema cache so it picks up the new FK
-- In Supabase this happens automatically, but you can also go to:
-- Supabase Dashboard → API → Reload Schema

DO $$
BEGIN
  RAISE NOTICE '✅ FK added: daily_work_reports.user_id → profiles.id';
  RAISE NOTICE '   PostgREST can now join daily_work_reports with profiles';
  RAISE NOTICE '   Admin EOD view should now show submitted reports';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  If Step 1 showed orphan_count > 0, the FK will fail.';
  RAISE NOTICE '   In that case, remove orphan records first or skip the FK';
  RAISE NOTICE '   and instead fix the app query to not join profiles directly.';
END $$;
