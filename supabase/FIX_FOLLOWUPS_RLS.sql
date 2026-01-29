-- =============================================
-- FIX: Add RLS Policies for follow_ups table (CORRECTED)
-- =============================================
-- Problem: follow_ups table has RLS enabled but NO policies
-- This causes all queries to be denied by default
-- =============================================

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Marketing users can view their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Admins can view all follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Marketing users can create follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Users can update their follow-ups" ON follow_ups;
DROP POLICY IF EXISTS "Users can delete their follow-ups" ON follow_ups;

-- =============================================
-- CREATE RLS POLICIES
-- =============================================

-- Policy 1: Marketing users can view follow-ups for their own leads
CREATE POLICY "Marketing users can view their follow-ups"
ON follow_ups
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'marketing'
  )
  AND (
    -- Follow-up belongs to a lead assigned to this user
    lead_id IN (
      SELECT id FROM leads WHERE assigned_to = auth.uid()
    )
    OR
    -- OR follow-up was created by this user
    done_by = auth.uid()
  )
);

-- Policy 2: Admins can view all follow-ups
CREATE POLICY "Admins can view all follow-ups"
ON follow_ups
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);

-- Policy 3: Marketing and admin users can create follow-ups
CREATE POLICY "Marketing users can create follow-ups"
ON follow_ups
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('marketing', 'admin')
  )
);

-- Policy 4: Users can update their own follow-ups or admins can update any
CREATE POLICY "Users can update their follow-ups"
ON follow_ups
FOR UPDATE
USING (
  done_by = auth.uid()
  OR
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Policy 5: Users can delete their own follow-ups or admins can delete any
CREATE POLICY "Users can delete their follow-ups"
ON follow_ups
FOR DELETE
USING (
  done_by = auth.uid()
  OR
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VERIFY POLICIES
-- =============================================
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd as command
FROM pg_policies 
WHERE tablename = 'follow_ups'
ORDER BY policyname;
