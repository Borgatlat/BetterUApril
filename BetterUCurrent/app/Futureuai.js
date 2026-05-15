import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  Pressable,
} from 'react-native';
import { Haptics } from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { getAnthropicApiKey } from '../utils/apiConfig';
import {
  checkAIGenerationLimit,
  incrementAIGenerationUsage,
  FEATURE_TYPES,
  getAIGenerationUsageInfo,
} from '../utils/aiGenerationLimits';
import { LoadingDots } from '../components/LoadingDots';
import { extractPlanTasksAndDisplayText, appendAiDailyTasks } from '../utils/appendAiDailyTasks';
import Markdown from 'react-native-markdown-display';
import UserPlan from '../components/UserPlan';
import { loadFutureuPlanArtifact, saveFutureuPlanArtifact } from '../utils/futureuPlanStorage';
import QuestionsArtifact from '../components/questionsArtifact';



const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
/** Try newest first; fall back to dated snapshots if an alias is not enabled on your Anthropic account. */
const CLAUDE_MODELS = [
  'claude-sonnet-4-6',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
];

/** Keeps prompts under rough context limits and controls cost. */
const MAX_MESSAGES_IN_CONTEXT = 44;
const MAX_USER_MESSAGE_CHARS = 8000;

function formatFutureuUserError(err) {
  const raw = String(err?.message || err || '');
  const msg = raw.toLowerCase();
  if (msg.includes('abort') || msg.includes('aborted')) {
    return 'The request timed out or was cancelled. Check your connection and try again.';
  }
  if (msg.includes('401') || msg.includes('invalid x-api-key') || msg.includes('authentication')) {
    return 'API authentication failed. Set EXPO_PUBLIC_ANTHROPIC_API_KEY and rebuild.';
  }
  if (msg.includes('429') || msg.includes('rate_limit')) {
    return 'Too many requests. Wait a minute and try again.';
  }
  if (msg.includes('529') || msg.includes('overloaded')) {
    return 'The AI service is busy. Try again shortly.';
  }
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return raw || 'Something went wrong. Please try again.';
}

const PROMPT_MODE = {
  SPECIFIC: 'specific',
  COMPOSITE: 'composite',
};

/** Controls answer length; wired into system prompt + USER_CONTEXT_JSON + max_tokens. */
const RESPONSE_DEPTH = {
  QUICK: 'quick',
  DETAILED: 'detailed',
};

const DEPTH_OPTIONS = [
  { id: RESPONSE_DEPTH.QUICK, label: 'Quick', description: 'Short reply + follow-ups' },
  { id: RESPONSE_DEPTH.DETAILED, label: 'Detailed', description: 'Full sections & plan' },
];

/**
 * Injected into the system prompt so Quick vs Detailed actually changes model behavior.
 * (Module-level prompt strings cannot read React state — depth must be passed in here.)
 */
function getResponseDepthBlock(depth) {
  if (depth === RESPONSE_DEPTH.QUICK) {
    return `
Response depth: QUICK (USER_CONTEXT_JSON.response_depth is "quick")
- Keep the visible Markdown body brief: at most 8-12 short sentences, plus 2-3 bullet lines if helpful.
- Use at most two ## headings in the body (do not write seven long numbered sections).
- Still output valid PLAN_JSON and TASKS_JSON as required. For PLAN_JSON use 2-4 milestones and 3-5 checklist items that match the shorter answer.
- End by saying you will refine their plan after they answer your follow-up questions. Ask 1-3 specific questions (e.g. region, deadline, motivation, resources).
- Still include PLAN_JSON.implementation_intentions with 3-4 short questions_for_user tailored to their goal (implementation intentions architect); keep the Markdown section compact.
`;
  }
  return `
Response depth: DETAILED (USER_CONTEXT_JSON.response_depth is "detailed")
- Follow the full output format below with rich detail in each section.
- PLAN_JSON may use fuller milestones and up to 12 checklist items as in PLAN_JSON_RULE.
- End with follow-up questions and state you will refine the plan after they answer.
- Apply the full IMPLEMENTATION INTENTION architect in the body and PLAN_JSON (see IMPLEMENTATION_INTENTION_RULE in PLAN_JSON shape).
`;
}

const TASKS_JSON_RULE = `
At the very end of your reply, after all sections, add exactly one final line (no text after it):
TASKS_JSON: ["task 1", "task 2", "task 3", "task 4", "task 5"]
Use 3-5 short, actionable tasks the user can do this week based on your advice. Do not put TASKS_JSON anywhere else in the message.
`;

