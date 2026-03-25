-- Migration: Add new columns to designer_attendance for attendance accuracy
-- Run this in Supabase SQL Editor

ALTER TABLE designer_attendance
  ADD COLUMN IF NOT EXISTS tap_out_method   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_override   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_reason  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS override_at      TIMESTAMPTZ DEFAULT NULL;

-- tap_out_method values:
--   'manual'  = designer clicked "End My Day"
--   'beacon'  = sendBeacon fired on browser close
--   'eod_cron' = auto-closed by 7:30pm cron
--   NULL      = legacy / unknown

-- admin_override = TRUE means admin has corrected this record
-- override_reason = free text reason entered by admin
-- override_at = timestamp when admin corrected it

COMMENT ON COLUMN designer_attendance.tap_out_method  IS 'How logout was recorded: manual | beacon | eod_cron';
COMMENT ON COLUMN designer_attendance.admin_override  IS 'Admin has manually corrected this record';
COMMENT ON COLUMN designer_attendance.override_reason IS 'Admin reason for correction';
COMMENT ON COLUMN designer_attendance.override_at     IS 'When admin corrected the record';
