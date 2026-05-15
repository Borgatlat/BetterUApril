-- ============================================================
-- ACCOUNTABILITY PARTNERS & WEEKLY CHECK-INS
-- Run in Supabase SQL Editor or via migration
-- ============================================================

-- Table: accountability_partners (who is paired with whom)
CREATE TABLE IF NOT EXISTS accountability_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    check_in_day TEXT DEFAULT 'sunday' CHECK (check_in_day IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
    reminder_hour_utc INTEGER DEFAULT 18 CHECK (reminder_hour_utc >= 0 AND reminder_hour_utc <= 23),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, partner_id),
    CHECK (user_id != partner_id)
);

CREATE INDEX IF NOT EXISTS idx_accountability_partners_user_id ON accountability_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_accountability_partners_partner_id ON accountability_partners(partner_id);

ALTER TABLE accountability_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own partnerships" ON accountability_partners;
CREATE POLICY "Users can view own partnerships"
    ON accountability_partners FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can insert partnership where they are user_id" ON accountability_partners;
CREATE POLICY "Users can insert partnership where they are user_id"
    ON accountability_partners FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own partnership" ON accountability_partners;
CREATE POLICY "Users can update own partnership"
    ON accountability_partners FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = partner_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can delete own partnership" ON accountability_partners;
CREATE POLICY "Users can delete own partnership"
    ON accountability_partners FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = partner_id);

-- Table: accountability_check_ins (one row per user per week per partnership)
CREATE TABLE IF NOT EXISTS accountability_check_ins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partnership_id UUID NOT NULL REFERENCES accountability_partners(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
    notes TEXT,
    goals_met INTEGER,
    goals_total INTEGER,
    consistency_rating INTEGER CHECK (consistency_rating IS NULL OR (consistency_rating >= 1 AND consistency_rating <= 5)),
    biggest_win TEXT,
    next_focus TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(partnership_id, week_start_date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_partnership ON accountability_check_ins(partnership_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_week ON accountability_check_ins(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_check_ins_week ON accountability_check_ins(week_start_date DESC);

ALTER TABLE accountability_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own check-ins" ON accountability_check_ins;
CREATE POLICY "Users can view own check-ins"
    ON accountability_check_ins FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can insert own check-in" ON accountability_check_ins;
CREATE POLICY "Users can insert own check-in"
    ON accountability_check_ins FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own check-in" ON accountability_check_ins;
CREATE POLICY "Users can update own check-in"
    ON accountability_check_ins FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add accountability notification types (merge with existing CHECK if your DB already has a long list)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'friend_request',
    'friend_request_accepted',
    'comment',
    'like',
    'mention',
    'group_invitation',
    'group_join_request',
    'group_activity',
    'goal_completion',
    'streak_milestone',
    'achievement',
    'personal_record',
    'workout_reminder',
    'mental_reminder',
    'hydration_reminder',
    'weekly_progress',
    'monthly_stats',
    'ai_recommendation',
    'motivational_quote',
    'community_highlight',
    'challenge_invitation',
    'leaderboard_update',
    'points_earned',
    'level_up',
    'reward_unlocked',
    'sync_status',
    'app_update',
    'premium_feature',
    'local_event',
    'virtual_meetup',
    'community_challenge',
    'workout_share',
    'mental_session_share',
    'nudge_workout',
    'nudge_run',
    'nudge_mental',
    'daily_reminder',
    'app_message',
    'accountability_partner_request',
    'accountability_check_in_reminder',
    'accountability_check_in_received'
));
