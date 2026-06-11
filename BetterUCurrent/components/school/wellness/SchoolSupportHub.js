import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Unified "you are not alone" support story — Focus Lock, Partners, Emmaus (Tier 2).
 */
export function SchoolSupportHub({ onFocusLock, onAccountability, onEmmaus, onCounselor }) {
  const items = [
    {
      id: "focus",
      title: "Focus Lock",
      hint: "Put your phone down · stay present",
      icon: "phone-portrait-outline",
      color: T.accent,
      bg: T.accentDim,
      onPress: onFocusLock,
    },
    {
      id: "partners",
      title: "Accountability partners",
      hint: "Weekly check-ins with someone you trust",
      icon: "people-outline",
      color: T.gold,
      bg: T.goldDim,
      onPress: onAccountability,
    },
    {
      id: "emmaus",
      title: "Emmaus Companion",
      hint: "Peer support when you want company",
      icon: "walk-outline",
      color: "#3b82f6",
      bg: "rgba(59, 130, 246, 0.12)",
      onPress: onEmmaus,
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>
        You don&apos;t have to do hard days alone. Pick one way to get support on campus.
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={item.onPress}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View style={[styles.icon, { backgroundColor: item.bg }]}>
            <Ionicons name={item.icon} size={22} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.subMuted} />
        </TouchableOpacity>
      ))}
      {typeof onCounselor === "function" ? (
        <TouchableOpacity
          style={styles.counselor}
          onPress={onCounselor}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Request counselor support"
        >
          <Ionicons name="heart" size={18} color="#dc2626" />
          <Text style={styles.counselorTxt}>Need a counselor? Tap here — we only share your name if you ask.</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  lead: {
    color: T.sub,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: T.radiusLg,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: T.text, fontWeight: "800", fontSize: 15 },
  hint: { color: T.subMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  counselor: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
    padding: 12,
    borderRadius: T.radiusLg,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  counselorTxt: { flex: 1, color: T.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
});
