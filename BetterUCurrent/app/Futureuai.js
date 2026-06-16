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
  Keyboard,
  Modal,
  Pressable,
  BackHandler,
} from 'react-native';
import { Haptics } from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import {
  checkAIGenerationLimit,
  incrementAIGenerationUsage,
  FEATURE_TYPES,
  getAIGenerationUsageInfo,
  AI_GENERATION_LIMITS,
} from '../utils/aiGenerationLimits';
import { LoadingDots } from '../components/LoadingDots';
import { extractPlanTasksAndDisplayText, appendAiDailyTasks, buildFallbackPlan, formatAssistantDisplayText, formatPlanMessageIntro } from '../utils/appendAiDailyTasks';
import Markdown from 'react-native-markdown-display';
import UserPlan from '../components/UserPlan';
import { loadFutureuPlanArtifact, saveFutureuPlanArtifact } from '../utils/futureuPlanStorage';
import {
  listFutureuChatSessions,
  createFutureuChatSession,
  touchFutureuChatSession,
  listFutureuChatMessages,
  saveFutureuChatMessage,
  updateFutureuChatMessage,
  deleteFutureuChatMessage,
  getActiveFutureuSessionId,
  setActiveFutureuSessionId,
} from '../utils/futureuChatStorage';
import QuestionsArtifact from '../components/questionsArtifact';
import {
  PROMPT_MODE,
  RESPONSE_DEPTH,
  MODE_OPTIONS,
  buildSystemPrompt,
  buildUserContextPayload,
  extractGoalConstraints,
} from '../lib/futureuPromptEngine';
import { callFutureUClaude, isFutureUClaudeAvailable, formatFutureUClaudeError } from '../lib/futureuClaudeClient';
import { useFutureUVoiceInput } from '../hooks/useFutureUVoiceInput';
import { navigateToHome } from '../utils/safeNavigation';

/** Keeps prompts under rough context limits and controls cost. */
const MAX_MESSAGES_IN_CONTEXT = 44;
const MAX_USER_MESSAGE_CHARS = 8000;

