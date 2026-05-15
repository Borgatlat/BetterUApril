-- BetterU League - Auto Award Trophies When Challenge Ends
-- This creates a function and scheduled job to automatically award trophies
-- when a challenge's end_date passes

-- ============================================================================
-- FUNCTION: Check and complete expired challenges
-- ============================================================================
CREATE OR REPLACE FUNCTION check_and_complete_challenges()
RETURNS VOID AS $$
DECLARE
    v_challenge_record RECORD;
BEGIN
    -- Find all active challenges that have ended (end_date is in the past)
    FOR v_challenge_record IN
        SELECT id, name, end_date
        FROM league_challenges
        WHERE status = 'active'
        AND end_date < CURRENT_DATE
        ORDER BY end_date ASC
    LOOP
        -- Award trophies for this challenge
        RAISE NOTICE 'Awarding trophies for challenge: % (ended: %)', v_challenge_record.name, v_challenge_record.end_date;
        PERFORM award_challenge_trophies(v_challenge_record.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_and_complete_challenges() TO authenticated;

-- ============================================================================
-- SCHEDULED JOB (using pg_cron)
-- ============================================================================
-- Note: pg_cron must be enabled in Supabase
-- This will run daily at midnight UTC to check for expired challenges
-- 
-- To enable pg_cron in Supabase:
-- 1. Go to Database → Extensions
-- 2. Enable "pg_cron"
-- 3. Then run this SQL:
/*
SELECT cron.schedule(
    'award-challenge-trophies',
    '0 0 * * *',  -- Run daily at midnight UTC
    $$SELECT check_and_complete_challenges()$$
);
*/

-- ============================================================================
-- ALTERNATIVE: Manual trigger function (runs when challenge status changes)
-- ============================================================================
-- This is a backup - you can manually call check_and_complete_challenges()
-- or set up a webhook/cron job to call it

-- Example: Call this function daily via a cron job or scheduled task
-- SELECT check_and_complete_challenges();

