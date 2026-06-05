-- Future U chat history (sessions + messages)
-- Run in Supabase Dashboard → SQL Editor for project kmpufblmilcvortrfilp (or your project ref).
-- Requires: auth.users (built-in). RLS: users can only access their own rows.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.futureu_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.futureu_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.futureu_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  suggested_tasks JSONB,
  tasks_added BOOLEAN NOT NULL DEFAULT FALSE,
  plan_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- If table existed before plan_snapshot was added:
ALTER TABLE public.futureu_chat_messages
  ADD COLUMN IF NOT EXISTS plan_snapshot JSONB;

-- ---------------------------------------------------------------------------
-- Indexes (RLS + list queries)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_futureu_chat_sessions_user_updated
  ON public.futureu_chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_futureu_chat_messages_session_created
  ON public.futureu_chat_messages(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_futureu_chat_messages_user_id
  ON public.futureu_chat_messages(user_id);

-- ---------------------------------------------------------------------------
-- updated_at on sessions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.futureu_touch_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.futureu_chat_sessions
  SET updated_at = timezone('utc', now())
  WHERE id = NEW.session_id
    AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS futureu_messages_touch_session ON public.futureu_chat_messages;
CREATE TRIGGER futureu_messages_touch_session
  AFTER INSERT ON public.futureu_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.futureu_touch_session_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.futureu_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.futureu_chat_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: own rows only
DROP POLICY IF EXISTS "futureu sessions select own" ON public.futureu_chat_sessions;
CREATE POLICY "futureu sessions select own"
  ON public.futureu_chat_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu sessions insert own" ON public.futureu_chat_sessions;
CREATE POLICY "futureu sessions insert own"
  ON public.futureu_chat_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu sessions update own" ON public.futureu_chat_sessions;
CREATE POLICY "futureu sessions update own"
  ON public.futureu_chat_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu sessions delete own" ON public.futureu_chat_sessions;
CREATE POLICY "futureu sessions delete own"
  ON public.futureu_chat_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Messages: own rows + session must belong to caller (prevents cross-user session_id injection)
DROP POLICY IF EXISTS "futureu messages select own" ON public.futureu_chat_messages;
CREATE POLICY "futureu messages select own"
  ON public.futureu_chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu messages insert own" ON public.futureu_chat_messages;
CREATE POLICY "futureu messages insert own"
  ON public.futureu_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.futureu_chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "futureu messages update own" ON public.futureu_chat_messages;
CREATE POLICY "futureu messages update own"
  ON public.futureu_chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.futureu_chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "futureu messages delete own" ON public.futureu_chat_messages;
CREATE POLICY "futureu messages delete own"
  ON public.futureu_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants (authenticated app users only; anon cannot read/write chat)
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.futureu_chat_sessions FROM anon, public;
REVOKE ALL ON public.futureu_chat_messages FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.futureu_chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.futureu_chat_messages TO authenticated;
