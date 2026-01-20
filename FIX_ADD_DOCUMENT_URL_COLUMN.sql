-- Add document_url column to profiles table for identity documents
-- This allows designers to upload and store their identity documents (Aadhar, PAN, etc.)

-- Step 1: Add the column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN profiles.document_url IS 'URL to stored identity document (Aadhar, PAN, Driving License, etc.)';

-- Done! Now designers can save their identity documents
-- The column will store the URL from Supabase Storage
