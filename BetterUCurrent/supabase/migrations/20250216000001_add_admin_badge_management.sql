-- Admin Badge Management Functions
-- Allows admins to add and remove badges from users

-- Function to remove a badge from a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_remove_user_badge(
  p_user_id UUID,
  p_badge_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_displayed BOOLEAN;
BEGIN
  -- Check if current user is an admin
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can remove badges';
  END IF;
  
  -- Check if this is the displayed badge
  SELECT is_displayed INTO v_is_displayed
  FROM public.user_badges
  WHERE user_id = p_user_id
    AND badge_id = p_badge_id;
  
  -- Remove the badge
  DELETE FROM public.user_badges
  WHERE user_id = p_user_id
    AND badge_id = p_badge_id;
  
  -- If it was the displayed badge, clear displayed_badge_id from profile
  IF v_is_displayed THEN
    UPDATE public.profiles
    SET displayed_badge_id = NULL
    WHERE id = p_user_id;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to add a badge to a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_add_user_badge(
  p_user_id UUID,
  p_badge_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_badge_exists BOOLEAN;
BEGIN
  -- Check if current user is an admin
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can add badges';
  END IF;
  
  -- Check if badge exists
  SELECT EXISTS(
    SELECT 1 FROM public.badge_definitions
    WHERE id = p_badge_id
      AND is_active = true
  ) INTO v_badge_exists;
  
  IF NOT v_badge_exists THEN
    RAISE EXCEPTION 'Badge does not exist or is not active';
  END IF;
  
  -- Check if user already has this badge
  IF EXISTS(
    SELECT 1 FROM public.user_badges
    WHERE user_id = p_user_id
      AND badge_id = p_badge_id
  ) THEN
    RAISE EXCEPTION 'User already has this badge';
  END IF;
  
  -- Add the badge
  INSERT INTO public.user_badges (
    user_id,
    badge_id,
    is_displayed,
    earned_at
  ) VALUES (
    p_user_id,
    p_badge_id,
    false,
    timezone('utc'::text, now())
  );
  
  RETURN true;
END;
$$;

-- Grant execute permissions to authenticated users (they'll be checked inside the function)
GRANT EXECUTE ON FUNCTION public.admin_remove_user_badge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_user_badge(UUID, UUID) TO authenticated;

