-- Remove rarity from custom backgrounds (only applies to shop themes)
-- Set all solid color themes to 'common' rarity

-- ============================================================================
-- 1. REMOVE RARITY FROM CUSTOM BACKGROUNDS
-- ============================================================================
-- Remove rarity column from custom_backgrounds table
ALTER TABLE public.custom_backgrounds 
DROP COLUMN IF EXISTS rarity;

-- Drop the constraint if it exists
ALTER TABLE public.custom_backgrounds
DROP CONSTRAINT IF EXISTS check_custom_backgrounds_rarity;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_custom_backgrounds_rarity;

-- ============================================================================
-- 2. SET ALL SOLID COLOR THEMES TO 'COMMON' RARITY
-- ============================================================================
-- All the basic color themes should be 'common'
-- These are: default, light_blue, pink, green, midnight_blue, charcoal,
-- crimson_night, royal_purple, emerald_dark, golden_hour, aurora, volcanic,
-- platinum, neon_cyber, obsidian

UPDATE public.profile_theme_costs 
SET rarity = 'common'
WHERE theme_key IN (
  'default',
  'light_blue',
  'pink',
  'green',
  'midnight_blue',
  'charcoal',
  'crimson_night',
  'royal_purple',
  'emerald_dark',
  'golden_hour',
  'aurora',
  'volcanic',
  'platinum',
  'neon_cyber',
  'obsidian'
);

COMMENT ON COLUMN public.profile_theme_costs.rarity IS 
  'Rarity level: common, rare, epic, legendary, mythic. Only applies to shop themes (not custom backgrounds). All solid color themes default to common.';
