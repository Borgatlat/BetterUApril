-- Update custom background upload cost to 10,000 Neuros
-- This migration updates the price for uploading custom backgrounds

UPDATE public.neuros_costs
SET neuros_cost = 10000,
    description = 'Cost to upload a custom background image for profile (10,000 Neuros)',
    updated_at = timezone('utc'::text, now())
WHERE cost_type = 'custom_background_upload';

-- If the row doesn't exist yet (shouldn't happen, but safe to include)
INSERT INTO public.neuros_costs (cost_type, neuros_cost, description)
VALUES ('custom_background_upload', 10000, 'Cost to upload a custom background image for profile (10,000 Neuros)')
ON CONFLICT (cost_type) DO UPDATE
SET neuros_cost = EXCLUDED.neuros_cost,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());
