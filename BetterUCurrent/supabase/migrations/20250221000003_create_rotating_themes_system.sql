-- Rotating Theme System
-- Allows devs to add themes remotely, rotates 5 themes weekly per user
-- Each user gets randomized rarity slots (50% common, 30% rare, 15% epic, 4.9% legendary, 0.1% mythic)

-- ============================================================================
-- 1. THEME BANK TABLE
-- ============================================================================
-- Stores all available themes that can be rotated (added remotely by devs)
CREATE TABLE IF NOT EXISTS public.theme_bank (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Theme identification
  name TEXT NOT NULL, -- Display name (e.g., "Cosmic Purple", "Neon Dreams")
  theme_key TEXT NOT NULL UNIQUE, -- Unique identifier (e.g., "cosmic_purple_001")
  
  -- Theme image (from Cloudinary or Google Drive) - NULL for color-only themes
  image_url TEXT, -- Full URL to theme image (NULL for color-only themes that use background_color)
  
  -- Theme properties (for rendering)
  background_color TEXT, -- Hex color (e.g., "#4a0e4e")
  gradient_colors TEXT[], -- Array of gradient colors (e.g., ["#4a0e4e", "#1a0a1e"])
  
  -- Metadata
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
  neuros_cost INTEGER NOT NULL DEFAULT 0, -- Cost in neuros (can vary by rarity)
  description TEXT, -- Optional description
  
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL, -- Can disable without deleting
  is_rotating BOOLEAN DEFAULT true NOT NULL, -- Whether this theme can appear in rotations
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_theme_bank_active ON public.theme_bank(is_active, is_rotating) WHERE is_active = true AND is_rotating = true;
CREATE INDEX IF NOT EXISTS idx_theme_bank_rarity ON public.theme_bank(rarity) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_theme_bank_key ON public.theme_bank(theme_key);

COMMENT ON TABLE public.theme_bank IS 'Bank of all available themes that can be rotated. Devs can add themes remotely via Cloudinary/Google Drive links.';
COMMENT ON COLUMN public.theme_bank.image_url IS 'Full URL to theme image (Cloudinary or Google Drive)';
COMMENT ON COLUMN public.theme_bank.rarity IS 'Base rarity of the theme. User slots will have randomized rarities.';
COMMENT ON COLUMN public.theme_bank.is_rotating IS 'Whether this theme can appear in weekly rotations';

-- ============================================================================
-- 2. THEME ROTATIONS TABLE
-- ============================================================================
-- Tracks weekly rotation periods
CREATE TABLE IF NOT EXISTS public.theme_rotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Rotation period
  week_start_date DATE NOT NULL, -- Start of rotation week (typically Monday)
  week_end_date DATE NOT NULL, -- End of rotation week (typically Sunday)
  rotation_number INTEGER NOT NULL UNIQUE, -- Sequential rotation number
  
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL, -- Current active rotation
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure dates are valid
  CONSTRAINT check_rotation_dates CHECK (week_end_date >= week_start_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_theme_rotations_active ON public.theme_rotations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_theme_rotations_dates ON public.theme_rotations(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_theme_rotations_number ON public.theme_rotations(rotation_number);

COMMENT ON TABLE public.theme_rotations IS 'Tracks weekly rotation periods. Each week, users get 5 new themes assigned.';

-- ============================================================================
-- 3. USER THEME SLOTS TABLE
-- ============================================================================
-- Stores which themes each user sees in their 5 slots for each rotation
-- Each user gets randomized rarity slots per week
CREATE TABLE IF NOT EXISTS public.user_theme_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and rotation
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rotation_id UUID NOT NULL REFERENCES public.theme_rotations(id) ON DELETE CASCADE,
  
  -- Slot information
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 5), -- Slot 1-5
  theme_id UUID NOT NULL REFERENCES public.theme_bank(id) ON DELETE CASCADE, -- Which theme
  
  -- User-specific rarity (randomized per user per slot)
  slot_rarity TEXT NOT NULL CHECK (slot_rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
  
  -- Pricing (can vary based on slot_rarity)
  neuros_cost INTEGER NOT NULL DEFAULT 0, -- Cost for this user's slot
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure one slot per user per rotation per slot number
  UNIQUE(user_id, rotation_id, slot_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_theme_slots_user_rotation ON public.user_theme_slots(user_id, rotation_id);
CREATE INDEX IF NOT EXISTS idx_user_theme_slots_theme ON public.user_theme_slots(theme_id);
CREATE INDEX IF NOT EXISTS idx_user_theme_slots_rarity ON public.user_theme_slots(slot_rarity);

COMMENT ON TABLE public.user_theme_slots IS 'Stores the 5 theme slots each user sees per rotation. Each slot has a randomized rarity per user.';
COMMENT ON COLUMN public.user_theme_slots.slot_rarity IS 'Randomized rarity for this user''s slot (50% common, 30% rare, 15% epic, 4.9% legendary, 0.1% mythic)';
COMMENT ON COLUMN public.user_theme_slots.neuros_cost IS 'Cost in neuros for this specific slot (can vary by rarity)';

-- ============================================================================
-- 4. RARITY PRICING TABLE
-- ============================================================================
-- Defines pricing for each rarity level (can be updated remotely)
CREATE TABLE IF NOT EXISTS public.rarity_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Rarity level
  rarity TEXT NOT NULL UNIQUE CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
  
  -- Pricing
  neuros_cost INTEGER NOT NULL DEFAULT 0, -- Base cost for this rarity
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default rarity pricing
INSERT INTO public.rarity_pricing (rarity, neuros_cost) VALUES
  ('common', 10),
  ('rare', 25),
  ('epic', 50),
  ('legendary', 100),
  ('mythic', 500)
ON CONFLICT (rarity) DO UPDATE
SET neuros_cost = EXCLUDED.neuros_cost,
    updated_at = timezone('utc'::text, now());

COMMENT ON TABLE public.rarity_pricing IS 'Defines pricing for each rarity level. Can be updated remotely without code changes.';

-- ============================================================================
-- 5. HELPER FUNCTION: GET CURRENT ROTATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_rotation()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rotation_id UUID;
BEGIN
  SELECT id INTO v_rotation_id
  FROM public.theme_rotations
  WHERE is_active = true
    AND week_start_date <= CURRENT_DATE
    AND week_end_date >= CURRENT_DATE
  ORDER BY rotation_number DESC
  LIMIT 1;
  
  RETURN v_rotation_id;
END;
$$;

COMMENT ON FUNCTION public.get_current_rotation() IS 'Returns the ID of the currently active rotation, or NULL if none exists.';

-- ============================================================================
-- 6. HELPER FUNCTION: ASSIGN USER THEME SLOTS
-- ============================================================================
-- This function assigns 5 themes to a user for a rotation with randomized rarities
-- Rarity distribution: 50% common, 30% rare, 15% epic, 4.9% legendary, 0.1% mythic
CREATE OR REPLACE FUNCTION public.assign_user_theme_slots(
  p_user_id UUID,
  p_rotation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot INTEGER;
  v_random_value NUMERIC;
  v_rarity TEXT;
  v_theme_id UUID;
  v_neuros_cost INTEGER;
  v_available_themes UUID[];
  v_selected_themes UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Get all active rotating themes
  SELECT ARRAY_AGG(id) INTO v_available_themes
  FROM public.theme_bank
  WHERE is_active = true AND is_rotating = true;
  
  -- If no themes available, return
  IF v_available_themes IS NULL OR array_length(v_available_themes, 1) = 0 THEN
    RAISE EXCEPTION 'No themes available for rotation';
  END IF;
  
  -- Assign 5 slots
  FOR v_slot IN 1..5 LOOP
    -- Generate random value (0-100)
    v_random_value := random() * 100;
    
    -- Determine rarity based on distribution
    -- 50% common (0-50), 30% rare (50-80), 15% epic (80-95), 4.9% legendary (95-99.9), 0.1% mythic (99.9-100)
    IF v_random_value < 50 THEN
      v_rarity := 'common';
    ELSIF v_random_value < 80 THEN
      v_rarity := 'rare';
    ELSIF v_random_value < 95 THEN
      v_rarity := 'epic';
    ELSIF v_random_value < 99.9 THEN
      v_rarity := 'legendary';
    ELSE
      v_rarity := 'mythic';
    END IF;
    
    -- Get cost for this rarity
    SELECT neuros_cost INTO v_neuros_cost
    FROM public.rarity_pricing
    WHERE rarity = v_rarity;
    
    -- Select a random theme that hasn't been selected yet
    -- If we've used all themes, allow repeats
    IF array_length(v_selected_themes, 1) >= array_length(v_available_themes, 1) THEN
      v_selected_themes := ARRAY[]::UUID[];
    END IF;
    
    -- Pick a random theme from available themes, excluding already selected
    -- Use array_agg with unnest in FROM clause, then filter
    SELECT theme_id INTO v_theme_id
    FROM (
      SELECT unnest(v_available_themes) AS theme_id
    ) available
    WHERE theme_id != ALL(v_selected_themes)
    ORDER BY random()
    LIMIT 1;
    
    -- If no unique theme found, pick any random theme
    IF v_theme_id IS NULL THEN
      SELECT theme_id INTO v_theme_id
      FROM (
        SELECT unnest(v_available_themes) AS theme_id
      ) available
      ORDER BY random()
      LIMIT 1;
    END IF;
    
    -- Add to selected themes
    v_selected_themes := array_append(v_selected_themes, v_theme_id);
    
    -- Insert slot assignment
    INSERT INTO public.user_theme_slots (
      user_id,
      rotation_id,
      slot_number,
      theme_id,
      slot_rarity,
      neuros_cost
    ) VALUES (
      p_user_id,
      p_rotation_id,
      v_slot,
      v_theme_id,
      v_rarity,
      COALESCE(v_neuros_cost, 0)
    )
    ON CONFLICT (user_id, rotation_id, slot_number) DO UPDATE
    SET
      theme_id = EXCLUDED.theme_id,
      slot_rarity = EXCLUDED.slot_rarity,
      neuros_cost = EXCLUDED.neuros_cost;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.assign_user_theme_slots(UUID, UUID) IS 
  'Assigns 5 themes to a user for a rotation with randomized rarities. Rarity distribution: 50% common, 30% rare, 15% epic, 4.9% legendary, 0.1% mythic.';

-- ============================================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Theme Bank: Everyone can view active themes
ALTER TABLE public.theme_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view active themes" ON public.theme_bank;
CREATE POLICY "Users can view active themes"
  ON public.theme_bank FOR SELECT
  USING (is_active = true);

-- Service role can manage themes
DROP POLICY IF EXISTS "Service role can manage themes" ON public.theme_bank;
CREATE POLICY "Service role can manage themes"
  ON public.theme_bank FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Theme Rotations: Everyone can view active rotations
ALTER TABLE public.theme_rotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view active rotations" ON public.theme_rotations;
CREATE POLICY "Users can view active rotations"
  ON public.theme_rotations FOR SELECT
  USING (is_active = true);

-- Service role can manage rotations
DROP POLICY IF EXISTS "Service role can manage rotations" ON public.theme_rotations;
CREATE POLICY "Service role can manage rotations"
  ON public.theme_rotations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- User Theme Slots: Users can view their own slots
ALTER TABLE public.user_theme_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own slots" ON public.user_theme_slots;
CREATE POLICY "Users can view own slots"
  ON public.user_theme_slots FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all slots
DROP POLICY IF EXISTS "Service role can manage slots" ON public.user_theme_slots;
CREATE POLICY "Service role can manage slots"
  ON public.user_theme_slots FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Rarity Pricing: Everyone can view pricing
ALTER TABLE public.rarity_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view rarity pricing" ON public.rarity_pricing;
CREATE POLICY "Users can view rarity pricing"
  ON public.rarity_pricing FOR SELECT
  USING (true);

-- Service role can manage pricing
DROP POLICY IF EXISTS "Service role can manage rarity pricing" ON public.rarity_pricing;
CREATE POLICY "Service role can manage rarity pricing"
  ON public.rarity_pricing FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 8. TRIGGER TO UPDATE UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_theme_bank_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_theme_bank_updated_at ON public.theme_bank;
CREATE TRIGGER trigger_update_theme_bank_updated_at
  BEFORE UPDATE ON public.theme_bank
  FOR EACH ROW
  EXECUTE FUNCTION public.update_theme_bank_updated_at();

CREATE OR REPLACE FUNCTION public.update_theme_rotations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_theme_rotations_updated_at ON public.theme_rotations;
CREATE TRIGGER trigger_update_theme_rotations_updated_at
  BEFORE UPDATE ON public.theme_rotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_theme_rotations_updated_at();
