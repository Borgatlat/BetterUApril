import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SectionEmptyHint } from "./sectionEmptyHint";
import { spiritualTheme } from "./spiritualTheme";

export function PrayerWallList({ items, loading }) {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Prayer wall</Text>
        <View style={styles.loader}>
          <ActivityIndicator color={spiritualTheme.accent} />
          <Text style={styles.sub}>Loading approved intentions…</Text>
        </View>
      </View>
    );
  }

  if (!items?.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Prayer wall</Text>
        <SectionEmptyHint
          icon="ribbon-outline"
          title="Quiet for now"
          subtitle="Approved anonymous intentions from classmates will surface here once campus ministers publish them."
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Prayer wall</Text>
      <Text style={styles.lead}>Anonymous, staff-approved reflections from your community.</Text>
      {items.map((r) => (
        <View key={r.id} style={styles.quote}>
          <Text style={styles.body}>&ldquo;{r.body}&rdquo;</Text>
          <Text style={styles.date}>{new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17 },
  lead: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  loader: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  sub: { color: spiritualTheme.sub, fontSize: 13 },
  quote: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,255,200,0.18)",
    backgroundColor: "rgba(0,255,200,0.05)",
  },
  body: { color: "#e4f5f1", fontSize: 15, lineHeight: 22, fontStyle: "italic" },
  date: { color: "#5a7a72", fontSize: 12, marginTop: 10, fontWeight: "600" },
});
