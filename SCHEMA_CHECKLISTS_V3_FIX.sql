-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure table exists
CREATE TABLE IF NOT EXISTS job_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENSURE category column exists (Critical Step)
ALTER TABLE job_checklists 
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'design';

-- 4. Fix Constraints
-- First, drop the old single-column unique constraint if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_checklists_job_type_key') THEN
        ALTER TABLE job_checklists DROP CONSTRAINT job_checklists_job_type_key;
    END IF;
END $$;

-- Add new composite unique constraint (if not exists)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_checklists_unique_type_category') THEN
        ALTER TABLE job_checklists ADD CONSTRAINT job_checklists_unique_type_category UNIQUE (job_type, category);
    END IF;
END $$;

-- 5. Temporarily Disable RLS during migration
ALTER TABLE job_checklists DISABLE ROW LEVEL SECURITY;

-- 6. Seed Design Checklists
INSERT INTO job_checklists (job_type, category, items) VALUES 
('Box', 'design', '["Bleed", "Die Cut Line", "Gluing Flap", "Colors (CMYK)", "Text Safe Zone", "Barcode Scan Test"]'),
('Label', 'design', '["Size Dimensions", "Adhesive Side", "Colors", "Roll Direction", "Corner Radius"]'),
('Brochure', 'design', '["Spelling", "Images High Res", "Fold Lines", "Bleed", "Page Numbers"]'),
('Pouch', 'design', '["Sealing Area", "Zipper Position", "Colors", "Material Spec", "Window Position"]'),
('Visiting Card', 'design', '["Name Spelling", "Phone Numbers", "Email Validity", "Address Check", "Bleed"]'),
('Banner', 'design', '["Resolution (72-150 DPI)", "Grommet Holes Safe", "Size Check", "Colors"]'),
('Book', 'design', '["Page Count", "Margin/Gutter", "Page Numbers", "Table of Contents", "Cover Spine Width"]'),
('Other', 'design', '["Dimensions Check", "Colors / Pantones", "Spelling/Content", "Images Resolution"]')
ON CONFLICT (job_type, category) DO UPDATE SET 
    items = EXCLUDED.items;

-- 7. Seed Dispatch/QC Checklists
INSERT INTO job_checklists (job_type, category, items) VALUES 
('Standard', 'dispatch', '["Print Quality (No Streaks)", "Color Match with File/Sample", "Quantity Verified", "Finishing Verified (Lamination/Foil)", "Cutting Accuracy", "Packaging Cleanliness"]'),
('Box', 'dispatch', '["Print Quality", "Color Match", "Quantity Verified", "Glue Adhesion Test", "Assembly Test", "Packaging Count"]'),
('Label', 'dispatch', '["Print Quality", "Color Match", "Quantity (Roll/Sheet Count)", "Adhesive Test", "Die Cut Layout"]'),
('Visiting Card', 'dispatch', '["Cardstock Thickness", "Print Quality", "Quantity Check", "Cutting Edges Sharpness", "Box Packaging"]'),
('Other', 'dispatch', '["Print Quality", "Quantity Check", "Damage Check", "Packaging"]')
ON CONFLICT (job_type, category) DO UPDATE SET 
    items = EXCLUDED.items;

-- 8. Add checklist columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatch_checklist_progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_status TEXT DEFAULT 'pending';

-- 9. Re-enable RLS and Set Policies
ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON job_checklists;
DROP POLICY IF EXISTS "Allow write access to admins" ON job_checklists;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON job_checklists;
DROP POLICY IF EXISTS "Allow write access to admins and managers" ON job_checklists;

CREATE POLICY "Allow read access to authenticated users" 
ON job_checklists FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow write access to admins and managers" 
ON job_checklists FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'manager')
  )
);
