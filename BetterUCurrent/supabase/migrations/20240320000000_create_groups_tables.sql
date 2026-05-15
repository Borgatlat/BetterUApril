-- Drop existing policies
DROP POLICY IF EXISTS "Groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Groups can be created by authenticated users" ON groups;
DROP POLICY IF EXISTS "Groups can be updated by owners" ON groups;
DROP POLICY IF EXISTS "Groups can be deleted by owners" ON groups;

DROP POLICY IF EXISTS "Group members are viewable by everyone" ON group_members;
DROP POLICY IF EXISTS "Group members can be added by group owners/admins" ON group_members;
DROP POLICY IF EXISTS "Users can be added as members when accepting invitations" ON group_members;
DROP POLICY IF EXISTS "Group members can be removed by group owners/admins" ON group_members;

DROP POLICY IF EXISTS "Join requests are viewable by group owners/admins" ON join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON join_requests;
DROP POLICY IF EXISTS "Join requests can be updated by group owners/admins" ON join_requests;

DROP POLICY IF EXISTS "Group invitations are viewable by invited users and group owners/admins" ON group_invitations;
DROP POLICY IF EXISTS "Group invitations can be created by group owners/admins" ON group_invitations;
DROP POLICY IF EXISTS "Group invitations can be updated by invited users" ON group_invitations;

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_group_created ON groups;
DROP FUNCTION IF EXISTS add_group_creator_as_owner();

-- Drop existing tables if they exist
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS join_requests CASCADE;
DROP TABLE IF EXISTS group_invitations CASCADE;

-- Create groups table
CREATE TABLE groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    avatar_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE group_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Create join_requests table
CREATE TABLE join_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id, status)
);

-- Create group_invitations table
CREATE TABLE group_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invited_by_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, invited_user_id, status)
);

-- Add indexes
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_is_public ON groups(is_public);
CREATE INDEX idx_join_requests_group_id ON join_requests(group_id);
CREATE INDEX idx_join_requests_user_id ON join_requests(user_id);
CREATE INDEX idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX idx_group_invitations_invited_user_id ON group_invitations(invited_user_id);
CREATE INDEX idx_group_invitations_invited_by_id ON group_invitations(invited_by_id);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for groups
CREATE POLICY "Groups are viewable by everyone" ON groups
    FOR SELECT USING (true);

CREATE POLICY "Groups can be created by authenticated users" ON groups
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Groups can be updated by owners" ON groups
    FOR UPDATE USING (
        auth.uid() = created_by
    );

CREATE POLICY "Groups can be deleted by owners" ON groups
    FOR DELETE USING (
        auth.uid() = created_by
    );

-- Create policies for group_members
CREATE POLICY "Group members are viewable by everyone" ON group_members
    FOR SELECT USING (true);

-- Add policy to allow creator to be added as owner via trigger
CREATE POLICY "Creator can be added as owner via trigger" ON group_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = group_members.group_id
            AND g.created_by = auth.uid()
        )
    );

CREATE POLICY "Group members can be added by group owners/admins" ON group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

-- Add policy to allow group owners to update member roles
CREATE POLICY "Group owners can update member roles" ON group_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
            AND gm.role = 'owner'
        )
    );

-- Add policy to allow users to be added as members when accepting invitations
CREATE POLICY "Users can be added as members when accepting invitations" ON group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_invitations gi
            WHERE gi.group_id = group_members.group_id
            AND gi.invited_user_id = auth.uid()
            AND gi.status = 'pending'
        )
    );

CREATE POLICY "Group members can be removed by group owners/admins" ON group_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

-- Create policies for join_requests
CREATE POLICY "Join requests are viewable by group owners/admins" ON join_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = join_requests.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can create join requests" ON join_requests
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = join_requests.group_id
            AND g.is_public = false
        )
    );

CREATE POLICY "Join requests can be updated by group owners/admins" ON join_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = join_requests.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

-- Add policy for users to view their own join requests
CREATE POLICY "Users can view their own join requests" ON join_requests
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Create policies for group_invitations
CREATE POLICY "Group invitations are viewable by invited users and group owners/admins" ON group_invitations
    FOR SELECT USING (
        auth.uid() = invited_user_id OR
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_invitations.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Group invitations can be created by group owners/admins" ON group_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_invitations.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Group invitations can be updated by invited users" ON group_invitations
    FOR UPDATE USING (
        auth.uid() = invited_user_id
    );

-- Add policy to allow group owners/admins to delete invitations
CREATE POLICY "Group invitations can be deleted by group owners/admins" ON group_invitations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_invitations.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

-- Add policy to allow invited users to view their own invitations
CREATE POLICY "Users can view their own invitations" ON group_invitations
    FOR SELECT USING (
        auth.uid() = invited_user_id
    );

-- Add policy to allow users to join public groups
CREATE POLICY "Users can join public groups" ON group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = group_members.group_id
            AND g.is_public = true
            AND auth.uid() = group_members.user_id
        )
    );

-- Create trigger to automatically add creator as owner
CREATE OR REPLACE FUNCTION add_group_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_group_created ON groups;

-- Create the trigger
CREATE TRIGGER on_group_created
    AFTER INSERT ON groups
    FOR EACH ROW
    EXECUTE FUNCTION add_group_creator_as_owner(); 