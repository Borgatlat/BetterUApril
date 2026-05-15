-- ============================================================
-- GROUP EVENTS: so "Share to groups" and group Events section work
-- Copy all below into Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- When you share an event to a group (Add Event modal → Share to groups),
-- the app inserts a row here. The group page shows only these rows.

-- 1) group_events: one row per event shared to a group (or created on group page)
CREATE TABLE IF NOT EXISTS group_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_events_group_id ON group_events(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_event_date ON group_events(event_date);

ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view group events" ON group_events;
CREATE POLICY "Group members can view group events"
    ON group_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_events.group_id
              AND group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Group members can insert group events" ON group_events;
CREATE POLICY "Group members can insert group events"
    ON group_events FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_events.group_id
              AND group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Creator can update own group event" ON group_events;
CREATE POLICY "Creator can update own group event"
    ON group_events FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can delete own group event" ON group_events;
CREATE POLICY "Creator can delete own group event"
    ON group_events FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- 2) group_event_attendees: who is attending (Join Event on group page)
CREATE TABLE IF NOT EXISTS group_event_attendees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES group_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_event_attendees_event_id ON group_event_attendees(event_id);

ALTER TABLE group_event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view attendees" ON group_event_attendees;
CREATE POLICY "Group members can view attendees"
    ON group_event_attendees FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM group_events ge
            JOIN group_members gm ON gm.group_id = ge.group_id AND gm.user_id = auth.uid()
            WHERE ge.id = group_event_attendees.event_id
        )
    );

DROP POLICY IF EXISTS "Authenticated can join event" ON group_event_attendees;
CREATE POLICY "Authenticated can join event"
    ON group_event_attendees FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own attendance" ON group_event_attendees;
CREATE POLICY "Users can remove own attendance"
    ON group_event_attendees FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
