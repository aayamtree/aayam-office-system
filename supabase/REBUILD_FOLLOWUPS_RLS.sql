-- =============================================
-- FRESH START: Follow-ups RLS Policies
-- =============================================
-- Simple, working policies - no complex logic
-- =============================================

-- Step 1: Remove ALL existing policies
DROP POLICY IF EXISTS "Marketing users can view their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Admins can view all follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Marketing users can create follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Users can update their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Users can delete their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Public Authenticated" ON follow_ups;

-- Step 2: Create SIMPLE policies that work

-- Policy 1: Everyone can view all follow-ups (simplest - we can add filtering later)
CREATE POLICY "Allow all authenticated users to view follow-ups"
ON follow_ups
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Everyone can create follow-ups
CREATE POLICY "Allow all authenticated users to create follow-ups"
ON follow_ups
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: Everyone can update all follow-ups
CREATE POLICY "Allow all authenticated users to update follow-ups"
ON follow_ups
FOR UPDATE
TO authenticated
USING (true);

-- Policy 4: Everyone can delete all follow-ups
CREATE POLICY "Allow all authenticated users to delete follow-ups"
ON follow_ups
FOR DELETE
TO authenticated
USING (true);

-- Step 3: Ensure RLS is enabled
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify
SELECT 
  policyname,
  cmd as command,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'follow_ups'
ORDER BY policyname;
