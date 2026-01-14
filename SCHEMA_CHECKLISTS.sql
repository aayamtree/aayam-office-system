-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create job_checklists table
CREATE TABLE IF NOT EXISTS job_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT UNIQUE NOT NULL, -- e.g. "Box", "Label", "Brochure", "Visiting Card"
    items JSONB NOT NULL DEFAULT '[]', -- Array of strings e.g. ["Bleed Check", "Colors"]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial data for common print shop items
INSERT INTO job_checklists (job_type, items) VALUES 
('Box', '["Bleed", "Die Cut Line", "Gluing Flap", "Colors (CMYK)", "Text Safe Zone", "Barcode Scan Test"]'),
('Label', '["Size Dimensions", "Adhesive Side", "Colors", "Roll Direction", "Corner Radius"]'),
('Brochure', '["Spelling", "Images High Res", "Fold Lines", "Bleed", "Page Numbers"]'),
('Pouch', '["Sealing Area", "Zipper Position", "Colors", "Material Spec", "Window Position"]'),
('Visiting Card', '["Name Spelling", "Phone Numbers", "Email Validity", "Address Check", "Bleed"]'),
('Banner', '["Resolution (72-150 DPI)", "Grommet Holes Safe", "Size Check", "Colors"]'),
('Book', '["Page Count", "Margin/Gutter", "Page Numbers", "Table of Contents", "Cover Spine Width"]')
ON CONFLICT (job_type) DO UPDATE SET 
    items = EXCLUDED.items;

-- RLS Policies
ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone with a role
CREATE POLICY "Allow read access to authenticated users" 
ON job_checklists FOR SELECT 
TO authenticated 
USING (true);

-- Allow write access only to admins
CREATE POLICY "Allow write access to admins" 
ON job_checklists FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
