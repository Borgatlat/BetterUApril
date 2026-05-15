-- Reset Team Challenge Minutes
-- This script will delete workout logs that are contributing to the challenge
-- WARNING: This will permanently delete workout history within the challenge date range

-- First, let's see what workouts will be deleted (run this first to check)
SELECT 
    uwl.id,
    uwl.user_id,
    uwl.duration,
    uwl.completed_at,
    DATE(uwl.completed_at) as workout_date,
    tm.team_id,
    t.name as team_name
FROM user_workout_logs uwl
JOIN team_members tm ON uwl.user_id = tm.user_id
JOIN teams t ON tm.team_id = t.id
WHERE tm.team_id = '6db27a61-e6cb-4370-b8dd-8ab03afa9add'  -- Your team ID
  AND uwl.duration >= 600  -- 10+ minutes
  AND DATE(uwl.completed_at) BETWEEN 
    (SELECT start_date FROM league_challenges WHERE id = 'b597219c-99a8-4eab-a265-074b6b7152c4') AND
    (SELECT end_date FROM league_challenges WHERE id = 'b597219c-99a8-4eab-a265-074b6b7152c4');

-- If the above query shows the workouts you want to delete, run this:
-- DELETE FROM user_workout_logs
-- WHERE id IN (
--     SELECT uwl.id
--     FROM user_workout_logs uwl
--     JOIN team_members tm ON uwl.user_id = tm.user_id
--     WHERE tm.team_id = '6db27a61-e6cb-4370-b8dd-8ab03afa9add'
--       AND uwl.duration >= 600
--       AND DATE(uwl.completed_at) BETWEEN 
--         (SELECT start_date FROM league_challenges WHERE id = 'b597219c-99a8-4eab-a265-074b6b7152c4') AND
--         (SELECT end_date FROM league_challenges WHERE id = 'b597219c-99a8-4eab-a265-074b6b7152c4')
-- );

-- After deleting, reset the challenge progress
-- UPDATE team_challenge_participants
-- SET current_value = 0,
--     rank = NULL,
--     last_updated = NOW()
-- WHERE team_id = '6db27a61-e6cb-4370-b8dd-8ab03afa9add'
--   AND challenge_id = 'b597219c-99a8-4eab-a265-074b6b7152c4';

-- Recalculate ranks for all teams
-- UPDATE team_challenge_participants tcp
-- SET rank = subq.rank
-- FROM (
--     SELECT 
--         team_id,
--         ROW_NUMBER() OVER (ORDER BY current_value DESC, last_updated ASC) as rank
--     FROM team_challenge_participants
--     WHERE challenge_id = 'b597219c-99a8-4eab-a265-074b6b7152c4'
-- ) subq
-- WHERE tcp.team_id = subq.team_id 
-- AND tcp.challenge_id = 'b597219c-99a8-4eab-a265-074b6b7152c4';

