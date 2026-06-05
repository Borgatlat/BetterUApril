-- Fix assign_user_theme_slots function
-- Remove unnest() from WHERE clause (not allowed in PostgreSQL)

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
    -- Fix: Move unnest to FROM clause, filter in WHERE
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
