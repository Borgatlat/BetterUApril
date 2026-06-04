import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Compact school identity strip — shows the real school name (not generic “whole you” copy).
 */
export function CampusCareBanner({ schoolName = "Your school" }) {
  const name = schoolName?.trim() || "Your school";

  return (
    <View style={styles.wrap}>
      <Ionicons name="school-outline" size={18} color={T.gold} />
      <Text style={styles.title} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: T.radiusLg,
    backgroundColor: T.goldDim,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.28)",
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: T.text,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
