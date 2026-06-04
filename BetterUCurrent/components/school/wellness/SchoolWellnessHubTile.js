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

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    width: "48%",
    minHeight: 132,
    backgroundColor: T.cardBg,
    borderRadius: T.radiusXl,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    color: T.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
    paddingRight: 20,
  },
  hint: {
    color: T.sub,
    fontSize: 12,
    lineHeight: 17,
    paddingRight: 16,
  },
  chev: {
    position: "absolute",
    top: 14,
    right: 12,
  },
});
