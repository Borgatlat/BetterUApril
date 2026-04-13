-- Sleep tracking: one row per night. "date" = the morning you woke up (so "last night" = today's date).
CREATE TABLE IF NOT EXISTS public.sleep_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    bedtime TEXT,
    waketime TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    quality INTEGER CHECK (quality >= 1 AND quality <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_sleep_tracking_profile_id ON public.sleep_tracking(profile_id);
CREATE INDEX IF NOT EXISTS idx_sleep_tracking_date ON public.sleep_tracking(date DESC);

ALTER TABLE public.sleep_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sleep tracking" ON public.sleep_tracking;
CREATE POLICY "Users can view their own sleep tracking"
    ON public.sleep_tracking FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can insert their own sleep tracking" ON public.sleep_tracking;
CREATE POLICY "Users can insert their own sleep tracking"
    ON public.sleep_tracking FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can update their own sleep tracking" ON public.sleep_tracking;
CREATE POLICY "Users can update their own sleep tracking"
    ON public.sleep_tracking FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can delete their own sleep tracking" ON public.sleep_tracking;
CREATE POLICY "Users can delete their own sleep tracking"
    ON public.sleep_tracking FOR DELETE USING (auth.uid() = profile_id);
