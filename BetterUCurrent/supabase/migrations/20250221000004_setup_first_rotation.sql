-- Setup First Weekly Rotation
-- Creates the first rotation and adds initial themes to the bank

-- ============================================================================
-- 1. CREATE FIRST ROTATION (This Week: Monday to Sunday)
-- ============================================================================
INSERT INTO public.theme_rotations (week_start_date, week_end_date, rotation_number, is_active)
VALUES (
  DATE_TRUNC('week', CURRENT_DATE)::DATE,  -- This Monday
  DATE_TRUNC('week', CURRENT_DATE)::DATE + INTERVAL '6 days',  -- This Sunday
  1,  -- First rotation
  true
)
RETURNING id;

-- ============================================================================
-- 2. ADD INITIAL THEMES TO THEME BANK
-- ============================================================================
-- Add some example themes (replace image_urls with your actual Cloudinary/Google Drive links)
-- These are placeholder themes - you should replace with your actual theme images

INSERT INTO public.theme_bank (
  name,
  theme_key,
  image_url,
  background_color,
  gradient_colors,
  rarity,
  neuros_cost,
  description,
  is_active,
  is_rotating
) VALUES
  -- Color-only themes (no image_url needed - uses background_color)
  (
    'Cosmic Purple',
    'cosmic_purple_001',
    NULL,  -- Color theme - no image URL needed
    '#4a0e4e',
    ARRAY['#4a0e4e', '#1a0a1e'],
    'epic',
    50,
    'A mysterious purple cosmic theme',
    true,
    true
  ),
  (
    'Neon Dreams',
    'neon_dreams_001',
    NULL,  -- Color theme
    '#00ffff',
    ARRAY['#00ffff', '#ff00ff'],
    'rare',
    25,
    'Vibrant neon colors that pop',
    true,
    true
  ),
  (
    'Sunset Glow',
    'sunset_glow_001',
    NULL,  -- Color theme
    '#ff6b35',
    ARRAY['#ff6b35', '#f7931e'],
    'common',
    10,
    'Warm sunset colors',
    true,
    true
  ),
  (
    'Ocean Depths',
    'ocean_depths_001',
    NULL,  -- Color theme
    '#006994',
    ARRAY['#006994', '#003d5b'],
    'rare',
    25,
    'Deep ocean blue theme',
    true,
    true
  ),
  (
    'Forest Mist',
    'forest_mist_001',
    NULL,  -- Color theme
    '#2d5016',
    ARRAY['#2d5016', '#1a3009'],
    'common',
    10,
    'Misty forest green',
    true,
    true
  ),
  (
    'Galactic Core',
    'galactic_core_001',
    NULL,  -- Color theme
    '#1a0033',
    ARRAY['#1a0033', '#000000'],
    'legendary',
    100,
    'Deep space galactic theme',
    true,
    true
  ),
  (
    'Golden Hour',
    'golden_hour_001',
    NULL,  -- Color theme
    '#ffd700',
    ARRAY['#ffd700', '#ff8c00'],
    'epic',
    50,
    'Golden sunset theme',
    true,
    true
  ),
  (
    'Midnight City',
    'midnight_city_001',
    NULL,  -- Color theme
    '#1a1a2e',
    ARRAY['#1a1a2e', '#0f0f1e'],
    'rare',
    25,
    'Urban midnight theme',
    true,
    true
  ),
  (
    'Aurora Borealis',
    'aurora_borealis_001',
    NULL,  -- Color theme
    '#00ff88',
    ARRAY['#00ff88', '#0088ff'],
    'epic',
    50,
    'Northern lights inspired',
    true,
    true
  ),
  (
    'Crimson Storm',
    'crimson_storm_001',
    NULL,  -- Color theme
    '#8b0000',
    ARRAY['#8b0000', '#4b0000'],
    'common',
    10,
    'Deep red storm theme',
    true,
    true
  )
ON CONFLICT (theme_key) DO NOTHING;

-- Note: Replace all image_urls above with actual Cloudinary or Google Drive direct image URLs
-- The themes above are examples - you should add your actual theme images
