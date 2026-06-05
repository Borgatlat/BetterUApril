-- Fix AI generation usage to use user's local date instead of server UTC date.
-- CURRENT_DATE in Postgres uses server timezone (UTC), so users in other
-- timezones wouldn't see their daily limit reset at their local midnight.
-- Now the client passes the local date; when not provided, falls back to CURRENT_DATE.

CREATE OR REPLACE FUNCTION increment_ai_generation_usage(
    p_user_id UUID,
    p_feature_type TEXT,
    p_usage_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO ai_generation_usage (user_id, feature_type, usage_date, usage_count)
    VALUES (p_user_id, p_feature_type, p_usage_date, 1)
    ON CONFLICT (user_id, feature_type, usage_date)
    DO UPDATE SET
        usage_count = ai_generation_usage.usage_count + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING usage_count INTO v_count;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_ai_generation_usage(
    p_user_id UUID,
    p_feature_type TEXT,
    p_usage_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COALESCE(usage_count, 0) INTO v_count
    FROM ai_generation_usage
    WHERE user_id = p_user_id
    AND feature_type = p_feature_type
    AND usage_date = p_usage_date;
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
