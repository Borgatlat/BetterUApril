-- BetterU League System - Database Tables and RLS Policies
-- This migration creates all tables needed for the competitive team-based league system

-- ============================================================================
-- 1. TEAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    avatar_url TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    max_members INTEGER DEFAULT 20,
    
    -- League system fields
    total_trophies INTEGER DEFAULT 0 NOT NULL,
    current_league VARCHAR(20) DEFAULT 'Bronze' NOT NULL CHECK (current_league IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master')),
    best_league VARCHAR(20) DEFAULT 'Bronze' NOT NULL CHECK (best_league IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 2. TEAM MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Enforce one team per user
    UNIQUE(user_id),
    -- Prevent duplicate memberships
    UNIQUE(team_id, user_id)
);

-- ============================================================================
-- 3. LEAGUE CHALLENGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS league_challenges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Challenge details
    challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
        'workout_minutes', 
        'total_workouts', 
        'streak', 
        'runs', 
        'mental_sessions', 
        'prs', 
        'calories', 
        'distance'
    )),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Time period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'upcoming' NOT NULL CHECK (status IN ('upcoming', 'active', 'completed')),
    
    -- Prize info
    prize_description TEXT,
    prize_type VARCHAR(50) CHECK (prize_type IN ('premium_subscription', 'badge', 'cash', 'merchandise', NULL)),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 4. TEAM CHALLENGE PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_challenge_participants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    challenge_id UUID NOT NULL REFERENCES league_challenges(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Current progress (cached for performance)
    current_value INTEGER DEFAULT 0 NOT NULL,
    rank INTEGER,
    
    -- Results (after challenge ends)
    final_value INTEGER,
    final_rank INTEGER,
    base_trophies INTEGER DEFAULT 0 NOT NULL,
    trophies_earned INTEGER DEFAULT 0 NOT NULL,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- One participation record per team per challenge
    UNIQUE(challenge_id, team_id)
);

-- ============================================================================
-- 5. TROPHY HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_trophy_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES league_challenges(id) ON DELETE CASCADE,
    base_trophies INTEGER NOT NULL,
    multiplier DECIMAL(3,2) NOT NULL,
    trophies_earned INTEGER NOT NULL,
    rank_achieved INTEGER,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_total_trophies ON teams(total_trophies DESC);
CREATE INDEX IF NOT EXISTS idx_teams_current_league ON teams(current_league);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_rank ON team_challenge_participants(challenge_id, rank);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_team_id ON team_challenge_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_league_challenges_status ON league_challenges(status, start_date);
CREATE INDEX IF NOT EXISTS idx_league_challenges_type_status ON league_challenges(challenge_type, status);

