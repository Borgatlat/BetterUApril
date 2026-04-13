-- Add ban indicator field to profiles table
ALTER TABLE profiles ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN ban_reason TEXT;
ALTER TABLE profiles ADD COLUMN banned_until TIMESTAMP WITH TIME ZONE;

-- Create function to update profile when user is banned
CREATE OR REPLACE FUNCTION update_profile_ban_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile when ban is created
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles 
    SET is_banned = TRUE,
        ban_reason = NEW.reason,
        banned_until = CASE 
          WHEN NEW.is_permanent THEN NULL 
          ELSE NEW.banned_until 
        END
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  
  -- Update profile when ban is deactivated
  IF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE profiles 
    SET is_banned = FALSE,
        ban_reason = NULL,
        banned_until = NULL
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update profile ban status
CREATE TRIGGER trigger_update_profile_ban_status
  AFTER INSERT OR UPDATE ON bans
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_ban_status();

-- Update existing banned users' profiles
UPDATE profiles 
SET is_banned = TRUE,
    ban_reason = b.reason,
    banned_until = CASE 
      WHEN b.is_permanent THEN NULL 
      ELSE b.banned_until 
    END
FROM bans b
WHERE profiles.id = b.user_id 
  AND b.is_active = TRUE;
