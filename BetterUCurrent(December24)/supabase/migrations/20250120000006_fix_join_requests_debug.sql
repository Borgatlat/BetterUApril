-- BetterU League - Debug and Fix Join Requests RLS
-- This file will help us debug the actual issue

-- First, let's create a simple test function to see what's happening
CREATE OR REPLACE FUNCTION test_team_ownership(p_team_id UUID)
RETURNS TABLE (
    auth_user_id UUID,
    team_created_by UUID,
    is_created_by_match BOOLEAN,
    member_user_id UUID,
    member_role VARCHAR,
    is_member_owner BOOLEAN
) AS $$
DECLARE
    v_auth_user_id UUID;
    v_team_created_by UUID;
    v_member_record RECORD;
BEGIN
    v_auth_user_id := auth.uid();
    
    -- Get team created_by
    SELECT created_by INTO v_team_created_by
    FROM teams
    WHERE id = p_team_id;
    
    -- Get team member info
    SELECT user_id, role INTO v_member_record
    FROM team_members
    WHERE team_id = p_team_id
    AND user_id = v_auth_user_id
    LIMIT 1;
    
    RETURN QUERY
    SELECT 
        v_auth_user_id,
        v_team_created_by,
        (v_auth_user_id = v_team_created_by) AS is_created_by_match,
        COALESCE(v_member_record.user_id, '00000000-0000-0000-0000-000000000000'::UUID) AS member_user_id,
        COALESCE(v_member_record.role, 'none') AS member_role,
        (v_member_record.role IN ('owner', 'admin')) AS is_member_owner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_team_ownership(UUID) TO authenticated;

-- Now let's fix the RLS policy to be more explicit
-- The issue might be that we need to ensure the policy can actually read team_members
DROP POLICY IF EXISTS "Join requests are viewable by team owners and requesters" ON team_join_requests;

-- Create a simpler, more direct policy
CREATE POLICY "Join requests are viewable by team owners and requesters" ON team_join_requests
    FOR SELECT USING (
        -- User is the requester
        auth.uid() = user_id OR
        -- User is team owner/admin - check team_members directly
        -- We use a subquery that should work with RLS
        (
            SELECT COUNT(*) > 0
            FROM team_members tm
            WHERE tm.team_id = team_join_requests.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Same for UPDATE
DROP POLICY IF EXISTS "Team owners/admins can update join requests" ON team_join_requests;
CREATE POLICY "Team owners/admins can update join requests" ON team_join_requests
    FOR UPDATE USING (
        (
            SELECT COUNT(*) > 0
            FROM team_members tm
            WHERE tm.team_id = team_join_requests.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

