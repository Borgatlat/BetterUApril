# BetterU League - Supabase Setup Guide

## 📋 SQL Files to Run in Supabase

Run these SQL files **in order** in your Supabase SQL Editor:

### 1. **Create League Tables** 
   - File: `supabase/migrations/20250120000000_create_league_tables.sql`
   - **What it does:**
     - Creates `teams` table
     - Creates `team_members` table (enforces one team per user)
     - Creates `league_challenges` table
     - Creates `team_challenge_participants` table
     - Creates `team_trophy_history` table
     - Sets up all RLS policies
     - Creates indexes for performance
     - Sets up triggers for auto-adding creator as owner

### 2. **Create League Functions**
   - File: `supabase/migrations/20250120000001_create_league_functions.sql`
   - **What it does:**
     - `calculate_team_workout_minutes()` - Calculates team's total workout minutes
     - `calculate_team_total_workouts()` - Calculates team's total workouts
     - `update_team_challenge_progress()` - Updates team progress for any challenge type
     - `award_challenge_trophies()` - Awards trophies at end of challenge
     - `create_monthly_challenge()` - Creates new monthly challenge

### 3. **Create League Triggers**
   - File: `supabase/migrations/20250120000002_create_league_triggers.sql`
   - **What it does:**
     - Auto-updates challenge progress when workouts are completed
     - Auto-updates challenge progress when mental sessions are completed
     - Auto-updates challenge progress when runs are completed
     - Auto-enrolls new teams in active challenges

## 🔧 Additional Setup Required

### Storage Bucket for Team Avatars

You need to create a storage bucket for team avatars:

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named: `team-avatars`
3. Set it to **Public** (or configure RLS policies)
4. Add RLS policy:
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Users can upload team avatars"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'team-avatars');
   
   -- Allow everyone to view
   CREATE POLICY "Anyone can view team avatars"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'team-avatars');
   ```

## ✅ Verification Checklist

After running the SQL files, verify:

- [ ] `teams` table exists
- [ ] `team_members` table exists
- [ ] `league_challenges` table exists
- [ ] `team_challenge_participants` table exists
- [ ] `team_trophy_history` table exists
- [ ] All RLS policies are active
- [ ] Triggers are created
- [ ] Functions are created
- [ ] Storage bucket `team-avatars` exists

## 🧪 Test Queries

Run these to verify everything works:

```sql
-- Test: Create a team (replace with your user ID)
INSERT INTO teams (name, description, created_by)
VALUES ('Test Team', 'A test team', 'YOUR_USER_ID_HERE')
RETURNING *;

-- Test: Check if creator was added as owner
SELECT * FROM team_members WHERE team_id = 'TEAM_ID_FROM_ABOVE';

-- Test: Create a challenge
SELECT create_monthly_challenge();

-- Test: Check challenge was created
SELECT * FROM league_challenges WHERE status = 'active';
```

## 📝 Notes

- All tables use proper foreign keys with CASCADE deletes
- RLS is enabled on all tables
- One team per user is enforced via UNIQUE constraint
- Triggers automatically update progress in real-time
- Functions use SECURITY DEFINER for proper permissions

