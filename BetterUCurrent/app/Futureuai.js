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
  'I want to become a software engineer at a strong tech company',
  'I want to get into Harvard for my intended major',
  'I want to become a registered nurse',
  'I want to build a startup with real revenue',
  'I want to grow as a confident team leader',
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

  const { listening: voiceListening, toggleListening: toggleVoiceInput } = useFutureUVoiceInput({
    onTranscript: setInput,
    disabled: loading,
  });

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

      const maxTokens = responseDepth === RESPONSE_DEPTH.QUICK ? 1400 : 2500;
      const raw = await callFutureUClaude({
        systemPrompt,
        messages: historyForModel,
        maxTokens,
      });
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
              <Text style={styles.subtitle}>Pathfinding coach</Text>
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

          <View style={styles.pathModeBar}>
            <Text style={styles.pathModeLabel}>Path style</Text>
            <View style={styles.pathModeSegment}>
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
            <Text style={styles.pathModeHint}>
              {promptMode === PROMPT_MODE.SPECIFIC
                ? MODE_OPTIONS[0].description
                : MODE_OPTIONS[1].description}
            </Text>
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
                  Choose Role model for one real exemplar, or General path for a typical playbook. Be
                  specific (school, role, sport) so answers match your target—not a nearby substitute.
                </Text>
                <Text style={styles.emptyDisclaimer}>
                  Planning & motivation only — not medical, legal, or financial advice.
                </Text>
                <Text style={styles.emptyHint}>Starter prompts below · menu icon for past chats</Text>
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
            <View style={styles.composerMetaRow}>
              {usageHint ? <Text style={styles.usageHint}>{usageHint}</Text> : <View />}
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
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                editable={!loading && !voiceListening}
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
  title: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  usageHint: { fontSize: 11, color: '#86efac', fontWeight: '600', flex: 1 },
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
  pathModeBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 92, 246, 0.18)',
  },
  pathModeLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  pathModeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  pathModeBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  pathModeBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  pathModeBtnTextActive: { color: '#e0f2fe' },
  pathModeHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  composerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 240,
    flexGrow: 1,
  },
  emptyWrap: { paddingVertical: 20, paddingHorizontal: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 10 },
  emptyBody: { fontSize: 14, lineHeight: 22, color: '#cbd5e1' },
  emptyDisclaimer: { fontSize: 12, color: '#64748b', marginTop: 12, lineHeight: 18 },
  emptyHint: { fontSize: 13, color: '#22d3ee', marginTop: 14 },
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
