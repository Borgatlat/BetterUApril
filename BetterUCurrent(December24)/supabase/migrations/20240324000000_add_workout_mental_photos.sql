-- Add photo URL columns to workout and mental session tables
ALTER TABLE user_workout_logs
ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE mental_session_logs
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add comments to explain the columns
COMMENT ON COLUMN user_workout_logs.photo_url IS 'URL to the workout photo stored in Cloudinary';
COMMENT ON COLUMN mental_session_logs.photo_url IS 'URL to the mental session photo stored in Cloudinary'; 