import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Horizontal action chips (Instagram-style quick actions).
 */
export function SchoolWellnessQuickRow({
  onLogPulse,
  onFocusLock,
  onCounselor,
  onAccountability,
  onEmmaus,
}) {
  const chips = [
    {
      id: "pulse",
      label: "Log pulse",
      icon: "pulse-outline",
      color: T.accent,
      bg: T.accentDim,
      onPress: onLogPulse,
    },
    {
      id: "focus",
      label: "Focus Lock",
      icon: "phone-portrait-outline",
      color: T.accent,
      bg: T.accentDim,
      onPress: onFocusLock,
    },
    {
      id: "counselor",
      label: "Counselor",
      icon: "heart",
      color: "#fca5a5",
      bg: "rgba(220, 38, 38, 0.12)",
      onPress: onCounselor,
    },
    {
      id: "accountability",
      label: "Partners",
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
            icon: "walk-outline",
            color: "#8ab4ff",
            bg: "rgba(138, 180, 255, 0.12)",
            onPress: onEmmaus,
          },
        ]
      : []),
  ];

  return (
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
          <View style={[styles.iconCircle, { backgroundColor: chip.bg }]}>
            <Ionicons name={chip.icon} size={22} color={chip.color} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {chip.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 14,
    paddingVertical: 4,
    paddingRight: 8,
  },
  chip: {
    alignItems: "center",
    width: 76,
  },
  iconCircle: {
    width: T.radiusChip * 2,
    height: T.radiusChip * 2,
    borderRadius: T.radiusChip,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 8,
  },
  label: {
    color: T.sub,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
});
