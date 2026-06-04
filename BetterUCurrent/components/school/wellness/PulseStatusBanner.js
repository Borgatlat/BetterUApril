import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Shows whether today's pulse is logged and a compact mood/stress/sleep summary.
 *
 * @param {{ todayPulse: object | null, loading?: boolean }} props
 */
export function PulseStatusBanner({ todayPulse, loading = false }) {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={T.accent} size="small" />
        <Text style={styles.loadingTxt}>Checking today's pulse…</Text>
      </View>
    );
  }

  const done = Boolean(todayPulse);
  const accentColor = done ? T.pulseDone : T.pulsePending;
  const bg = done ? T.pulseDoneDim : T.pulsePendingDim;

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: `${accentColor}44` }]}>
      <View style={[styles.ring, { borderColor: accentColor }]}>
        <Ionicons
          name={done ? "checkmark-circle" : "ellipse-outline"}
          size={28}
          color={accentColor}
        />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{done ? "Today's pulse logged" : "Pulse not logged yet"}</Text>
        {done ? (
          <Text style={styles.summary}>
            Mood {todayPulse.mood} · Stress {todayPulse.stress_level} · Sleep{" "}
            {todayPulse.sleep_quality}
          </Text>
        ) : (
          <Text style={styles.summary}>Tap Log pulse below — takes under a minute</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: T.radiusLg,
    borderWidth: 1,
  },
  ring: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1 },
  title: { color: T.text, fontSize: 15, fontWeight: "800" },
  summary: { color: T.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  loadingTxt: { color: T.subMuted, fontSize: 13, marginLeft: 8 },
});
