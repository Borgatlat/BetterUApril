-- Update referral sparks function to award Sparks to both referrer and referred user
-- Both users get 3 Sparks when a referral is completed

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

COMMENT ON FUNCTION award_referral_sparks() IS 'Awards 3 Sparks to both the referrer and the referred user when a referral is completed';

