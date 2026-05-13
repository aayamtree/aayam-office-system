/*
  MIGRATION: UPDATE QUOTATIONS FOR LEADS
  
  This SQL script updates the quotations table to allow NULL client_id values,
  enabling the creation of quotations for Leads before they are converted to Clients.

  INSTRUCTIONS:
  1. Go to your Supabase Dashboard
  2. Navigate to the SQL Editor
  3. Paste the following SQL commands and Run them.
*/

-- 1. Make client_id optional (nullable)
ALTER TABLE quotations ALTER COLUMN client_id DROP NOT NULL;

-- 2. Ensure lead_id column exists and is a foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'lead_id') THEN
        ALTER TABLE quotations ADD COLUMN lead_id UUID REFERENCES leads(id);
    END IF;
END $$;

-- 3. Add an index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);
