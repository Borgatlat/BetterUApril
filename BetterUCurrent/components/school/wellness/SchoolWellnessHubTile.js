import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * One cell in the 2-column campus hub grid.
 */
export function SchoolWellnessHubTile({ icon, title, hint, iconColor, iconBg, onPress }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.hint} numberOfLines={2}>
        {hint}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={iconColor} style={styles.chev} />
    </TouchableOpacity>
  );
}

/** Two tiles per row with consistent gap. */
export function SchoolWellnessHubGrid({ children }) {
  return <View style={styles.grid}>{children}</View>;
}

/** Small label inside Explore sections */
export function SchoolWellnessHubGroupLabel({ children }) {
  return <Text style={styles.groupLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    maxWidth: "48%",
    minHeight: 118,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: T.radiusLg,
    padding: 13,
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  title: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
    paddingRight: 18,
    letterSpacing: -0.2,
  },
  hint: {
    color: T.sub,
    fontSize: 11,
    lineHeight: 15,
    paddingRight: 12,
  },
  chev: {
    position: "absolute",
    top: 12,
    right: 10,
    opacity: 0.7,
  },
  groupLabel: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginTop: 2,
    marginBottom: 2,
  },
});
