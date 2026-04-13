-- Fix RLS policy to allow users to see blocks where they are blocked
-- This is needed for mutual blocking - users need to know who blocked them
-- so they can filter those users' content from their feed

-- Drop the old policy if it exists (it should already exist, but just in case)
DROP POLICY IF EXISTS "Users can view blocks where they are blocked" ON blocks;

-- Create policy to allow users to view blocks where they are the blocked user
-- This is CRITICAL for mutual blocking - users must be able to see who blocked them
CREATE POLICY "Users can view blocks where they are blocked" ON blocks
    FOR SELECT
    USING (auth.uid() = blocked_id);

-- This policy allows:
-- - User A can see blocks they created (where A is blocker_id) - via existing policy
-- - User B can see blocks where they are blocked (where B is blocked_id) - via this new policy
-- Together, this enables mutual blocking where both users can filter each other's content

