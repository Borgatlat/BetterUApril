import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Shows whether today's pulse is logged and a compact mood/stress/sleep summary.
 *
 * @param {{ todayPulse: object | null, loading?: boolean }} props
 */
export function PulseStatusBanner({ todayPulse, loading = false, onPress }) {
  if (loading) {
    return (
      <View style={[styles.wrap, styles.wrapNeutral]}>
        <ActivityIndicator color={T.accent} size="small" />
        <Text style={styles.loadingTxt}>Checking today's pulse…</Text>
      </View>
    );
  }

  const done = Boolean(todayPulse);
  const accentColor = done ? T.pulseDone : T.pulsePending;
  const bg = done ? T.pulseDoneDim : T.pulsePendingDim;

  const content = (
    <>
      <View style={[styles.ring, { borderColor: accentColor }]}>
        <Ionicons
          name={done ? "checkmark-circle" : "pulse-outline"}
          size={26}
          color={accentColor}
        />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{done ? "Today's pulse logged" : "Log today's pulse"}</Text>
        {done ? (
          <Text style={styles.summary}>
            Mood {todayPulse.mood} · Stress {todayPulse.stress_level} · Sleep{" "}
            {todayPulse.sleep_quality}
          </Text>
        ) : (
          <Text style={styles.summary}>Mood, stress & sleep — about 30 seconds</Text>
        )}
      </View>
      {onPress ? (
        <View style={[styles.actionPill, { backgroundColor: `${accentColor}22` }]}>
          <Text style={[styles.actionPillText, { color: accentColor }]}>
            {done ? "Update" : "Start"}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={accentColor} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.wrap, { backgroundColor: bg, borderColor: `${accentColor}44` }]}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.wrap, { backgroundColor: bg, borderColor: `${accentColor}44` }]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={done ? "Update today's pulse" : "Log today's pulse"}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: T.radiusLg,
    borderWidth: 1,
  },
  wrapNeutral: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: T.border,
  },
  ring: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { color: T.text, fontSize: 16, fontWeight: "800" },
  summary: { color: T.sub, fontSize: 13, marginTop: 3, lineHeight: 18 },
  loadingTxt: { color: T.subMuted, fontSize: 13, marginLeft: 8 },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionPillText: { fontSize: 12, fontWeight: "800" },
});
