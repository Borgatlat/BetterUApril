-- Neuros Costs Configuration Tables
-- These tables allow real-time updates to neuros pricing without code changes

-- ============================================================================
-- 1. PROFILE THEMES COSTS TABLE
-- ============================================================================
-- Stores the neuros cost for each profile theme
CREATE TABLE IF NOT EXISTS public.profile_theme_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Theme identification (matches the theme key in code)
  theme_key TEXT NOT NULL UNIQUE, -- e.g., 'midnight_blue', 'platinum', etc.
  
  -- Pricing
  neuros_cost INTEGER NOT NULL DEFAULT 0, -- Cost in neuros (0 = free)
  
  -- Metadata
  is_active BOOLEAN DEFAULT true NOT NULL, -- Can disable themes without deleting
  display_order INTEGER DEFAULT 0, -- Order for display in theme selector
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profile_theme_costs_key ON public.profile_theme_costs(theme_key);
CREATE INDEX IF NOT EXISTS idx_profile_theme_costs_active ON public.profile_theme_costs(is_active) WHERE is_active = true;

COMMENT ON TABLE public.profile_theme_costs IS 'Stores neuros costs for profile themes. Allows real-time price updates without code changes.';
COMMENT ON COLUMN public.profile_theme_costs.theme_key IS 'The theme key identifier (matches the key in the PROFILE_THEMES object in code)';
COMMENT ON COLUMN public.profile_theme_costs.neuros_cost IS 'Cost in neuros to purchase this theme (0 = free)';

-- ============================================================================
-- 2. NEUROS COSTS TABLE
-- ============================================================================
-- Stores neuros costs for various features (border colors, etc.)
CREATE TABLE IF NOT EXISTS public.neuros_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Cost type identification
  cost_type TEXT NOT NULL UNIQUE, -- e.g., 'border_color', 'custom_feature', etc.
  
  -- Pricing
  neuros_cost INTEGER NOT NULL DEFAULT 1, -- Cost in neuros
  
  -- Metadata
  description TEXT, -- Description of what this cost applies to
  is_active BOOLEAN DEFAULT true NOT NULL, -- Can disable costs without deleting
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_neuros_costs_type ON public.neuros_costs(cost_type);
CREATE INDEX IF NOT EXISTS idx_neuros_costs_active ON public.neuros_costs(is_active) WHERE is_active = true;

COMMENT ON TABLE public.neuros_costs IS 'Stores neuros costs for various app features. Allows real-time price updates without code changes.';
COMMENT ON COLUMN public.neuros_costs.cost_type IS 'Type identifier for the cost (e.g., "border_color" for workout/run/mental session border colors)';
COMMENT ON COLUMN public.neuros_costs.neuros_cost IS 'Cost in neuros for this feature';

-- ============================================================================
-- 3. INSERT DEFAULT VALUES
-- ============================================================================

-- Insert default profile theme costs (matching current code values)
-- All theme costs can be updated remotely in the database without code changes
INSERT INTO public.profile_theme_costs (theme_key, neuros_cost, display_order) VALUES
  -- Free themes (0 neuros)
  ('default', 0, 1),
  ('light_blue', 0, 2),
  ('pink', 0, 3),
  ('green', 0, 4),
  -- Starter themes (1 neuro)
  ('midnight_blue', 1, 5),
  ('charcoal', 1, 6),
  -- Bronze tier (5 neuros)
  ('crimson_night', 5, 7),
  ('royal_purple', 5, 8),
  ('emerald_dark', 5, 9),
  -- Silver tier (10 neuros)
  ('golden_hour', 10, 10),
  ('aurora', 10, 11),
  ('volcanic', 10, 12),
  -- Gold tier (15 neuros)
  ('platinum', 15, 13),
  ('neon_cyber', 15, 14),
  ('obsidian', 15, 15)
ON CONFLICT (theme_key) DO UPDATE
SET neuros_cost = EXCLUDED.neuros_cost,
    display_order = EXCLUDED.display_order,
    updated_at = timezone('utc'::text, now());

-- Insert default neuros costs for other features
INSERT INTO public.neuros_costs (cost_type, neuros_cost, description) VALUES
  ('border_color', 1, 'Cost to apply a custom border color to workout/run/mental session posts')
ON CONFLICT (cost_type) DO UPDATE
SET neuros_cost = EXCLUDED.neuros_cost,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on profile_theme_costs table
ALTER TABLE public.profile_theme_costs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view active theme costs" ON public.profile_theme_costs;
DROP POLICY IF EXISTS "Service role can manage theme costs" ON public.profile_theme_costs;

-- Everyone can view active theme costs
CREATE POLICY "Users can view active theme costs"
  ON public.profile_theme_costs FOR SELECT
  USING (is_active = true);

-- Service role can manage all theme costs
CREATE POLICY "Service role can manage theme costs"
  ON public.profile_theme_costs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable RLS on neuros_costs table
ALTER TABLE public.neuros_costs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view active neuros costs" ON public.neuros_costs;
DROP POLICY IF EXISTS "Service role can manage neuros costs" ON public.neuros_costs;

-- Everyone can view active neuros costs
CREATE POLICY "Users can view active neuros costs"
  ON public.neuros_costs FOR SELECT
  USING (is_active = true);

-- Service role can manage all neuros costs
CREATE POLICY "Service role can manage neuros costs"
  ON public.neuros_costs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 5. HELPER FUNCTION TO GET THEME COST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_theme_cost(p_theme_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  SELECT neuros_cost INTO v_cost
  FROM public.profile_theme_costs
  WHERE theme_key = p_theme_key
    AND is_active = true;
  
  -- Return 0 if theme not found (default to free)
  RETURN COALESCE(v_cost, 0);
END;
$$;

COMMENT ON FUNCTION public.get_theme_cost(TEXT) IS 'Returns the neuros cost for a profile theme. Returns 0 if theme not found or inactive.';

-- ============================================================================
-- 6. HELPER FUNCTION TO GET FEATURE COST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_neuros_cost(p_cost_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  SELECT neuros_cost INTO v_cost
  FROM public.neuros_costs
  WHERE cost_type = p_cost_type
    AND is_active = true;
  
  -- Return 1 if cost type not found (default cost)
  RETURN COALESCE(v_cost, 1);
END;
$$;

COMMENT ON FUNCTION public.get_neuros_cost(TEXT) IS 'Returns the neuros cost for a feature type (e.g., border_color). Returns 1 if cost type not found or inactive.';

