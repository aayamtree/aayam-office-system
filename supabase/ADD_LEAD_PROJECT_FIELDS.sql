-- Add project fields to leads table for enhanced lead cards
-- These fields allow admin to see full project overview at a glance

-- Add new columns to leads table
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('print', 'design', 'design_print')),
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS deadline DATE;

-- Add comments for documentation
COMMENT ON COLUMN leads.project_type IS 'Type of project: print (client provides design), design (design only), or design_print (full service)';
COMMENT ON COLUMN leads.quantity IS 'Estimated quantity for the project';
COMMENT ON COLUMN leads.estimated_amount IS 'Estimated project amount (excluding GST)';
COMMENT ON COLUMN leads.deadline IS 'Expected or requested deadline for the project';

-- Create index for filtering by project type
CREATE INDEX IF NOT EXISTS idx_leads_project_type ON leads(project_type);

-- Create index for deadline-based queries
CREATE INDEX IF NOT EXISTS idx_leads_deadline ON leads(deadline) WHERE deadline IS NOT NULL;
