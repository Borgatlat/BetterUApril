-- ============================================================================
-- BetterU Bond Market System
-- This migration creates the complete bond market feature including:
-- - Bond configuration table (interest rates)
-- - User bonds table (active/completed bonds)
-- - Bond transactions table (audit trail)
-- - Functions for purchasing, withdrawing, and calculating payouts
-- - Daily streak check function
-- - RLS policies
-- ============================================================================

-- ============================================================================
-- 1. CREATE BOND_CONFIG TABLE
-- ============================================================================
-- Stores configurable interest rates for each bond tier (not hardcoded)
-- Premium users get better rates stored separately
CREATE TABLE IF NOT EXISTS public.bond_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Bond tier identifier
  bond_tier TEXT NOT NULL UNIQUE CHECK (bond_tier IN ('tier_500', 'tier_1000', 'tier_5000')),
  
  -- Standard user interest rates (as decimals: 0.05 = 5%)
  week_1_rate DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  week_2_rate DECIMAL(5,4) NOT NULL DEFAULT 0.12,
  week_3_rate DECIMAL(5,4) NOT NULL DEFAULT 0.20,
  week_4_rate DECIMAL(5,4) NOT NULL DEFAULT 0.30,
  
  -- Premium user interest rates (better rates)
  premium_week_1_rate DECIMAL(5,4) NOT NULL DEFAULT 0.07,
  premium_week_2_rate DECIMAL(5,4) NOT NULL DEFAULT 0.14,
  premium_week_3_rate DECIMAL(5,4) NOT NULL DEFAULT 0.22,
  premium_week_4_rate DECIMAL(5,4) NOT NULL DEFAULT 0.32,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bond_config_tier ON public.bond_config(bond_tier);

-- Enable Row Level Security
ALTER TABLE public.bond_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone can read, only admins can update (via service role)
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can view bond config" ON public.bond_config;

CREATE POLICY "Anyone can view bond config"
  ON public.bond_config
  FOR SELECT
  USING (true);

-- Only service role can update (admin panel will use service role)
-- Regular users cannot update bond config

-- ============================================================================
-- 2. CREATE USER_BONDS TABLE
-- ============================================================================
-- Tracks all user bonds (active, withdrawn, forfeited)
CREATE TABLE IF NOT EXISTS public.user_bonds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bond details
  bond_amount INTEGER NOT NULL CHECK (bond_amount IN (500, 1000, 5000)),
  bond_tier TEXT NOT NULL CHECK (bond_tier IN ('tier_500', 'tier_1000', 'tier_5000')),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'forfeited')),
  
  -- Timestamps
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  forfeited_at TIMESTAMP WITH TIME ZONE,
  
  -- Week tracking (0 = first week, can't withdraw yet; 1-4 = can withdraw)
  current_week INTEGER NOT NULL DEFAULT 0 CHECK (current_week >= 0 AND current_week <= 4),
  
  -- Streak tracking
  last_streak_check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Withdrawal logic: store day of week (0=Sunday, 6=Saturday)
  purchase_day_of_week INTEGER NOT NULL CHECK (purchase_day_of_week >= 0 AND purchase_day_of_week <= 6),
  
  -- Store interest rates at time of purchase (for historical accuracy)
  interest_rates_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Final payout (null if still active)
  final_payout INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_bonds_user_id ON public.user_bonds(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bonds_status ON public.user_bonds(status);
CREATE INDEX IF NOT EXISTS idx_user_bonds_purchased_at ON public.user_bonds(purchased_at);
CREATE INDEX IF NOT EXISTS idx_user_bonds_user_status ON public.user_bonds(user_id, status);

-- Fix current_week constraint to allow 0 (if table already exists with old constraint)
-- Drop the old constraint if it exists and add the new one
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_bonds_current_week_check' 
    AND conrelid = 'public.user_bonds'::regclass
  ) THEN
    ALTER TABLE public.user_bonds DROP CONSTRAINT user_bonds_current_week_check;
  END IF;
  
  -- Add new constraint allowing 0-4
  ALTER TABLE public.user_bonds 
    ADD CONSTRAINT user_bonds_current_week_check 
    CHECK (current_week >= 0 AND current_week <= 4);
END $$;

-- Update any existing bonds with current_week = 1 to 0 (if they were just created)
-- This handles the case where bonds were created before the fix
UPDATE public.user_bonds 
SET current_week = 0 
WHERE current_week = 1 
  AND status = 'active' 
  AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - purchased_at)) / (7 * 24 * 60 * 60) < 1;

