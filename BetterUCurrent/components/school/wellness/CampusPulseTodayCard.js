import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

function Metric({ label, value, icon, color }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.metricVal}>{value ?? "—"}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

/**
 * Anonymized school-wide pulse for today (only when enough students opted in).
 */
export function CampusPulseTodayCard({ aggregate, loading, todayPulse }) {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={T.accent} size="small" />
        <Text style={styles.loadingTxt}>Loading campus pulse…</Text>
      </View>
    );
  }

  const yours = todayPulse
    ? {
        mood: todayPulse.mood,
        stress: todayPulse.stress_level,
        sleep: todayPulse.sleep_quality,
      }
    : null;

  if (!aggregate?.ok) {
    const n = aggregate?.sample_size ?? 0;
    const min = aggregate?.min_sample ?? 5;
    return (
      <View style={styles.wrapMuted}>
        <Ionicons name="people-outline" size={18} color={T.subMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.mutedTitle}>Campus average (today)</Text>
          <Text style={styles.mutedSub}>
            {n > 0
              ? `${n} of ${min}+ students checked in — averages stay hidden until more classmates log in anonymously.`
              : `No anonymous check-ins yet today. Log your pulse (keep “share anonymously” on) to help your campus see trends.`}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Campus average today</Text>
        <Text style={styles.badge}>{aggregate.sample_size} students</Text>
      </View>
      <Text style={styles.note}>Anonymous · only students who opted in to aggregate sharing</Text>
      <View style={styles.metricsRow}>
        <Metric label="Mood" value={aggregate.mood_avg} icon="happy-outline" color={T.pulseDone} />
        <Metric label="Stress" value={aggregate.stress_avg} icon="flash-outline" color={T.pulsePending} />
        <Metric label="Sleep" value={aggregate.sleep_avg} icon="moon-outline" color="#8ab4ff" />
      </View>
      {yours ? (
        <Text style={styles.compare}>
          You today: mood {yours.mood} · stress {yours.stress} · sleep {yours.sleep}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 14,
    borderRadius: T.radiusLg,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
    gap: 8,
  },
  wrapMuted: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: T.radiusLg,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: T.border,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: T.text, fontSize: 15, fontWeight: "800", flex: 1 },
  badge: {
    color: T.accent,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: T.accentDim,
    overflow: "hidden",
  },
  note: { color: T.subMuted, fontSize: 11, lineHeight: 16 },
  metricsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  metric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: T.border,
    gap: 4,
  },
  metricVal: { color: T.text, fontSize: 18, fontWeight: "800" },
  metricLbl: { color: T.subMuted, fontSize: 11, fontWeight: "600" },
  compare: { color: T.sub, fontSize: 12, marginTop: 4, lineHeight: 17 },
  mutedTitle: { color: T.text, fontSize: 14, fontWeight: "700" },
  mutedSub: { color: T.subMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  loadingTxt: { color: T.subMuted, fontSize: 13, marginLeft: 8 },
});
