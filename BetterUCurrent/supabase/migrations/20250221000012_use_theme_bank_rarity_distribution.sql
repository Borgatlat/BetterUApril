-- Use Theme Bank Rarity Distribution
-- Updates assign_user_theme_slots to calculate rarity chances based on actual rarities in theme_bank
-- instead of hardcoded percentages

-- ============================================================================
-- UPDATE ASSIGNMENT FUNCTION TO USE THEME_BANK RARITY DISTRIBUTION
-- ============================================================================
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
  v_theme_custom_cost INTEGER;
  v_available_themes UUID[];
  v_selected_themes UUID[] := ARRAY[]::UUID[];
  
  -- Rarity distribution variables (calculated from theme_bank)
  v_common_count INTEGER := 0;
  v_rare_count INTEGER := 0;
  v_epic_count INTEGER := 0;
  v_legendary_count INTEGER := 0;
  v_mythic_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_common_cumulative NUMERIC := 0;
  v_rare_cumulative NUMERIC := 0;
  v_epic_cumulative NUMERIC := 0;
  v_legendary_cumulative NUMERIC := 0;
BEGIN
  -- Get all active rotating themes
  SELECT ARRAY_AGG(id) INTO v_available_themes
  FROM public.theme_bank
  WHERE is_active = true AND is_rotating = true;
  
  -- If no themes available, return
  IF v_available_themes IS NULL OR array_length(v_available_themes, 1) = 0 THEN
    RAISE EXCEPTION 'No themes available for rotation';
  END IF;
  
  -- Calculate rarity distribution from theme_bank
  SELECT 
    COUNT(*) FILTER (WHERE rarity = 'common'),
    COUNT(*) FILTER (WHERE rarity = 'rare'),
    COUNT(*) FILTER (WHERE rarity = 'epic'),
    COUNT(*) FILTER (WHERE rarity = 'legendary'),
    COUNT(*) FILTER (WHERE rarity = 'mythic'),
    COUNT(*)
  INTO 
    v_common_count,
    v_rare_count,
    v_epic_count,
    v_legendary_count,
    v_mythic_count,
    v_total_count
  FROM public.theme_bank
  WHERE is_active = true AND is_rotating = true;
  
  -- Calculate cumulative percentages (0-100 scale)
  -- Each rarity's cumulative value represents the upper bound for that rarity
  IF v_total_count > 0 THEN
    v_common_cumulative := (v_common_count::NUMERIC / v_total_count::NUMERIC) * 100;
    v_rare_cumulative := v_common_cumulative + (v_rare_count::NUMERIC / v_total_count::NUMERIC) * 100;
    v_epic_cumulative := v_rare_cumulative + (v_epic_count::NUMERIC / v_total_count::NUMERIC) * 100;
    v_legendary_cumulative := v_epic_cumulative + (v_legendary_count::NUMERIC / v_total_count::NUMERIC) * 100;
    -- mythic goes to 100 (last bucket)
  END IF;
  
  -- Assign 5 slots
  FOR v_slot IN 1..5 LOOP
    -- Generate random value (0-100)
    v_random_value := random() * 100;
    
    -- Determine rarity based on calculated distribution from theme_bank
    IF v_total_count = 0 THEN
      -- Fallback: should not happen, but use common as default
      v_rarity := 'common';
    ELSIF v_common_count > 0 AND v_random_value < v_common_cumulative THEN
      v_rarity := 'common';
    ELSIF v_rare_count > 0 AND v_random_value < v_rare_cumulative THEN
      v_rarity := 'rare';
    ELSIF v_epic_count > 0 AND v_random_value < v_epic_cumulative THEN
      v_rarity := 'epic';
    ELSIF v_legendary_count > 0 AND v_random_value < v_legendary_cumulative THEN
      v_rarity := 'legendary';
    ELSIF v_mythic_count > 0 THEN
      v_rarity := 'mythic';
    ELSE
      -- Fallback: pick first available rarity
      SELECT rarity INTO v_rarity
      FROM public.theme_bank
      WHERE is_active = true AND is_rotating = true
      ORDER BY 
        CASE rarity
          WHEN 'common' THEN 1
          WHEN 'rare' THEN 2
          WHEN 'epic' THEN 3
          WHEN 'legendary' THEN 4
          WHEN 'mythic' THEN 5
        END
      LIMIT 1;
    END IF;
    
    -- Select a random theme with the chosen rarity that hasn't been selected yet
    -- If we've used all themes of this rarity, allow repeats
    SELECT theme_id INTO v_theme_id
    FROM (
      SELECT unnest(v_available_themes) AS theme_id
    ) available
    WHERE theme_id != ALL(v_selected_themes)
      AND theme_id IN (
        SELECT id 
        FROM public.theme_bank 
        WHERE is_active = true 
          AND is_rotating = true 
          AND rarity = v_rarity
      )
    ORDER BY random()
    LIMIT 1;
    
    -- If no unique theme found, pick any random theme of this rarity
    IF v_theme_id IS NULL THEN
      SELECT id INTO v_theme_id
      FROM public.theme_bank
      WHERE is_active = true 
        AND is_rotating = true 
        AND rarity = v_rarity
      ORDER BY random()
      LIMIT 1;
    END IF;
    
    -- If still no theme found (shouldn't happen), pick any available theme
    IF v_theme_id IS NULL THEN
      SELECT theme_id INTO v_theme_id
      FROM (
        SELECT unnest(v_available_themes) AS theme_id
      ) available
      ORDER BY random()
      LIMIT 1;
    END IF;
    
    -- Check if this theme has a custom price (per-theme pricing)
    -- If theme_bank.neuros_cost is NOT NULL, use it; otherwise use rarity-based pricing
    SELECT neuros_cost INTO v_theme_custom_cost
    FROM public.theme_bank
    WHERE id = v_theme_id;
    
    IF v_theme_custom_cost IS NOT NULL THEN
      -- Theme has custom price - use it
      v_neuros_cost := v_theme_custom_cost;
    ELSE
      -- No custom price - fall back to rarity-based pricing
      SELECT neuros_cost INTO v_neuros_cost
      FROM public.rarity_pricing
      WHERE rarity = v_rarity;
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
  'Assigns 5 themes to a user for a rotation with randomized rarities. Rarity distribution is calculated dynamically based on the actual rarities of themes in theme_bank (active and rotating). Uses per-theme pricing from theme_bank.neuros_cost if set, otherwise falls back to rarity-based pricing from rarity_pricing.';
