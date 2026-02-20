-- =============================================
-- CREATE STORAGE BUCKETS for file uploads
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create 'attachments' bucket (for invoice PDFs, e-way bills, job files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'files' bucket (for design files, if needed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('attachments', 'files'));

-- 4. Allow authenticated users to read files
CREATE POLICY "Authenticated users can read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id IN ('attachments', 'files'));

-- 5. Allow public read (for shared links)
CREATE POLICY "Public read for attachments" ON storage.objects
FOR SELECT TO anon
USING (bucket_id IN ('attachments', 'files'));

-- 6. Allow authenticated users to update/delete their uploads
CREATE POLICY "Authenticated users can update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id IN ('attachments', 'files'));

CREATE POLICY "Authenticated users can delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id IN ('attachments', 'files'));
