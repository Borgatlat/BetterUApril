-- BetterU League - Fix Join Requests RLS
-- Creates a function that directly returns join requests for team owners, bypassing RLS

-- ============================================================================
-- FUNCTION: Get join requests for a team (for team owners/admins)
-- This function bypasses RLS to return requests for team owners
-- ============================================================================
CREATE OR REPLACE FUNCTION get_team_join_requests(p_team_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    team_id UUID,
    status VARCHAR,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT
) AS $$
DECLARE
    v_current_user_id UUID;
    v_is_owner BOOLEAN := FALSE;
BEGIN
    -- Get current user ID
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Check if user is team owner/admin
    -- Check via teams.created_by
    SELECT EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = p_team_id
        AND t.created_by = v_current_user_id
    ) INTO v_is_owner;
    
    -- If not owner via created_by, check via team_members
    IF NOT v_is_owner THEN
        SELECT EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = p_team_id
            AND tm.user_id = v_current_user_id
            AND tm.role IN ('owner', 'admin')
        ) INTO v_is_owner;
    END IF;
    
    -- If user is not owner/admin, return empty result
    IF NOT v_is_owner THEN
        RETURN;
    END IF;
    
    -- Return join requests with profile data
    RETURN QUERY
    SELECT 
        tjr.id,
        tjr.user_id,
        tjr.team_id,
        tjr.status,
        tjr.message,
        tjr.created_at,
        p.username,
        p.full_name,
        p.avatar_url
    FROM team_join_requests tjr
    LEFT JOIN profiles p ON p.id = tjr.user_id
    WHERE tjr.team_id = p_team_id
    AND tjr.status = 'pending'
    ORDER BY tjr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_team_join_requests(UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: Check if user is team owner or admin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_team_owner_or_admin(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is team owner via teams.created_by
    IF EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = p_team_id
        AND t.created_by = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is owner/admin via team_members
    IF EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = p_team_id
        AND tm.user_id = p_user_id
        AND tm.role IN ('owner', 'admin')
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_team_owner_or_admin(UUID, UUID) TO authenticated;

-- ============================================================================
-- UPDATE RLS POLICIES TO USE THE HELPER FUNCTION
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Join requests are viewable by team owners and requesters" ON team_join_requests;
DROP POLICY IF EXISTS "Team owners/admins can update join requests" ON team_join_requests;
DROP POLICY IF EXISTS "Invitations are viewable by team owners and invited users" ON team_invitations;
DROP POLICY IF EXISTS "Team owners/admins can create invitations" ON team_invitations;

-- Join requests: Viewable by team owners/admins and the requester
CREATE POLICY "Join requests are viewable by team owners and requesters" ON team_join_requests
    FOR SELECT USING (
        -- User is the requester
        auth.uid() = user_id OR
        -- User is team owner/admin (using helper function)
        is_team_owner_or_admin(team_id, auth.uid())
    );

-- Join requests: Team owners/admins can update (accept/reject)
CREATE POLICY "Team owners/admins can update join requests" ON team_join_requests
    FOR UPDATE USING (
        -- User is team owner/admin (using helper function)
        is_team_owner_or_admin(team_id, auth.uid())
    );

-- Invitations: Viewable by team owners/admins and the invited user
CREATE POLICY "Invitations are viewable by team owners and invited users" ON team_invitations
    FOR SELECT USING (
        -- User is the invited person
        auth.uid() = invited_user_id OR
        -- User is team owner/admin (using helper function)
        is_team_owner_or_admin(team_id, auth.uid())
    );

-- Invitations: Team owners/admins can create invitations
CREATE POLICY "Team owners/admins can create invitations" ON team_invitations
    FOR INSERT WITH CHECK (
        auth.uid() = invited_by_id AND
        is_team_owner_or_admin(team_id, auth.uid())
    );

