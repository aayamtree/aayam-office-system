-- ============================================================
-- FIX: Add missing FK jobs.sales_person_id → profiles.id
-- Date: 2026-04-07
--
-- Problem: useJobs() defaultSelect includes:
--   sales_person:profiles!sales_person_id(id, full_name, role)
-- PostgREST requires a real FK to join on a named column hint.
-- Without it, every jobs query returns 400 PGRST200:
--   "Could not find a relationship between 'jobs' and 'profiles'"
-- This causes Marketing Orders (and all order lists) to show
-- "Loading orders..." permanently and never load any data.
--
-- Fix: Add the FK with NOT VALID (skips historical row validation,
-- safe if any old rows have mock/speed-login IDs in sales_person_id).
-- PostgREST picks it up via pg_constraint after schema cache reload.
-- ============================================================

-- Step 1: Add the FK (NOT VALID = skip existing row validation)
ALTER TABLE jobs
  ADD CONSTRAINT fk_jobs_sales_person_id
  FOREIGN KEY (sales_person_id) REFERENCES profiles(id)
  ON DELETE SET NULL
  NOT VALID;

-- Step 2: Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Step 3: Verify constraint was created
SELECT conname, contype, confrelid::regclass AS references_table
FROM pg_constraint
WHERE conrelid = 'jobs'::regclass
  AND conname = 'fk_jobs_sales_person_id';
