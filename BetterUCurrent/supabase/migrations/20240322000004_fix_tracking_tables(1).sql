-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.calorie_tracking;
DROP TABLE IF EXISTS public.water_tracking;

-- Create calorie_tracking table
CREATE TABLE public.calorie_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    consumed INTEGER DEFAULT 0,
    goal INTEGER DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

-- Create water_tracking table
CREATE TABLE public.water_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    glasses INTEGER DEFAULT 0,
    goal NUMERIC DEFAULT 8.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

-- Create indexes
CREATE INDEX idx_calorie_tracking_profile_id ON public.calorie_tracking(profile_id);
CREATE INDEX idx_calorie_tracking_date ON public.calorie_tracking(date);
CREATE INDEX idx_water_tracking_profile_id ON public.water_tracking(profile_id);
CREATE INDEX idx_water_tracking_date ON public.water_tracking(date);

-- Enable Row Level Security
ALTER TABLE public.calorie_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies for calorie_tracking
CREATE POLICY "Users can view their own calorie tracking"
    ON public.calorie_tracking
    FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own calorie tracking"
    ON public.calorie_tracking
    FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own calorie tracking"
    ON public.calorie_tracking
    FOR UPDATE
    USING (auth.uid() = profile_id);

-- Create policies for water_tracking
CREATE POLICY "Users can view their own water tracking"
    ON public.water_tracking
    FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own water tracking"
    ON public.water_tracking
    FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own water tracking"
    ON public.water_tracking
    FOR UPDATE
    USING (auth.uid() = profile_id);

-- Migrate existing data from user_tracking to new tables
INSERT INTO public.calorie_tracking (profile_id, date, consumed, goal, created_at, updated_at)
SELECT user_id, date, calories, 2000, created_at, updated_at
FROM public.user_tracking
ON CONFLICT (profile_id, date) DO NOTHING;

INSERT INTO public.water_tracking (profile_id, date, glasses, goal, created_at, updated_at)
SELECT user_id, date, ROUND(water_liters * 4), water_liters, created_at, updated_at
FROM public.user_tracking
ON CONFLICT (profile_id, date) DO NOTHING;

-- Drop the old user_tracking table
DROP TABLE IF EXISTS public.user_tracking; 