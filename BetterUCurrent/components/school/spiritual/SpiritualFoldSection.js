import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spiritualTheme as T } from "./spiritualTheme";

/** Collapsible block for lower-priority spiritual content (retreats, campus). */
export function SpiritualFoldSection({
  title,
  subtitle,
  preview,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  last = false,
  children,
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = onExpandedChange ?? setInternalExpanded;

  return (
    <View style={[styles.wrap, last && styles.wrapLast]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && expanded ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {!expanded && preview ? <Text style={styles.preview}>{preview}</Text> : null}
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={T.subMuted} />
      </TouchableOpacity>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },
  wrapLast: { marginBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  headerLeft: { flex: 1 },
  title: { color: T.text, fontSize: 16, fontWeight: "800" },
  subtitle: { color: T.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  preview: { color: T.subMuted, fontSize: 12, marginTop: 4, fontStyle: "italic" },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
});
