-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.user_workout_logs;
DROP TABLE IF EXISTS public.user_stats;
DROP TABLE IF EXISTS public.user_tracking;

-- Create user_workout_logs table
CREATE TABLE public.user_workout_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_name TEXT NOT NULL,
    exercises JSONB NOT NULL,
    completed_sets INTEGER NOT NULL DEFAULT 0,
    exercise_count INTEGER NOT NULL DEFAULT 0,
    exercise_names TEXT[] NOT NULL,
    total_weight NUMERIC NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_stats table
CREATE TABLE public.user_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    today_workout_completed BOOLEAN DEFAULT false,
    streak_count INTEGER DEFAULT 0,
    total_workouts INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_tracking table
CREATE TABLE public.user_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    calories INTEGER DEFAULT 0,
    water_liters NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes
CREATE INDEX idx_workout_logs_user_id ON public.user_workout_logs(user_id);
CREATE INDEX idx_workout_logs_completed_at ON public.user_workout_logs(completed_at);
CREATE INDEX idx_user_tracking_user_id ON public.user_tracking(user_id);
CREATE INDEX idx_user_tracking_date ON public.user_tracking(date);

-- Enable RLS
ALTER TABLE public.user_workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own workout logs"
    ON public.user_workout_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout logs"
    ON public.user_workout_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout logs"
    ON public.user_workout_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own stats"
    ON public.user_stats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
    ON public.user_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
    ON public.user_stats FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tracking"
    ON public.user_tracking FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracking"
    ON public.user_tracking FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracking"
    ON public.user_tracking FOR UPDATE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_workout_logs_updated_at
    BEFORE UPDATE ON public.user_workout_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_stats_updated_at
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_tracking_updated_at
    BEFORE UPDATE ON public.user_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 