-- Enable Row Level Security
ALTER TABLE public.user_bonds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own bonds" ON public.user_bonds;
DROP POLICY IF EXISTS "Users can view active bonds of others" ON public.user_bonds;
DROP POLICY IF EXISTS "Users can insert their own bonds" ON public.user_bonds;
DROP POLICY IF EXISTS "Users can update their own bonds" ON public.user_bonds;

-- Users can read their own bonds
CREATE POLICY "Users can view their own bonds"
  ON public.user_bonds
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view active bonds of their friends (for profile display)
-- This is handled via a function that checks friendship status
-- For now, we'll allow viewing active bonds of any user (for profile screens)
CREATE POLICY "Users can view active bonds of others"
  ON public.user_bonds
  FOR SELECT
  USING (status = 'active');

-- Users can insert their own bonds (when purchasing)
CREATE POLICY "Users can insert their own bonds"
  ON public.user_bonds
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bonds (for withdrawal)
CREATE POLICY "Users can update their own bonds"
  ON public.user_bonds
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. CREATE BOND_TRANSACTIONS TABLE (Optional - for audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bond_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- References
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bond_id UUID REFERENCES public.user_bonds(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'withdrawal', 'forfeiture')),
  amount INTEGER NOT NULL, -- Neuros amount (negative for purchase, positive for withdrawal)
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bond_transactions_user_id ON public.bond_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bond_transactions_bond_id ON public.bond_transactions(bond_id);
CREATE INDEX IF NOT EXISTS idx_bond_transactions_type ON public.bond_transactions(transaction_type);

-- Enable Row Level Security
ALTER TABLE public.bond_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view their own transactions
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.bond_transactions;

CREATE POLICY "Users can view their own transactions"
  ON public.bond_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only system can insert transactions (via functions)
-- Regular users cannot directly insert

