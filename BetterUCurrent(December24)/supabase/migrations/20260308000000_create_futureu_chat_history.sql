-- Future U chat history: sessions + messages
-- This lets users re-open previous Future U conversations.

CREATE TABLE IF NOT EXISTS futureu_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS futureu_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES futureu_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  suggested_tasks JSONB,
  tasks_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_futureu_chat_sessions_user_updated
  ON futureu_chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_futureu_chat_messages_session_created
  ON futureu_chat_messages(session_id, created_at ASC);

ALTER TABLE futureu_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE futureu_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "futureu sessions select own" ON futureu_chat_sessions;
CREATE POLICY "futureu sessions select own"
  ON futureu_chat_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu sessions insert own" ON futureu_chat_sessions;
CREATE POLICY "futureu sessions insert own"
  ON futureu_chat_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu sessions update own" ON futureu_chat_sessions;
CREATE POLICY "futureu sessions update own"
  ON futureu_chat_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu sessions delete own" ON futureu_chat_sessions;
CREATE POLICY "futureu sessions delete own"
  ON futureu_chat_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu messages select own" ON futureu_chat_messages;
CREATE POLICY "futureu messages select own"
  ON futureu_chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu messages insert own" ON futureu_chat_messages;
CREATE POLICY "futureu messages insert own"
  ON futureu_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu messages update own" ON futureu_chat_messages;
CREATE POLICY "futureu messages update own"
  ON futureu_chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "futureu messages delete own" ON futureu_chat_messages;
CREATE POLICY "futureu messages delete own"
  ON futureu_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
