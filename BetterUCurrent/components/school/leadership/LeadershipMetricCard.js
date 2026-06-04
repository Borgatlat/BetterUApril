import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { institutionalTheme as I } from "../institutionalTheme";

export function LeadershipMetricCard({ icon, label, sub, value, highlight }) {
  return (
    <View style={[styles.card, highlight && styles.cardHi]}>
      <Ionicons name={icon} size={22} color={highlight ? I.gold : I.accent} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

export function LeadershipMetricsRow({ children }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: I.panelElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: I.panelBorder,
    minHeight: 120,
  },
  cardHi: {
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: I.goldDim,
  },
  label: { color: I.sub, fontSize: 12, fontWeight: "700", marginTop: 10 },
  value: {
    color: I.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
    letterSpacing: -0.5,
  },
  sub: { color: I.subMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
});