-- Unique constraint to prevent overlapping active challenges of the same type
-- This will be enforced via application logic, but we add a partial unique index as backup
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_challenges_unique_active 
ON league_challenges(challenge_type) 
WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_trophy_history_team_id ON team_trophy_history(team_id);
CREATE INDEX IF NOT EXISTS idx_trophy_history_challenge_id ON team_trophy_history(challenge_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_trophy_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR TEAMS
-- ============================================================================

-- Teams: Viewable by everyone
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON teams;
CREATE POLICY "Teams are viewable by everyone" ON teams
    FOR SELECT USING (true);

-- Teams: Can be created by authenticated users
DROP POLICY IF EXISTS "Teams can be created by authenticated users" ON teams;
CREATE POLICY "Teams can be created by authenticated users" ON teams
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Teams: Can be updated by owners
DROP POLICY IF EXISTS "Teams can be updated by owners" ON teams;
CREATE POLICY "Teams can be updated by owners" ON teams
    FOR UPDATE USING (auth.uid() = created_by);

-- Teams: Can be deleted by owners
DROP POLICY IF EXISTS "Teams can be deleted by owners" ON teams;
CREATE POLICY "Teams can be deleted by owners" ON teams
    FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- RLS POLICIES FOR TEAM MEMBERS
-- ============================================================================

-- Team members: Viewable by everyone
DROP POLICY IF EXISTS "Team members are viewable by everyone" ON team_members;
CREATE POLICY "Team members are viewable by everyone" ON team_members
    FOR SELECT USING (true);

-- Team members: Users can join teams (but only if they don't have a team already)
DROP POLICY IF EXISTS "Users can join teams" ON team_members;
CREATE POLICY "Users can join teams" ON team_members
    FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id AND
        NOT EXISTS (
            SELECT 1 FROM team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Team members: Can be updated by team owners/admins
DROP POLICY IF EXISTS "Team owners/admins can update members" ON team_members;
CREATE POLICY "Team owners/admins can update members" ON team_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Team members: Can leave their own team
DROP POLICY IF EXISTS "Users can leave their team" ON team_members;
CREATE POLICY "Users can leave their team" ON team_members
    FOR DELETE USING (auth.uid() = user_id);

-- Team members: Owners/admins can remove members
DROP POLICY IF EXISTS "Team owners/admins can remove members" ON team_members;
CREATE POLICY "Team owners/admins can remove members" ON team_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- RLS POLICIES FOR LEAGUE CHALLENGES
-- ============================================================================

-- League challenges: Viewable by everyone
DROP POLICY IF EXISTS "League challenges are viewable by everyone" ON league_challenges;
CREATE POLICY "League challenges are viewable by everyone" ON league_challenges
    FOR SELECT USING (true);

-- League challenges: Can be created by service role (for monthly auto-creation)
-- Note: This will be handled via database functions/triggers, not direct user inserts
DROP POLICY IF EXISTS "League challenges can be created by service" ON league_challenges;
CREATE POLICY "League challenges can be created by service" ON league_challenges
    FOR INSERT WITH CHECK (true);

-- League challenges: Can be updated by service role
DROP POLICY IF EXISTS "League challenges can be updated by service" ON league_challenges;
CREATE POLICY "League challenges can be updated by service" ON league_challenges
    FOR UPDATE USING (true);

-- ============================================================================
-- RLS POLICIES FOR TEAM CHALLENGE PARTICIPANTS
-- ============================================================================

-- Challenge participants: Viewable by everyone
DROP POLICY IF EXISTS "Challenge participants are viewable by everyone" ON team_challenge_participants;
CREATE POLICY "Challenge participants are viewable by everyone" ON team_challenge_participants
    FOR SELECT USING (true);

-- Challenge participants: Can be inserted by system (when team joins challenge)
DROP POLICY IF EXISTS "Challenge participants can be created by system" ON team_challenge_participants;
CREATE POLICY "Challenge participants can be created by system" ON team_challenge_participants
    FOR INSERT WITH CHECK (true);

-- Challenge participants: Can be updated by system (for progress tracking)
DROP POLICY IF EXISTS "Challenge participants can be updated by system" ON team_challenge_participants;
CREATE POLICY "Challenge participants can be updated by system" ON team_challenge_participants
    FOR UPDATE USING (true);

-- ============================================================================
-- RLS POLICIES FOR TROPHY HISTORY
-- ============================================================================

-- Trophy history: Viewable by everyone
DROP POLICY IF EXISTS "Trophy history is viewable by everyone" ON team_trophy_history;
CREATE POLICY "Trophy history is viewable by everyone" ON team_trophy_history
    FOR SELECT USING (true);

-- Trophy history: Can be inserted by system (when trophies are awarded)
DROP POLICY IF EXISTS "Trophy history can be created by system" ON team_trophy_history;
CREATE POLICY "Trophy history can be created by system" ON team_trophy_history
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically add creator as team owner
CREATE OR REPLACE FUNCTION add_team_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for teams
DROP TRIGGER IF EXISTS on_team_created ON teams;
CREATE TRIGGER on_team_created
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION add_team_creator_as_owner();

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_league_challenges_updated_at ON league_challenges;
CREATE TRIGGER update_league_challenges_updated_at
    BEFORE UPDATE ON league_challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_challenge_participants_updated_at ON team_challenge_participants;
CREATE TRIGGER update_team_challenge_participants_updated_at
    BEFORE UPDATE ON team_challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

