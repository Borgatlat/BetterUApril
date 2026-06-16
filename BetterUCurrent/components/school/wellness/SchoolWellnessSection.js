import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

/**
 * Groups related hub content — cyan accent bar, sentence-case titles (mirrors SpiritualSection).
 */
export function SchoolWellnessSection({
  title,
  subtitle,
  children,
  last = false,
  inCard = false,
  accentColor,
}) {
  const accent = accentColor || T.accent;

  return (
    <View style={[styles.group, last && styles.groupLast]}>
      <View style={styles.header}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  accentBar: {
    width: 3,
    minHeight: 36,
    borderRadius: 2,
  },
  headerText: { flex: 1 },
  title: {
    color: T.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    color: T.sub,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
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
