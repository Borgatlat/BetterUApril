-- Enable RLS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can join public groups" ON group_members;
DROP POLICY IF EXISTS "Users can create join requests" ON group_join_requests;
DROP POLICY IF EXISTS "Group owners can manage join requests" ON group_join_requests;

-- Create policy for joining public groups
CREATE POLICY "Users can join public groups"
ON group_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE id = group_id
    AND is_public = true
  )
);

-- Create policy for creating join requests
CREATE POLICY "Users can create join requests"
ON group_join_requests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE id = group_id
    AND is_public = false
  )
);

-- Create policy for group owners to manage join requests
CREATE POLICY "Group owners can manage join requests"
ON group_join_requests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_join_requests.group_id
    AND user_id = auth.uid()
    AND role = 'owner'
  )
);

-- Add policy for users to view their own join requests
CREATE POLICY "Users can view their own join requests"
ON group_join_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid()); 