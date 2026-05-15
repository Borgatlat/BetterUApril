-- Make the Sparks award function more robust
-- Only mark sparks_awarded as true if BOTH users successfully received Sparks

DROP FUNCTION IF EXISTS award_referral_sparks_immediate(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION award_referral_sparks_immediate(
    p_referrer_id UUID,
    p_referred_id UUID,
    p_referral_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_updated INTEGER := 0;
    v_referred_updated INTEGER := 0;
    v_both_succeeded BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Verify both profiles exist first
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Referrer profile not found',
            'referrer_id', p_referrer_id
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referred_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Referred user profile not found',
            'referred_id', p_referred_id
        );
    END IF;
    
    -- Award 3 Sparks to the referrer (person who shared the code)
    UPDATE profiles 
    SET sparks_balance = COALESCE(sparks_balance, 0) + 3
    WHERE id = p_referrer_id;
    
    GET DIAGNOSTICS v_referrer_updated = ROW_COUNT;
    
    -- Award 3 Sparks to the referred user (person who used the code)
    UPDATE profiles 
    SET sparks_balance = COALESCE(sparks_balance, 0) + 3
    WHERE id = p_referred_id;
    
    GET DIAGNOSTICS v_referred_updated = ROW_COUNT;
    
    -- Only mark as awarded if BOTH updates succeeded
    v_both_succeeded := (v_referrer_updated > 0) AND (v_referred_updated > 0);
    
    IF v_both_succeeded THEN
        -- Mark sparks as awarded in referral record
        UPDATE referrals
        SET sparks_awarded = true
        WHERE id = p_referral_id;
    END IF;
    
    -- Return detailed result
    v_result := jsonb_build_object(
        'success', v_both_succeeded,
        'referrer_updated', v_referrer_updated > 0,
        'referred_updated', v_referred_updated > 0,
        'referrer_id', p_referrer_id,
        'referred_id', p_referred_id,
        'sparks_awarded', v_both_succeeded
    );
    
    -- If one failed, include error info
    IF NOT v_both_succeeded THEN
        v_result := v_result || jsonb_build_object(
            'error', 'One or both Spark updates failed',
            'referrer_rows', v_referrer_updated,
            'referred_rows', v_referred_updated
        );
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information without marking as awarded
        RETURN jsonb_build_object(
            'success', false,
            'error', true,
            'message', SQLERRM,
            'sqlstate', SQLSTATE,
            'referrer_updated', v_referrer_updated > 0,
            'referred_updated', v_referred_updated > 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set the function owner to postgres for superuser permissions
ALTER FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) OWNER TO postgres;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION award_referral_sparks_immediate(UUID, UUID, UUID) IS 
'Awards 3 Sparks to both referrer and referred user immediately. Only marks sparks_awarded=true if BOTH updates succeed. Returns detailed results for debugging.';

