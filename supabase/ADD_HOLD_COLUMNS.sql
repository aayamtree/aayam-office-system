-- =============================================
-- HOLD / UNHOLD FEATURE
-- Add columns to jobs table for project hold
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_on_hold BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pre_hold_stage TEXT;
