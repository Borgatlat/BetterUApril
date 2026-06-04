-- BetterU Feature 3: Counselor Triage Queue (MTSS dispatch).
--
-- Coexists with the existing public.counselor_alerts table. The legacy alerts
-- table stays untouched so SentinelStaffDashboard keeps working; the new triage
-- queue powers the tier-aware grid built in CounselorTriageGrid.js.
--
-- Three enums power the triage grid:
--   risk_tier_enum    — MTSS tiers (Multi-Tier System of Support):
--                       tier_1 = universal everyday stressor / venting
--                       tier_2 = elevated, repeated, or specific need
--                       tier_3 = crisis / safety / immediate help requested
--   triage_status_enum — pending → assigned → resolved (no skipping back)
--
-- CREATE TYPE ... IF NOT EXISTS does not exist in PG, so we wrap each in a
-- DO block that catches duplicate_object errors (the idiomatic idempotency pattern).

-- ============================================================================
-- 1) Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.risk_tier_enum AS ENUM ('tier_1', 'tier_2', 'tier_3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.triage_status_enum AS ENUM ('pending', 'assigned', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.counselor_triage_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- text FK because organizations.id is a slug. Matches existing schema convention.
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  risk_tier public.risk_tier_enum NOT NULL DEFAULT 'tier_1',
  status public.triage_status_enum NOT NULL DEFAULT 'pending',
  assigned_counselor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  trigger_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- A counselor cannot resolve a ticket that nobody owns. Database-level guard
  -- complements the client-side button flow.
  CONSTRAINT triage_resolved_has_assignee CHECK (
    status <> 'resolved' OR assigned_counselor_id IS NOT NULL
  ),
  CONSTRAINT triage_trigger_reason_length CHECK (char_length(trigger_reason) <= 1000)
);

COMMENT ON TABLE public.counselor_triage_queue IS
  'Tier-aware counselor dispatch queue. tier_3 = crisis; powered by Supabase Realtime.';

-- Compound index for the canonical grid query:
--   WHERE org_id = $1 AND status <> 'resolved'
--   ORDER BY risk_tier DESC, created_at DESC
-- DESC on risk_tier sorts tier_3 first because of enum ordinal order.
CREATE INDEX IF NOT EXISTS idx_triage_org_active
  ON public.counselor_triage_queue (org_id, risk_tier DESC, created_at DESC)
  WHERE status <> 'resolved';

CREATE INDEX IF NOT EXISTS idx_triage_assignee
  ON public.counselor_triage_queue (assigned_counselor_id)
  WHERE assigned_counselor_id IS NOT NULL;

-- ============================================================================
-- 3) updated_at + auto-assignment trigger
-- ============================================================================
-- Single trigger handles two concerns:
--   (a) bump updated_at on every change
--   (b) when status flips to 'assigned' and assigned_counselor_id is NULL,
--       record the acting counselor (auth.uid()) automatically. This guarantees
--       audit trail even if the client forgets to pass the id.
CREATE OR REPLACE FUNCTION public.touch_counselor_triage_queue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'assigned'
     AND (OLD.status IS DISTINCT FROM 'assigned')
     AND NEW.assigned_counselor_id IS NULL THEN
    NEW.assigned_counselor_id := auth.uid();
  END IF;

  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_counselor_triage_queue ON public.counselor_triage_queue;
CREATE TRIGGER trg_touch_counselor_triage_queue
  BEFORE UPDATE ON public.counselor_triage_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_counselor_triage_queue();

-- ============================================================================
-- 4) Row-Level Security
-- ============================================================================
ALTER TABLE public.counselor_triage_queue ENABLE ROW LEVEL SECURITY;

-- SELECT: own row OR (counselor/admin in same org)
DROP POLICY IF EXISTS triage_select ON public.counselor_triage_queue;
CREATE POLICY triage_select ON public.counselor_triage_queue
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  );

-- INSERT: a student can file their own ticket. Staff can file on a student's
-- behalf (e.g. teacher referral routed through counselor account).
DROP POLICY IF EXISTS triage_insert ON public.counselor_triage_queue;
CREATE POLICY triage_insert ON public.counselor_triage_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Student filing own ticket: must be 'student' in the same org as the ticket.
    (
      student_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.account_type = 'student'
          AND p.org_id = counselor_triage_queue.org_id
      )
    )
    OR
    -- Staff filing on behalf: counselor/admin in the same org.
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  );

-- UPDATE: counselors/admins in same org can change status/tier/assignment.
-- Students CANNOT update their own ticket (prevents tier inflation/deflation).
DROP POLICY IF EXISTS triage_update_staff ON public.counselor_triage_queue;
CREATE POLICY triage_update_staff ON public.counselor_triage_queue
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  );

-- No DELETE policy = nobody can delete tickets. Audit trail preserved.

-- ============================================================================
-- 5) Realtime publication
-- ============================================================================
-- Supabase Realtime listens to logical replication. Adding the table to the
-- supabase_realtime publication is what makes INSERT/UPDATE/DELETE events
-- stream to subscribed clients. Wrapped in DO block because adding a table
-- that's already in the publication raises an error.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.counselor_triage_queue;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication does not exist; skipping (likely local-only env).';
END $$;

-- For UPDATE payloads to include the OLD row (needed so the client knows the
-- previous status), set REPLICA IDENTITY FULL. Default is DEFAULT (primary key
-- only) which would leave the `old_record` field empty.
ALTER TABLE public.counselor_triage_queue REPLICA IDENTITY FULL;

-- ============================================================================
-- 6) Staff helper: enriched view with student name + email for the grid
-- ============================================================================
-- The triage grid wants student name + email for context. profiles RLS would
-- normally block a counselor from SELECTing other users' rows, so wrap the JOIN
-- in a SECURITY DEFINER function that double-checks the caller is staff in org.
CREATE OR REPLACE FUNCTION public.staff_list_triage_queue(p_org_id text)
RETURNS TABLE (
  id uuid,
  org_id text,
  student_id uuid,
  student_full_name text,
  student_email text,
  student_grade_level text,
  risk_tier public.risk_tier_enum,
  status public.triage_status_enum,
  assigned_counselor_id uuid,
  assigned_counselor_name text,
  trigger_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('counselor', 'admin')
      AND p.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.org_id,
    q.student_id,
    COALESCE(sp.full_name, sp.email, 'Student'::text)::text AS student_full_name,
    COALESCE(sp.email, '')::text AS student_email,
    sp.grade_level,
    q.risk_tier,
    q.status,
    q.assigned_counselor_id,
    cp.full_name AS assigned_counselor_name,
    q.trigger_reason,
    q.created_at,
    q.updated_at,
    q.resolved_at
  FROM counselor_triage_queue q
  LEFT JOIN profiles sp ON sp.id = q.student_id
  LEFT JOIN profiles cp ON cp.id = q.assigned_counselor_id
  WHERE q.org_id = p_org_id
    AND q.status <> 'resolved'
  -- Two-key ORDER BY: tier_3 first (DESC on enum), then oldest unresolved first
  -- within the same tier so the queue feels FIFO inside each priority band.
  ORDER BY q.risk_tier DESC, q.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_triage_queue(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_triage_queue(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_triage_queue(text) TO service_role;
