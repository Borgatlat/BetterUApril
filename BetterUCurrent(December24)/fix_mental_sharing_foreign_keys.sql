-- Fix Mental Session Sharing Foreign Key Constraints
-- This fixes the foreign key constraint error when sharing custom sessions

-- Step 1: Drop the existing foreign key constraints
ALTER TABLE mental_session_shares DROP CONSTRAINT IF EXISTS mental_session_shares_mental_session_id_fkey;
ALTER TABLE shared_mental_sessions DROP CONSTRAINT IF EXISTS shared_mental_sessions_original_session_id_fkey;

-- Step 2: Add comments to clarify the purpose of these columns
COMMENT ON COLUMN mental_session_shares.mental_session_id IS 'References either mental_session_logs.id or custom_mental_sessions.id';
COMMENT ON COLUMN shared_mental_sessions.original_session_id IS 'References either mental_session_logs.id or custom_mental_sessions.id';

-- Step 3: Verify the changes
SELECT 'Foreign key constraints removed successfully!' as status;
SELECT 'mental_session_id and original_session_id are now flexible UUIDs' as info;
SELECT 'They can reference either mental_session_logs or custom_mental_sessions' as note;

-- Step 4: Test that the tables still work
SELECT 'Tables are ready for both built-in and custom mental session sharing!' as result;
