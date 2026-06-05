import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Groups related hub content with a titled section (same pattern as Spiritual tab).
 * @param {boolean} [inCard] — wrap content in a rounded card surface
 */
export function SchoolWellnessSection({ title, subtitle, children, last = false, inCard = false }) {
  return (
    <View style={[styles.group, last && styles.groupLast]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.body, inCard && styles.bodyCard]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: T.spacing.lg,
  },
  groupLast: {
    marginBottom: T.spacing.sm,
  },
  header: { marginBottom: 12, paddingHorizontal: 2 },
  title: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  subtitle: {
    color: T.sub,
    fontSize: 14,
    marginTop: 5,
    lineHeight: 20,
    fontWeight: "500",
  },
  body: { gap: 12 },
  bodyCard: {
    backgroundColor: T.cardBg,
    borderRadius: T.radiusXl,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 14,
  },
});
