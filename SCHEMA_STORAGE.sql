-- 1. Create the 'files' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Enable Row Level Security (RLS) on the storage.objects table if not already enabled
-- (This is usually enabled by default, but good to ensure)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow PUBLIC read access to files in the 'files' bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'files' );

-- 4. Policy: Allow Authenticated users (Staff) to UPLOAD files
CREATE POLICY "Staff Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'files' );

-- 5. Policy: Allow Authenticated users to UPDATE/DELETE their own files (optional, or allow all staff)
CREATE POLICY "Staff Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'files' );

CREATE POLICY "Staff Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'files' );
