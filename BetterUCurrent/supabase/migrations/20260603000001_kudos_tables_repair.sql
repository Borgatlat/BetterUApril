-- Repair / ensure kudos tables used by FeedCard + kudosService.js (legacy "likes").

-- Workout kudos → user_workout_logs
CREATE TABLE IF NOT EXISTS public.workout_kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.user_workout_logs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (workout_id, user_id)
);

ALTER TABLE public.workout_kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_kudos_select ON public.workout_kudos;
CREATE POLICY workout_kudos_select ON public.workout_kudos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS workout_kudos_insert ON public.workout_kudos;
CREATE POLICY workout_kudos_insert ON public.workout_kudos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS workout_kudos_delete ON public.workout_kudos;
CREATE POLICY workout_kudos_delete ON public.workout_kudos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workout_kudos_workout_id_idx ON public.workout_kudos (workout_id);
CREATE INDEX IF NOT EXISTS workout_kudos_user_id_idx ON public.workout_kudos (user_id);

-- Mental session kudos → mental_session_logs
CREATE TABLE IF NOT EXISTS public.mental_session_kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.mental_session_logs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, user_id)
);

ALTER TABLE public.mental_session_kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mental_session_kudos_select ON public.mental_session_kudos;
CREATE POLICY mental_session_kudos_select ON public.mental_session_kudos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS mental_session_kudos_insert ON public.mental_session_kudos;
CREATE POLICY mental_session_kudos_insert ON public.mental_session_kudos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS mental_session_kudos_delete ON public.mental_session_kudos;
CREATE POLICY mental_session_kudos_delete ON public.mental_session_kudos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS mental_session_kudos_session_id_idx ON public.mental_session_kudos (session_id);
CREATE INDEX IF NOT EXISTS mental_session_kudos_user_id_idx ON public.mental_session_kudos (user_id);

-- Legacy alias table some projects still have (delete_account references mental_kudos)
CREATE TABLE IF NOT EXISTS public.mental_kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.mental_session_logs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, user_id)
);

ALTER TABLE public.mental_kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mental_kudos_select ON public.mental_kudos;
CREATE POLICY mental_kudos_select ON public.mental_kudos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS mental_kudos_insert ON public.mental_kudos;
CREATE POLICY mental_kudos_insert ON public.mental_kudos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS mental_kudos_delete ON public.mental_kudos;
CREATE POLICY mental_kudos_delete ON public.mental_kudos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
