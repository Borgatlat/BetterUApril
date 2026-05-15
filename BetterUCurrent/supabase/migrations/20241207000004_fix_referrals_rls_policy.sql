-- Fix RLS policy for referrals table to allow users to insert referrals during onboarding
-- This allows new users to create referral records when they use a referral code

-- Drop the policy if it already exists (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can create referrals for themselves" ON referrals;

-- Add policy to allow users to insert referrals when they are the referred user
CREATE POLICY "Users can create referrals for themselves"
    ON referrals FOR INSERT
    WITH CHECK (auth.uid() = referred_id);

