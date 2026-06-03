import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SectionEmptyHint } from "./sectionEmptyHint";
import { spiritualTheme } from "./spiritualTheme";

export function RetreatTracksSection({ tracksWithPrompts, loading }) {
  const [open, setOpen] = useState({});

  useEffect(() => {
    if (tracksWithPrompts?.length === 1) {
      const id = tracksWithPrompts[0].track.id;
      setOpen((s) => (s[id] ? s : { ...s, [id]: true }));
    }
  }, [tracksWithPrompts]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Retreat follow-up</Text>
        <View style={styles.loader}>
          <ActivityIndicator color={spiritualTheme.accent} />
          <Text style={styles.sub}>Loading tracks…</Text>
        </View>
      </View>
    );
  }

  if (!tracksWithPrompts?.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Retreat follow-up</Text>
        <SectionEmptyHint
          icon="trail-sign-outline"
          title="No retreat tracks loaded"
          subtitle="Your school may add custom Kairos / confirmation tracks; defaults load with your campus link."
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Retreat follow-up</Text>
      <Text style={styles.muted}>Expand a track — prompts layer on top of the shared Live the Fourth ideas.</Text>
      {tracksWithPrompts.map(({ track, prompts }) => (
        <View key={track.id} style={styles.card}>
          <TouchableOpacity
            onPress={() => setOpen((s) => ({ ...s, [track.id]: !s[track.id] }))}
            accessibilityRole="button"
            accessibilityState={{ expanded: !!open[track.id] }}
          >
            <View style={styles.cardHead}>
              <Text style={styles.trackTitle}>{track.display_name}</Text>
              <Text style={styles.chev}>{open[track.id] ? "\u2212" : "+"}</Text>
            </View>
            <Text style={styles.slug}>
              {track.slug}
              {!track.org_id ? " · default templates" : ""}
            </Text>
          </TouchableOpacity>
          {open[track.id] ? (
            <View style={styles.promptBox}>
              {(prompts ?? []).length === 0 ? (
                <Text style={styles.emptyPr}>No prompts in this track yet.</Text>
              ) : (
                prompts.map((pr) => (
                  <View key={pr.id} style={styles.promptRow}>
                    <Text style={styles.kind}>{pr.kind}</Text>
                    <Text style={styles.body}>{pr.body}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17 },
  muted: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19 },
  loader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sub: { color: spiritualTheme.sub, fontSize: 13 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
    padding: 14,
    backgroundColor: spiritualTheme.cardBg,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trackTitle: { color: spiritualTheme.text, fontWeight: "700", fontSize: 16, flex: 1 },
  chev: { color: spiritualTheme.accent, fontSize: 20, fontWeight: "300", marginLeft: 8 },
  slug: { color: spiritualTheme.subMuted, fontSize: 12, marginTop: 6 },
  promptBox: { marginTop: 12, gap: 8 },
  promptRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  kind: { color: "#c77dff", fontSize: 11, textTransform: "uppercase", marginBottom: 4, fontWeight: "700" },
  body: { color: spiritualTheme.sub, fontSize: 14, lineHeight: 20 },
  emptyPr: { color: spiritualTheme.subMuted, fontSize: 13, paddingVertical: 8 },
});
