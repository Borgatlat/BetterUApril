import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/** Collapsed-by-default privacy explainer for the Support section. */
export function PrivacyExpandable() {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="How privacy works"
      >
        <Ionicons name="shield-checkmark" size={18} color={T.accent} />
        <Text style={styles.rowTitle}>How privacy works</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={T.subMuted} />
      </TouchableOpacity>
      {open ? (
        <Text style={styles.body}>
          Anonymous pulses stay off leadership charts. Counselors see your name only if you
          request support.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: T.cardBg,
    borderRadius: T.radiusLg,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowTitle: {
    flex: 1,
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
  },
  body: {
    color: T.sub,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 14,
    marginTop: -4,
  },
});
