import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { institutionalTheme as I } from "../institutionalTheme";

/**
 * Premium hero for admin / counselor dashboards.
 */
export function LeadershipHero({ orgId, title, subtitle, icon = "shield-checkmark-outline" }) {
  return (
    <LinearGradient colors={I.heroLeadership} style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={28} color={I.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BETTERU · CAMPUS INSTITUTIONAL</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
      </View>
      {orgId ? (
        <View style={styles.orgRow}>
          <View style={styles.orgChip}>
            <Text style={styles.orgTxt}>ORG · {orgId}</Text>
          </View>
          <View style={styles.trustChip}>
            <Ionicons name="lock-closed-outline" size={12} color={I.goldMuted} />
            <Text style={styles.trustTxt}>FERPA-aware aggregates</Text>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: I.radiusXl,
    borderWidth: 1,
    borderColor: I.shadowBorder,
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  top: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: I.accentDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.25)",
  },
  eyebrow: {
    color: I.goldMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    color: I.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  sub: { color: I.sub, fontSize: 14, lineHeight: 21, marginTop: 8 },
  orgRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
  },
  orgChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: I.border,
  },
  orgTxt: { color: I.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: I.goldDim,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  trustTxt: { color: I.goldMuted, fontSize: 10, fontWeight: "700" },
});
