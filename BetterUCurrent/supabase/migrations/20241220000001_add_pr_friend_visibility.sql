-- Add RLS policy to allow users to view their friends' PRs
-- This allows PRs to show up in the feed for friends

CREATE POLICY "Users can view friends' PRs"
    ON personal_records FOR SELECT
    USING (
        -- Users can view their own PRs
        auth.uid() = user_id
        OR
        -- Users can view PRs from their friends
        EXISTS (
            SELECT 1 FROM friends
            WHERE (
                (friends.user_id = auth.uid() AND friends.friend_id = personal_records.user_id)
                OR
                (friends.friend_id = auth.uid() AND friends.user_id = personal_records.user_id)
            )
            AND friends.status = 'accepted'
        )
    );

