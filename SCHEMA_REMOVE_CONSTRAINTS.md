-- Remove Foreign Key constraints to allow "Fake Speed Admin" ID to exist in these tables
-- This solves the "Violates Foreign Key" and "Data Not Showing" issues
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_created_by_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_converted_to_client_id_fkey; -- Optional safeguard

ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_done_by_fkey;

-- For Commissions (Jobs table)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_sales_person_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_created_by_fkey;
