import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

function CrisisRow({ icon, label, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={T.accent} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="open-outline" size={18} color={T.subMuted} />
    </TouchableOpacity>
  );
}

export function CrisisSupportCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Crisis help</Text>
      <Text style={styles.sub}>Free, confidential support — 24/7</Text>
      <CrisisRow icon="call-outline" label="988 — call or text" onPress={() => Linking.openURL("tel:988")} />
      <CrisisRow
        icon="chatbubble-outline"
        label="Crisis Text — text HOME to 741741"
        onPress={() => Linking.openURL("https://www.crisistextline.org/")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.cardBg,
    borderRadius: T.radiusXl,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
  },
  title: { color: T.text, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  sub: { color: T.subMuted, fontSize: 13, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: T.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: T.text, flex: 1, fontSize: 14, fontWeight: "600" },
});