-- ============================================================================
-- 4. FUNCTION: Calculate Bond Payout
-- ============================================================================
-- Calculates the total payout for a bond based on week number and premium status
-- Returns: Total payout amount (principal + cumulative interest)
DROP FUNCTION IF EXISTS public.calculate_bond_payout(TEXT, INTEGER, BOOLEAN);
CREATE OR REPLACE FUNCTION public.calculate_bond_payout(
  p_bond_tier TEXT,
  p_week_number INTEGER,
  p_is_premium BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond_amount INTEGER;
  v_rate DECIMAL(5,4);
  v_cumulative_rate DECIMAL(10,4) := 0;
  v_payout INTEGER;
BEGIN
  -- Determine bond amount from tier
  CASE p_bond_tier
    WHEN 'tier_500' THEN v_bond_amount := 500;
    WHEN 'tier_1000' THEN v_bond_amount := 1000;
    WHEN 'tier_5000' THEN v_bond_amount := 5000;
    ELSE RAISE EXCEPTION 'Invalid bond tier: %', p_bond_tier;
  END CASE;
  
  -- Validate week number
  IF p_week_number < 1 OR p_week_number > 4 THEN
    RAISE EXCEPTION 'Week number must be between 1 and 4';
  END IF;
  
  -- Get interest rates from bond_config
  IF p_is_premium THEN
    SELECT 
      CASE p_week_number
        WHEN 1 THEN premium_week_1_rate
        WHEN 2 THEN premium_week_2_rate
        WHEN 3 THEN premium_week_3_rate
        WHEN 4 THEN premium_week_4_rate
      END
    INTO v_rate
    FROM public.bond_config
    WHERE bond_tier = p_bond_tier;
  ELSE
    SELECT 
      CASE p_week_number
        WHEN 1 THEN week_1_rate
        WHEN 2 THEN week_2_rate
        WHEN 3 THEN week_3_rate
        WHEN 4 THEN week_4_rate
      END
    INTO v_rate
    FROM public.bond_config
    WHERE bond_tier = p_bond_tier;
  END IF;
  
  -- If no config found, use defaults
  IF v_rate IS NULL THEN
    IF p_is_premium THEN
      v_rate := CASE p_week_number
        WHEN 1 THEN 0.07
        WHEN 2 THEN 0.14
        WHEN 3 THEN 0.22
        WHEN 4 THEN 0.32
      END;
    ELSE
      v_rate := CASE p_week_number
        WHEN 1 THEN 0.05
        WHEN 2 THEN 0.12
        WHEN 3 THEN 0.20
        WHEN 4 THEN 0.30
      END;
    END IF;
  END IF;
  
  -- Calculate cumulative rate (the rate represents total return, not incremental)
  -- Week 1: 5% total, Week 2: 12% total, Week 3: 20% total, Week 4: 30% total
  v_cumulative_rate := v_rate;
  
  -- Calculate payout: principal * (1 + cumulative_rate)
  v_payout := ROUND(v_bond_amount * (1 + v_cumulative_rate));
  
  RETURN v_payout;
END;
$$;

-- ============================================================================
-- 5. FUNCTION: Get Bond Withdrawal Eligibility
-- ============================================================================
-- Checks if a bond can be withdrawn (same day of week, after week 1)
DROP FUNCTION IF EXISTS public.get_bond_withdrawal_eligibility(UUID);
CREATE OR REPLACE FUNCTION public.get_bond_withdrawal_eligibility(
  p_bond_id UUID
)
RETURNS TABLE(
  can_withdraw BOOLEAN,
  current_week INTEGER,
  days_until_withdrawal INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_current_day_of_week INTEGER;
  v_days_since_purchase INTEGER;
  v_weeks_since_purchase INTEGER;
BEGIN
  -- Get bond details
  SELECT 
    ub.*,
    EXTRACT(DOW FROM CURRENT_TIMESTAMP)::INTEGER as current_dow
  INTO v_bond
  FROM public.user_bonds ub
  WHERE ub.id = p_bond_id;
  
  -- Check if bond exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'Bond not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if bond is active
  IF v_bond.status != 'active' THEN
    RETURN QUERY SELECT false, v_bond.current_week, 0, 'Bond is not active'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate weeks since purchase
  v_weeks_since_purchase := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_bond.purchased_at)) / (7 * 24 * 60 * 60);
  
  -- Update current_week based on time elapsed
  -- Week 0: 0-1 weeks (can't withdraw), Week 1: 1-2 weeks (can withdraw), etc.
  -- Use FLOOR to get the week number (0, 1, 2, 3, 4)
  v_bond.current_week := LEAST(4, GREATEST(0, FLOOR(v_weeks_since_purchase)::INTEGER));
  
  -- Check if it's the same day of week as purchase
  v_current_day_of_week := EXTRACT(DOW FROM CURRENT_TIMESTAMP)::INTEGER;
  
  -- Calculate days until next withdrawal opportunity
  IF v_current_day_of_week = v_bond.purchase_day_of_week THEN
    -- Same day - can withdraw if week >= 1 (after first week has passed)
    IF v_bond.current_week >= 1 THEN
      RETURN QUERY SELECT true, v_bond.current_week, 0, 'Eligible to withdraw'::TEXT;
    ELSE
      RETURN QUERY SELECT false, v_bond.current_week, 0, 'Must wait until next week (after first week)'::TEXT;
    END IF;
  ELSE
    -- Different day - calculate days until next opportunity
    IF v_current_day_of_week < v_bond.purchase_day_of_week THEN
      v_days_since_purchase := v_bond.purchase_day_of_week - v_current_day_of_week;
    ELSE
      v_days_since_purchase := 7 - (v_current_day_of_week - v_bond.purchase_day_of_week);
    END IF;
    
    RETURN QUERY SELECT false, v_bond.current_week, v_days_since_purchase, 
      format('Can withdraw on %s (same day of week as purchase)', 
        CASE v_bond.purchase_day_of_week
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END)::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- 6. FUNCTION: Purchase Bond
-- ============================================================================
-- Handles bond purchase: deducts Neuros, creates bond record
DROP FUNCTION IF EXISTS public.purchase_bond(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.purchase_bond(
  p_user_id UUID,
  p_bond_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond_amount INTEGER;
  v_user_balance INTEGER;
  v_is_premium BOOLEAN;
  v_bond_id UUID;
  v_interest_rates JSONB;
  v_purchase_day_of_week INTEGER;
  v_config RECORD;
BEGIN
  -- Validate bond tier
  IF p_bond_tier NOT IN ('tier_500', 'tier_1000', 'tier_5000') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid bond tier'
    );
  END IF;
  
  -- Determine bond amount
  CASE p_bond_tier
    WHEN 'tier_500' THEN v_bond_amount := 500;
    WHEN 'tier_1000' THEN v_bond_amount := 1000;
    WHEN 'tier_5000' THEN v_bond_amount := 5000;
  END CASE;
  
  -- Get user balance and premium status
  SELECT 
    COALESCE(neuros_balance, 0),
    COALESCE(is_premium, false)
  INTO v_user_balance, v_is_premium
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Check if user has enough balance
  IF v_user_balance < v_bond_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient Neuros balance'
    );
  END IF;
  
  -- Get interest rates from config
  SELECT * INTO v_config
  FROM public.bond_config
  WHERE bond_tier = p_bond_tier;
  
  -- Build interest rates JSON
  IF v_is_premium THEN
    v_interest_rates := jsonb_build_object(
      'week_1', COALESCE(v_config.premium_week_1_rate, 0.07),
      'week_2', COALESCE(v_config.premium_week_2_rate, 0.14),
      'week_3', COALESCE(v_config.premium_week_3_rate, 0.22),
      'week_4', COALESCE(v_config.premium_week_4_rate, 0.32),
      'is_premium', true
    );
  ELSE
    v_interest_rates := jsonb_build_object(
      'week_1', COALESCE(v_config.week_1_rate, 0.05),
      'week_2', COALESCE(v_config.week_2_rate, 0.12),
      'week_3', COALESCE(v_config.week_3_rate, 0.20),
      'week_4', COALESCE(v_config.week_4_rate, 0.30),
      'is_premium', false
    );
  END IF;
  
  -- Get current day of week (0=Sunday, 6=Saturday)
  v_purchase_day_of_week := EXTRACT(DOW FROM CURRENT_TIMESTAMP)::INTEGER;
  
  -- Deduct Neuros from user balance
  UPDATE public.profiles
  SET neuros_balance = neuros_balance - v_bond_amount
  WHERE id = p_user_id;
  
  -- Create bond record
  INSERT INTO public.user_bonds (
    user_id,
    bond_amount,
    bond_tier,
    status,
    current_week,
    purchase_day_of_week,
    interest_rates_applied,
    last_streak_check_date
  ) VALUES (
    p_user_id,
    v_bond_amount,
    p_bond_tier,
    'active',
    0,
    v_purchase_day_of_week,
    v_interest_rates,
    CURRENT_DATE
  )
  RETURNING id INTO v_bond_id;
  
  -- Record transaction
  INSERT INTO public.bond_transactions (
    user_id,
    bond_id,
    transaction_type,
    amount
  ) VALUES (
    p_user_id,
    v_bond_id,
    'purchase',
    -v_bond_amount
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'bond_id', v_bond_id,
    'bond_amount', v_bond_amount,
    'new_balance', v_user_balance - v_bond_amount
  );
END;
$$;

-- ============================================================================
-- 7. FUNCTION: Withdraw Bond
-- ============================================================================
-- Handles bond withdrawal: calculates payout, adds Neuros, updates bond
DROP FUNCTION IF EXISTS public.withdraw_bond(UUID, UUID);
CREATE OR REPLACE FUNCTION public.withdraw_bond(
  p_user_id UUID,
  p_bond_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_eligibility RECORD;
  v_payout INTEGER;
  v_user_balance INTEGER;
  v_weeks_since_purchase NUMERIC;
BEGIN
  -- Get bond details
  SELECT ub.*, p.is_premium, p.neuros_balance
  INTO v_bond
  FROM public.user_bonds ub
  JOIN public.profiles p ON p.id = ub.user_id
  WHERE ub.id = p_bond_id AND ub.user_id = p_user_id;
  
  -- Check if bond exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bond not found'
    );
  END IF;
  
  -- Check if bond is active
  IF v_bond.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bond is not active'
    );
  END IF;
  
  -- Check withdrawal eligibility
  SELECT * INTO v_eligibility
  FROM public.get_bond_withdrawal_eligibility(p_bond_id);
  
  IF NOT v_eligibility.can_withdraw THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_eligibility.reason,
      'days_until_withdrawal', v_eligibility.days_until_withdrawal
    );
  END IF;
  
  -- Check streak requirement
  -- Get user's streak status
  DECLARE
    v_streak_record RECORD;
    v_last_activity_date DATE;
    v_days_since_activity INTEGER;
  BEGIN
    SELECT 
      COALESCE(last_activity_date, '1970-01-01'::DATE) as last_activity_date
    INTO v_streak_record
    FROM public.user_streaks
    WHERE user_id = p_user_id;
    
    IF FOUND THEN
      v_last_activity_date := v_streak_record.last_activity_date;
      v_days_since_activity := CURRENT_DATE - v_last_activity_date;
      
      -- If streak is broken (more than 1 day since last activity), forfeit bond
      IF v_days_since_activity > 1 THEN
        -- Forfeit bond
        UPDATE public.user_bonds
        SET 
          status = 'forfeited',
          forfeited_at = CURRENT_TIMESTAMP,
          final_payout = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = p_bond_id;
        
        -- Record transaction
        INSERT INTO public.bond_transactions (
          user_id,
          bond_id,
          transaction_type,
          amount
        ) VALUES (
          p_user_id,
          p_bond_id,
          'forfeiture',
          0
        );
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Bond forfeited: Daily activity streak was broken',
          'forfeited', true
        );
      END IF;
    END IF;
  END;
  
  -- Calculate weeks since purchase to determine current week
  v_weeks_since_purchase := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_bond.purchased_at)) / (7 * 24 * 60 * 60);
  -- Week 0: 0-1 weeks, Week 1: 1-2 weeks, etc.
  v_bond.current_week := LEAST(4, GREATEST(0, FLOOR(v_weeks_since_purchase)::INTEGER));
  
  -- For payout calculation, use week 1-4 (not 0-3)
  -- If current_week is 0, use week 1 rate (minimum)
  -- If current_week is 1-4, use that week's rate
  DECLARE
    v_payout_week INTEGER;
    v_bond_is_premium BOOLEAN;
  BEGIN
    v_payout_week := GREATEST(1, v_bond.current_week);
    
    -- IMPORTANT: Use the premium status from when the bond was purchased,
    -- stored in interest_rates_applied.is_premium, NOT the current premium status.
    -- This ensures users get the rates they were promised at purchase time,
    -- regardless of whether their premium status changes later.
    v_bond_is_premium := COALESCE((v_bond.interest_rates_applied->>'is_premium')::BOOLEAN, false);
    
    -- If interest_rates_applied doesn't have is_premium, fall back to current premium status
    -- (for backwards compatibility with bonds purchased before this field was added)
    IF v_bond.interest_rates_applied IS NULL OR NOT (v_bond.interest_rates_applied ? 'is_premium') THEN
      v_bond_is_premium := COALESCE(v_bond.is_premium, false);
    END IF;
    
    -- Calculate payout using the premium status from purchase time
    v_payout := public.calculate_bond_payout(
      v_bond.bond_tier,
      v_payout_week,
      v_bond_is_premium
    );
  END;
  
  -- Add payout to user balance
  UPDATE public.profiles
  SET neuros_balance = neuros_balance + v_payout
  WHERE id = p_user_id
  RETURNING neuros_balance INTO v_user_balance;
  
  -- Update bond status
  UPDATE public.user_bonds
  SET 
    status = 'withdrawn',
    withdrawn_at = CURRENT_TIMESTAMP,
    final_payout = v_payout,
    current_week = v_bond.current_week,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_bond_id;
  
  -- Record transaction
  INSERT INTO public.bond_transactions (
    user_id,
    bond_id,
    transaction_type,
    amount
  ) VALUES (
    p_user_id,
    p_bond_id,
    'withdrawal',
    v_payout
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'payout', v_payout,
    'week', v_bond.current_week,
    'new_balance', v_user_balance
  );
