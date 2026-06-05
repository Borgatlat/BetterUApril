-- Add Background Rarity System
-- Adds rarity levels (common, rare, epic, legendary, mythic) to both preset themes and custom backgrounds

-- ============================================================================
-- 1. ADD RARITY TO CUSTOM BACKGROUNDS TABLE
-- ============================================================================
-- Add rarity column to custom_backgrounds table
ALTER TABLE public.custom_backgrounds 
ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common' NOT NULL;

-- Add CHECK constraint to ensure only valid rarities
ALTER TABLE public.custom_backgrounds
DROP CONSTRAINT IF EXISTS check_custom_backgrounds_rarity;

ALTER TABLE public.custom_backgrounds
ADD CONSTRAINT check_custom_backgrounds_rarity 
CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic'));

-- Create index for efficient rarity queries
CREATE INDEX IF NOT EXISTS idx_custom_backgrounds_rarity 
ON public.custom_backgrounds(user_id, rarity);

-- Update existing custom backgrounds to 'common' (if any exist)
UPDATE public.custom_backgrounds 
SET rarity = 'common' 
WHERE rarity IS NULL OR rarity NOT IN ('common', 'rare', 'epic', 'legendary', 'mythic');

-- Add comment
COMMENT ON COLUMN public.custom_backgrounds.rarity IS 'Rarity level: common, rare, epic, legendary, mythic (in ascending order)';

-- ============================================================================
-- 2. ADD RARITY TO PROFILE THEME COSTS TABLE
-- ============================================================================
-- Add rarity column to profile_theme_costs table
ALTER TABLE public.profile_theme_costs 
ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common' NOT NULL;

-- Add CHECK constraint to ensure only valid rarities
ALTER TABLE public.profile_theme_costs
DROP CONSTRAINT IF EXISTS check_profile_theme_costs_rarity;

ALTER TABLE public.profile_theme_costs
ADD CONSTRAINT check_profile_theme_costs_rarity 
CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic'));

-- Create index for efficient rarity queries
CREATE INDEX IF NOT EXISTS idx_profile_theme_costs_rarity 
ON public.profile_theme_costs(rarity) WHERE is_active = true;

-- Set all existing themes to 'common' rarity
UPDATE public.profile_theme_costs 
SET rarity = 'common' 
WHERE rarity IS NULL OR rarity NOT IN ('common', 'rare', 'epic', 'legendary', 'mythic');

-- Add comment
COMMENT ON COLUMN public.profile_theme_costs.rarity IS 'Rarity level: common, rare, epic, legendary, mythic (in ascending order). All color themes default to common.';

-- ============================================================================
-- 3. HELPER FUNCTION TO GET RARITY ORDER
-- ============================================================================
-- Function to get numeric order for rarity (useful for sorting)
CREATE OR REPLACE FUNCTION public.get_rarity_order(p_rarity TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_rarity
    WHEN 'common' THEN 1
    WHEN 'rare' THEN 2
    WHEN 'epic' THEN 3
    WHEN 'legendary' THEN 4
    WHEN 'mythic' THEN 5
    ELSE 0
  END;
END;
$$;

COMMENT ON FUNCTION public.get_rarity_order(TEXT) IS 'Returns numeric order for rarity (1=common, 2=rare, 3=epic, 4=legendary, 5=mythic). Useful for sorting.';
