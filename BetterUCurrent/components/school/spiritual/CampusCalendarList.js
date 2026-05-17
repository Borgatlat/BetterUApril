import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { format } from "date-fns";
import { SectionEmptyHint } from "./sectionEmptyHint";
import { spiritualTheme } from "./spiritualTheme";

export function CampusCalendarList({ events, loading }) {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Campus schedule</Text>
        <View style={styles.loader}>
          <ActivityIndicator color={spiritualTheme.accent} />
          <Text style={styles.sub}>Loading chapel & ministry times…</Text>
        </View>
      </View>
    );
  }

  if (!events?.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Campus schedule</Text>
        <SectionEmptyHint
          icon="calendar-outline"
          title="Nothing scheduled yet"
          subtitle="Rosary, confession, Mass, and other times appear here once your campus team adds them."
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Campus schedule</Text>
      <Text style={styles.lead}>Upcoming — pull down anywhere to refresh.</Text>
      {events.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.kind}>{e.kind}</Text>
          <Text style={styles.title}>{e.title}</Text>
          {e.body ? <Text style={styles.body}>{e.body}</Text> : null}
          <Text style={styles.time}>
            {format(new Date(e.starts_at), "EEE MMM d · h:mm a")}
            {e.ends_at ? ` – ${format(new Date(e.ends_at), "h:mm a")}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17 },
  lead: { color: spiritualTheme.subMuted, fontSize: 12, marginBottom: 4 },
  loader: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  sub: { color: spiritualTheme.sub, fontSize: 13 },
  row: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(100,180,255,0.2)",
    backgroundColor: "rgba(100,180,255,0.06)",
  },
  kind: { color: "#8ab4ff", fontSize: 11, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.5 },
  title: { color: "#fff", fontWeight: "700", fontSize: 16, marginTop: 4 },
  body: { color: "#b8c4cc", fontSize: 14, marginTop: 8, lineHeight: 20 },
  time: { color: "#8ad4ff", fontSize: 13, marginTop: 10, fontWeight: "600" },
});
