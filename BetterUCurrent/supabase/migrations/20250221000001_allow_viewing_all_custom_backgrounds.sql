-- Allow all users to view custom backgrounds from other users
-- This enables users to see custom backgrounds when viewing other profiles

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own backgrounds" ON public.custom_backgrounds;

-- Create new policy that allows all authenticated users to view all backgrounds
CREATE POLICY "Users can view all backgrounds"
  ON public.custom_backgrounds FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON POLICY "Users can view all backgrounds" ON public.custom_backgrounds IS 
  'Allows all authenticated users to view custom backgrounds from any user, enabling profile viewing with custom backgrounds';
