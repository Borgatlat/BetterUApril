-- Add policy to allow users to view their friends' runs
CREATE POLICY "Users can view friends' runs"
    ON runs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM friendships
            WHERE (
                (friendships.user_id = auth.uid() AND friendships.friend_id = runs.user_id)
                OR
                (friendships.friend_id = auth.uid() AND friendships.user_id = runs.user_id)
            )
            AND friendships.status = 'accepted'
        )
    ); 