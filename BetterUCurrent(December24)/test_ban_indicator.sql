-- Test script to add ban indicator to profiles table
-- Run this in your Supabase SQL editor

-- 1. Add the ban indicator fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE;

-- 2. Update existing banned users' profiles
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

-- 3. Test: Check if any profiles are marked as banned
SELECT id, username, is_banned, ban_reason, banned_until 
FROM profiles 
WHERE is_banned = TRUE;

-- 4. Test: Check if any users are in the bans table
SELECT * FROM bans WHERE is_active = TRUE;
