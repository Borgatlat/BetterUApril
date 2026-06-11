import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useOrgBranding } from "../../context/OrgBrandingContext";
import {
  fetchParentLinkedStudents,
  fetchParentStudentSummary,
} from "../../lib/parentPortalClient";

function StudentSummaryCard({ student, summary, loading }) {
  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }
  if (!summary) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{student.student_name}</Text>
      <Text style={styles.cardSub}>
        {student.grade_level ? `Grade ${student.grade_level}` : student.student_email}
      </Text>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{summary.service_hours_approved ?? 0}</Text>
          <Text style={styles.metricLbl}>Service hrs approved</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{summary.service_hours_pending ?? 0}</Text>
          <Text style={styles.metricLbl}>Pending review</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{summary.pulse_checkins_30d ?? 0}</Text>
          <Text style={styles.metricLbl}>Check-ins (30d)</Text>
        </View>
      </View>
      <View style={styles.row}>
        <Ionicons
          name={summary.checked_in_this_week ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={summary.checked_in_this_week ? "#059669" : "#94a3b8"}
        />
        <Text style={styles.rowTxt}>
          {summary.checked_in_this_week
            ? "Checked in with campus wellness this week"
            : "No wellness check-in yet this week"}
        </Text>
      </View>
      <Text style={styles.ferpa}>{summary.note}</Text>
    </View>
  );
}

export default function ParentDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { workspace } = useAuthSession();
  const { branding, theme: T } = useOrgBranding();
  const [students, setStudents] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const rows = await fetchParentLinkedStudents();
      setStudents(rows);
      const next = {};
      await Promise.all(
        rows.map(async (s) => {
          next[s.student_id] = await fetchParentStudentSummary(s.student_id);
        }),
      );
      setSummaries(next);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (workspace === "parent") load();
    }, [workspace, load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (workspace !== "parent") {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Parent portal is for linked guardian accounts.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: branding?.name ? `${branding.name} Family` : "Family portal" }} />
      <ScrollView
        style={[styles.container, { backgroundColor: T.screenBg }]}
        contentContainerStyle={{
          padding: 20,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: insets.bottom + 40,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.h1, { color: T.text }]}>Family portal</Text>
        <Text style={[styles.lead, { color: T.sub }]}>
          Service hours and wellness participation — never private journal or mood scores.
        </Text>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        {loading && !refreshing ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 24 }} />
        ) : null}

        {!loading && students.length === 0 ? (
          <View style={[styles.card, { borderColor: T.border, backgroundColor: T.cardBg }]}>
            <Text style={[styles.cardTitle, { color: T.text }]}>No students linked yet</Text>
            <Text style={[styles.cardSub, { color: T.sub }]}>
              Ask your school counselor to link your email to your student in BetterU.
            </Text>
          </View>
        ) : null}

        {students.map((s) => (
          <StudentSummaryCard
            key={s.student_id}
            student={s}
            summary={summaries[s.student_id]}
            loading={loading && !summaries[s.student_id]}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", padding: 24 },
  muted: { color: "#64748b", textAlign: "center" },
  h1: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  err: { color: "#dc2626", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: "#1e293b" },
  cardSub: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 12 },
  metrics: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metric: {
    flex: 1,
    backgroundColor: "#f4f6f8",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  metricVal: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  metricLbl: { fontSize: 10, color: "#64748b", textAlign: "center", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  rowTxt: { flex: 1, fontSize: 13, color: "#475569", fontWeight: "600" },
  ferpa: { fontSize: 11, color: "#94a3b8", lineHeight: 16, marginTop: 4 },
});
