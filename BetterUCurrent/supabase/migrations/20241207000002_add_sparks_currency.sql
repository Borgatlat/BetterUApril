-- Add Sparks currency balance to profiles
-- Sparks are earned through referrals and can be spent on profile themes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sparks_balance INTEGER DEFAULT 0;

COMMENT ON COLUMN profiles.sparks_balance IS 'In-app currency earned through referrals, used to purchase profile themes';

CREATE INDEX IF NOT EXISTS idx_profiles_sparks ON profiles(sparks_balance);

-- Add purchased themes tracking
-- Stores array of theme keys that the user has purchased
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purchased_themes TEXT[] DEFAULT '{}';

COMMENT ON COLUMN profiles.purchased_themes IS 'Array of theme keys that the user has purchased with Sparks';

-- Create referrals table to track referral relationships
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    referral_code TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    sparks_awarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(referred_id) -- A user can only be referred once
);

COMMENT ON TABLE referrals IS 'Tracks referral relationships and rewards';
COMMENT ON COLUMN referrals.referrer_id IS 'User who made the referral';
COMMENT ON COLUMN referrals.referred_id IS 'User who was referred';
COMMENT ON COLUMN referrals.referral_code IS 'The code used for this referral';
COMMENT ON COLUMN referrals.status IS 'pending = signed up but not active, completed = active user';
COMMENT ON COLUMN referrals.sparks_awarded IS 'Whether sparks have been awarded for this referral';

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Function to award sparks when a referral is completed
CREATE OR REPLACE FUNCTION award_referral_sparks()
RETURNS TRIGGER AS $$
BEGIN
    -- Only award if status changed to 'completed' and sparks haven't been awarded yet
    IF NEW.status = 'completed' AND NEW.sparks_awarded = false AND OLD.status != 'completed' THEN
        -- Award 3 sparks to the referrer (person who shared the code)
        UPDATE profiles 
        SET sparks_balance = sparks_balance + 3
        WHERE id = NEW.referrer_id;
        
        -- Award 3 sparks to the referred user (person who used the code)
        UPDATE profiles 
        SET sparks_balance = sparks_balance + 3
        WHERE id = NEW.referred_id;
        
        -- Mark sparks as awarded
        NEW.sparks_awarded = true;
        NEW.completed_at = timezone('utc'::text, now());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically award sparks when referral is completed
CREATE TRIGGER trigger_award_referral_sparks
    BEFORE UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION award_referral_sparks();

-- RLS Policies for referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer)
CREATE POLICY "Users can view their own referrals"
    ON referrals FOR SELECT
    USING (auth.uid() = referrer_id);

-- Users can view referrals where they were referred
CREATE POLICY "Users can view referrals where they were referred"
    ON referrals FOR SELECT
    USING (auth.uid() = referred_id);

-- Users can insert referrals when they are the referred user (during onboarding)
CREATE POLICY "Users can create referrals for themselves"
    ON referrals FOR INSERT
    WITH CHECK (auth.uid() = referred_id);

-- Service role can insert/update referrals (for backend operations)
CREATE POLICY "Service role can manage referrals"
    ON referrals FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

