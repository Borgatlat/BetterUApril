-- ============================================================
-- COPY EVERYTHING BELOW (from CREATE TABLE to the last semicolon)
-- Then: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- Create events table for community feed (Add Event modal)
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own events" ON events;
CREATE POLICY "Users can insert their own events"
    ON events FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
CREATE POLICY "Authenticated users can view events"
    ON events FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Creators can update their own events" ON events;
CREATE POLICY "Creators can update their own events"
    ON events FOR UPDATE TO authenticated
    USING (auth.uid() = creator_id)
    WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete their own events" ON events;
CREATE POLICY "Creators can delete their own events"
    ON events FOR DELETE TO authenticated
    USING (auth.uid() = creator_id);

-- Event attendees (for Join/Leave on feed event cards)
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view event attendees" ON event_attendees;
CREATE POLICY "Authenticated can view event attendees" ON event_attendees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can join event" ON event_attendees;
CREATE POLICY "Authenticated can join event" ON event_attendees FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can leave event" ON event_attendees;
CREATE POLICY "Users can leave event" ON event_attendees FOR DELETE TO authenticated USING (auth.uid() = user_id);
