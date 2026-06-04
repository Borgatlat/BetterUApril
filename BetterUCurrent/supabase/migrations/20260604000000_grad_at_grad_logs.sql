-- Grad at Grad pillar metrics: auto-logged from approved service hours and spiritual pulses.
-- Profile of the Graduate at Graduation (JSN) — five Ignatian pillars tracked per student.

-- ============================================================================
-- 1) Enum
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.grad_at_grad_pillar AS ENUM (
    'open_to_growth',
    'intellectually_competent',
    'religious',
    'loving',
    'committed_to_justice'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.grad_at_grad_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  pillar public.grad_at_grad_pillar NOT NULL,
  source_activity text NOT NULL,
  source_record_id uuid,
  points_allocated integer NOT NULL CHECK (points_allocated > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grad_at_grad_source_unique UNIQUE (source_activity, source_record_id)
);

COMMENT ON TABLE public.grad_at_grad_logs IS
  'Grad at Grad pillar points. Rows created by triggers only (service approval, spiritual pulse).';

CREATE INDEX IF NOT EXISTS idx_grad_at_grad_student
  ON public.grad_at_grad_logs (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grad_at_grad_org_pillar
  ON public.grad_at_grad_logs (org_id, pillar, created_at DESC);

-- ============================================================================
-- 3) Auto-log trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_log_grad_at_grad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'service_hour_logs' THEN
    IF NEW.status = 'approved'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
      INSERT INTO public.grad_at_grad_logs (
        student_id, org_id, pillar, source_activity, source_record_id, points_allocated
      )
      VALUES (
        NEW.student_id,
        NEW.org_id,
        'committed_to_justice',
        'service_hours',
        NEW.id,
        GREATEST(1, CEIL(NEW.hours)::integer)
      )
      ON CONFLICT (source_activity, source_record_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'spiritual_pulses' THEN
    INSERT INTO public.grad_at_grad_logs (
      student_id, org_id, pillar, source_activity, source_record_id, points_allocated
    )
    VALUES (
      NEW.profile_id,
      NEW.org_id,
      'religious',
      'spiritual_pulse',
      NEW.id,
      5
    )
    ON CONFLICT (source_activity, source_record_id) DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grad_at_grad_service_hours ON public.service_hour_logs;
CREATE TRIGGER trg_grad_at_grad_service_hours
  AFTER INSERT OR UPDATE OF status ON public.service_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_grad_at_grad();

DROP TRIGGER IF EXISTS trg_grad_at_grad_spiritual_pulses ON public.spiritual_pulses;
CREATE TRIGGER trg_grad_at_grad_spiritual_pulses
  AFTER INSERT ON public.spiritual_pulses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_grad_at_grad();

-- ============================================================================
-- 4) Row-Level Security
-- ============================================================================
ALTER TABLE public.grad_at_grad_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grad_at_grad_select_own ON public.grad_at_grad_logs;
CREATE POLICY grad_at_grad_select_own ON public.grad_at_grad_logs
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS grad_at_grad_select_staff ON public.grad_at_grad_logs;
CREATE POLICY grad_at_grad_select_staff ON public.grad_at_grad_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = grad_at_grad_logs.org_id
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — triggers only.

-- ============================================================================
-- 5) Student pillar summary RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_grad_at_grad_summary(
  p_student_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  pillar text,
  total_points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_type text;
  v_caller_org text;
  v_target_org text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT account_type, org_id INTO v_caller_type, v_caller_org
  FROM profiles WHERE id = v_caller;

  SELECT org_id INTO v_target_org FROM profiles WHERE id = p_student_id;

  IF p_student_id = v_caller THEN
    NULL;
  ELSIF v_caller_type IN ('admin', 'counselor')
        AND v_caller_org IS NOT NULL
        AND v_caller_org = v_target_org THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT g.pillar::text, SUM(g.points_allocated)::bigint
  FROM grad_at_grad_logs g
  WHERE g.student_id = p_student_id
  GROUP BY g.pillar
  ORDER BY g.pillar;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_grad_at_grad_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_grad_at_grad_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_grad_at_grad_summary(uuid) TO service_role;
