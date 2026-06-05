import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = (userId) => `futureu_chat_store_v1_${userId}`;
const ACTIVE_SESSION_KEY = (userId) => `futureu_active_session_v1_${userId}`;

export async function getActiveFutureuSessionId(userId) {
  if (!userId) return null;
  try {
    return await AsyncStorage.getItem(ACTIVE_SESSION_KEY(userId));
  } catch {
    return null;
  }
}

export async function setActiveFutureuSessionId(userId, sessionId) {
  if (!userId) return;
  try {
    if (sessionId) {
      await AsyncStorage.setItem(ACTIVE_SESSION_KEY(userId), sessionId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY(userId));
    }
  } catch {
    /* non-fatal */
  }
}

function isMissingTableError(error) {
  const code = error?.code;
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || msg.includes('does not exist') || msg.includes('relation');
}

function newLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function readStore(userId) {
  if (!userId) return { sessions: [], messagesBySession: {} };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return { sessions: [], messagesBySession: {} };
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      messagesBySession:
        parsed.messagesBySession && typeof parsed.messagesBySession === 'object'
          ? parsed.messagesBySession
          : {},
    };
  } catch {
    return { sessions: [], messagesBySession: {} };
  }
}

async function writeStore(userId, store) {
  if (!userId) return;
  await AsyncStorage.setItem(
    STORAGE_KEY(userId),
    JSON.stringify({
      sessions: store.sessions || [],
      messagesBySession: store.messagesBySession || {},
    }),
  );
}

