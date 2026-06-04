import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { institutionalTheme as I } from "../institutionalTheme";

/**
 * Operations console shortcuts for leadership dashboard.
 */
export function LeadershipQuickNav({ items }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Operations console</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.btn, variantBtnStyle(item.variant)]}
          onPress={item.onPress}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View style={[styles.iconCircle, variantIconStyle(item.variant)]}>
            <Ionicons name={item.icon} size={22} color={item.iconColor ?? I.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={I.subMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const VARIANT_BTN = {
  triage: { backgroundColor: I.warnDim, borderColor: "rgba(255,91,107,0.35)" },
  emmaus: { backgroundColor: I.calmDim, borderColor: "rgba(138,180,255,0.35)" },
  report: { backgroundColor: I.accentDim, borderColor: "rgba(0,229,229,0.35)" },
  disciplinary: { backgroundColor: I.goldDim, borderColor: "rgba(212,175,55,0.35)" },
};

const VARIANT_ICON = {
  triage: { backgroundColor: "rgba(255,91,107,0.15)" },
  emmaus: { backgroundColor: "rgba(138,180,255,0.15)" },
  report: { backgroundColor: "rgba(0,229,229,0.15)" },
  disciplinary: { backgroundColor: "rgba(212,175,55,0.15)" },
};

function variantBtnStyle(v) {
  return v ? VARIANT_BTN[v] : null;
}

function variantIconStyle(v) {
  return v ? VARIANT_ICON[v] : null;
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 16 },
  label: {
    color: I.subMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: I.panelBorder,
    backgroundColor: I.panel,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: I.text, fontWeight: "800", fontSize: 15 },
  sub: { color: I.sub, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