END;
$$;

-- ============================================================================
-- 8. FUNCTION: Check Bond Streaks (Daily Cron Job)
-- ============================================================================
-- This function checks all active bonds and forfeits those with broken streaks
-- Should be run daily via Supabase cron or Edge Function
DROP FUNCTION IF EXISTS public.check_bond_streak_requirements();
CREATE OR REPLACE FUNCTION public.check_bond_streak_requirements()
RETURNS TABLE(
  bonds_checked INTEGER,
  bonds_forfeited INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_streak_record RECORD;
  v_days_since_activity INTEGER;
  v_checked INTEGER := 0;
  v_forfeited INTEGER := 0;
BEGIN
  -- Loop through all active bonds
  FOR v_bond IN 
    SELECT ub.*
    FROM public.user_bonds ub
    WHERE ub.status = 'active'
  LOOP
    v_checked := v_checked + 1;
    
    -- Get user's streak status
    SELECT 
      COALESCE(last_activity_date, '1970-01-01'::DATE) as last_activity_date
    INTO v_streak_record
    FROM public.user_streaks
    WHERE user_id = v_bond.user_id;
    
    -- Calculate days since last activity
    IF FOUND THEN
      v_days_since_activity := CURRENT_DATE - v_streak_record.last_activity_date;
      
      -- If streak is broken (more than 1 day since last activity), forfeit bond
      -- Note: This check also happens automatically in update_user_streak when gap is detected
      IF v_days_since_activity > 1 THEN
        -- Forfeit bond
        UPDATE public.user_bonds
        SET 
          status = 'forfeited',
          forfeited_at = CURRENT_TIMESTAMP,
          final_payout = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = v_bond.id;
        
        -- Record transaction
        INSERT INTO public.bond_transactions (
          user_id,
          bond_id,
          transaction_type,
          amount
        ) VALUES (
          v_bond.user_id,
          v_bond.id,
          'forfeiture',
          0
        );
        
        v_forfeited := v_forfeited + 1;
      ELSE
        -- Update last streak check date
        UPDATE public.user_bonds
        SET 
          last_streak_check_date = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = v_bond.id;
      END IF;
    ELSE
      -- No streak record - forfeit bond (user has never completed an activity)
      UPDATE public.user_bonds
      SET 
        status = 'forfeited',
        forfeited_at = CURRENT_TIMESTAMP,
        final_payout = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      
      INSERT INTO public.bond_transactions (
        user_id,
        bond_id,
        transaction_type,
        amount
      ) VALUES (
        v_bond.user_id,
        v_bond.id,
        'forfeiture',
        0
      );
      
      v_forfeited := v_forfeited + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_checked, v_forfeited;
END;
$$;

-- ============================================================================
-- 9. FUNCTION: Update Bond Current Week
-- ============================================================================
-- Helper function to update current_week for all active bonds
-- Should be called periodically to keep weeks accurate
DROP FUNCTION IF EXISTS public.update_bond_weeks();
CREATE OR REPLACE FUNCTION public.update_bond_weeks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_weeks_since_purchase NUMERIC;
  v_new_week INTEGER;
  v_updated INTEGER := 0;
BEGIN
  FOR v_bond IN 
    SELECT id, purchased_at, current_week
    FROM public.user_bonds
    WHERE status = 'active'
  LOOP
    -- Calculate weeks since purchase
    v_weeks_since_purchase := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_bond.purchased_at)) / (7 * 24 * 60 * 60);
    -- Week 0: 0-1 weeks, Week 1: 1-2 weeks, etc.
    v_new_week := LEAST(4, GREATEST(0, FLOOR(v_weeks_since_purchase)::INTEGER));
    
    -- Update if week changed
    IF v_new_week != v_bond.current_week THEN
      UPDATE public.user_bonds
      SET 
        current_week = v_new_week,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  
  RETURN v_updated;