function sortSessions(sessions) {
  return [...sessions].sort(
    (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
  );
}

function mapLocalMessage(row) {
  return {
    id: row.id,
    role: row.role,
    text: row.content,
    suggestedTasks: Array.isArray(row.suggested_tasks) ? row.suggested_tasks : undefined,
    tasksAdded: !!row.tasks_added,
    planArtifact: row.plan_snapshot || undefined,
  };
}

/** @returns {Promise<Array<{ id: string, title: string, created_at: string, updated_at: string }>>} */
export async function listFutureuChatSessions(userId) {
  const store = await readStore(userId);

  const { data, error } = await supabase
    .from('futureu_chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (!error && Array.isArray(data)) {
    const byId = new Map(store.sessions.map((s) => [s.id, s]));
    data.forEach((remote) => byId.set(remote.id, remote));
    store.sessions = sortSessions([...byId.values()]);
    await writeStore(userId, store);
    return store.sessions;
  }

  if (error && !isMissingTableError(error)) {
    console.warn('[FutureU Chat] remote sessions failed, using local:', error.message || error);
  }

  return sortSessions(store.sessions);
}

/**
 * @returns {Promise<{ id: string, title: string, updated_at: string, created_at: string } | null>}
 */
export async function createFutureuChatSession(userId, title) {
  if (!userId) return null;
  const now = new Date().toISOString();
  const safeTitle = String(title || 'New chat').trim() || 'New chat';

  const { data, error } = await supabase
    .from('futureu_chat_sessions')
    .insert({ user_id: userId, title: safeTitle })
    .select('id, title, updated_at, created_at')
    .single();

  let session;
  if (!error && data) {
    session = data;
  } else {
    if (error && !isMissingTableError(error)) {
      console.warn('[FutureU Chat] create remote session failed:', error.message || error);
    }
    session = {
      id: newLocalId('fu_sess'),
      user_id: userId,
      title: safeTitle,
      created_at: now,
      updated_at: now,
    };
  }

  const store = await readStore(userId);
  store.sessions = sortSessions([
    session,
    ...store.sessions.filter((s) => s.id !== session.id),
  ]);
  if (!store.messagesBySession[session.id]) {
    store.messagesBySession[session.id] = [];
  }
  await writeStore(userId, store);
  return session;
}

export async function touchFutureuChatSession(userId, sessionId) {
  if (!userId || !sessionId) return;
  const nowIso = new Date().toISOString();
  await supabase
    .from('futureu_chat_sessions')
    .update({ updated_at: nowIso })
    .eq('id', sessionId)
    .eq('user_id', userId);

  const store = await readStore(userId);
  store.sessions = sortSessions(
    store.sessions.map((s) => (s.id === sessionId ? { ...s, updated_at: nowIso } : s)),
  );
  await writeStore(userId, store);
}

/**
 * @returns {Promise<Array<{ id: string, role: string, text: string, suggestedTasks?: string[], tasksAdded?: boolean, planArtifact?: object }>>}
 */
export async function listFutureuChatMessages(userId, sessionId) {
  if (!userId || !sessionId) return [];

  const store = await readStore(userId);
  const localRows = store.messagesBySession[sessionId] || [];

  const { data, error } = await supabase
    .from('futureu_chat_messages')
    .select('id, role, content, suggested_tasks, tasks_added, plan_snapshot, created_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (!error && Array.isArray(data) && data.length > 0) {
    const mapped = data.map((m) => mapLocalMessage(m));
    store.messagesBySession[sessionId] = data.map((m) => ({
      ...m,
      plan_snapshot: m.plan_snapshot ?? localRows.find((l) => l.id === m.id)?.plan_snapshot,
    }));
    await writeStore(userId, store);
    return mapped;
  }

  if (error && !isMissingTableError(error)) {
    console.warn('[FutureU Chat] remote messages failed, using local:', error.message || error);
  }

  return localRows
    .slice()
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .map(mapLocalMessage);
}

/**
 * @returns {Promise<string|null>} message id
 */
export async function saveFutureuChatMessage(userId, sessionId, payload) {
  if (!userId || !sessionId) return null;
  const {
    role,
    content,
    suggestedTasks = null,
    tasksAdded = false,
    planSnapshot = null,
  } = payload;

  const insertRow = {
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    suggested_tasks: suggestedTasks,
    tasks_added: tasksAdded,
  };
  if (planSnapshot != null) {
    insertRow.plan_snapshot = planSnapshot;
  }

  const { data, error } = await supabase
    .from('futureu_chat_messages')
    .insert(insertRow)
    .select('id')
    .single();

  let messageId;
  if (!error && data?.id) {
    messageId = data.id;
  } else {
    if (error && !isMissingTableError(error)) {
      console.warn('[FutureU Chat] save remote message failed:', error.message || error);
    }
    messageId = newLocalId('fu_msg');
  }

  const store = await readStore(userId);
  const list = store.messagesBySession[sessionId] || [];
  list.push({
    id: messageId,
    role,
    content,
    suggested_tasks: suggestedTasks,
    tasks_added: tasksAdded,
    plan_snapshot: planSnapshot,
    created_at: new Date().toISOString(),
  });
  store.messagesBySession[sessionId] = list;
  await writeStore(userId, store);
  return messageId;
}

export async function updateFutureuChatMessage(userId, messageId, updates) {
  if (!userId || !messageId) return;
  if (updates.content != null) {
    await supabase
      .from('futureu_chat_messages')
      .update({ content: updates.content })
      .eq('id', messageId)
      .eq('user_id', userId);
  }
  if (updates.tasks_added != null) {
    await supabase
      .from('futureu_chat_messages')
      .update({ tasks_added: updates.tasks_added })
      .eq('id', messageId)
      .eq('user_id', userId);
  }
  if (updates.plan_snapshot != null) {
    await supabase
      .from('futureu_chat_messages')
      .update({ plan_snapshot: updates.plan_snapshot })
      .eq('id', messageId)
      .eq('user_id', userId);
  }

  const store = await readStore(userId);
  Object.keys(store.messagesBySession).forEach((sid) => {
    store.messagesBySession[sid] = (store.messagesBySession[sid] || []).map((m) => {
      if (m.id !== messageId) return m;
      return {
        ...m,
        ...(updates.content != null ? { content: updates.content } : {}),
        ...(updates.tasks_added != null ? { tasks_added: updates.tasks_added } : {}),
        ...(updates.plan_snapshot != null ? { plan_snapshot: updates.plan_snapshot } : {}),
      };
    });
  });
  await writeStore(userId, store);
}

export async function deleteFutureuChatMessage(userId, messageId) {
  if (!userId || !messageId) return;
  await supabase.from('futureu_chat_messages').delete().eq('id', messageId).eq('user_id', userId);

  const store = await readStore(userId);
  Object.keys(store.messagesBySession).forEach((sid) => {
    store.messagesBySession[sid] = (store.messagesBySession[sid] || []).filter(
      (m) => m.id !== messageId,
    );
  });
  await writeStore(userId, store);
}

/** Wipes messages for current session in local store only (remote rows remain unless deleted individually). */
export async function clearFutureuChatSessionLocal(userId, sessionId) {
  if (!userId || !sessionId) return;
  const store = await readStore(userId);
  store.messagesBySession[sessionId] = [];
  await writeStore(userId, store);
}
