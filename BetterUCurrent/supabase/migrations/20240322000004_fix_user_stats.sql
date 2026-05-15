-- Drop existing table if it exists
DROP TABLE IF EXISTS public.user_stats;

-- Create user_stats table with correct columns
CREATE TABLE public.user_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    today_workout_completed BOOLEAN DEFAULT false,
    today_mental_completed BOOLEAN DEFAULT false,
    streak_count INTEGER DEFAULT 0,
    total_workouts INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_user_stats_profile_id ON public.user_stats(profile_id); 