const PLAN_JSON_RULE = `
After your main answer (before TASKS_JSON), include exactly one line that starts with PLAN_JSON: followed by a single JSON object on the same line or spanning lines until the closing brace.
The JSON must match this shape:
{
  "plan_title": "short title",
  "goal": "user goal text",
  "timeframe_days": 90,
  "persona": { "name": "...", "why_match": "..." },
  "milestones": [
    { "id": "m1", "title": "...", "start_day": 1, "end_day": 30, "success_criteria": "..." }
  ],
  "checklist": [
    { "id": "c1", "text": "...", "due_day": 7, "priority": "high", "completed": false }
  ],
  "risks": ["optional strings"],
  "final_thoughts": "short string",
  "implementation_intentions": {
    "summary": "one sentence: when + where + first concrete action",
    "questions_for_user": [
      "Logistical question tailored to their goal (e.g. exact time block, route, tool)"
    ],
    "suggested_if_then": [
      { "if": "I feel tired or unmotivated", "then": "the smallest action I will still do" }
    ],
    "user_commitments": ["optional: fill on later turns when the user answers; short committed if-then or schedule lines"]
  }
}
Rules:
- timeframe_days must exactly equal the USER_CONTEXT_JSON timeframe_days when provided.
- Phase granularity: 1-14 days = daily micro-steps in checklist; 15-60 = weekly-style milestones; 61-365 = monthly; >365 = quarterly.
- checklist: 5-12 items when possible; due_day is day number within timeframe (1..timeframe_days).
- implementation_intentions is REQUIRED whenever you output a plan. Tailor questions_for_user to USER_CONTEXT_JSON.goal (e.g. SAT prep: tutoring platform, practice test schedule, what to say when scores disappoint; fitness: gym bag location, backup workout; startup: weekly calendar block, who to tell for accountability). Include at least one question about friction: tiredness, procrastination, or decision paralysis. Offer to help find a resource when relevant (e.g. tutoring platforms).
- suggested_if_then: 2-4 pairs covering their most likely real-world hurdles.
- Do not put PLAN_JSON anywhere except that one block. Put human-readable "Final Thoughts" in the main body AND duplicate key ideas in final_thoughts.
- In the Markdown body, after the plan sections, include a heading ## Implementation intentions and briefly list the same questions (so the user sees them in chat); keep questions_for_user and suggested_if_then in sync with that section.
`;

const IMPLEMENTATION_INTENTION_ARCHITECT = `
IMPLEMENTATION INTENTION ARCHITECT (reduces cognitive overload at the moment of action)
- After the strategic plan is clear, force the user to pre-decide when, where, and how they will act—not vague motivation.
- Ask uncomfortably specific logistics (which time block, which room, which app or bus route, what exact sentence they will say if they want to quit).
- Separate "clarifying unknowns" (deadline, region) from "implementation intentions" (execution friction). Both matter; implementation intentions must not be skipped.
- If USER_CONTEXT_JSON.user_turn_index is 2 or higher and the user is answering prior questions, merge their replies into implementation_intentions.user_commitments as short bullet strings, refine suggested_if_then if needed, and adjust checklist only when their answers require it.
`;


const FUTUREU_BASE_RULES = `
You are Future U inside the BetterU self-improvement app.
Address the user by name at least once.
Tone: encouraging, practical, clear, and concise. No emojis.
Always provide actionable next steps and tie recommendations to BetterU features (daily tasks, tracking, workouts, mental sessions, community).
Do not provide harmful, illegal, medical, or financial guarantees.
If uncertain about a factual claim, mark it as uncertain instead of inventing details.
If the users goal is unclear or not specific(I want to be helpful, I want to be succesful,) than ask follow up questions to turn a vague goal into a more specific one( I want to start a million dollar charity for the homeless, I want to start a million dollars in yearly revenue in an AI education platform startup )
Use Markdown in the main body (## headings, **bold**).
${PLAN_JSON_RULE}
${TASKS_JSON_RULE}
${IMPLEMENTATION_INTENTION_ARCHITECT}
After giving the plan, ask follow-up questions when anything important is still unclear. Always pair those with implementation intentions as specified above.
`;

const FUTUREU_SPECIFIC_PROMPT = `
Mode: specific_person_path (PRIMARY MODE)
Goal:
- Choose ONE specific real person relevant to the user's target future identity.
- Explain what that person did to reach that outcome.
- Translate those lessons into practical steps for the user.
Constraint matching:
- The chosen person and story must match the user's stated constraint (e.g. if they ask about Harvard admission, pick someone who fits Harvard specifically—not Oxford—unless the user explicitly asked for similar elite schools or a broader comparison).
- If you cannot name someone who clearly fits, say so briefly and ask follow-up questions instead of substituting a different school or outcome.

Output format (use the full numbered structure when response depth is DETAILED; when QUICK, follow the QUICK rules in the Response depth block above instead of expanding every section at length):
1) Chosen Person + Why this match
2) Their Path Timeline (3-7 milestones)
3) What to Copy (skills, habits, decisions)
4) Your Time-Based Plan (must use timeframe_days from USER_CONTEXT_JSON exactly; one coherent plan, not a separate fixed 30-day block unless timeframe is 30)
5) BetterU Plan (daily tasks, tracking, workouts, mental sessions, community)
6) Final Thoughts (body); also fill final_thoughts in PLAN_JSON
7) Clarifying follow-ups: ask 1-3 questions for anything still unknown (region, deadline, constraints, resources). Say you will refine the plan after they answer.
8) Implementation intentions (mandatory): in the body under ## Implementation intentions, ask 4-6 logistics and hurdle questions tailored to THIS user's goal—not generic motivation. Examples of the kind of specificity required: what they will do or say if tired or unmotivated; the recurring time block in their real week; exact tool or venue (tutor platform, gym, library, commute); if-then for the single most likely excuse. Mirror the same content in PLAN_JSON.implementation_intentions (questions_for_user, suggested_if_then, summary).
`;

const FUTUREU_COMPOSITE_PROMPT = `
Mode: composite_fallback
Goal:
- Provide a realistic composite path when no single best specific person is obvious.
- Explain the common milestones and habits people in that path follow.

Output format (full structure for DETAILED; for QUICK follow the Response depth block):
1) Why no single person was selected
2) Composite timeline (3-7 milestones)
3) What to Copy (skills, habits, decisions)
4) Your Time-Based Plan (must use timeframe_days from USER_CONTEXT_JSON exactly)
5) BetterU Plan (daily tasks, tracking, workouts, mental sessions, community)
6) Final Thoughts (body); also fill final_thoughts in PLAN_JSON
7) Clarifying follow-ups: ask 1-3 questions; say you will refine the plan after they answer.
8) Implementation intentions (mandatory): same as specific mode—## Implementation intentions in the body plus PLAN_JSON.implementation_intentions, all tailored to USER_CONTEXT_JSON.goal and hours_per_week.
`;