END;
$$;

-- ============================================================================
-- 10. INSERT DEFAULT BOND CONFIG
-- ============================================================================
-- Insert default interest rates for all three bond tiers
INSERT INTO public.bond_config (bond_tier, week_1_rate, week_2_rate, week_3_rate, week_4_rate, premium_week_1_rate, premium_week_2_rate, premium_week_3_rate, premium_week_4_rate)
VALUES 
  ('tier_500', 0.05, 0.12, 0.20, 0.30, 0.07, 0.14, 0.22, 0.32),
  ('tier_1000', 0.05, 0.12, 0.20, 0.30, 0.07, 0.14, 0.22, 0.32),
  ('tier_5000', 0.05, 0.12, 0.20, 0.30, 0.07, 0.14, 0.22, 0.32)
ON CONFLICT (bond_tier) DO NOTHING;

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================
-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_bond_payout(TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bond_withdrawal_eligibility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_bond(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_bond(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_bond_streak_requirements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_bond_weeks() TO authenticated;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Daily Cron Job Setup:
--    - Set up a Supabase cron job or Edge Function to call check_bond_streak_requirements() daily
--    - Example cron expression: "0 0 * * *" (midnight UTC daily)
--    - Also call update_bond_weeks() to keep week numbers accurate
--
-- 2. Interest Rate Calculation:
--    - Rates are cumulative (not incremental)
--    - Week 1: 5% total return (500 bond = 525 payout)
--    - Week 2: 12% total return (500 bond = 560 payout)
--    - Week 3: 20% total return (500 bond = 600 payout)
--    - Week 4: 30% total return (500 bond = 650 payout)
--
-- 3. Withdrawal Rules:
--    - Can only withdraw on the same day of week as purchase
--    - Must wait at least 1 week (can withdraw starting week 1)
--    - Must maintain daily activity streak or bond is forfeited
--
-- 4. Streak Requirement:
--    - Bond is forfeited if user's streak is broken (last_activity_date > 1 day ago)
--    - Checked daily via cron job and on withdrawal attempt
--
-- 5. Premium Users:
--    - Get better interest rates (stored in premium_week_X_rate columns)
--    - Rates are fetched based on profiles.is_premium flag
-- ============================================================================
