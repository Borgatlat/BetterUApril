import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { spiritualTheme as T } from "./spiritualTheme";

/**
 * Section wrapper unique to Spiritual tab — warm accent bar, sentence-case titles.
 */
export function SpiritualSection({ title, subtitle, children, last = false }) {
  return (
    <View style={[styles.wrap, last && styles.wrapLast]}>
      <View style={styles.header}>
        <View style={styles.accentBar} />
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  wrapLast: { marginBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  accentBar: {
    width: 3,
    height: "100%",
    minHeight: 36,
    borderRadius: 2,
    backgroundColor: "#e8a045",
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
  },
  body: { gap: 12 },
});
