-- Update Referral Reward to 50 Neuros
-- Changes the referral reward from 3 neuros to 50 neuros for both referrer and referred user

-- ============================================================================
-- 1. UPDATE REFERRAL TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION award_referral_sparks()
RETURNS TRIGGER AS $$
BEGIN
    -- Only award if status changed to 'completed' and sparks haven't been awarded yet
    IF NEW.status = 'completed' AND NEW.sparks_awarded = false AND OLD.status != 'completed' THEN
        -- Award 50 neuros to the referrer (person who shared the code)
        UPDATE profiles 
        SET neuros_balance = COALESCE(neuros_balance, 0) + 50
        WHERE id = NEW.referrer_id;
        
        -- Award 50 neuros to the referred user (person who used the code)
        UPDATE profiles 
        SET neuros_balance = COALESCE(neuros_balance, 0) + 50
        WHERE id = NEW.referred_id;
        
        -- Mark sparks as awarded
        NEW.sparks_awarded = true;
        NEW.completed_at = timezone('utc'::text, now());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. UPDATE IMMEDIATE AWARD FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION award_referral_sparks_immediate(
    p_referrer_id UUID,
    p_referred_id UUID,
    p_referral_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_updated BOOLEAN := false;
    v_referred_updated BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Award 50 Neuros to the referrer (person who shared the code)
    UPDATE profiles 
    SET neuros_balance = COALESCE(neuros_balance, 0) + 50
    WHERE id = p_referrer_id;
    
    GET DIAGNOSTICS v_referrer_updated = ROW_COUNT;
    
    -- Award 50 Neuros to the referred user (person who used the code)
    UPDATE profiles 
    SET neuros_balance = COALESCE(neuros_balance, 0) + 50
    WHERE id = p_referred_id;
    
    GET DIAGNOSTICS v_referred_updated = ROW_COUNT;
    
    -- Mark sparks as awarded in referral record
    UPDATE referrals
    SET sparks_awarded = true
    WHERE id = p_referral_id;
    
    -- Return result showing what was updated
    v_result := jsonb_build_object(
        'success', true,
        'referrer_updated', v_referrer_updated > 0,
        'referred_updated', v_referred_updated > 0,
        'referrer_id', p_referrer_id,
        'referred_id', p_referred_id
    );
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'error', true,
            'message', SQLERRM,
            'referrer_updated', v_referrer_updated > 0,
            'referred_updated', v_referred_updated > 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function comments
COMMENT ON FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) IS 
'Awards 50 Neuros to both referrer and referred user immediately when a referral code is used. Uses SECURITY DEFINER with postgres owner to bypass RLS and update any profile.';

COMMENT ON FUNCTION award_referral_sparks() IS 'Awards 50 Neuros to both the referrer and the referred user when a referral is completed';

