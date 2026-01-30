-- Add print planner validation fields to jobs table
-- This enforces the rule: Only print-ready + approved jobs reach print planner

-- Add print_ready flag
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS print_ready BOOLEAN DEFAULT false;

-- Add client_approval flag
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_approval BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN jobs.print_ready IS 'Indicates if design files are ready for printing';
COMMENT ON COLUMN jobs.client_approval IS 'Indicates if client has approved the design';

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_jobs_print_planner ON jobs(print_ready, client_approval, job_type)
  WHERE print_ready = true AND client_approval = true AND job_type IN ('Print Only', 'Design + Print');

-- Update existing jobs with reasonable defaults
-- Note: Set to false to be safe - admin can manually approve
UPDATE jobs SET print_ready = false WHERE print_ready IS NULL;
UPDATE jobs SET client_approval = false WHERE client_approval IS NULL;
