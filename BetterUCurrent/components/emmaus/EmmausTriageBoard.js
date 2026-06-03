import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  fetchCompanionQueueAnon,
  fetchCompanionActive,
  acceptCompanionRequest,
  setCompanionStatus,
  subscribeToCompanionRequests,
  compareAnonRequests,
} from "../../lib/emmausCompanionClient";
import {
  labelCategory,
  labelSupport,
  labelFormat,
  labelUrgency,
} from "../../lib/emmausLabels";
import { emmausTheme as T } from "./emmausTheme";

const ACCENT = T.accent;
const URGENT = T.urgent;

export function EmmausTriageBoard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orgId, workspace, accountType, isPeerMentor } = useAuthSession();
  const [anon, setAnon] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const canAccess =
    orgId &&
    (workspace === "staff" || (workspace === "student" && isPeerMentor) ||
      accountType === "counselor" ||
      accountType === "admin");

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulsingBorder = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,91,107,0.35)", "rgba(255,91,107,1)"],
  });

  const load = useCallback(async () => {
    if (!orgId || !canAccess) return;
    setError(null);
    try {
      const [a, b] = await Promise.all([
        fetchCompanionQueueAnon(orgId),
        fetchCompanionActive(orgId),
      ]);
      setAnon([...a].sort(compareAnonRequests));
      setActive(b ?? []);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, canAccess]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!orgId || !canAccess) return undefined;
    const sub = subscribeToCompanionRequests(orgId, () => load());
    return () => {
      sub.unsubscribe().catch(() => {});
    };
  }, [orgId, canAccess, load]);

  const urgentCount = useMemo(
    () => anon.filter((r) => r.urgency_tier === "urgent_today").length,
    [anon],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAccept = async (id) => {
    setBusyId(id);
    try {
      await acceptCompanionRequest(id);
      await load();
      router.push(`/emmaus-chat/${id}`);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (id, status) => {
    setBusyId(id);
    try {
      await setCompanionStatus(id, status);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!canAccess) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={36} color={T.subMuted} />
        <Text style={styles.muted}>
          Emmaus triage is for peer mentors and campus counselors in your school.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
      }
    >
      <View style={styles.hero}>
        <Ionicons name="walk-outline" size={28} color={ACCENT} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Emmaus Companion</Text>
          <Text style={styles.heroSub}>
            Anonymous until you accept · live feed for your campus
          </Text>
        </View>
      </View>

      {urgentCount > 0 ? (
        <Animated.View style={[styles.urgentBanner, { borderColor: pulsingBorder }]}>
          <Ionicons name="alert-circle" size={24} color={URGENT} />
          <Text style={styles.urgentTxt}>
            {urgentCount} student{urgentCount > 1 ? "s" : ""} need someone today
          </Text>
        </Animated.View>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Text style={styles.sectionLabel}>Waiting for a companion ({anon.length})</Text>
      {anon.length === 0 ? (
        <Text style={styles.empty}>No unassigned requests right now.</Text>
      ) : (
        anon.map((row) => (
          <AnonCard
            key={row.id}
            row={row}
            busy={busyId === row.id}
            pulsingBorder={row.urgency_tier === "urgent_today" ? pulsingBorder : undefined}
            onAccept={() => handleAccept(row.id)}
          />
        ))
      )}

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Active companions ({active.length})</Text>
      {active.length === 0 ? (
        <Text style={styles.empty}>Accepted requests appear here with student names.</Text>
      ) : (
        active.map((row) => (
          <ActiveCard
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onChat={() => router.push(`/emmaus-chat/${row.id}`)}
            onInPerson={() => handleStatus(row.id, "converted_to_in_person")}
            onResolve={() => handleStatus(row.id, "resolved")}
          />
        ))
      )}
    </ScrollView>
  );
}

function AnonCard({ row, busy, pulsingBorder, onAccept }) {
  const urgent = row.urgency_tier === "urgent_today";
  const Container = urgent && pulsingBorder ? Animated.View : View;
  const borderStyle = urgent && pulsingBorder ? { borderColor: pulsingBorder } : {};

  return (
    <Container style={[styles.card, urgent && styles.cardUrgent, borderStyle]}>
      {urgent ? (
        <View style={styles.urgentPill}>
          <Text style={styles.urgentPillTxt}>Urgent today</Text>
        </View>
      ) : null}
      <Text style={styles.cardMeta}>{labelCategory(row.category)}</Text>
      <Text style={styles.cardTitle}>{labelSupport(row.support_type)}</Text>
      <Text style={styles.cardSub}>
        {labelFormat(row.format_preference)} · {labelUrgency(row.urgency_tier)}
      </Text>
      {row.student_notes_preview ? (
        <Text style={styles.preview} numberOfLines={2}>
          &ldquo;{row.student_notes_preview}&rdquo;
        </Text>
      ) : null}
      <Text style={styles.time}>{new Date(row.created_at).toLocaleString()}</Text>
      <TouchableOpacity
        style={[styles.acceptBtn, busy && styles.btnBusy]}
        onPress={onAccept}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={T.textOnAccent} />
        ) : (
          <Text style={styles.acceptTxt}>Accept & become companion</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.anonNote}>Student identity hidden until you accept</Text>
    </Container>
  );
}

function ActiveCard({ row, busy, onChat, onInPerson, onResolve }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.student_full_name}</Text>
      <Text style={styles.cardSub}>
        {labelCategory(row.category)} · {labelSupport(row.support_type)}
      </Text>
      <Text style={styles.statusChip}>{row.status.replace(/_/g, " ")}</Text>
      <View style={styles.rowBtns}>
        <TouchableOpacity style={styles.smallBtn} onPress={onChat}>
          <Text style={styles.smallBtnTxt}>Open chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, styles.smallBtnAlt]}
          onPress={onInPerson}
          disabled={busy}
        >
          <Text style={styles.smallBtnTxtAlt}>Met in person</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnGhost]} onPress={onResolve} disabled={busy}>
          <Text style={styles.smallBtnTxtGhost}>Resolve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.screenBg },
  content: { padding: 16, gap: 10 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: T.screenBg },
  muted: { color: T.sub, textAlign: "center", marginTop: 12, fontSize: 14, lineHeight: 20 },
  hero: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 8 },
  heroTitle: { color: T.text, fontSize: 20, fontWeight: "800" },
  heroSub: { color: T.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: T.urgentDim,
    marginBottom: 8,
  },
  urgentTxt: { flex: 1, color: URGENT, fontWeight: "700", fontSize: 14 },
  sectionLabel: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 8,
  },
  empty: { color: T.subMuted, fontSize: 13, paddingVertical: 8 },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 10,
  },
  cardUrgent: { backgroundColor: T.urgentDim },
  urgentPill: {
    alignSelf: "flex-start",
    backgroundColor: URGENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  urgentPillTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cardMeta: { color: T.subMuted, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  cardTitle: { color: T.text, fontSize: 17, fontWeight: "800", marginTop: 4 },
  cardSub: { color: T.sub, fontSize: 13, marginTop: 4 },
  preview: { color: T.sub, fontSize: 13, fontStyle: "italic", marginTop: 8, lineHeight: 18 },
  time: { color: T.subMuted, fontSize: 11, marginTop: 8 },
  acceptBtn: {
    marginTop: 12,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnBusy: { opacity: 0.6 },
  acceptTxt: { color: T.textOnAccent, fontWeight: "800", fontSize: 14 },
  anonNote: { color: T.subMuted, fontSize: 11, marginTop: 8, textAlign: "center" },
  statusChip: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    textTransform: "capitalize",
  },
  rowBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: ACCENT,
  },
  smallBtnAlt: { backgroundColor: "rgba(138,180,255,0.2)", borderWidth: 1, borderColor: "rgba(138,180,255,0.4)" },
  smallBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: T.border },
  smallBtnTxt: { color: T.textOnAccent, fontWeight: "700", fontSize: 12 },
  smallBtnTxtAlt: { color: "#8ab4ff", fontWeight: "700", fontSize: 12 },
  smallBtnTxtGhost: { color: T.sub, fontWeight: "600", fontSize: 12 },
  err: { color: T.danger, fontSize: 13, marginBottom: 8 },
});
