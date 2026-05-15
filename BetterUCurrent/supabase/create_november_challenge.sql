-- OLD FILE - Use create_november_2025_challenge.sql instead
-- This file is kept for reference but should not be used

-- Delete November 2024 challenge (if it exists) without awarding trophies
DELETE FROM league_challenges
WHERE name = 'November 2024 Workout Minutes Challenge'
AND status != 'completed';  -- Only delete if not already completed

-- Create November 2025 Workout Minutes Challenge
-- Prize: 1st place = 1 month premium, 2nd place = 2 weeks premium, 3rd place = 1 week premium

INSERT INTO league_challenges (
    challenge_type,
    name,
    description,
    start_date,
    end_date,
    status,
    prize_description
) VALUES (
    'workout_minutes',
    'November 2025 Workout Minutes Challenge',
    'Compete with teams worldwide in November''s workout minutes challenge! Train hard, earn trophies, and win premium subscriptions!',
    '2025-11-01',
    '2025-11-30',
    'active',
    '🏆 1st Place: 1 month Premium free | 🥈 2nd Place: 2 weeks Premium free | 🥉 3rd Place: 1 week Premium free'
)
RETURNING id, name, start_date, end_date, status;

-- Auto-enroll all existing teams in this challenge
INSERT INTO team_challenge_participants (challenge_id, team_id, current_value)
SELECT 
    (SELECT id FROM league_challenges WHERE name = 'November 2025 Workout Minutes Challenge' ORDER BY created_at DESC LIMIT 1),
    id,
    0
FROM teams
ON CONFLICT (challenge_id, team_id) DO NOTHING;

-- Verify the challenge was created
SELECT 
    id,
    name,
    challenge_type,
    start_date,
    end_date,
    status,
    prize_description,
    (SELECT COUNT(*) FROM team_challenge_participants WHERE challenge_id = league_challenges.id) as enrolled_teams
FROM league_challenges
WHERE name = 'November 2025 Workout Minutes Challenge'
ORDER BY created_at DESC
LIMIT 1;

