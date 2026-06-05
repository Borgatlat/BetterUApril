import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Horizontal quick actions — pulse logging lives on the banner above; these are shortcuts.
 */
export function SchoolWellnessQuickRow({
  onFocusLock,
  onCounselor,
  onAccountability,
  onEmmaus,
}) {
  const chips = [
    {
      id: "focus",
      label: "Focus Lock",
      hint: "Phone-free timer",
      icon: "phone-portrait-outline",
      color: T.accent,
      bg: T.accentDim,
      onPress: onFocusLock,
    },
    {
      id: "counselor",
      label: "Counselor",
      hint: "Request support",
      icon: "heart",
      color: "#fca5a5",
      bg: "rgba(220, 38, 38, 0.12)",
      onPress: onCounselor,
    },
    {
      id: "accountability",
      label: "Partners",
      hint: "Check-ins",
      icon: "people-outline",
      color: T.gold,
      bg: T.goldDim,
      onPress: onAccountability,
    },
    ...(typeof onEmmaus === "function"
      ? [
          {
            id: "emmaus",
            label: "Emmaus",
            hint: "Peer companion",
            icon: "walk-outline",
            color: "#8ab4ff",
            bg: "rgba(138, 180, 255, 0.12)",
            onPress: onEmmaus,
          },
        ]
      : []),
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.rowLabel}>Quick actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {chips.map((chip) => (
          <TouchableOpacity
            key={chip.id}
            style={styles.chip}
            onPress={chip.onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
          >
            <View style={[styles.iconCircle, { backgroundColor: chip.bg, borderColor: `${chip.color}33` }]}>
              <Ionicons name={chip.icon} size={20} color={chip.color} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {chip.label}
            </Text>
            <Text style={styles.hint} numberOfLines={1}>
              {chip.hint}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  rowLabel: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scroll: {
    gap: 10,
    paddingRight: 4,
  },
  chip: {
    width: 88,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  label: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  hint: {
    color: T.subMuted,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
});
