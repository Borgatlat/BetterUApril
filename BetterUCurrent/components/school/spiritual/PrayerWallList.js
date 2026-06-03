import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { SectionEmptyHint } from "./sectionEmptyHint";
import { spiritualTheme } from "./spiritualTheme";

export function PrayerWallList({ items, loading }) {
  const prayFor = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* haptics optional */
    }
  };

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
          <View style={styles.footer}>
            <Text style={styles.date}>
              {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </Text>
            <TouchableOpacity
              onPress={prayFor}
              style={styles.prayBtn}
              accessibilityRole="button"
              accessibilityLabel="Pray for this intention"
            >
              <Text style={styles.prayTxt}>Pray for this</Text>
            </TouchableOpacity>
          </View>
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  date: { color: spiritualTheme.sub, fontSize: 12, fontWeight: "600", flex: 1 },
  prayBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: spiritualTheme.accentDim,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.25)",
  },
  prayTxt: { color: spiritualTheme.accent, fontSize: 12, fontWeight: "700" },
});
