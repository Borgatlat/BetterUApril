import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spiritualTheme } from "./spiritualTheme";

/** Soft empty-state row (icon + copy) inside a tinted pill. */
export function SectionEmptyHint({ icon = "ellipse-outline", title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={22} color={spiritualTheme.sub} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: spiritualTheme.border,
  },
  icon: { marginTop: 2 },
  title: { color: spiritualTheme.emptyTitle, fontSize: 14, fontWeight: "600" },
  sub: { color: spiritualTheme.emptySub, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
