-- Function to initialize data for existing users
CREATE OR REPLACE FUNCTION public.initialize_existing_user(user_id UUID)
RETURNS void AS $$
BEGIN
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
        INSERT INTO public.profiles (id) VALUES (user_id);
    END IF;

    -- Check if settings exist
    IF NOT EXISTS (SELECT 1 FROM public.user_settings WHERE id = user_id) THEN
        INSERT INTO public.user_settings (id) VALUES (user_id);
    END IF;

    -- Check if stats exist
    IF NOT EXISTS (SELECT 1 FROM public.user_stats WHERE id = user_id) THEN
        INSERT INTO public.user_stats (id) VALUES (user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize data for all existing users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        PERFORM public.initialize_existing_user(user_record.id);
    END LOOP;
END $$; 