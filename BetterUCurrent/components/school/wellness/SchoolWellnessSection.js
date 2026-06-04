import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Groups related hub content with a titled section (same pattern as Spiritual tab).
 */
export function SchoolWellnessSection({ title, subtitle, children, last = false }) {
  return (
    <View style={[styles.group, last && styles.groupLast]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: T.spacing.xl,
    paddingBottom: T.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  groupLast: {
    borderBottomWidth: 0,
    marginBottom: T.spacing.sm,
    paddingBottom: 0,
  },
  header: { marginBottom: 14 },
  title: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  subtitle: {
    color: T.sub,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  body: { gap: 14 },
});
