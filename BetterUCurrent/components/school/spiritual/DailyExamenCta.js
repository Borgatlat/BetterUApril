import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { dailyExamenCategoryExerciseParams } from "../../../lib/dailyExamNavigation";
import { spiritualTheme } from "./spiritualTheme";

/** Opens the shared Daily Examen flow (same as Mental tab category). */
export function DailyExamenCta({ compact = false }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() =>
        router.push({
          pathname: "/category-exercises",
          params: dailyExamenCategoryExerciseParams(),
        })
      }
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Start Daily Examen, about three minutes"
    >
      <View style={styles.row}>
        <View style={[styles.icon, compact && styles.iconCompact]}>
          <Ionicons name="search" size={compact ? 20 : 24} color="#e8a045" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.t, compact && styles.tCompact]}>Daily Examen</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>~3 min</Text>
            </View>
          </View>
          {!compact ? (
            <Text style={styles.s}>
              Prayer with Christ · gratitude, review, mercy, tomorrow&apos;s resolution
            </Text>
          ) : (
            <Text style={styles.sCompact}>Ignatian prayer with Christ</Text>
          )}
        </View>
        {!compact ? <Ionicons name="play-circle-outline" size={28} color="#e8a045" /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spiritualTheme.radiusLg,
    padding: 16,
    backgroundColor: "rgba(232,160,69,0.09)",
    borderWidth: 1,
    borderColor: "rgba(232,160,69,0.28)",
    flex: 1,
  },
  cardCompact: {
    padding: 12,
    minHeight: 100,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(232,160,69,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCompact: { width: 36, height: 36, borderRadius: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  t: { color: spiritualTheme.text, fontWeight: "800", fontSize: 17 },
  tCompact: { fontSize: 15 },
  badge: {
    backgroundColor: "rgba(232,160,69,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeTxt: { color: "#e8c88a", fontSize: 10, fontWeight: "800" },
  s: { color: spiritualTheme.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  sCompact: { color: spiritualTheme.subMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
});
