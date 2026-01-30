-- Print Planner Quantity Management Migration
-- Adds quantity tracking fields to print_run_jobs table

-- Add new columns for quantity management
ALTER TABLE print_run_jobs 
ADD COLUMN IF NOT EXISTS quantity_needed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ups_in_sheet INTEGER NOT NULL DEFAULT 1;

-- Add computed column for sheets required
-- Note: PostgreSQL doesn't support GENERATED AS for computed columns like MySQL
-- We'll use a view or calculate in application code instead

-- Add helpful comments
COMMENT ON COLUMN print_run_jobs.quantity_needed IS 'Customer order quantity for this job (e.g., 500 business cards)';
COMMENT ON COLUMN print_run_jobs.ups_in_sheet IS 'How many copies of this job fit on one sheet (e.g., 10-up)';

-- Create a view that includes the calculated sheets_required
CREATE OR REPLACE VIEW print_run_jobs_with_calculations AS
SELECT 
  prj.*,
  CASE 
    WHEN prj.ups_in_sheet > 0 THEN CEIL(prj.quantity_needed::DECIMAL / prj.ups_in_sheet::DECIMAL)
    ELSE 0 
  END AS sheets_required
FROM print_run_jobs prj;

COMMENT ON VIEW print_run_jobs_with_calculations IS 'Print run jobs with auto-calculated sheets_required field';

-- Grant permissions to authenticated users
GRANT SELECT ON print_run_jobs_with_calculations TO authenticated;

-- Update existing records to have default values
UPDATE print_run_jobs 
SET quantity_needed = 0, ups_in_sheet = 1
WHERE quantity_needed IS NULL OR ups_in_sheet IS NULL;