function buildSystemPrompt(displayName, mode, responseDepth = RESPONSE_DEPTH.DETAILED) {
  const userName = (displayName && String(displayName).trim()) || 'friend';
  const modePrompt =
    mode === PROMPT_MODE.SPECIFIC ? FUTUREU_SPECIFIC_PROMPT : FUTUREU_COMPOSITE_PROMPT;
  const depthBlock = getResponseDepthBlock(responseDepth);
  return `${FUTUREU_BASE_RULES}\n\n${depthBlock}\n\nThe user's preferred name is "${userName}".\n\n${modePrompt}`;
}

function buildSessionTitle(text) {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return 'New chat';
  return normalized.length > 56 ? `${normalized.slice(0, 56)}...` : normalized;
}

function formatSessionTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString();
}

/** True when the id is a Supabase row UUID (not a temp client id like `u-173…`). */
function isPersistedChatMessageId(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const timeoutMs = 45000 + attempt * 15000;
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Retryable API status: ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function callClaude(apiKey, systemPrompt, messages, maxTokens = 2500) {
  let lastError;
  const tried = [];
  for (let i = 0; i < CLAUDE_MODELS.length; i += 1) {
    const model = CLAUDE_MODELS[i];
    tried.push(model);
    try {
      const response = await fetchWithRetry(CLAUDE_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || data?.error?.type || `HTTP ${response.status}`;
        throw new Error(message);
      }

      const block = data?.content?.[0];
      if (block?.type === 'text' && typeof block.text === 'string') {
        return block.text;
      }
      throw new Error('Unexpected response format from Claude');
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || '').toLowerCase();
      if (!(msg.includes('model') || msg.includes('not_found'))) break;
    }
  }
  const suffix = tried.length ? ` (tried: ${tried.join(', ')})` : '';
  if (lastError) {
    lastError.message = `${lastError.message}${suffix}`;
    throw lastError;
  }
  throw new Error(`Claude request failed${suffix}`);
}


const PRESET_PROMPTS = [
  'I want to become a software engineer',
  'I want to become a registered nurse',
  'I want to become a founder',
  'I want to become more confident as a leader',
  'I want to become a sports psychologist',
];





const MODE_OPTIONS = [
  { id: PROMPT_MODE.SPECIFIC, label: 'Specific Person', description: 'One real role model path' },
  { id: PROMPT_MODE.COMPOSITE, label: 'Composite', description: 'Blended typical path' },
];

