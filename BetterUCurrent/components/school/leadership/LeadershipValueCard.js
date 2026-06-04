import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { institutionalTheme as I } from "../institutionalTheme";

/**
 * Explains institutional ROI for principals / board conversations.
 */
export function LeadershipValueCard() {
  const bullets = [
    "One console for wellness signals, pastoral formation, MTSS triage, and peer accompaniment",
    "Board-ready anonymized exports — no student roster in aggregate views",
    "Aligns with Jesuit cura personalis: body, mind, spirit, and service in one student app",
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="diamond-outline" size={22} color={I.gold} />
        <Text style={styles.title}>Why schools invest in BetterU</Text>
      </View>
      {bullets.map((b, i) => (
        <View key={i} style={styles.row}>
          <Ionicons name="checkmark-circle" size={18} color={I.success} />
          <Text style={styles.txt}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: I.panel,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    marginBottom: 16,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { color: I.goldMuted, fontWeight: "800", fontSize: 15, flex: 1 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  txt: { flex: 1, color: I.sub, fontSize: 13, lineHeight: 20 },
});
