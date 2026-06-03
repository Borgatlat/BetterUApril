import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spiritualTheme } from "./spiritualTheme";
import { dailyExamenCategoryExerciseParams } from "../../../lib/dailyExamNavigation";
import { buildUsccbDailyReadingsUrl } from "../../../lib/spiritualDefaults";
import { getLiveFourthWeekCode } from "../../../lib/spiritualDefaults";
import { loadLiveFourthWeekProgress } from "../../../lib/liveFourthProgress";
import { Linking } from "react-native";

/**
 * Horizontal chips summarizing today's spiritual habits (Examen, readings, Live the Fourth).
 */
export function SpiritualTodayProgress({ weekCode, onOpenLiveFourth }) {
  const router = useRouter();
  const [l4Done, setL4Done] = useState({ challenge: false, journal: false });

  const code = weekCode ?? getLiveFourthWeekCode(new Date());
  const l4Total = (l4Done.challenge ? 1 : 0) + (l4Done.journal ? 1 : 0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const progress = await loadLiveFourthWeekProgress(code);
        if (!cancelled) setL4Done(progress);
      })();
      return () => {
        cancelled = true;
      };
    }, [code]),
  );

  const chips = [
    {
      id: "examen",
      label: "Examen",
      icon: "search-outline",
      onPress: () =>
        router.push({
          pathname: "/category-exercises",
          params: dailyExamenCategoryExerciseParams(),
        }),
    },
    {
      id: "readings",
      label: "Readings",
      icon: "book-outline",
      onPress: () => Linking.openURL(buildUsccbDailyReadingsUrl()),
    },
    {
      id: "l4",
      label: l4Total >= 2 ? "Live the Fourth ✓" : `Live the Fourth (${l4Total}/2)`,
      icon: "flame-outline",
      onPress: onOpenLiveFourth,
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Today</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.chip}
            onPress={c.onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={c.label}
          >
            <Ionicons name={c.icon} size={16} color={spiritualTheme.accent} />
            <Text style={styles.chipText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    color: spiritualTheme.subMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: spiritualTheme.cardBg,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
  },
  chipText: { color: spiritualTheme.sub, fontSize: 13, fontWeight: "600" },
});