const Futureuai = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, isPremium } = useUser();
  const displayName = userProfile?.name?.trim() || 'friend';
  /** Same UUID as auth.uid() — required for futureu_chat_* RLS (prefer profiles.id). */
  const resolveChatUserId = useCallback(async () => {
    const fromProfile = userProfile?.id || userProfile?.user_id;
    if (fromProfile) return fromProfile;
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  }, [userProfile?.id, userProfile?.user_id]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [promptMode, setPromptMode] = useState(PROMPT_MODE.SPECIFIC);
  const [responseDepth, setResponseDepth] = useState(RESPONSE_DEPTH.DETAILED);
  const [chatItems, setChatItems] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Empty until user completes the in-chat plan intake (QuestionsArtifact). sendText uses API fallbacks until then. */
  const [timeFrameDays, setTimeFrameDays] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [goal, setGoal] = useState('');
  /** After user saves QuestionsArtifact; reset on new/clear chat. Loaded sessions skip the card. */
  const [planIntakeComplete, setPlanIntakeComplete] = useState(false);
  const [latestPlanArtifact, setLatestPlanArtifact] = useState(null);
  /** Shown under the header: daily Future U quota from Supabase ai usage RPC */
  const [usageHint, setUsageHint] = useState('');
  /** When set, the composer is editing this user message id (text in `input`). */
  const [editingUserMessageId, setEditingUserMessageId] = useState(null);
  /** Long-press user bubble: show dim overlay + tooltip actions (edit / delete). */
  const [messageActionTarget, setMessageActionTarget] = useState(null);
  const flatListRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const editingUserMessageIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadFutureuPlanArtifact();
      if (!cancelled && stored) setLatestPlanArtifact(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshFutureuUsage = useCallback(async () => {
    try {
      const info = await getAIGenerationUsageInfo(FEATURE_TYPES.FUTURE_U, isPremium);
      setUsageHint(`Daily replies: ${info.remaining} of ${info.limit} left`);
    } catch {
      setUsageHint('');
    }
  }, [isPremium]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    editingUserMessageIdRef.current = editingUserMessageId;
  }, [editingUserMessageId]);

  useEffect(() => {
    if (chatItems.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [chatItems, loading]);

  const loadSessions = useCallback(async () => {
    const uid = await resolveChatUserId();
    if (!uid) {
      setChatSessions([]);
      setSessionsLoading(false);
      return;
    }
    setSessionsLoading(true);
    const { data, error } = await supabase
      .from('futureu_chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('[FutureU] load sessions', error);
      setChatSessions([]);
    } else {
      setChatSessions(data || []);
    }
    setSessionsLoading(false);
  }, [resolveChatUserId]);

  const loadSessionMessages = useCallback(
    async (sessionId) => {
      const uid = await resolveChatUserId();
      if (!uid || !sessionId) return;
      const { data, error } = await supabase
        .from('futureu_chat_messages')
        .select('id, role, content, suggested_tasks, tasks_added, created_at')
        .eq('user_id', uid)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('[FutureU] load messages', error);
        Alert.alert('Error', 'Could not load this chat session.');
        return;
      }
      const mapped = (data || []).map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        suggestedTasks: Array.isArray(m.suggested_tasks) ? m.suggested_tasks : undefined,
        tasksAdded: !!m.tasks_added,
      }));
      setCurrentSessionId(sessionId);
      setChatItems(mapped);
      // Existing threads already have context in history; don’t force the intake card again.
      setPlanIntakeComplete(mapped.length > 0);
    },
    [resolveChatUserId]
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
      refreshFutureuUsage();
      const sid = currentSessionIdRef.current;
      if (sid) {
        loadSessionMessages(sid);
      }
    }, [loadSessions, loadSessionMessages, refreshFutureuUsage])
  );

  const createSessionIfNeeded = async (firstText) => {
    if (currentSessionId) return currentSessionId;
    const uid = await resolveChatUserId();
    if (!uid) return null;
    const title = buildSessionTitle(firstText);
    const { data, error } = await supabase
      .from('futureu_chat_sessions')
      .insert({ user_id: uid, title })
      .select('id, title, updated_at, created_at')
      .single();
    if (error) {
      console.error('[FutureU] create session', error);
      return null;
    }
    if (data) {
      setCurrentSessionId(data.id);
      setChatSessions((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
      return data.id;
    }
    return null;
  };

  const saveMessage = async ({ sessionId, role, content, suggestedTasks = null, tasksAdded = false }) => {
    const uid = await resolveChatUserId();
    if (!uid || !sessionId) return null;
    const { data, error } = await supabase
      .from('futureu_chat_messages')
      .insert({
        session_id: sessionId,
        user_id: uid,
        role,
        content,
        suggested_tasks: suggestedTasks,
        tasks_added: tasksAdded,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[FutureU] save message', error);
      return null;
    }
    return data?.id || null;
  };

  const touchSession = async (sessionId) => {
    const uid = await resolveChatUserId();
    if (!uid || !sessionId) return;
    const nowIso = new Date().toISOString();
    await supabase
      .from('futureu_chat_sessions')
      .update({ updated_at: nowIso })
      .eq('id', sessionId)
      .eq('user_id', uid);
    setChatSessions((prev) =>
      [...prev]
        .map((s) => (s.id === sessionId ? { ...s, updated_at: nowIso } : s))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    );
  };

  const clearChat = () => {
    Alert.alert('Clear chat', 'Clear current chat messages on this screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setChatItems([]);
          setCurrentSessionId(null);
          setEditingUserMessageId(null);
          setInput('');
          setGoal('');
          setTimeFrameDays('');
          setHoursPerWeek('');
          setPlanIntakeComplete(false);
          setMessageActionTarget(null);
        },
      },
    ]);
  };






  const startNewChat = () => {
    setCurrentSessionId(null);
    setChatItems([]);
    setSidebarOpen(false);
    setEditingUserMessageId(null);
    setInput('');
    setGoal('');
    setTimeFrameDays('');
    setHoursPerWeek('');
    setPlanIntakeComplete(false);
    setMessageActionTarget(null);
  };

  const cancelEditingUserMessage = () => {
    setEditingUserMessageId(null);
    setInput('');
  };

  const closeMessageActionMenu = useCallback(() => {
    setMessageActionTarget(null);
  }, []);

  const triggerMessageMenuHaptic = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* haptics unavailable (e.g. web) */
    }
  }, []);

  const triggerActionButtonHaptic = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  }, []);

  /** Loads the tapped user bubble into the composer so Send updates that message (no new AI call). */
  const beginEditUserMessage = (item) => {
    if (item.role !== 'user' || loading) return;
    setEditingUserMessageId(item.id);
    setInput(item.text || '');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  /** Removes one user message from the list and from Supabase when it was already saved. */
  const deleteUserMessage = (item) => {
    if (item.role !== 'user' || loading) return;
    Alert.alert('Delete message', 'Remove this message from the chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const delId = item.id;
          setChatItems((prev) => prev.filter((m) => m.id !== delId));
          if (editingUserMessageIdRef.current === delId) {
            setInput('');
          }
          setEditingUserMessageId((cur) => (cur === delId ? null : cur));
          if (isPersistedChatMessageId(delId)) {
            const uid = await resolveChatUserId();
            if (uid) {
              const { error } = await supabase
                .from('futureu_chat_messages')
                .delete()
                .eq('id', delId)
                .eq('user_id', uid);
              if (error) console.error('[FutureU] delete message', error);
            }
          }
        },
      },
    ]);
  };

  /** Persists edited text for the message id in `editingUserMessageId`, then clears edit mode. */
  const commitUserMessageEdit = async (newText) => {
    const id = editingUserMessageId;
    if (!id) return;
    const trimmed = newText.trim();
    if (!trimmed) {
      Alert.alert('Empty message', 'Type something or tap Cancel.');
      return;
    }
    if (isPersistedChatMessageId(id)) {
      const uid = await resolveChatUserId();
      if (uid) {
        const { error } = await supabase
          .from('futureu_chat_messages')
          .update({ content: trimmed })
          .eq('id', id)
          .eq('user_id', uid);
        if (error) {
          console.error('[FutureU] update message', error);
          Alert.alert('Error', 'Could not save your edit.');
          return;
        }
      }
    }
    setChatItems((prev) => prev.map((m) => (m.id === id ? { ...m, text: trimmed } : m)));
    setEditingUserMessageId(null);
    setInput('');
  };

  const userMessageCount = useMemo(
    () => chatItems.filter((m) => m.role === 'user').length,
    [chatItems]
  );

  const handlePlanIntakeSubmit = useCallback(() => {
    const days = parseInt(String(timeFrameDays).replace(/\D/g, ''), 10);
    const hours = parseInt(String(hoursPerWeek).replace(/\D/g, ''), 10);
    if (!Number.isFinite(days) || days < 1) {
      Alert.alert('Timeline needed', 'Enter how many days you want for your goal (e.g. 90).');
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      Alert.alert('Hours needed', 'Enter hours per week you can commit (e.g. 7).');
      return;
    }
    setTimeFrameDays(String(days));
    setHoursPerWeek(String(hours));
    setPlanIntakeComplete(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [timeFrameDays, hoursPerWeek]);

  /** Hide the intake card; API still uses 90-day / 7-hr defaults in sendText when fields are empty. */
  const handlePlanIntakeSkip = useCallback(() => {
    setPlanIntakeComplete(true);
    setTimeFrameDays(String(90));
    setHoursPerWeek(String(7));
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendText = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (editingUserMessageId) {
      await commitUserMessageEdit(trimmed);
      return;
    }

    if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
      Alert.alert(
        'Message too long',
        `Keep each message under ${MAX_USER_MESSAGE_CHARS} characters so the app stays reliable.`
      );
      return;
    }

    const limitCheck = await checkAIGenerationLimit(FEATURE_TYPES.FUTURE_U, isPremium);
    if (!limitCheck.canGenerate) {
      const canUpgrade = !isPremium;
      Alert.alert(
        'Daily Future U limit',
        canUpgrade
          ? `Free accounts get ${limitCheck.limit} Future U replies per day. Premium includes more.`
          : `You have used all ${limitCheck.limit} Future U replies for today. Try again tomorrow.`,
        canUpgrade
          ? [
              { text: 'Not now', style: 'cancel' },
              { text: 'Go Premium', onPress: () => router.push('/purchase-subscription') },
            ]
          : [{ text: 'OK' }]
      );
      return;
    }

    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      Alert.alert(
        'API key missing',
        'Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file, restart Expo, then try again.'
      );
      return;
    }

    const sessionId = await createSessionIfNeeded(trimmed);
    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setChatItems((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    /** Tracks which id to remove from the list if the AI request fails (includes DB id after save). */
    let userMessageStableId = userMessage.id;

    if (sessionId) {
      const userSavedId = await saveMessage({ sessionId, role: 'user', content: trimmed });
      if (userSavedId) {
        userMessageStableId = userSavedId;
        setChatItems((prev) =>
          prev.map((m) => (m.id === userMessage.id ? { ...m, id: userSavedId } : m))
        );
      }
      await touchSession(sessionId);
    }

    const tf = Math.max(1, parseInt(String(timeFrameDays).replace(/\D/g, ''), 10) || 90);
    const hpw = Math.max(0, parseInt(String(hoursPerWeek).replace(/\D/g, ''), 10) || 7);
    const userTurnIndex = [...chatItems, userMessage].filter((m) => m.role === 'user').length;
    const userPayload = {
      goal: (goal && goal.trim()) || trimmed,
      timeframe_days: tf,
      hours_per_week: hpw,
      user_message: trimmed,
      response_depth: responseDepth,
      user_turn_index: userTurnIndex,
    };

    try {
      const systemPrompt = buildSystemPrompt(displayName, promptMode, responseDepth);
      const transcript = [...chatItems, userMessage];
      const recent =
        transcript.length > MAX_MESSAGES_IN_CONTEXT
          ? transcript.slice(-MAX_MESSAGES_IN_CONTEXT)
          : transcript;
      const historyForModel = recent.map(({ role, text: content }) => ({
        role,
        content,
      }));
      historyForModel.push({
        role: 'user',
        content: `USER_CONTEXT_JSON: ${JSON.stringify(userPayload)}`,
      });

      const maxTokens = responseDepth === RESPONSE_DEPTH.QUICK ? 1400 : 2500;
      const raw = await callClaude(apiKey, systemPrompt, historyForModel, maxTokens);
      const { displayText, tasks: suggestedTasks, plan } = extractPlanTasksAndDisplayText(raw);

      if (plan && typeof plan === 'object') {
        await saveFutureuPlanArtifact(plan, { appendHistory: true });
        setLatestPlanArtifact(plan);
      }

      const tempAiId = `a-${Date.now()}`;
      setChatItems((prev) => [
        ...prev,
        {
          id: tempAiId,
          role: 'assistant',
          text: displayText,
          suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : undefined,
          tasksAdded: false,
        },
      ]);

      if (sessionId) {
        const savedId = await saveMessage({
          sessionId,
          role: 'assistant',
          content: displayText,
          suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : null,
          tasksAdded: false,
        });
        if (savedId) {
          setChatItems((prev) => prev.map((m) => (m.id === tempAiId ? { ...m, id: savedId } : m)));
        }
        await touchSession(sessionId);
      }

      const inc = await incrementAIGenerationUsage(FEATURE_TYPES.FUTURE_U);
      if (!inc.success) {
        console.warn('[FutureU] increment usage failed (limits may be out of sync):', inc.error);
      }
      await refreshFutureuUsage();
    } catch (error) {
      console.error('[FutureU]', error);
      Alert.alert('Could not reach Future U', formatFutureuUserError(error));
      setChatItems((prev) => prev.filter((item) => item.id !== userMessageStableId));
    } finally {
      setLoading(false);
      loadSessions();
      refreshFutureuUsage();
    }
  };

  const handleAddSuggestedTasks = async (messageId, tasks) => {
    try {
      const { added, skipped } = await appendAiDailyTasks(tasks);
      if (added > 0) {
        Alert.alert(
          'Daily tasks updated',
          `Added ${added} task${added === 1 ? '' : 's'}.${skipped > 0 ? ` ${skipped} duplicate(s) skipped.` : ''}`
        );
      } else {
        Alert.alert(
          'Daily tasks',
          skipped > 0 ? 'Those tasks are already on your list.' : 'No tasks to add.'
        );
      }
      setChatItems((prev) => prev.map((m) => (m.id === messageId ? { ...m, tasksAdded: true } : m)));
      const uid = await resolveChatUserId();
      if (uid) {
        await supabase
          .from('futureu_chat_messages')
          .update({ tasks_added: true })
          .eq('id', messageId)
          .eq('user_id', uid);
      }
    } catch (e) {
      console.error('[FutureU] append tasks', e);
      Alert.alert('Error', e?.message || 'Could not save tasks');
    }
  };
  const markdownStyles = {
    body: { color: '#fff', fontSize: 14, lineHeight: 21 },
    paragraph: { color: '#fff', fontSize: 14, lineHeight: 21, marginBottom: 6 },
    strong: { fontWeight: '800', color: '#f5f3ff' },
    heading1: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 10 },
    heading2: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
    heading3: { fontSize: 17, fontWeight: '800', color: '#e9d5ff', marginBottom: 6 },
    bullet_list: { marginTop: 6, marginBottom: 8 },
    list_item: { color: '#e2e8f0', marginBottom: 2 },
    link: { color: '#22d3ee' },
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    const showAddTasks =
      !isUser &&
      Array.isArray(item.suggestedTasks) &&
      item.suggestedTasks.length > 0 &&
      !item.tasksAdded;

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
          <View style={styles.avatarWrap}>
            <LinearGradient colors={['#06b6d4', '#00ffff']} style={styles.avatar}>
              <Ionicons name="rocket" size={16} color="#0f172a" />
            </LinearGradient>
          </View>
        )}
        {isUser ? (
          <Pressable
            onLongPress={() => {
              if (loading) return;
              triggerMessageMenuHaptic();
              setMessageActionTarget(item);
            }}
            delayLongPress={380}
            disabled={loading}
            accessibilityLabel="Your message. Long press for edit or delete."
            accessibilityHint="Opens actions for this message"
            style={({ pressed }) => [
              styles.userBubblePressable,
              pressed && !loading && styles.userBubblePressablePressed,
            ]}
          >
            <View
              style={[
                styles.bubble,
                styles.userBubble,
                editingUserMessageId === item.id && styles.userBubbleEditing,
              ]}
            >
              <Text style={[styles.bubbleText, styles.userBubbleText]}>{item.text}</Text>
            </View>
          </Pressable>
        ) : (
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Markdown style={markdownStyles}>{item.text}</Markdown>
          {showAddTasks && (
            <View style={styles.suggestedTasksPreview}>
              <Text style={styles.suggestedTasksLabel}>Suggested for Daily Tasks</Text>
              {item.suggestedTasks.map((t, idx) => (
                <Text key={`${item.id}-t-${idx}`} style={styles.suggestedTaskLine}>
                  • {t}
                </Text>
              ))}
              <TouchableOpacity
                style={styles.addTasksBtn}
                onPress={() => handleAddSuggestedTasks(item.id, item.suggestedTasks)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#e9d5ff" />
                <Text style={styles.addTasksBtnText}>Add to Daily Tasks</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isUser && item.tasksAdded && item.suggestedTasks?.length > 0 && (
            <View style={styles.addedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34d399" />
              <Text style={styles.addedBadgeText}>Added to Daily Tasks</Text>
            </View>
          )}
        </View>
        )}
      </View>
    );
  };

  const chatListHeader = useMemo(
    () => (
      <View style={styles.chatListHeader}>
        <UserPlan
          externalPlan={latestPlanArtifact}
          onPlanChange={setLatestPlanArtifact}
          compact
          chatEmbed
          hideOpenButton
        />
      </View>
    ),
    [latestPlanArtifact]
  );

  const showPlanQuestions =
    userMessageCount >= 1 && !planIntakeComplete && !loading;


  
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <LinearGradient colors={['#1a0b2e', '#2d1b4e', '#000']} style={styles.gradient}>
        <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}> 
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setSidebarOpen((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name={sidebarOpen ? 'close' : 'menu'} size={22} color="#c4b5fd" />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Future U</Text>
              <Text style={styles.subtitle}>Career & identity guide</Text>
              {usageHint ? <Text style={styles.usageHint}>{usageHint}</Text> : null}
              <Text style={styles.disclaimer}>
                For planning and motivation only — not medical, legal, or financial advice.
              </Text>
            </View>
            <TouchableOpacity style={styles.headerIconBtn} onPress={clearChat}>
              <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
          

          {sidebarOpen && (
            <View style={styles.sidebarOverlay}>
              <View style={styles.sidebarPanel}>
                <View style={styles.sidebarHeader}>
                  <Text style={styles.sidebarTitle}>Previous Chats</Text>
                  <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
                    <Ionicons name="add" size={16} color="#e9d5ff" />
                    <Text style={styles.newChatText}>New</Text>
                  </TouchableOpacity>
                </View>
                {sessionsLoading ? (
                  <View style={styles.sidebarLoading}>
                    <ActivityIndicator color="#22d3ee" size="small" />
                  </View>
                ) : (
                  <FlatList
                    data={chatSessions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.sessionRow,
                          currentSessionId === item.id && styles.sessionRowActive,
                        ]}
                        onPress={async () => {
                          await loadSessionMessages(item.id);
                          setSidebarOpen(false);
                        }}
                      >
                        <Text style={styles.sessionTitle} numberOfLines={1}>
                          {item.title || 'Untitled chat'}
                        </Text>
                        <Text style={styles.sessionTime}>{formatSessionTime(item.updated_at)}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.sidebarEmpty}>No previous chats yet.</Text>
                    }
                  />
                )}
              </View>
              <TouchableOpacity
                style={styles.sidebarBackdrop}
                onPress={() => setSidebarOpen(false)}
                activeOpacity={1}
              />
            </View>
          )}

          <View style={styles.modeToggleRow}>
            {MODE_OPTIONS.map((option) => {
              const selected = promptMode === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.modeToggleButton, selected && styles.modeToggleButtonActive]}
                  onPress={() => setPromptMode(option.id)}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.modeToggleTitle, selected && styles.modeToggleTitleActive]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.modeToggleSubtitle,
                      selected && styles.modeToggleSubtitleActive,
                    ]}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.depthToggleRow}>
            {DEPTH_OPTIONS.map((option) => {
              const selected = responseDepth === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.depthToggleButton, selected && styles.depthToggleButtonActive]}
                  onPress={() => setResponseDepth(option.id)}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.depthToggleTitle, selected && styles.depthToggleTitleActive]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.depthToggleSubtitle,
                      selected && styles.depthToggleSubtitleActive,
                    ]}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            ref={flatListRef}
            data={chatItems}
            extraData={{ editingUserMessageId, planIntakeComplete, loading, userMessageCount }}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={chatListHeader}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>Who do you want to become?</Text>
                <Text style={styles.emptyBody}>
                  Open the left menu to revisit past chats. Start a new prompt and Future U will save
                  this conversation to Supabase.
                </Text>
                <Text style={styles.emptyHint}>Try a starter prompt below.</Text>
              </View>
            }
            ListFooterComponent={
              <>
                {showPlanQuestions ? (
                  <QuestionsArtifact
                    goal={goal}
                    timeFrameDays={timeFrameDays}
                    hoursPerWeek={hoursPerWeek}
                    onChangeGoal={setGoal}
                    onChangeTimeFrameDays={setTimeFrameDays}
                    onChangeHoursPerWeek={setHoursPerWeek}
                    onSubmit={handlePlanIntakeSubmit}
                    onSkip={handlePlanIntakeSkip}
                    disabled={loading}
                  />
                ) : null}
                {loading ? (
                  <View style={[styles.messageRow, styles.assistantRow]}>
                    <View style={styles.avatarWrap}>
                      <LinearGradient colors={['#06b6d4', '#00ffff']} style={styles.avatar}>
                        <Ionicons name="rocket" size={16} color="#0f172a" />
                      </LinearGradient>
                    </View>
                    <View style={[styles.bubble, styles.assistantBubble]}>
                      <LoadingDots size={10} color="#22d3ee" />
                    </View>
                  </View>
                ) : null}
              </>
            }
            showsVerticalScrollIndicator={false}
          />
          <BlurView intensity={40} tint="dark" style={[styles.inputBar, { paddingBottom: 12 + insets.bottom }]}>
            {editingUserMessageId ? (
              <View style={styles.editBanner}>
                <Text style={styles.editBannerText}>Editing your message</Text>
                <TouchableOpacity onPress={cancelEditingUserMessage} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={styles.editBannerCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <FlatList
              data={PRESET_PROMPTS}
              horizontal
              keyExtractor={(item, index) => `preset-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetList}
              renderItem={({ item: preset }) => (
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => sendText(preset)}
                  disabled={loading || !!editingUserMessageId}
                >
                  <Text style={styles.presetChipText} numberOfLines={2}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={
                  editingUserMessageId ? 'Edit your message…' : 'Who do you want to become?'
                }
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                editable={!loading}
              /> 
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                onPress={() => sendText(input)}
                disabled={!input.trim() || loading}
                accessibilityLabel={editingUserMessageId ? 'Save edited message' : 'Send message'}
              >
                {loading ? (
                  <ActivityIndicator color="#a855f7" size="small" />
                ) : editingUserMessageId ? (
                  <Ionicons name="checkmark" size={22} color="#86efac" />
                ) : (
                  <Ionicons name="send" size={20} color="#c4b5fd" />
                )}
              </TouchableOpacity>
            </View>
          </BlurView>

          <Modal
            visible={!!messageActionTarget}
            transparent
            animationType="fade"
            onRequestClose={closeMessageActionMenu}
          >
            <View style={styles.messageActionModalRoot}>
              <Pressable
                style={styles.messageActionBackdrop}
                onPress={closeMessageActionMenu}
                accessibilityLabel="Dismiss"
              />
              <View style={styles.messageActionCenter} pointerEvents="box-none">
                <View style={styles.messageActionPopover}>
                  <Text style={styles.messageActionPopoverTitle}>Your message</Text>
                  <View style={styles.messageActionPreview}>
                    <Text style={styles.messageActionPreviewText}>
                      {messageActionTarget?.text || ''}
                    </Text>
                  </View>
                  <View style={styles.messageActionBtnRow}>
                    <TouchableOpacity
                      style={styles.messageActionBtnEdit}
                      onPress={() => {
                        const t = messageActionTarget;
                        triggerActionButtonHaptic();
                        closeMessageActionMenu();
                        if (t) beginEditUserMessage(t);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="create-outline" size={20} color="#e0f2fe" />
                      <Text style={styles.messageActionBtnEditText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.messageActionBtnDelete}
                      onPress={() => {
                        const t = messageActionTarget;
                        triggerActionButtonHaptic();
                        closeMessageActionMenu();
                        if (t) deleteUserMessage(t);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={20} color="#fecdd3" />
                      <Text style={styles.messageActionBtnDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
    zIndex: 5,
  },
  headerIconBtn: { padding: 8 },
  headerTitles: { flex: 1, marginHorizontal: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 12, color: '#c4b5fd', opacity: 0.95, marginTop: 2 },
  usageHint: { fontSize: 11, color: '#86efac', marginTop: 4, fontWeight: '600' },
  disclaimer: { fontSize: 10, color: '#94a3b8', marginTop: 4, lineHeight: 14, maxWidth: 220 },
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    flexDirection: 'row',
  },
  sidebarBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sidebarPanel: {
    width: 280,
    backgroundColor: 'rgba(10, 10, 18, 0.97)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(139, 92, 246, 0.25)',
    // Keep controls comfortably inside safe area and below top edge.
    paddingTop: 32,
    paddingHorizontal: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 24,
    marginBottom: 8,
  },
  sidebarTitle: { color: '#f5f3ff', fontSize: 16, fontWeight: '700' },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  newChatText: { color: '#e9d5ff', fontWeight: '700', fontSize: 12 },
  sidebarLoading: { padding: 16, alignItems: 'center' },
  sidebarEmpty: { color: '#94a3b8', fontSize: 13, padding: 12 },
  sessionRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    backgroundColor: 'rgba(139, 92, 246, 0.07)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  sessionRowActive: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  sessionTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sessionTime: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  chatListHeader: {
    paddingBottom: 4,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  modeToggleButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  modeToggleButtonActive: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modeToggleTitle: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  modeToggleTitleActive: { color: '#e0f2fe' },
  modeToggleSubtitle: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  modeToggleSubtitleActive: { color: '#e9d5ff' },
  depthToggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  depthToggleButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(30, 27, 45, 0.6)',
  },
  depthToggleButtonActive: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
  },
  depthToggleTitle: { color: '#cbd5e1', fontSize: 11, fontWeight: '800' },
  depthToggleTitleActive: { color: '#ede9fe' },
  depthToggleSubtitle: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  depthToggleSubtitleActive: { color: '#ddd6fe' },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 240,
    flexGrow: 1,
  },
  emptyWrap: { paddingVertical: 20, paddingHorizontal: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 10 },
  emptyBody: { fontSize: 14, lineHeight: 22, color: '#cbd5e1' },
  emptyHint: { fontSize: 13, color: '#22d3ee', marginTop: 16 },
  messageRow: { flexDirection: 'row', marginVertical: 8, maxWidth: '92%' },
  userRow: { alignSelf: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  userBubblePressable: {
    maxWidth: '100%',
    borderRadius: 20,
  },
  userBubblePressablePressed: {
    opacity: 0.92,
  },
  avatarWrap: { marginRight: 8, alignSelf: 'flex-start' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: { padding: 14, borderRadius: 20, maxWidth: '100%' },
  userBubble: { backgroundColor: '#8b5cf6', borderTopRightRadius: 6 },
  userBubbleEditing: {
    borderWidth: 2,
    borderColor: '#22d3ee',
  },
  assistantBubble: {
    backgroundColor: 'rgba(24, 24, 32, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderTopLeftRadius: 6,
  },
  bubbleText: { fontSize: 14, lineHeight: 21, color: '#fff' },
  userBubbleText: { fontWeight: '500' },
  suggestedTasksPreview: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 211, 238, 0.25)',
  },
  suggestedTasksLabel: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  suggestedTaskLine: { color: '#e2e8f0', fontSize: 13, lineHeight: 20, marginBottom: 2 },
  addTasksBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.45)',
  },
  addTasksBtnText: { color: '#f5f3ff', fontSize: 13, fontWeight: '700' },
  addedBadge: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addedBadgeText: { color: '#6ee7b7', fontSize: 12, fontWeight: '600' },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  editBannerText: { color: '#a5f3fc', fontSize: 13, fontWeight: '700' },
  editBannerCancel: { color: '#fda4af', fontSize: 14, fontWeight: '700' },
  presetList: { paddingBottom: 10, gap: 8 },
  presetChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    maxWidth: 260,
  },
  presetChipText: { color: '#e2e8f0', fontSize: 12, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: 8,
  },
  sendBtn: {
    marginLeft: 10,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.5)',
  },
  sendBtnDisabled: { opacity: 0.35 },
  messageActionModalRoot: {
    flex: 1,
  },
  messageActionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  messageActionCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageActionPopover: {
    width: '88%',
    maxWidth: 400,
    marginHorizontal: 20,
    backgroundColor: 'rgba(18, 14, 32, 0.98)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
  },
  messageActionPopoverTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  /** Brighter than normal bubble so the text reads as “selected” on the dimmed screen. */
  messageActionPreview: {
    backgroundColor: 'rgba(139, 92, 246, 0.42)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  messageActionPreviewText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  messageActionBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  messageActionBtnEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  messageActionBtnEditText: {
    color: '#e0f2fe',
    fontSize: 15,
    fontWeight: '800',
  },
  messageActionBtnDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  messageActionBtnDeleteText: {
    color: '#fecdd3',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default Futureuai;
