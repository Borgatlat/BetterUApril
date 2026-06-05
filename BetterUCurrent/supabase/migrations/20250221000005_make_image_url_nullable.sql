-- Make image_url nullable in theme_bank table
-- Color themes don't need image URLs, only background_color

ALTER TABLE public.theme_bank 
ALTER COLUMN image_url DROP NOT NULL;

COMMENT ON COLUMN public.theme_bank.image_url IS 'Full URL to theme image (NULL for color-only themes that use background_color instead)';
