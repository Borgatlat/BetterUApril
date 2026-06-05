-- Update Rotating Theme Prices (x10 multiplier, minimum 100)
-- This updates the rarity_pricing table to multiply all prices by 10
-- The cheapest theme will be 100 neuros (common rarity)

UPDATE public.rarity_pricing
SET 
  neuros_cost = CASE
    WHEN rarity = 'common' THEN 100  -- 10 * 10 = 100 (minimum)
    WHEN rarity = 'rare' THEN 250    -- 25 * 10 = 250
    WHEN rarity = 'epic' THEN 500    -- 50 * 10 = 500
    WHEN rarity = 'legendary' THEN 1000  -- 100 * 10 = 1000
    WHEN rarity = 'mythic' THEN 5000    -- 500 * 10 = 5000
    ELSE neuros_cost
  END,
  updated_at = timezone('utc'::text, now())
WHERE rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic');

-- Also update any existing user_theme_slots to match new pricing
-- This ensures existing slots match the new pricing structure
-- Note: user_theme_slots only has created_at, not updated_at
UPDATE public.user_theme_slots uts
SET 
  neuros_cost = GREATEST(
    (SELECT neuros_cost FROM public.rarity_pricing WHERE rarity = uts.slot_rarity),
    100
  )
WHERE EXISTS (
  SELECT 1 FROM public.rarity_pricing rp 
  WHERE rp.rarity = uts.slot_rarity
);

COMMENT ON TABLE public.rarity_pricing IS 'Pricing for rotating themes. Common: 100, Rare: 250, Epic: 500, Legendary: 1000, Mythic: 5000 neuros.';
