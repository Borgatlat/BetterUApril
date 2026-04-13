-- First, create or verify tables exist
DO $$ 
BEGIN
    -- Check if required tables exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        CREATE TABLE profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name TEXT,
            email TEXT,
            onboarding_completed BOOLEAN DEFAULT false,
            training_level TEXT DEFAULT 'beginner',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
        CREATE TABLE user_settings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            use_imperial BOOLEAN DEFAULT false,
            calorie_goal INTEGER DEFAULT 2000,
            water_goal_ml INTEGER DEFAULT 2000,
            daily_reminders BOOLEAN DEFAULT true,
            rest_time_seconds INTEGER DEFAULT 90,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            UNIQUE(profile_id)
        );
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
        CREATE TABLE user_stats (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            workouts_completed INTEGER DEFAULT 0,
            total_workout_minutes INTEGER DEFAULT 0,
            mental_sessions_completed INTEGER DEFAULT 0,
            prs_this_month INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            today_workout_completed BOOLEAN DEFAULT false,
            today_mental_completed BOOLEAN DEFAULT false,
            last_reset_date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            UNIQUE(profile_id)
        );
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'onboarding_data') THEN
        CREATE TABLE onboarding_data (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_stats_profile_id ON user_stats(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_last_reset_date ON user_stats(last_reset_date);

-- Grant the postgres role (used by Supabase Auth) the ability to bypass RLS
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Enable RLS on tables (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_data ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can view their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Users can update their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Users can insert their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Service role can bypass RLS" ON profiles;
DROP POLICY IF EXISTS "Service role can bypass RLS" ON user_settings;
DROP POLICY IF EXISTS "Service role can bypass RLS" ON user_stats;
DROP POLICY IF EXISTS "Service role can bypass RLS" ON onboarding_data;
DROP POLICY IF EXISTS "Authenticated users can create their initial data" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can create their initial data" ON user_settings;
DROP POLICY IF EXISTS "Authenticated users can create their initial data" ON user_stats;
DROP POLICY IF EXISTS "Authenticated users can create their initial data" ON onboarding_data;
DROP POLICY IF EXISTS "Anon users can create their initial data" ON profiles;
DROP POLICY IF EXISTS "Anon users can create their initial data" ON user_settings;
DROP POLICY IF EXISTS "Anon users can create their initial data" ON user_stats;
DROP POLICY IF EXISTS "Anon users can create their initial data" ON onboarding_data;
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON profiles;
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON user_settings;
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON user_stats;
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON onboarding_data;

-- Create a policy to allow the postgres role to bypass RLS
CREATE POLICY "Postgres role can bypass RLS"
    ON profiles
    FOR ALL
    TO postgres
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Postgres role can bypass RLS"
    ON user_settings
    FOR ALL
    TO postgres
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Postgres role can bypass RLS"
    ON user_stats
    FOR ALL
    TO postgres
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Postgres role can bypass RLS"
    ON onboarding_data
    FOR ALL
    TO postgres
    USING (true)
    WITH CHECK (true);

-- Drop ALL existing triggers and functions that handle user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_stats ON auth.users;
DROP FUNCTION IF EXISTS create_default_settings();
DROP FUNCTION IF EXISTS initialize_user_stats();
DROP FUNCTION IF EXISTS handle_new_user();

-- Grant postgres role the ability to bypass RLS
GRANT ALL ON auth.users TO postgres;
GRANT ALL ON auth.identities TO postgres;
GRANT ALL ON auth.sessions TO postgres;
GRANT ALL ON auth.refresh_tokens TO postgres;
GRANT ALL ON auth.mfa_factors TO postgres;
GRANT ALL ON auth.mfa_challenges TO postgres;
GRANT ALL ON auth.mfa_amr_claims TO postgres;
GRANT ALL ON auth.flow_state TO postgres;
GRANT ALL ON auth.audit_log_entries TO postgres;
GRANT ALL ON auth.sso_providers TO postgres;
GRANT ALL ON auth.sso_domains TO postgres;
GRANT ALL ON auth.saml_providers TO postgres;
GRANT ALL ON auth.saml_relay_states TO postgres;

-- Grant necessary permissions (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
    ) THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'anon'
    ) THEN
        CREATE ROLE anon;
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Create RLS policies for the tables
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own stats"
    ON user_stats FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own stats"
    ON user_stats FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own stats"
    ON user_stats FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own onboarding data"
    ON onboarding_data FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own onboarding data"
    ON onboarding_data FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own onboarding data"
    ON onboarding_data FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Grant necessary permissions (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
    ) THEN
        CREATE ROLE service_role;
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant the service_role the ability to bypass RLS
CREATE POLICY "Service role can bypass RLS"
    ON profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can bypass RLS"
    ON user_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can bypass RLS"
    ON user_stats
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can bypass RLS"
    ON onboarding_data
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create a policy to allow the authenticated role to create their initial data
CREATE POLICY "Authenticated users can create their initial data"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can create their initial data"
    ON user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Authenticated users can create their initial data"
    ON user_stats
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Authenticated users can create their initial data"
    ON onboarding_data
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create a policy to allow the anon role to create their initial data
CREATE POLICY "Anon users can create their initial data"
    ON profiles
    FOR INSERT
    TO anon
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Anon users can create their initial data"
    ON user_settings
    FOR INSERT
    TO anon
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Anon users can create their initial data"
    ON user_stats
    FOR INSERT
    TO anon
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Anon users can create their initial data"
    ON onboarding_data
    FOR INSERT
    TO anon
    WITH CHECK (auth.uid() = id); 