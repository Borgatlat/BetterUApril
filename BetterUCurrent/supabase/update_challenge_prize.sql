-- Update prize description for the active challenge
-- Replace 'YOUR_PRIZE_DESCRIPTION_HERE' with your desired prize text

UPDATE league_challenges
SET prize_description = 'YOUR_PRIZE_DESCRIPTION_HERE'
WHERE id = (
    SELECT id 
    FROM league_challenges 
    WHERE status = 'active' 
    ORDER BY created_at DESC 
    LIMIT 1
);

-- Or update a specific challenge by name:
-- UPDATE league_challenges
-- SET prize_description = 'YOUR_PRIZE_DESCRIPTION_HERE'
-- WHERE name = 'November 2025 Workout Minutes Challenge';

-- Verify the update
SELECT 
    id,
    name,
    status,
    prize_description,
    start_date,
    end_date
FROM league_challenges
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 1;

