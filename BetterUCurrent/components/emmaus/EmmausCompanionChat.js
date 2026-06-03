import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  fetchCompanionRequestById,
  fetchCompanionMessages,
  sendCompanionMessage,
  subscribeToCompanionMessages,
} from "../../lib/emmausCompanionClient";
import { labelCategory, labelSupport } from "../../lib/emmausLabels";
import { emmausTheme as T } from "./emmausTheme";

export function EmmausCompanionChat({ requestId }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthSession();
  const [request, setRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!requestId) return;
    setErr(null);
    try {
      const [req, msgs] = await Promise.all([
        fetchCompanionRequestById(requestId),
        fetchCompanionMessages(requestId),
      ]);
      setRequest(req);
      setMessages(msgs);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!requestId) return undefined;
    const sub = subscribeToCompanionMessages(requestId, () => load());
    return () => {
      sub.unsubscribe().catch(() => {});
    };
  }, [requestId, load]);

  const readOnly =
    !request ||
    request.status === "resolved" ||
    request.status === "unassigned";

  const send = async () => {
    if (readOnly || !text.trim()) return;
    setSending(true);
    try {
      await sendCompanionMessage(requestId, text);
      setText("");
      await load();
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => {
    const mine = item.sender_id === user?.id;
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleTxt, mine && styles.bubbleTxtMine]}>{item.body}</Text>
        <Text style={styles.bubbleTime}>
          {new Date(item.created_at).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Conversation not found or access denied.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.shell, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={64}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={T.accent} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Companion chat</Text>
          <Text style={styles.headerSub}>
            {labelCategory(request.category)} · {labelSupport(request.support_type)}
          </Text>
        </View>
      </View>

      {readOnly ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTxt}>
            {request.status === "resolved"
              ? "This conversation is closed."
              : "Chat opens after a companion accepts your request."}
          </Text>
        </View>
      ) : null}

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Say hello — this space is just for you and your companion.</Text>
        }
      />

      {!readOnly ? (
        <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={T.placeholder}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[styles.send, (!text.trim() || sending) && styles.sendOff]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={T.textOnAccent} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={T.textOnAccent} />
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: T.screenBg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: T.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  headerTitle: { color: T.text, fontWeight: "800", fontSize: 16 },
  headerSub: { color: T.subMuted, fontSize: 12, marginTop: 2 },
  banner: {
    backgroundColor: T.urgentDim,
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  bannerTxt: { color: T.sub, fontSize: 12, textAlign: "center" },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    alignSelf: "flex-start",
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: T.accentDim,
    borderColor: "rgba(0,229,229,0.35)",
  },
  bubbleTheirs: {},
  bubbleTxt: { color: T.text, fontSize: 15, lineHeight: 21 },
  bubbleTxtMine: { color: T.text },
  bubbleTime: { color: T.subMuted, fontSize: 10, marginTop: 6, alignSelf: "flex-end" },
  empty: { color: T.subMuted, textAlign: "center", marginTop: 40, fontSize: 14 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: "rgba(0,0,0,0.3)",
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { opacity: 0.4 },
  err: { color: T.danger, paddingHorizontal: 16, fontSize: 12 },
  muted: { color: T.sub, textAlign: "center" },
  link: { color: T.accent, marginTop: 12, fontWeight: "700" },
});
