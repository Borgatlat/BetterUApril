-- Create table to track daily AI generation usage per user
-- This tracks how many AI generations each user has made per day for each feature type
CREATE TABLE IF NOT EXISTS ai_generation_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_type TEXT NOT NULL CHECK (feature_type IN ('workout', 'meal', 'mental_session')),
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, feature_type, usage_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_generation_usage_user_date ON ai_generation_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_generation_usage_feature ON ai_generation_usage(feature_type);

-- Enable Row Level Security
ALTER TABLE ai_generation_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own usage
CREATE POLICY "Users can view their own AI generation usage"
    ON ai_generation_usage FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage
CREATE POLICY "Users can insert their own AI generation usage"
    ON ai_generation_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own usage
CREATE POLICY "Users can update their own AI generation usage"
    ON ai_generation_usage FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Function to get or create daily usage record and increment count
CREATE OR REPLACE FUNCTION increment_ai_generation_usage(
    p_user_id UUID,
    p_feature_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Insert or update the usage count for today
    INSERT INTO ai_generation_usage (user_id, feature_type, usage_date, usage_count)
    VALUES (p_user_id, p_feature_type, CURRENT_DATE, 1)
    ON CONFLICT (user_id, feature_type, usage_date)
    DO UPDATE SET
        usage_count = ai_generation_usage.usage_count + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING usage_count INTO v_count;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current daily usage count
CREATE OR REPLACE FUNCTION get_ai_generation_usage(
    p_user_id UUID,
    p_feature_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COALESCE(usage_count, 0) INTO v_count
    FROM ai_generation_usage
    WHERE user_id = p_user_id
    AND feature_type = p_feature_type
    AND usage_date = CURRENT_DATE;
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_ai_generation_usage(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_generation_usage(UUID, TEXT) TO authenticated;
