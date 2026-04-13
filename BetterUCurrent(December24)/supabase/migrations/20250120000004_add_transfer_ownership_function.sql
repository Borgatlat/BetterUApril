-- BetterU League - Transfer Ownership Function
-- Creates a function to safely transfer team ownership

-- ============================================================================
-- FUNCTION: Transfer Team Ownership
-- ============================================================================
CREATE OR REPLACE FUNCTION transfer_team_ownership(
    p_team_id UUID,
    p_new_owner_id UUID,
    p_current_owner_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Verify current user is the owner
    IF NOT EXISTS (
        SELECT 1 FROM teams 
        WHERE id = p_team_id 
        AND created_by = p_current_owner_id
    ) THEN
        RAISE EXCEPTION 'Only the current team owner can transfer ownership';
    END IF;

    -- Verify new owner is a team member
    IF NOT EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = p_team_id 
        AND user_id = p_new_owner_id
    ) THEN
        RAISE EXCEPTION 'New owner must be a team member';
    END IF;

    -- Update team ownership
    UPDATE teams
    SET created_by = p_new_owner_id
    WHERE id = p_team_id;

    -- Update new owner's role
    UPDATE team_members
    SET role = 'owner'
    WHERE team_id = p_team_id
    AND user_id = p_new_owner_id;

    -- Update old owner's role to member (if they're staying) or remove them
    -- This will be handled by the frontend, but we can set it to member here
    UPDATE team_members
    SET role = 'member'
    WHERE team_id = p_team_id
    AND user_id = p_current_owner_id
    AND role = 'owner';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION transfer_team_ownership(UUID, UUID, UUID) TO authenticated;

