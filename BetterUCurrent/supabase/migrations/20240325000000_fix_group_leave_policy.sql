 -- Add policy to allow users to leave groups on their own
CREATE POLICY "Users can leave groups on their own" ON group_members
    FOR DELETE USING (
        auth.uid() = user_id
    ); 