-- Create events table for community feed (Add Event modal)
-- Stores events created by users so they can appear on the feed / group pages

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

-- Indexes for common queries (feed by date, by creator)
CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert events (only as themselves)
DROP POLICY IF EXISTS "Users can insert their own events" ON events;
CREATE POLICY "Users can insert their own events"
    ON events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = creator_id);

-- Authenticated users can read all events (for feed)
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
CREATE POLICY "Authenticated users can view events"
    ON events FOR SELECT
    TO authenticated
    USING (true);

-- Creators can update their own events
DROP POLICY IF EXISTS "Creators can update their own events" ON events;
CREATE POLICY "Creators can update their own events"
    ON events FOR UPDATE
    TO authenticated
    USING (auth.uid() = creator_id)
    WITH CHECK (auth.uid() = creator_id);

-- Creators can delete their own events
DROP POLICY IF EXISTS "Creators can delete their own events" ON events;
CREATE POLICY "Creators can delete their own events"
    ON events FOR DELETE
    TO authenticated
    USING (auth.uid() = creator_id);
