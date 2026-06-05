-- Promo Codes System
-- This migration creates tables for promo codes and their redemptions
-- Promo codes can award neuros (currency), badges, or other rewards

-- ============================================================================
-- 1. PROMO CODES TABLE
-- ============================================================================
-- Stores all available promo codes with their rewards and restrictions
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Code identification
  code TEXT NOT NULL UNIQUE, -- The actual promo code users enter (e.g., "WELCOME2024")
  code_uppercase TEXT NOT NULL UNIQUE, -- Uppercase version for case-insensitive matching
  
  -- Reward configuration
  reward_type TEXT NOT NULL CHECK (reward_type IN ('neuros', 'badge', 'both')), -- Type of reward
  neuros_amount INTEGER DEFAULT 0, -- Amount of neuros to award (if reward_type is 'neuros' or 'both')
  badge_id UUID REFERENCES public.badge_definitions(id) ON DELETE SET NULL, -- Badge to award (if reward_type is 'badge' or 'both')
  
  -- Code restrictions
  max_uses INTEGER, -- Maximum number of times this code can be used (NULL = unlimited)
  max_uses_per_user INTEGER DEFAULT 1, -- Maximum times a single user can use this code
  is_active BOOLEAN DEFAULT true NOT NULL, -- Whether the code is currently active
  expires_at TIMESTAMP WITH TIME ZONE, -- When the code expires (NULL = never expires)
  
  -- Metadata
  description TEXT, -- Description of what this promo code gives
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin who created the code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code_uppercase ON public.promo_codes(code_uppercase);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_codes_expires_at ON public.promo_codes(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.promo_codes IS 'Stores all promo codes that can be redeemed by users';
COMMENT ON COLUMN public.promo_codes.code IS 'The actual promo code text (case-sensitive for display)';
COMMENT ON COLUMN public.promo_codes.code_uppercase IS 'Uppercase version for case-insensitive matching';
COMMENT ON COLUMN public.promo_codes.reward_type IS 'Type of reward: neuros (currency), badge, or both';
COMMENT ON COLUMN public.promo_codes.neuros_amount IS 'Amount of neuros to award when code is redeemed';
COMMENT ON COLUMN public.promo_codes.badge_id IS 'Badge to award when code is redeemed';
COMMENT ON COLUMN public.promo_codes.max_uses IS 'Maximum total uses across all users (NULL = unlimited)';
COMMENT ON COLUMN public.promo_codes.max_uses_per_user IS 'Maximum times a single user can redeem this code';

-- ============================================================================
-- 2. PROMO CODE REDEMPTIONS TABLE
-- ============================================================================
-- Tracks which users have redeemed which promo codes
CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and code relationship
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  
  -- Redemption details
  code_used TEXT NOT NULL, -- The actual code text that was entered (for audit trail)
  neuros_awarded INTEGER DEFAULT 0, -- Amount of neuros actually awarded
  badge_awarded_id UUID REFERENCES public.badge_definitions(id) ON DELETE SET NULL, -- Badge that was awarded
  
  -- Timestamp
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Prevent duplicate redemptions per user per code (enforced by unique constraint)
  CONSTRAINT promo_code_redemptions_user_code_unique UNIQUE(user_id, promo_code_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user_id ON public.promo_code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo_code_id ON public.promo_code_redemptions(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_redeemed_at ON public.promo_code_redemptions(redeemed_at DESC);

COMMENT ON TABLE public.promo_code_redemptions IS 'Tracks promo code redemptions by users';
COMMENT ON COLUMN public.promo_code_redemptions.code_used IS 'The actual code text entered (for audit purposes)';
COMMENT ON COLUMN public.promo_code_redemptions.neuros_awarded IS 'Amount of neuros actually awarded to this user';
COMMENT ON COLUMN public.promo_code_redemptions.badge_awarded_id IS 'Badge ID that was awarded to this user';

-- ============================================================================
-- 3. FUNCTION TO REDEEM PROMO CODE
-- ============================================================================
-- This function handles the entire redemption process:
-- 1. Validates the code
-- 2. Checks if user already redeemed it
-- 3. Checks usage limits
-- 4. Awards rewards (neuros and/or badge)
-- 5. Records the redemption
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo_code RECORD;
  v_redemption_count INTEGER;
  v_user_redemption_count INTEGER;
  v_neuros_balance INTEGER;
  v_badge_exists BOOLEAN;
  v_redemption_id UUID;
  v_result JSONB;
BEGIN
  -- Normalize code to uppercase for lookup
  p_code := UPPER(TRIM(p_code));
  
  -- Find the promo code
  SELECT * INTO v_promo_code
  FROM public.promo_codes
  WHERE code_uppercase = p_code;
  
  -- Check if code exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_CODE',
      'message', 'This promo code does not exist'
    );
  END IF;
  
  -- Check if code is active
  IF NOT v_promo_code.is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INACTIVE_CODE',
      'message', 'This promo code is no longer active'
    );
  END IF;
  
  -- Check if code has expired
  IF v_promo_code.expires_at IS NOT NULL AND v_promo_code.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXPIRED_CODE',
      'message', 'This promo code has expired'
    );
  END IF;
  
  -- Check total usage limit
  IF v_promo_code.max_uses IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redemption_count
    FROM public.promo_code_redemptions
    WHERE promo_code_id = v_promo_code.id;
    
    IF v_redemption_count >= v_promo_code.max_uses THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'MAX_USES_REACHED',
        'message', 'This promo code has reached its maximum usage limit'
      );
    END IF;
  END IF;
  
  -- Check if user has already redeemed this code
  -- This check prevents unnecessary processing and provides a clear error message
  SELECT COUNT(*) INTO v_user_redemption_count
  FROM public.promo_code_redemptions
  WHERE user_id = p_user_id
    AND promo_code_id = v_promo_code.id;
  
  IF v_user_redemption_count >= v_promo_code.max_uses_per_user THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_REDEEMED',
      'message', 'You have already redeemed this promo code'
    );
  END IF;
  
  -- Award neuros if applicable
  IF v_promo_code.reward_type IN ('neuros', 'both') AND v_promo_code.neuros_amount > 0 THEN
    -- Update balance
    UPDATE public.profiles
    SET neuros_balance = COALESCE(neuros_balance, 0) + v_promo_code.neuros_amount
    WHERE id = p_user_id;
  END IF;
  
  -- Award badge if applicable
  IF v_promo_code.reward_type IN ('badge', 'both') AND v_promo_code.badge_id IS NOT NULL THEN
    -- Check if badge exists
    SELECT EXISTS(
      SELECT 1 FROM public.badge_definitions WHERE id = v_promo_code.badge_id
    ) INTO v_badge_exists;
    
    IF v_badge_exists THEN
      -- Insert badge award (ON CONFLICT prevents duplicates)
      INSERT INTO public.user_badges (user_id, badge_id, earned_at, is_displayed)
      VALUES (p_user_id, v_promo_code.badge_id, NOW(), false)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Record the redemption
  -- The unique constraint (user_id, promo_code_id) ensures one-time use per user
  -- ON CONFLICT handles race conditions where user tries to redeem simultaneously
  INSERT INTO public.promo_code_redemptions (
    user_id,
    promo_code_id,
    code_used,
    neuros_awarded,
    badge_awarded_id
  )
  VALUES (
    p_user_id,
    v_promo_code.id,
    v_promo_code.code, -- Store original case for audit
    COALESCE(v_promo_code.neuros_amount, 0),
    v_promo_code.badge_id
  )
  ON CONFLICT (user_id, promo_code_id) 
  DO NOTHING
  RETURNING id INTO v_redemption_id;
  
  -- If v_redemption_id is NULL, it means ON CONFLICT was triggered (user already redeemed)
  -- This handles race conditions where two requests come in simultaneously
  IF v_redemption_id IS NULL THEN
    -- Rollback the rewards we just awarded
    IF v_promo_code.reward_type IN ('neuros', 'both') AND v_promo_code.neuros_amount > 0 THEN
      UPDATE public.profiles
      SET neuros_balance = GREATEST(COALESCE(neuros_balance, 0) - v_promo_code.neuros_amount, 0)
      WHERE id = p_user_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_REDEEMED',
      'message', 'You have already redeemed this promo code'
    );
  END IF;
  
  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'neuros_awarded', COALESCE(v_promo_code.neuros_amount, 0),
    'badge_awarded', v_promo_code.badge_id IS NOT NULL,
    'badge_id', v_promo_code.badge_id,
    'description', v_promo_code.description
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REDEMPTION_ERROR',
      'message', 'An error occurred while redeeming the promo code: ' || SQLERRM
    );
END;
$$;

-- Set function owner and permissions
ALTER FUNCTION public.redeem_promo_code(TEXT, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.redeem_promo_code(TEXT, UUID) IS 
'Redeems a promo code for a user. Validates the code, checks limits, awards rewards (neuros and/or badge), and records the redemption. Returns JSONB with success status and reward details.';

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on promo codes table
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Users can view active promo codes (for validation, but they'll use the function)
CREATE POLICY "Users can view active promo codes"
  ON public.promo_codes FOR SELECT
  USING (is_active = true);

-- Service role can manage all promo codes
CREATE POLICY "Service role can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable RLS on redemptions table
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions"
  ON public.promo_code_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own redemptions (via the function)
CREATE POLICY "Users can insert own redemptions"
  ON public.promo_code_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all redemptions
CREATE POLICY "Service role can manage redemptions"
  ON public.promo_code_redemptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

