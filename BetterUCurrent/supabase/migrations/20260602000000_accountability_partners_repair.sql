-- Accountability partners: idempotent repair for production Supabase.
-- Run this if "Add accountability partner" fails (missing table, RLS, FK, or notification type).

-- =============================================================================
-- 1) Tables (create if missing; align FKs with public.profiles like the rest of app)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accountability_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  check_in_day text NOT NULL DEFAULT 'sunday' CHECK (
    check_in_day IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')
  ),
  reminder_hour_utc integer NOT NULL DEFAULT 18 CHECK (reminder_hour_utc >= 0 AND reminder_hour_utc <= 23),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

CREATE INDEX IF NOT EXISTS idx_accountability_partners_user_id ON public.accountability_partners (user_id);
CREATE INDEX IF NOT EXISTS idx_accountability_partners_partner_id ON public.accountability_partners (partner_id);

-- Dedupe reverse-direction rows before symmetric unique index (keep oldest row per pair).
DELETE FROM public.accountability_partners ap1
USING public.accountability_partners ap2
WHERE ap1.id > ap2.id
  AND LEAST(ap1.user_id, ap1.partner_id) = LEAST(ap2.user_id, ap2.partner_id)
  AND GREATEST(ap1.user_id, ap1.partner_id) = GREATEST(ap2.user_id, ap2.partner_id);

-- One partnership per pair regardless of who initiated (prevents A→B and B→A duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_accountability_partners_pair
  ON public.accountability_partners (
    LEAST(user_id, partner_id),
    GREATEST(user_id, partner_id)
  );

CREATE TABLE IF NOT EXISTS public.accountability_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.accountability_partners (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  notes text,
  goals_met integer,
  goals_total integer,
  consistency_rating integer CHECK (
    consistency_rating IS NULL OR (consistency_rating >= 1 AND consistency_rating <= 5)
  ),
  biggest_win text,
  next_focus text,
  how_you_can_help text,
  message_to_partner text,
  reply_by_partner text,
  reply_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, week_start_date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_partnership ON public.accountability_check_ins (partnership_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_week ON public.accountability_check_ins (user_id, week_start_date);

-- Backfill columns if an older migration created the table without them.
ALTER TABLE public.accountability_check_ins
  ADD COLUMN IF NOT EXISTS message_to_partner text,
  ADD COLUMN IF NOT EXISTS how_you_can_help text,
  ADD COLUMN IF NOT EXISTS reply_by_partner text,
  ADD COLUMN IF NOT EXISTS reply_at timestamptz;

-- =============================================================================
-- 2) RLS
-- =============================================================================
ALTER TABLE public.accountability_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own partnerships" ON public.accountability_partners;
CREATE POLICY "Users can view own partnerships"
  ON public.accountability_partners FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can insert partnership where they are user_id" ON public.accountability_partners;
CREATE POLICY "Users can insert partnership where they are user_id"
  ON public.accountability_partners FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own partnership" ON public.accountability_partners;
CREATE POLICY "Users can update own partnership"
  ON public.accountability_partners FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = partner_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can delete own partnership" ON public.accountability_partners;
CREATE POLICY "Users can delete own partnership"
  ON public.accountability_partners FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can view own check-ins" ON public.accountability_check_ins;
CREATE POLICY "Users can view own check-ins"
  ON public.accountability_check_ins FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Users can insert own check-in" ON public.accountability_check_ins;
CREATE POLICY "Users can insert own check-in"
  ON public.accountability_check_ins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own check-in" ON public.accountability_check_ins;
CREATE POLICY "Users can update own check-in"
  ON public.accountability_check_ins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = partner_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_id);

-- =============================================================================
-- 3) Notification types (must include accountability_* or partner add succeeds but notify fails)
-- =============================================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
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
  'accountability_check_in_received',
  'counselor_support_alert'
));

-- =============================================================================
-- 4) create_notification — SECURITY DEFINER so inserts are not blocked by RLS edge cases
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type varchar,
  p_title varchar,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_is_actionable boolean DEFAULT true,
  p_action_type varchar DEFAULT NULL,
  p_action_data jsonb DEFAULT '{}'::jsonb,
  p_priority integer DEFAULT 1,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, message, data,
    is_actionable, action_type, action_data, priority, expires_at
  ) VALUES (
    p_user_id, p_type, p_title, p_message, COALESCE(p_data, '{}'::jsonb),
    p_is_actionable, p_action_type, p_action_data, p_priority, p_expires_at
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, varchar, varchar, text, jsonb, boolean, varchar, jsonb, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, varchar, varchar, text, jsonb, boolean, varchar, jsonb, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, varchar, varchar, text, jsonb, boolean, varchar, jsonb, integer, timestamptz) TO service_role;

-- =============================================================================
-- 5) add_accountability_partner — single server-side entry point (validates friends + inserts)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_accountability_partner(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_partnership_id uuid;
  v_sender_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  IF p_partner_id IS NULL OR p_partner_id = v_me THEN
    RAISE EXCEPTION 'invalid partner';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_partner_id) THEN
    RAISE EXCEPTION 'partner profile not found';
  END IF;

  -- Must be accepted friends (either direction).
  IF NOT EXISTS (
    SELECT 1 FROM friends f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = v_me AND f.friend_id = p_partner_id)
        OR (f.user_id = p_partner_id AND f.friend_id = v_me)
      )
  ) THEN
    RAISE EXCEPTION 'user must be an accepted friend first';
  END IF;

  -- Already partnered (either direction or symmetric index).
  IF EXISTS (
    SELECT 1 FROM accountability_partners ap
    WHERE (ap.user_id = v_me AND ap.partner_id = p_partner_id)
       OR (ap.user_id = p_partner_id AND ap.partner_id = v_me)
  ) THEN
    RAISE EXCEPTION 'already accountability partners';
  END IF;

  INSERT INTO accountability_partners (user_id, partner_id)
  VALUES (v_me, p_partner_id)
  RETURNING id INTO v_partnership_id;

  SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), 'A friend')
  INTO v_sender_name
  FROM profiles
  WHERE id = v_me;

  BEGIN
    PERFORM create_notification(
      p_partner_id,
      'accountability_partner_request',
      'Accountability Partner Request',
      v_sender_name || ' wants to be your accountability partner for weekly check-ins.',
      jsonb_build_object('partnership_id', v_partnership_id, 'sender_id', v_me),
      true,
      NULL,
      '{}'::jsonb,
      3,
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Partnership row is canonical; notification failure must not roll back the insert.
      RAISE NOTICE 'accountability partner notification skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_partnership_id,
    'user_id', v_me,
    'partner_id', p_partner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_accountability_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_accountability_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_accountability_partner(uuid) TO service_role;