function formatFutureuUserError(err) {
  return formatFutureUClaudeError(err);
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

const PRESET_PROMPTS = [
  { text: 'I want to become a software engineer at a strong tech company', icon: 'code-slash' },
  { text: 'I want to get into Harvard for my intended major', icon: 'school' },
  { text: 'I want to become a registered nurse', icon: 'medkit' },
  { text: 'I want to build a startup with real revenue', icon: 'rocket' },
  { text: 'I want to grow as a confident team leader', icon: 'people' },
];

const Futureuai = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, isPremium } = useUser();
  const displayName = userProfile?.name?.trim() || 'friend';
  /** Must match auth.uid() for Supabase RLS on futureu_chat_* tables. */
  const resolveChatUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
    return userProfile?.id || userProfile?.user_id || null;
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
  const isMountedRef = useRef(true);

  const { listening: voiceListening, toggleListening: toggleVoiceInput, stopListening } =
    useFutureUVoiceInput({
      onTranscript: setInput,
      disabled: loading,
    });

  const handleGoBack = useCallback(() => {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setMessageActionTarget(null);
    stopListening();
    if (router.canGoBack?.()) {
      router.back();
    } else {
      navigateToHome(router);
    }
  }, [router, stopListening]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
        return true;
      }
      if (messageActionTarget) {
        setMessageActionTarget(null);
        return true;
      }
      handleGoBack();
      return true;
    });
    return () => sub.remove();
  }, [sidebarOpen, messageActionTarget, handleGoBack]);

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

  const formatUsageHint = useCallback((info) => {
    const used = info?.currentUsage ?? 0;
    const limit = info?.limit ?? 0;
    const remaining = info?.remaining ?? Math.max(0, limit - used);
    return `${remaining} of ${limit} replies left today · ${used} used`;
  }, []);

  const refreshFutureuUsage = useCallback(async () => {
    try {
      const info = await getAIGenerationUsageInfo(FEATURE_TYPES.FUTURE_U, isPremium);
      if (!isMountedRef.current) return;
      setUsageHint(formatUsageHint(info));
    } catch {
      if (isMountedRef.current) setUsageHint('');
    }
  }, [isPremium, formatUsageHint]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    editingUserMessageIdRef.current = editingUserMessageId;
  }, [editingUserMessageId]);

  useEffect(() => {
    if (chatItems.length === 0) return undefined;
    const timer = setTimeout(() => {
      if (!isMountedRef.current) return;
      try {
        flatListRef.current?.scrollToEnd({ animated: true });
      } catch {
        /* list may have unmounted */
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [chatItems, loading]);

  const loadSessions = useCallback(async () => {
    const uid = await resolveChatUserId();
    if (!isMountedRef.current) return;
    if (!uid) {
      setChatSessions([]);
      setSessionsLoading(false);
      return;
    }
    setSessionsLoading(true);
    try {
      const sessions = await listFutureuChatSessions(uid);
      if (!isMountedRef.current) return;
      setChatSessions(sessions);
    } catch (err) {
      console.error('[FutureU] load sessions', err);
      if (isMountedRef.current) setChatSessions([]);
    }
    if (isMountedRef.current) setSessionsLoading(false);
  }, [resolveChatUserId]);

  const loadSessionMessages = useCallback(
    async (sessionId, { setActive = true } = {}) => {
      const uid = await resolveChatUserId();
      if (!isMountedRef.current || !uid || !sessionId) return;
      try {
        const mapped = await listFutureuChatMessages(uid, sessionId);
        if (!isMountedRef.current) return;
        const storedPlan = await loadFutureuPlanArtifact();
        if (!isMountedRef.current) return;
        if (storedPlan) {
          setLatestPlanArtifact(storedPlan);
          for (let i = mapped.length - 1; i >= 0; i -= 1) {
            if (mapped[i].role === 'assistant' && !mapped[i].planArtifact) {
              mapped[i].planArtifact = storedPlan;
              break;
            }
          }
        }
        if (setActive) {
          setCurrentSessionId(sessionId);
          await setActiveFutureuSessionId(uid, sessionId);
        }
        if (!isMountedRef.current) return;
        setChatItems(mapped);
        setPlanIntakeComplete(mapped.length > 0);
      } catch (err) {
        console.error('[FutureU] load messages', err);
        if (isMountedRef.current) {
          Alert.alert('Error', 'Could not load this chat session.');
        }
      }
    },
    [resolveChatUserId]
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await loadSessions();
        await refreshFutureuUsage();
        const uid = await resolveChatUserId();
        if (!uid || cancelled) return;
        const sid =
          currentSessionIdRef.current || (await getActiveFutureuSessionId(uid));
        if (sid && !cancelled) {
          await loadSessionMessages(sid);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loadSessions, loadSessionMessages, refreshFutureuUsage, resolveChatUserId])
  );

  const createSessionIfNeeded = async (firstText) => {
    if (currentSessionId) return currentSessionId;
    const uid = await resolveChatUserId();
    if (!uid) return null;
    const title = buildSessionTitle(firstText);
    const data = await createFutureuChatSession(uid, title);
    if (data) {
      setCurrentSessionId(data.id);
      await setActiveFutureuSessionId(uid, data.id);
      setChatSessions((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
      return data.id;
    }
    return null;
  };

  const saveMessage = async ({
    sessionId,
    role,
    content,
    suggestedTasks = null,
    tasksAdded = false,
    planSnapshot = null,
  }) => {
    const uid = await resolveChatUserId();
    if (!uid || !sessionId) return null;
    return saveFutureuChatMessage(uid, sessionId, {
      role,
      content,
      suggestedTasks,
      tasksAdded,
      planSnapshot,
    });
  };

  const touchSession = async (sessionId) => {
    const uid = await resolveChatUserId();
    if (!uid || !sessionId) return;
    await touchFutureuChatSession(uid, sessionId);
    const nowIso = new Date().toISOString();
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
        onPress: async () => {
          setChatItems([]);
          setCurrentSessionId(null);
          const uid = await resolveChatUserId();
          if (uid) await setActiveFutureuSessionId(uid, null);
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






  const startNewChat = async () => {
    setCurrentSessionId(null);
    const uid = await resolveChatUserId();
    if (uid) await setActiveFutureuSessionId(uid, null);
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
          if (isPersistedChatMessageId(delId) || String(delId).startsWith('fu_msg_')) {
            const uid = await resolveChatUserId();
            if (uid) {
              await deleteFutureuChatMessage(uid, delId);
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
    if (isPersistedChatMessageId(id) || String(id).startsWith('fu_msg_')) {
      const uid = await resolveChatUserId();
      if (uid) {
        await updateFutureuChatMessage(uid, id, { content: trimmed });
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

  const isEmptyChat = chatItems.length === 0;

  const activeModeOption = useMemo(
    () => MODE_OPTIONS.find((o) => o.id === promptMode) || MODE_OPTIONS[0],
    [promptMode]
  );

  const renderPathModeSelector = (compact = false) => (
    <View style={compact ? styles.pathModeBarCompact : styles.pathModeBarInline}>
      {!compact ? (
        <Text style={styles.pathModeLabel}>How should Future U guide you?</Text>
      ) : null}
      <View style={[styles.pathModeSegment, compact && styles.pathModeSegmentCompact]}>
        {MODE_OPTIONS.map((option) => {
          const selected = promptMode === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.pathModeBtn, selected && styles.pathModeBtnActive]}
              onPress={() => setPromptMode(option.id)}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.pathModeBtnText, selected && styles.pathModeBtnTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!compact ? (
        <Text style={styles.pathModeHint}>{activeModeOption.description}</Text>
      ) : null}
    </View>
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

    if (!planIntakeComplete) {
      if (!goal.trim()) setGoal(trimmed);
      if (!timeFrameDays) setTimeFrameDays('90');
      if (!hoursPerWeek) setHoursPerWeek('7');
      setPlanIntakeComplete(true);
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

    const claudeReady = await isFutureUClaudeAvailable();
    if (!claudeReady) {
      Alert.alert(
        'Future U AI not configured',
        'Add EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-... to BetterUCurrent/.env, then restart Expo with npx expo start -c.',
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
    const goalConstraints = extractGoalConstraints(trimmed);
    const userPayload = buildUserContextPayload({
      goal: (goal && goal.trim()) || trimmed,
      timeframeDays: tf,
      hoursPerWeek: hpw,
      userMessage: trimmed,
      responseDepth,
      userTurnIndex,
      promptMode,
      goalConstraints,
    });

    try {
      const systemPrompt = buildSystemPrompt(
        displayName,
        promptMode,
        responseDepth,
        goalConstraints,
      );
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

      const maxTokens = responseDepth === RESPONSE_DEPTH.QUICK ? 2400 : 4096;
      const raw = await callFutureUClaude({
        systemPrompt,
        messages: historyForModel,
        maxTokens,
      });
      if (!isMountedRef.current) return;

      let { displayText, tasks: suggestedTasks, plan } = extractPlanTasksAndDisplayText(raw);
      displayText = formatAssistantDisplayText(displayText);

      const goalText = (goal && goal.trim()) || trimmed;
      if (!plan) {
        plan = buildFallbackPlan({
          goal: goalText,
          timeframeDays: tf,
          tasks: suggestedTasks,
          displayText,
        });
      }
      if (plan && suggestedTasks.length === 0 && Array.isArray(plan.checklist)) {
        suggestedTasks = plan.checklist
          .map((c) => String(c.text || '').trim())
          .filter(Boolean)
          .slice(0, 6);
      }

      if (plan && typeof plan === 'object') {
        if (!plan.goal) plan = { ...plan, goal: goalText };
        await saveFutureuPlanArtifact(plan, { appendHistory: true });
        if (isMountedRef.current) setLatestPlanArtifact(plan);
      }

      if (!isMountedRef.current) return;

      const tempAiId = `a-${Date.now()}`;
      setChatItems((prev) => [
        ...prev,
        {
          id: tempAiId,
          role: 'assistant',
          text: displayText || 'Your plan is ready — use the checklist below and tap items as you complete them.',
          suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : undefined,
          tasksAdded: false,
          planArtifact: plan || undefined,
        },
      ]);

      if (sessionId) {
        const savedId = await saveMessage({
          sessionId,
          role: 'assistant',
          content: displayText || 'Your plan is ready — use the checklist below.',
          suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : null,
          tasksAdded: false,
          planSnapshot: plan || null,
        });
        if (savedId) {
          setChatItems((prev) => prev.map((m) => (m.id === tempAiId ? { ...m, id: savedId } : m)));
        }
        await touchSession(sessionId);
      }

      const inc = await incrementAIGenerationUsage(FEATURE_TYPES.FUTURE_U);
      if (!inc.success) {
        console.warn('[FutureU] increment usage failed (limits may be out of sync):', inc.error);
      } else if (typeof inc.newCount === 'number') {
        const limit = isPremium
          ? AI_GENERATION_LIMITS.PREMIUM.FUTURE_U
          : AI_GENERATION_LIMITS.FREE.FUTURE_U;
        setUsageHint(
          formatUsageHint({
            currentUsage: inc.newCount,
            limit,
            remaining: Math.max(0, limit - inc.newCount),
          }),
        );
      }
      await refreshFutureuUsage();
    } catch (error) {
      console.error('[FutureU]', error);
      if (isMountedRef.current) {
        Alert.alert('Could not reach Future U', formatFutureuUserError(error));
        setChatItems((prev) => prev.filter((item) => item.id !== userMessageStableId));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        loadSessions();
        refreshFutureuUsage();
      }
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
        await updateFutureuChatMessage(uid, messageId, { tasks_added: true });
      }
    } catch (e) {
      console.error('[FutureU] append tasks', e);
      Alert.alert('Error', e?.message || 'Could not save tasks');
    }
  };
  const markdownStyles = {
    body: { color: '#f1f5f9', fontSize: 16, lineHeight: 26 },
    paragraph: { color: '#f1f5f9', fontSize: 16, lineHeight: 26, marginTop: 0, marginBottom: 14 },
    strong: { fontWeight: '800', color: '#fff' },
    heading1: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6, marginBottom: 12, lineHeight: 28 },
    heading2: {
      fontSize: 18,
      fontWeight: '800',
      color: '#22d3ee',
      marginTop: 18,
      marginBottom: 10,
      lineHeight: 24,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(34, 211, 238, 0.2)',
    },
    heading3: { fontSize: 16, fontWeight: '800', color: '#e9d5ff', marginTop: 14, marginBottom: 8, lineHeight: 22 },
    bullet_list: { marginTop: 6, marginBottom: 14 },
    ordered_list: { marginTop: 6, marginBottom: 14 },
    list_item: { color: '#e2e8f0', marginBottom: 10, flexDirection: 'row', lineHeight: 24 },
    link: { color: '#22d3ee', textDecorationLine: 'underline' },
    blockquote: {
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      borderLeftWidth: 3,
      borderLeftColor: '#8b5cf6',
      paddingLeft: 14,
      paddingVertical: 4,
      marginVertical: 12,
    },
  };

  const planMarkdownStyles = {
    ...markdownStyles,
    body: { ...markdownStyles.body, fontSize: 15, lineHeight: 24 },
    paragraph: { ...markdownStyles.paragraph, fontSize: 15, lineHeight: 24, marginBottom: 10 },
    heading2: { ...markdownStyles.heading2, fontSize: 16, marginTop: 10 },
  };

  /** Tasks to offer for Daily Tasks — from TASKS_JSON or week-1 checklist on the plan. */
  const resolveMessageTasks = (item) => {
    if (Array.isArray(item.suggestedTasks) && item.suggestedTasks.length > 0) {
      return item.suggestedTasks;
    }
    const checklist = item.planArtifact?.checklist;
    if (!Array.isArray(checklist)) return [];
    return checklist
      .filter((c) => !c.completed && Number(c.due_day) <= 7)
      .map((c) => String(c.text || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    const hasPlan = !isUser && !!item.planArtifact;
    const introText = hasPlan ? formatPlanMessageIntro(item.text) : item.text;
    const actionableTasks = resolveMessageTasks(item);
    const showAddTasks = !isUser && actionableTasks.length > 0 && !item.tasksAdded;

    if (isUser) {
      return (
        <View style={[styles.messageRow, styles.userRow]}>
          <View style={styles.userBubbleColumn}>
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
          </View>
        </View>
      );
    }

    if (hasPlan) {
      return (
        <View style={styles.assistantPlanMessage}>
          <View style={styles.assistantPlanHeader}>
            <LinearGradient colors={['#06b6d4', '#00ffff']} style={styles.avatar}>
              <Ionicons name="rocket" size={15} color="#0f172a" />
            </LinearGradient>
            <Text style={styles.assistantPlanLabel}>Future U</Text>
          </View>

          {introText ? (
            <View style={styles.assistantIntroCard}>
              <Markdown style={planMarkdownStyles}>{introText}</Markdown>
            </View>
          ) : null}

          <View style={styles.planCardShell}>
            <UserPlan
              externalPlan={item.planArtifact}
              onPlanChange={(nextPlan) => {
                setLatestPlanArtifact(nextPlan);
                setChatItems((prev) =>
                  prev.map((m) =>
                    m.id === item.id ? { ...m, planArtifact: nextPlan } : m,
                  ),
                );
                resolveChatUserId().then((uid) => {
                  if (uid && item.id) {
                    updateFutureuChatMessage(uid, item.id, { plan_snapshot: nextPlan });
                  }
                });
              }}
              chatEmbed
              hideOpenButton
            />
          </View>

          {showAddTasks ? (
            <TouchableOpacity
              style={styles.addTasksBtnWide}
              onPress={() => handleAddSuggestedTasks(item.id, actionableTasks)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#22d3ee" />
              <Text style={styles.addTasksBtnText}>Add this week to Daily Tasks</Text>
            </TouchableOpacity>
          ) : null}
          {item.tasksAdded && actionableTasks.length > 0 ? (
            <View style={styles.addedBadgePlan}>
              <Ionicons name="checkmark-circle" size={16} color="#34d399" />
              <Text style={styles.addedBadgeText}>Added to Daily Tasks</Text>
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, styles.assistantRow]}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={['#06b6d4', '#00ffff']} style={styles.avatar}>
            <Ionicons name="rocket" size={15} color="#0f172a" />
          </LinearGradient>
        </View>
        <View style={styles.assistantBubbleColumn}>
          <View style={[styles.bubble, styles.assistantBubble]}>
            {item.text ? <Markdown style={markdownStyles}>{item.text}</Markdown> : null}
            {showAddTasks && (
              <View style={styles.suggestedTasksPreview}>
                <Text style={styles.suggestedTasksLabel}>Add to Daily Tasks</Text>
                {actionableTasks.map((t, idx) => (
                  <Text key={`${item.id}-t-${idx}`} style={styles.suggestedTaskLine}>
                    • {t}
                  </Text>
                ))}
                <TouchableOpacity
                  style={styles.addTasksBtn}
                  onPress={() => handleAddSuggestedTasks(item.id, actionableTasks)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#22d3ee" />
                  <Text style={styles.addTasksBtnText}>Add this week to Daily Tasks</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.tasksAdded && actionableTasks.length > 0 && (
              <View style={styles.addedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                <Text style={styles.addedBadgeText}>Added to Daily Tasks</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const showPlanIntakeInEmpty = isEmptyChat && !planIntakeComplete && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <LinearGradient colors={['#1a0b2e', '#2d1b4e', '#000']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleGoBack}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTitles}>
              <View style={styles.headerTitleRow}>
                <LinearGradient colors={['#06b6d4', '#00ffff']} style={styles.headerBadge}>
                  <Ionicons name="rocket" size={14} color="#0f172a" />
                </LinearGradient>
                <Text style={styles.title}>Future U</Text>
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {usageHint || 'Your pathfinding coach'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setSidebarOpen(true)}
              accessibilityLabel="Chat history"
            >
              <Ionicons name="time-outline" size={22} color="#c4b5fd" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={startNewChat}
              accessibilityLabel="New chat"
            >
              <Ionicons name="add-circle-outline" size={24} color="#22d3ee" />
            </TouchableOpacity>
          </View>

          <Modal
            visible={sidebarOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setSidebarOpen(false)}
          >
            <View style={styles.sidebarModalRoot}>
              <View style={[styles.sidebarPanel, { paddingTop: insets.top + 12 }]}>
                <View style={styles.sidebarHeader}>
                  <Text style={styles.sidebarTitle}>Chat history</Text>
                  <TouchableOpacity
                    style={styles.sidebarCloseBtn}
                    onPress={() => setSidebarOpen(false)}
                  >
                    <Ionicons name="close" size={22} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.newChatBtnWide} onPress={startNewChat}>
                  <Ionicons name="add" size={18} color="#0f172a" />
                  <Text style={styles.newChatTextWide}>Start new chat</Text>
                </TouchableOpacity>
                {sessionsLoading ? (
                  <View style={styles.sidebarLoading}>
                    <ActivityIndicator color="#22d3ee" size="small" />
                    <Text style={styles.sidebarLoadingText}>Loading chats…</Text>
                  </View>
                ) : (
                  <FlatList
                    data={chatSessions}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.sidebarListContent}
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
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={16}
                          color={currentSessionId === item.id ? '#22d3ee' : '#64748b'}
                          style={styles.sessionIcon}
                        />
                        <View style={styles.sessionTextWrap}>
                          <Text style={styles.sessionTitle} numberOfLines={2}>
                            {item.title || 'Untitled chat'}
                          </Text>
                          <Text style={styles.sessionTime}>{formatSessionTime(item.updated_at)}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.sidebarEmptyWrap}>
                        <Ionicons name="chatbubbles-outline" size={36} color="#475569" />
                        <Text style={styles.sidebarEmptyTitle}>No saved chats yet</Text>
                        <Text style={styles.sidebarEmpty}>
                          Send a message to start. Your conversations will show up here.
                        </Text>
                      </View>
                    }
                  />
                )}
                {!isEmptyChat ? (
                  <TouchableOpacity style={styles.sidebarClearBtn} onPress={clearChat}>
                    <Ionicons name="trash-outline" size={16} color="#fda4af" />
                    <Text style={styles.sidebarClearText}>Clear current chat</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Pressable
                style={styles.sidebarBackdrop}
                onPress={() => setSidebarOpen(false)}
                accessibilityLabel="Close chat history"
              />
            </View>
          </Modal>

          <FlatList
            ref={flatListRef}
            data={chatItems}
            extraData={{ editingUserMessageId, planIntakeComplete, loading, userMessageCount }}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <LinearGradient
                  colors={['rgba(34, 211, 238, 0.18)', 'rgba(139, 92, 246, 0.12)']}
                  style={styles.emptyHero}
                >
                  <View style={styles.emptyHeroIcon}>
                    <Ionicons name="sparkles" size={28} color="#22d3ee" />
                  </View>
                  <Text style={styles.emptyTitle}>Hey {displayName}, who do you want to become?</Text>
                  <Text style={styles.emptyBody}>
                    Future U builds a timed plan with milestones and a checklist you can tick off. Pick a
                    path style, optionally set your timeline, then send your goal.
                  </Text>
                </LinearGradient>

                {renderPathModeSelector(false)}

                {showPlanIntakeInEmpty ? (
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

                <Text style={styles.emptySectionLabel}>Or try a starter</Text>
                {PRESET_PROMPTS.map((preset) => (
                  <TouchableOpacity
                    key={preset.text}
                    style={styles.emptyPresetCard}
                    onPress={() => sendText(preset.text)}
                    disabled={loading || !!editingUserMessageId}
                    activeOpacity={0.88}
                  >
                    <View style={styles.emptyPresetIconWrap}>
                      <Ionicons name={preset.icon} size={18} color="#22d3ee" />
                    </View>
                    <Text style={styles.emptyPresetText}>{preset.text}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#64748b" />
                  </TouchableOpacity>
                ))}

                <Text style={styles.emptyDisclaimer}>
                  Planning and motivation only — not medical, legal, or financial advice.
                </Text>
              </View>
            }
            ListFooterComponent={
              loading ? (
                <View style={[styles.messageRow, styles.assistantRow]}>
                  <View style={styles.avatarWrap}>
                    <LinearGradient colors={['#06b6d4', '#00ffff']} style={styles.avatar}>
                      <Ionicons name="rocket" size={16} color="#0f172a" />
                    </LinearGradient>
                  </View>
                  <View style={[styles.bubble, styles.assistantBubble, styles.thinkingBubble]}>
                    <LoadingDots size={10} color="#22d3ee" />
                    <Text style={styles.thinkingLabel}>Building your plan…</Text>
                  </View>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />

          <View style={[styles.inputBar, { paddingBottom: 12 + insets.bottom }]}>
            {!isEmptyChat ? renderPathModeSelector(true) : null}
            <View style={styles.composerMetaRow}>
              <Text style={styles.composerHint} numberOfLines={1}>
                {isEmptyChat ? 'Or type your goal below' : activeModeOption.label}
              </Text>
              <TouchableOpacity
                style={[
                  styles.depthChip,
                  responseDepth === RESPONSE_DEPTH.QUICK && styles.depthChipActive,
                ]}
                onPress={() =>
                  setResponseDepth((d) =>
                    d === RESPONSE_DEPTH.QUICK ? RESPONSE_DEPTH.DETAILED : RESPONSE_DEPTH.QUICK,
                  )
                }
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  responseDepth === RESPONSE_DEPTH.QUICK
                    ? 'Brief replies on. Tap for full plan.'
                    : 'Full plan on. Tap for brief replies.'
                }
              >
                <Ionicons
                  name={responseDepth === RESPONSE_DEPTH.QUICK ? 'flash' : 'reader-outline'}
                  size={14}
                  color={responseDepth === RESPONSE_DEPTH.QUICK ? '#0f172a' : '#c4b5fd'}
                />
                <Text
                  style={[
                    styles.depthChipText,
                    responseDepth === RESPONSE_DEPTH.QUICK && styles.depthChipTextActive,
                  ]}
                >
                  {responseDepth === RESPONSE_DEPTH.QUICK ? 'Brief' : 'Full plan'}
                </Text>
              </TouchableOpacity>
            </View>
            {editingUserMessageId ? (
              <View style={styles.editBanner}>
                <Text style={styles.editBannerText}>Editing your message</Text>
                <TouchableOpacity
                  onPress={cancelEditingUserMessage}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.editBannerCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={[
                  styles.micBtn,
                  voiceListening && styles.micBtnActive,
                  loading && styles.micBtnDisabled,
                ]}
                onPress={toggleVoiceInput}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={voiceListening ? 'Stop voice input' : 'Voice to text'}
              >
                <Ionicons
                  name={voiceListening ? 'mic' : 'mic-outline'}
                  size={22}
                  color={voiceListening ? '#f87171' : '#c4b5fd'}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={
                  voiceListening
                    ? 'Listening…'
                    : editingUserMessageId
                      ? 'Edit your message…'
                      : 'Who do you want to become?'
                }
                placeholderTextColor="#64748b"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={MAX_USER_MESSAGE_CHARS}
                editable={!loading && !voiceListening}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  input.trim() && !loading ? styles.sendBtnActive : styles.sendBtnDisabled,
                ]}
                onPress={() => sendText(input)}
                disabled={!input.trim() || loading}
                accessibilityLabel={editingUserMessageId ? 'Save edited message' : 'Send message'}
              >
                {loading ? (
                  <ActivityIndicator color="#0f172a" size="small" />
                ) : editingUserMessageId ? (
                  <Ionicons name="checkmark" size={22} color="#0f172a" />
                ) : (
                  <Ionicons name="send" size={20} color={input.trim() ? '#0f172a' : '#64748b'} />
                )}
              </TouchableOpacity>
            </View>
          </View>

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
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
    zIndex: 5,
  },
  headerIconBtn: { padding: 8 },
  headerTitles: { flex: 1, marginHorizontal: 2, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: '#86efac', marginTop: 2, fontWeight: '600' },
  sidebarModalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sidebarPanel: {
    width: '86%',
    maxWidth: 320,
    backgroundColor: '#0c0a14',
    borderRightWidth: 1,
    borderRightColor: 'rgba(139, 92, 246, 0.25)',
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sidebarTitle: { color: '#f5f3ff', fontSize: 18, fontWeight: '800' },
  sidebarCloseBtn: { padding: 6 },
  newChatBtnWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22d3ee',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  newChatTextWide: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  sidebarLoading: { padding: 24, alignItems: 'center', gap: 10 },
  sidebarLoadingText: { color: '#94a3b8', fontSize: 13 },
  sidebarListContent: { paddingBottom: 16 },
  sidebarEmptyWrap: { paddingVertical: 32, paddingHorizontal: 8, alignItems: 'center' },
  sidebarEmptyTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginTop: 12 },
  sidebarEmpty: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  sidebarClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
  },
  sidebarClearText: { color: '#fda4af', fontWeight: '700', fontSize: 13 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    backgroundColor: 'rgba(139, 92, 246, 0.07)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  sessionRowActive: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  sessionIcon: { marginTop: 2, marginRight: 10 },
  sessionTextWrap: { flex: 1, minWidth: 0 },
  sessionTitle: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  sessionTime: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  chatListHeader: {
    paddingBottom: 8,
    marginBottom: 4,
  },
  planEmbedWrap: {
    marginTop: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 211, 238, 0.2)',
  },
  assistantPlanMessage: {
    width: '100%',
    marginVertical: 10,
    gap: 12,
  },
  assistantPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
  },
  assistantPlanLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  assistantIntroCard: {
    backgroundColor: 'rgba(14, 14, 22, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  planCardShell: {
    width: '100%',
  },
  addTasksBtnWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  addedBadgePlan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  pathModeBarInline: {
    marginTop: 4,
    marginBottom: 8,
  },
  pathModeBarCompact: {
    marginBottom: 10,
  },
  pathModeLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  pathModeSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 15, 24, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    padding: 3,
  },
  pathModeSegmentCompact: {
    borderRadius: 10,
  },
  pathModeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  pathModeBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.22)',
  },
  pathModeBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  pathModeBtnTextActive: { color: '#e0f2fe' },
  pathModeHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  composerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  composerHint: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  depthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  depthChipActive: {
    backgroundColor: '#22d3ee',
    borderColor: '#22d3ee',
  },
  depthChipText: { color: '#c4b5fd', fontSize: 11, fontWeight: '700' },
  depthChipTextActive: { color: '#0f172a' },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 220,
    flexGrow: 1,
  },
  emptyWrap: { paddingVertical: 8, paddingHorizontal: 2 },
  emptyHero: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
  },
  emptyHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, lineHeight: 26 },
  emptyBody: { fontSize: 14, lineHeight: 22, color: '#cbd5e1' },
  emptySectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 10,
  },
  emptyPresetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  emptyPresetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPresetText: { flex: 1, color: '#e2e8f0', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  emptyDisclaimer: { fontSize: 11, color: '#64748b', marginTop: 16, lineHeight: 17 },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 8,
    width: '100%',
    paddingHorizontal: 0,
  },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  userBubbleColumn: { maxWidth: '88%', alignItems: 'flex-end' },
  assistantBubbleColumn: { flex: 1, minWidth: 0, maxWidth: '92%' },
  userBubblePressable: {
    maxWidth: '100%',
    borderRadius: 20,
  },
  userBubblePressablePressed: {
    opacity: 0.92,
  },
  avatarWrap: { marginRight: 10, alignSelf: 'flex-start', marginTop: 2 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: { paddingHorizontal: 18, paddingVertical: 16, borderRadius: 22, maxWidth: '100%' },
  userBubble: {
    backgroundColor: '#8b5cf6',
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.35)',
  },
  userBubbleEditing: {
    borderWidth: 2,
    borderColor: '#22d3ee',
  },
  assistantBubble: {
    backgroundColor: 'rgba(14, 14, 22, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    borderTopLeftRadius: 8,
    width: '100%',
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    width: 'auto',
    minWidth: 180,
  },
  thinkingLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  bubbleText: { fontSize: 16, lineHeight: 24, color: '#f8fafc' },
  userBubbleText: { fontWeight: '500' },
  suggestedTasksPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 211, 238, 0.25)',
  },
  suggestedTasksLabel: {
    color: '#22d3ee',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  suggestedTaskLine: { color: '#e2e8f0', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  addTasksBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  addTasksBtnText: { color: '#e0f2fe', fontSize: 14, fontWeight: '800' },
  addedBadge: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addedBadgeText: { color: '#6ee7b7', fontSize: 12, fontWeight: '600' },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(8, 6, 16, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.25)',
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 6,
  },
  micBtn: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  micBtnActive: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  micBtnDisabled: { opacity: 0.35 },
  sendBtn: {
    marginLeft: 4,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  sendBtnActive: {
    backgroundColor: '#22d3ee',
    borderColor: '#22d3ee',
  },
  sendBtnDisabled: { opacity: 0.4 },
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
