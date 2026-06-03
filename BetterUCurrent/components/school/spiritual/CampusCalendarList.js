import React, { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { format, isAfter, isToday } from "date-fns";
import { SectionEmptyHint } from "./sectionEmptyHint";
import { spiritualTheme } from "./spiritualTheme";

function pickNextEvent(events) {
  if (!events?.length) return null;
  const now = new Date();
  const upcoming = [...events]
    .filter(
      (e) =>
        e.starts_at &&
        (isAfter(new Date(e.starts_at), now) || isToday(new Date(e.starts_at))),
    )
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return upcoming[0] ?? events[0];
}

export function CampusCalendarList({ events, loading }) {
  const nextEvent = useMemo(() => pickNextEvent(events), [events]);

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
      {nextEvent ? (
        <View style={styles.nextChip}>
          <Text style={styles.nextLabel}>Next up</Text>
          <Text style={styles.nextTitle} numberOfLines={1}>
            {nextEvent.title}
          </Text>
          <Text style={styles.nextTime}>
            {format(new Date(nextEvent.starts_at), isToday(new Date(nextEvent.starts_at)) ? "'Today' · h:mm a" : "EEE MMM d · h:mm a")}
          </Text>
        </View>
      ) : null}
      <Text style={styles.lead}>All upcoming — pull down to refresh.</Text>
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
  nextChip: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(100,180,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(100,180,255,0.35)",
    marginBottom: 4,
  },
  nextLabel: {
    color: "#8ab4ff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  nextTitle: { color: spiritualTheme.text, fontWeight: "700", fontSize: 16 },
  nextTime: { color: spiritualTheme.sub, fontSize: 13, marginTop: 4, fontWeight: "600" },
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
  title: { color: spiritualTheme.text, fontWeight: "700", fontSize: 16, marginTop: 4 },
  body: { color: spiritualTheme.sub, fontSize: 14, marginTop: 8, lineHeight: 20 },
  time: { color: "#8ad4ff", fontSize: 13, marginTop: 10, fontWeight: "600" },
});
