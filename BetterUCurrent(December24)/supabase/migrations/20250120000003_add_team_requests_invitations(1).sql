-- BetterU League - Team Join Requests and Invitations
-- Adds tables for managing team membership requests and invitations

-- ============================================================================
-- TEAM JOIN REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_join_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- TEAM INVITATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invited_by_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_team_join_requests_team_id ON team_join_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_user_id ON team_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_status ON team_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_user_id ON team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- Partial unique indexes to prevent duplicate pending requests/invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_join_requests_unique_pending 
ON team_join_requests(team_id, user_id) 
WHERE status = 'pending';

-- Prevent users from having multiple pending requests (one request per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_join_requests_one_per_user 
ON team_join_requests(user_id) 
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_unique_pending 
ON team_invitations(team_id, invited_user_id) 
WHERE status = 'pending';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE team_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Join requests: Viewable by team owners/admins and the requester
DROP POLICY IF EXISTS "Join requests are viewable by team owners and requesters" ON team_join_requests;
CREATE POLICY "Join requests are viewable by team owners and requesters" ON team_join_requests
    FOR SELECT USING (
        -- User is the requester
        auth.uid() = user_id OR
        -- User is team owner/admin (simple check via team_members)
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_join_requests.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Join requests: Users can create requests
DROP POLICY IF EXISTS "Users can create join requests" ON team_join_requests;
CREATE POLICY "Users can create join requests" ON team_join_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Join requests: Team owners/admins can update (accept/reject)
DROP POLICY IF EXISTS "Team owners/admins can update join requests" ON team_join_requests;
CREATE POLICY "Team owners/admins can update join requests" ON team_join_requests
    FOR UPDATE USING (
        -- User is team owner/admin (simple check via team_members)
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_join_requests.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Join requests: Users can update their own requests (to cancel)
DROP POLICY IF EXISTS "Users can update their own join requests" ON team_join_requests;
CREATE POLICY "Users can update their own join requests" ON team_join_requests
    FOR UPDATE USING (auth.uid() = user_id);

-- Join requests: Users can delete their own requests (to cancel)
DROP POLICY IF EXISTS "Users can delete their own join requests" ON team_join_requests;
CREATE POLICY "Users can delete their own join requests" ON team_join_requests
    FOR DELETE USING (auth.uid() = user_id);

-- Invitations: Viewable by team owners/admins and the invited user
DROP POLICY IF EXISTS "Invitations are viewable by team owners and invited users" ON team_invitations;
CREATE POLICY "Invitations are viewable by team owners and invited users" ON team_invitations
    FOR SELECT USING (
        -- User is the invited person
        auth.uid() = invited_user_id OR
        -- User is team owner/admin (simple check via team_members)
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_invitations.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Invitations: Team owners/admins can create invitations
DROP POLICY IF EXISTS "Team owners/admins can create invitations" ON team_invitations;
CREATE POLICY "Team owners/admins can create invitations" ON team_invitations
    FOR INSERT WITH CHECK (
        auth.uid() = invited_by_id AND
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_invitations.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Invitations: Invited users can update (accept/reject)
DROP POLICY IF EXISTS "Invited users can update invitations" ON team_invitations;
CREATE POLICY "Invited users can update invitations" ON team_invitations
    FOR UPDATE USING (auth.uid() = invited_user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to handle accepted join request
CREATE OR REPLACE FUNCTION handle_accepted_join_request()
RETURNS TRIGGER AS $$
BEGIN
    -- When a join request is accepted, add user to team
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Check if team is full
        IF (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id) >= 20 THEN
            RAISE EXCEPTION 'Team is full (20/20 members)';
        END IF;
        
        -- Check if user already has a team
        IF EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'User is already in a team';
        END IF;
        
        -- Add user to team
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (NEW.team_id, NEW.user_id, 'member')
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Auto-enroll team in active challenges
        INSERT INTO team_challenge_participants (challenge_id, team_id, current_value)
        SELECT id, NEW.team_id, 0
        FROM league_challenges
        WHERE status = 'active'
        ON CONFLICT (challenge_id, team_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle accepted invitation
CREATE OR REPLACE FUNCTION handle_accepted_invitation()
RETURNS TRIGGER AS $$
BEGIN
    -- When an invitation is accepted, add user to team
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Check if team is full
        IF (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id) >= 20 THEN
            RAISE EXCEPTION 'Team is full (20/20 members)';
        END IF;
        
        -- Check if user already has a team
        IF EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.invited_user_id) THEN
            RAISE EXCEPTION 'User is already in a team';
        END IF;
        
        -- Add user to team
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (NEW.team_id, NEW.invited_user_id, 'member')
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Auto-enroll team in active challenges
        INSERT INTO team_challenge_participants (challenge_id, team_id, current_value)
        SELECT id, NEW.team_id, 0
        FROM league_challenges
        WHERE status = 'active'
        ON CONFLICT (challenge_id, team_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_handle_accepted_join_request ON team_join_requests;
CREATE TRIGGER trigger_handle_accepted_join_request
    AFTER UPDATE ON team_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION handle_accepted_join_request();

DROP TRIGGER IF EXISTS trigger_handle_accepted_invitation ON team_invitations;
CREATE TRIGGER trigger_handle_accepted_invitation
    AFTER UPDATE ON team_invitations
    FOR EACH ROW
    EXECUTE FUNCTION handle_accepted_invitation();

-- Update updated_at triggers
DROP TRIGGER IF EXISTS update_team_join_requests_updated_at ON team_join_requests;
CREATE TRIGGER update_team_join_requests_updated_at
    BEFORE UPDATE ON team_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_invitations_updated_at ON team_invitations;
CREATE TRIGGER update_team_invitations_updated_at
    BEFORE UPDATE ON team_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

