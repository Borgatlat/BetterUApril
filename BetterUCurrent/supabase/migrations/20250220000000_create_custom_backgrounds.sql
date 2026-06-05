-- Custom Backgrounds Feature
-- Allows users to upload custom background images for their profile
-- Costs neuros (configurable from neuros_costs table)

-- ============================================================================
-- 1. CUSTOM BACKGROUNDS TABLE
-- ============================================================================
-- Stores user-uploaded custom background images
CREATE TABLE IF NOT EXISTS public.custom_backgrounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User who owns this background
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Background image URL (stored in Cloudinary)
  image_url TEXT NOT NULL,
  
  -- Metadata
  name TEXT, -- Optional name for the background
  is_active BOOLEAN DEFAULT false NOT NULL, -- Currently active background for this user
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_custom_backgrounds_user_id ON public.custom_backgrounds(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_backgrounds_active ON public.custom_backgrounds(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE public.custom_backgrounds IS 'Stores user-uploaded custom background images for profiles';
COMMENT ON COLUMN public.custom_backgrounds.user_id IS 'The user who owns this background';
COMMENT ON COLUMN public.custom_backgrounds.image_url IS 'Cloudinary URL for the background image';
COMMENT ON COLUMN public.custom_backgrounds.is_active IS 'Whether this is the currently active background for the user (only one can be active per user)';

-- ============================================================================
-- 2. ADD CUSTOM BACKGROUND REFERENCE TO PROFILES
-- ============================================================================
-- Add column to profiles to reference the active custom background
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_custom_background_id UUID REFERENCES public.custom_backgrounds(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.active_custom_background_id IS 'Reference to the active custom background image (if using custom background instead of theme)';

-- ============================================================================
-- 3. ADD BACKGROUND UPLOAD COST TO NEUROS_COSTS
-- ============================================================================
-- Insert the cost for uploading custom backgrounds (default: 100 neuros)
INSERT INTO public.neuros_costs (cost_type, neuros_cost, description) VALUES
  ('custom_background_upload', 100, 'Cost to upload a custom background image for profile')
ON CONFLICT (cost_type) DO UPDATE
SET neuros_cost = EXCLUDED.neuros_cost,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on custom_backgrounds table
ALTER TABLE public.custom_backgrounds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own backgrounds" ON public.custom_backgrounds;
DROP POLICY IF EXISTS "Users can insert own backgrounds" ON public.custom_backgrounds;
DROP POLICY IF EXISTS "Users can update own backgrounds" ON public.custom_backgrounds;
DROP POLICY IF EXISTS "Users can delete own backgrounds" ON public.custom_backgrounds;

-- Users can view their own backgrounds
CREATE POLICY "Users can view own backgrounds"
  ON public.custom_backgrounds FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own backgrounds
CREATE POLICY "Users can insert own backgrounds"
  ON public.custom_backgrounds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own backgrounds
CREATE POLICY "Users can update own backgrounds"
  ON public.custom_backgrounds FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own backgrounds
CREATE POLICY "Users can delete own backgrounds"
  ON public.custom_backgrounds FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. TRIGGER TO ENSURE ONLY ONE ACTIVE BACKGROUND PER USER
-- ============================================================================
-- When a background is set to active, deactivate all other backgrounds for that user
CREATE OR REPLACE FUNCTION public.ensure_single_active_background()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the new background is being set to active
  IF NEW.is_active = true THEN
    -- Deactivate all other backgrounds for this user
    UPDATE public.custom_backgrounds
    SET is_active = false,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_single_active_background() IS 'Ensures only one custom background is active per user at a time';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_active_background ON public.custom_backgrounds;
CREATE TRIGGER trigger_ensure_single_active_background
  BEFORE INSERT OR UPDATE ON public.custom_backgrounds
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_background();

-- ============================================================================
-- 6. TRIGGER TO UPDATE UPDATED_AT TIMESTAMP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_custom_backgrounds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_custom_backgrounds_updated_at ON public.custom_backgrounds;
CREATE TRIGGER trigger_update_custom_backgrounds_updated_at
  BEFORE UPDATE ON public.custom_backgrounds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_custom_backgrounds_updated_at();
