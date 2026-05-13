-- =============================================
-- ADD MISSING COLUMNS TO LEADS TABLE
-- =============================================
-- The leads table was created from CREATE_MARKETING_TABLES_SIMPLE.sql
-- which is missing lead_type, billing_preference, lost_reason, and project_type.
-- These columns are required by the app's lead creation form.
-- Run this in the Supabase SQL Editor.

-- Add lead_type column
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS lead_type TEXT;

-- Add billing_preference column
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS billing_preference TEXT;

-- Add lost_reason column
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- Add project_type column (if not already added by ADD_LEAD_PROJECT_FIELDS.sql)
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS project_type TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position;
