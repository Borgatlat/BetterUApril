import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/** Tab title block — mirrors SpiritualIntro but uses cyan pulse accent for wellness identity. */
export function WellnessIntro({ schoolName = "Your school", accentColor }) {
  const accent = accentColor || T.accent;
  const displaySchool = schoolName?.trim() || "Your school";

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconRing, { borderColor: `${accent}44`, backgroundColor: `${accent}18` }]}>
        <Ionicons name="pulse" size={26} color={accent} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title} accessibilityRole="header">
          Campus wellness
        </Text>
        <Text style={styles.subtitle}>
          {displaySchool} · daily pulse, support & campus tools
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 229, 229, 0.12)",
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, paddingTop: 2 },
  title: {
    color: T.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: T.sub,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
});
