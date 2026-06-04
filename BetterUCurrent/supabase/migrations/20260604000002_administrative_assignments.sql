-- Reflective disciplinary portal: restorative assignments with Supabase Realtime.

-- ============================================================================
-- 1) Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.admin_assignment_type AS ENUM ('reflective_journal', 'restorative_plan');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_assignment_status AS ENUM ('assigned', 'submitted', 'approved_by_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.administrative_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  assignment_type public.admin_assignment_type NOT NULL,
  prompt_text text NOT NULL,
  student_response text,
  status public.admin_assignment_status NOT NULL DEFAULT 'assigned',
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  CONSTRAINT admin_assignment_prompt_length CHECK (char_length(prompt_text) <= 10000),
  CONSTRAINT admin_assignment_response_length CHECK (
    student_response IS NULL OR char_length(student_response) <= 20000
  )
);

COMMENT ON TABLE public.administrative_assignments IS
  'Reflective disciplinary assignments. Realtime-enabled for Dean/counselor dashboards.';

CREATE INDEX IF NOT EXISTS idx_admin_assignments_student_active
  ON public.administrative_assignments (student_id, status)
  WHERE status = 'assigned';

CREATE INDEX IF NOT EXISTS idx_admin_assignments_org_queue
  ON public.administrative_assignments (org_id, status, due_at ASC)
  WHERE status <> 'approved_by_admin';

-- ============================================================================
-- 3) Status timestamp trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_administrative_assignments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
    NEW.submitted_at := now();
  END IF;

  IF NEW.status = 'approved_by_admin' AND OLD.status IS DISTINCT FROM 'approved_by_admin' THEN
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_administrative_assignments ON public.administrative_assignments;
CREATE TRIGGER trg_touch_administrative_assignments
  BEFORE UPDATE ON public.administrative_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_administrative_assignments();

-- ============================================================================
-- 4) Row-Level Security
-- ============================================================================
ALTER TABLE public.administrative_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_assignments_select_own ON public.administrative_assignments;
CREATE POLICY admin_assignments_select_own ON public.administrative_assignments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS admin_assignments_select_staff ON public.administrative_assignments;
CREATE POLICY admin_assignments_select_staff ON public.administrative_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
  );

DROP POLICY IF EXISTS admin_assignments_insert_staff ON public.administrative_assignments;
CREATE POLICY admin_assignments_insert_staff ON public.administrative_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles st
      WHERE st.id = administrative_assignments.student_id
        AND st.account_type = 'student'
        AND st.org_id = administrative_assignments.org_id
    )
  );

DROP POLICY IF EXISTS admin_assignments_update_student ON public.administrative_assignments;
CREATE POLICY admin_assignments_update_student ON public.administrative_assignments
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'assigned')
  WITH CHECK (
    student_id = auth.uid()
    AND status = 'submitted'
    AND student_response IS NOT NULL
    AND char_length(trim(student_response)) > 0
  );

DROP POLICY IF EXISTS admin_assignments_update_staff ON public.administrative_assignments;
CREATE POLICY admin_assignments_update_staff ON public.administrative_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
  );

-- No DELETE policy — audit trail preserved.

-- ============================================================================
-- 5) Realtime publication
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.administrative_assignments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication does not exist; skipping (likely local-only env).';
END $$;

ALTER TABLE public.administrative_assignments REPLICA IDENTITY FULL;

-- ============================================================================
-- 6) Staff list RPC (enriched with student + assigner names)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.staff_list_administrative_assignments(p_org_id text)
RETURNS TABLE (
  id uuid,
  org_id text,
  student_id uuid,
  student_full_name text,
  student_email text,
  assigned_by uuid,
  assigned_by_name text,
  assignment_type public.admin_assignment_type,
  prompt_text text,
  student_response text,
  status public.admin_assignment_status,
  due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz
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
    a.id,
    a.org_id,
    a.student_id,
    COALESCE(sp.full_name, sp.email, 'Student'::text)::text AS student_full_name,
    COALESCE(sp.email, '')::text AS student_email,
    a.assigned_by,
    ap.full_name AS assigned_by_name,
    a.assignment_type,
    a.prompt_text,
    a.student_response,
    a.status,
    a.due_at,
    a.created_at,
    a.updated_at,
    a.submitted_at,
    a.approved_at
  FROM administrative_assignments a
  LEFT JOIN profiles sp ON sp.id = a.student_id
  LEFT JOIN profiles ap ON ap.id = a.assigned_by
  WHERE a.org_id = p_org_id
    AND a.status <> 'approved_by_admin'
  ORDER BY
    CASE a.status WHEN 'submitted' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END,
    a.due_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_administrative_assignments(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_administrative_assignments(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_administrative_assignments(text) TO service_role;
