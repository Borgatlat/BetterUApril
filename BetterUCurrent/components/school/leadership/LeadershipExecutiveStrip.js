import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { institutionalTheme as I } from "../institutionalTheme";

/**
 * At-a-glance KPIs for principals — open tickets, adoption, sentinel.
 */
export function LeadershipExecutiveStrip({
  openAlerts = 0,
  pulseSample = null,
  stressSpike = false,
}) {
  return (
    <View style={styles.row}>
      <StripCell
        icon="notifications-outline"
        label="Open support"
        value={String(openAlerts)}
        tone={openAlerts > 0 ? "warn" : "ok"}
        hint={openAlerts > 0 ? "Needs same-day routing" : "Queue clear"}
      />
      <StripCell
        icon="people-outline"
        label="7-day pulses"
        value={pulseSample === null ? "—" : String(pulseSample)}
        tone="neutral"
        hint="Opt-in aggregate pool"
      />
      <StripCell
        icon={stressSpike ? "trending-up" : "shield-checkmark-outline"}
        label="Sentinel"
        value={stressSpike ? "Alert" : "Stable"}
        tone={stressSpike ? "warn" : "ok"}
        hint="48h stress drift"
      />
    </View>
  );
}

function StripCell({ icon, label, value, hint, tone }) {
  const border =
    tone === "warn" ? I.warn : tone === "ok" ? I.success : I.accent;
  const bg =
    tone === "warn" ? I.warnDim : tone === "ok" ? I.successDim : I.accentDim;

  return (
    <View style={[styles.cell, { backgroundColor: bg, borderColor: `${border}44` }]}>
      <Ionicons name={icon} size={20} color={border} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 16 },
  cell: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "flex-start",
    gap: 4,
    minHeight: 108,
  },
  value: { color: I.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
  label: { color: I.text, fontSize: 12, fontWeight: "700" },
  hint: { color: I.subMuted, fontSize: 10, lineHeight: 14, marginTop: 2 },
});
