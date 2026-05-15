-- Fix the Sparks award function to ensure it can update any profile
-- This ensures the function owner has proper permissions

-- Drop and recreate the function with explicit owner
DROP FUNCTION IF EXISTS award_referral_sparks_immediate(UUID, UUID, UUID);

-- Recreate the function with proper permissions
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
    -- Award 3 Sparks to the referrer (person who shared the code)
    -- Use SECURITY DEFINER to bypass RLS
    UPDATE profiles 
    SET sparks_balance = COALESCE(sparks_balance, 0) + 3
    WHERE id = p_referrer_id;
    
    GET DIAGNOSTICS v_referrer_updated = ROW_COUNT;
    
    -- Award 3 Sparks to the referred user (person who used the code)
    UPDATE profiles 
    SET sparks_balance = COALESCE(sparks_balance, 0) + 3
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

-- Set the function owner to postgres (superuser) to ensure it can update any profile
ALTER FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) OWNER TO postgres;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) IS 
'Awards 3 Sparks to both referrer and referred user immediately when a referral code is used. Uses SECURITY DEFINER with postgres owner to bypass RLS and update any profile.';

