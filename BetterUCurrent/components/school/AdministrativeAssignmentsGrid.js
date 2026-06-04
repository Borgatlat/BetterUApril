import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  fetchStaffAssignments,
  subscribeToAdministrativeAssignments,
  approveAssignment,
} from "../../lib/administrativeAssignmentsClient";

const ACCENT = "#00e5e5";
const GREEN = "#5ce1a3";
const AMBER = "#e8c170";
const URGENT = "#ff5b6b";
const PANEL = "#0c1115";

/**
 * Dean / counselor grid for reflective disciplinary assignments.
 * Subscribes to administrative_assignments via Supabase Realtime.
 */
export function AdministrativeAssignmentsGrid() {
  const insets = useSafeAreaInsets();
  const { orgId, workspace } = useAuthSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!orgId || workspace !== "staff") return;
    setError(null);
    try {
      const data = await fetchStaffAssignments(orgId);
      setRows(data);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, workspace]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!orgId || workspace !== "staff") return undefined;
    const sub = subscribeToAdministrativeAssignments(orgId, () => load());
    return () => {
      sub.unsubscribe().catch((e) => {
        if (__DEV__) console.warn("[admin_assignments] unsubscribe failed:", e);
      });
    };
  }, [orgId, workspace, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleApprove = async (id) => {
    setBusyId(id);
    try {
      await approveAssignment(id);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const submittedCount = rows.filter((r) => r.status === "submitted").length;
  const assignedCount = rows.filter((r) => r.status === "assigned").length;

  if (workspace !== "staff") {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Staff only.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
      }
    >
      <View style={styles.hero}>
        <Ionicons name="document-text-outline" size={28} color={ACCENT} />
        <Text style={styles.heroTitle}>Reflective assignments</Text>
        <Text style={styles.heroSub}>
          Restorative discipline portal. Submissions update live when students submit reflections.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statNum}>{submittedCount}</Text>
          <Text style={styles.statLbl}>Awaiting review</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statNum}>{assignedCount}</Text>
          <Text style={styles.statLbl}>Outstanding</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={40} color={GREEN} />
          <Text style={styles.emptyTxt}>No active assignments in the queue.</Text>
        </View>
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            style={[
              styles.card,
              row.status === "submitted" && styles.cardSubmitted,
            ]}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{row.student_full_name}</Text>
                <Text style={styles.studentEmail}>{row.student_email}</Text>
              </View>
              <StatusBadge status={row.status} />
            </View>

            <Text style={styles.typeLabel}>
              {row.assignment_type === "restorative_plan" ? "Restorative plan" : "Reflective journal"}
            </Text>
            <Text style={styles.prompt} numberOfLines={4}>
              {row.prompt_text}
            </Text>

            {row.student_response ? (
              <View style={styles.responseBox}>
                <Text style={styles.responseLabel}>Student response</Text>
                <Text style={styles.responseText}>{row.student_response}</Text>
              </View>
            ) : null}

            <Text style={styles.meta}>
              Due {new Date(row.due_at).toLocaleString()} · Assigned by{" "}
              {row.assigned_by_name ?? "Staff"}
            </Text>

            {row.status === "submitted" ? (
              <TouchableOpacity
                style={[styles.approveBtn, busyId === row.id && styles.btnDisabled]}
                onPress={() => handleApprove(row.id)}
                disabled={busyId === row.id}
              >
                {busyId === row.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="#fff" />
                    <Text style={styles.approveTxt}>Approve & close</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.pendingPill}>
                <Ionicons name="time-outline" size={16} color={AMBER} />
                <Text style={styles.pendingTxt}>Waiting for student submission</Text>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function StatusBadge({ status }) {
  const isSubmitted = status === "submitted";
  return (
    <View style={[styles.badge, isSubmitted ? styles.badgeSubmitted : styles.badgeAssigned]}>
      <Text style={styles.badgeTxt}>{isSubmitted ? "Submitted" : "Assigned"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050708" },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050708" },
  muted: { color: "#888" },
  hero: { gap: 8, marginBottom: 8 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroSub: { color: "#9aa6ae", fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 10 },
  statPill: {
    flex: 1,
    backgroundColor: PANEL,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statNum: { color: ACCENT, fontSize: 24, fontWeight: "800" },
  statLbl: { color: "#888", fontSize: 12, marginTop: 2 },
  errorBanner: {
    backgroundColor: "rgba(255,91,107,0.15)",
    padding: 12,
    borderRadius: 10,
  },
  errorTxt: { color: "#ffb4b4", fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTxt: { color: "#888", fontSize: 15 },
  card: {
    backgroundColor: PANEL,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  cardSubmitted: {
    borderColor: "rgba(92,225,163,0.35)",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  studentName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  studentEmail: { color: "#888", fontSize: 12, marginTop: 2 },
  typeLabel: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  prompt: { color: "#ccc", fontSize: 14, lineHeight: 20 },
  responseBox: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
  },
  responseLabel: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  responseText: { color: "#e4eaed", fontSize: 14, lineHeight: 20 },
  meta: { color: "#666", fontSize: 11 },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  approveTxt: { color: "#050708", fontWeight: "800", fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  pendingTxt: { color: AMBER, fontSize: 13 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeSubmitted: { backgroundColor: "rgba(92,225,163,0.2)" },
  badgeAssigned: { backgroundColor: "rgba(255,91,107,0.15)" },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
