-- BetterU Feature 4: Phone-Free Focus Mode integrity tracker.
--
-- The student starts a session, the timer counts down inside FocusLockScreen.js,
-- and ONLY if the app stays in the foreground for the entire duration do points
-- get awarded. Server-side gating prevents tampering — the client can flip
-- completed_successfully directly via PATCH, but the RPC re-validates before
-- crediting the wallet.

-- ============================================================================
-- 1) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- org_id nullable: non-school users can still use Focus Mode personally.
  org_id text REFERENCES public.organizations (id) ON DELETE SET NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 240),
  points_earned integer NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  completed_successfully boolean NOT NULL DEFAULT false,
  forfeit_reason text,  -- e.g. 'app_backgrounded', 'user_ended_early'
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT focus_forfeit_reason_check CHECK (
    forfeit_reason IS NULL OR forfeit_reason IN (
      'app_backgrounded', 'app_inactive', 'user_ended_early', 'system_crash'
    )
  ),
  -- A session cannot be both successful AND have a forfeit reason.
  CONSTRAINT focus_consistency CHECK (
    NOT (completed_successfully = true AND forfeit_reason IS NOT NULL)
  )
);

COMMENT ON TABLE public.focus_sessions IS
  'Phone-free focus session log. Points awarded server-side via increment_student_rewards_points only.';

CREATE INDEX IF NOT EXISTS idx_focus_student_recent
  ON public.focus_sessions (student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_focus_org_completed
  ON public.focus_sessions (org_id, completed_successfully, started_at DESC)
  WHERE org_id IS NOT NULL;

-- ============================================================================
-- 2) Row-Level Security
-- ============================================================================
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- Students see their own focus sessions only.
DROP POLICY IF EXISTS focus_select_own ON public.focus_sessions;
CREATE POLICY focus_select_own ON public.focus_sessions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS focus_insert_own ON public.focus_sessions;
CREATE POLICY focus_insert_own ON public.focus_sessions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- UPDATE allowed but the WITH CHECK keeps points_earned at 0 during client
-- writes. Only the SECURITY DEFINER RPC may bump points_earned > 0.
DROP POLICY IF EXISTS focus_update_own ON public.focus_sessions;
CREATE POLICY focus_update_own ON public.focus_sessions
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    AND points_earned = 0
  );

-- Counselors/admins in the same org can SELECT (aggregate engagement reports).
-- They CANNOT edit a student's session record.
DROP POLICY IF EXISTS focus_select_staff ON public.focus_sessions;
CREATE POLICY focus_select_staff ON public.focus_sessions
  FOR SELECT TO authenticated
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = focus_sessions.org_id
    )
  );

-- ============================================================================
-- 3) increment_student_rewards_points RPC
-- ============================================================================
-- The whole integrity story rests on this function. Called only after the
-- client confirms a clean countdown finish. Steps:
--   1. SELECT ... FOR UPDATE locks the row so concurrent calls cannot double-award.
--   2. Verifies the session belongs to the caller.
--   3. Verifies completed_successfully = true (set by a separate PATCH before
--      this RPC fires; that PATCH is RLS-gated to the student).
--   4. Idempotency: if points_earned > 0 already, return ok+already_awarded.
--   5. Cap minutes to 120 to prevent a single absurd 240-min session inflating
--      the leaderboard.
--   6. Atomic UPDATE of both focus_sessions.points_earned and profiles.focus_points.
CREATE OR REPLACE FUNCTION public.increment_student_rewards_points(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session focus_sessions%ROWTYPE;
  v_points integer;
BEGIN
  -- FOR UPDATE acquires a row-level lock until the transaction commits/rolls
  -- back. Prevents a race where two parallel RPC calls both see points_earned=0
  -- and both award points.
  SELECT * INTO v_session
  FROM focus_sessions
  WHERE id = p_session_id
    AND student_id = auth.uid()
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'focus session not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  IF v_session.completed_successfully = false THEN
    RAISE EXCEPTION 'session was not completed successfully — points denied'
      USING ERRCODE = '22023';
  END IF;

  -- Idempotency guard. Double-tap on the "claim points" button must not
  -- credit the wallet twice.
  IF v_session.points_earned > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_awarded', true,
      'points', v_session.points_earned
    );
  END IF;

  -- Reward formula: 1 point per minute, capped at 120 so a single 4-hour
  -- session does not blow out the leaderboard.
  v_points := LEAST(v_session.duration_minutes, 120);

  UPDATE focus_sessions
  SET points_earned = v_points,
      ended_at = COALESCE(ended_at, now())
  WHERE id = p_session_id;

  UPDATE profiles
  SET focus_points = COALESCE(focus_points, 0) + v_points,
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'ok', true,
    'already_awarded', false,
    'points', v_points,
    'total_focus_points', (SELECT focus_points FROM profiles WHERE id = auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_student_rewards_points(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_student_rewards_points(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_student_rewards_points(uuid) TO service_role;

-- ============================================================================
-- 4) Optional aggregate helper for staff dashboards
-- ============================================================================
-- Returns weekly focus engagement for an org. Used later by the BoardReport
-- export. Not strictly required for Feature 4 but nice to ship alongside.
CREATE OR REPLACE FUNCTION public.get_org_focus_engagement(
  p_org_id text,
  p_weeks_back integer DEFAULT 4
)
RETURNS TABLE (
  week_start date,
  total_sessions bigint,
  successful_sessions bigint,
  total_minutes_focused bigint,
  unique_students bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('counselor', 'admin')
      AND profiles.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('week', f.started_at)::date AS week_start,
    COUNT(*)::bigint AS total_sessions,
    COUNT(*) FILTER (WHERE f.completed_successfully = true)::bigint AS successful_sessions,
    COALESCE(SUM(f.duration_minutes) FILTER (WHERE f.completed_successfully = true), 0)::bigint
      AS total_minutes_focused,
    COUNT(DISTINCT f.student_id)::bigint AS unique_students
  FROM focus_sessions f
  WHERE f.org_id = p_org_id
    AND f.started_at >= (CURRENT_DATE - (GREATEST(LEAST(p_weeks_back, 26), 1) * 7))
  GROUP BY date_trunc('week', f.started_at)
  ORDER BY week_start DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_focus_engagement(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_focus_engagement(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_focus_engagement(text, integer) TO service_role;
