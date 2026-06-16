import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spiritualTheme as T } from "./spiritualTheme";
import { dailyExamenCategoryExerciseParams } from "../../../lib/dailyExamNavigation";
import { buildUsccbDailyReadingsUrl, getLiveFourthWeekCode } from "../../../lib/spiritualDefaults";
import { loadLiveFourthWeekProgress } from "../../../lib/liveFourthProgress";

/**
 * Compact spiritual shortcuts — list-style, not wellness hub chip grid.
 */
export function SpiritualNavStrip({ weekCode, onOpenLiveFourth, onOpenMental, onOpenWellness }) {
  const router = useRouter();
  const code = weekCode ?? getLiveFourthWeekCode(new Date());
  const [l4Done, setL4Done] = useState({ challenge: false, journal: false });

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

  const l4Total = (l4Done.challenge ? 1 : 0) + (l4Done.journal ? 1 : 0);

  const items = [
    {
      id: "examen",
      label: "Daily Examen",
      meta: "~3 min",
      icon: "search-outline",
      onPress: () =>
        router.push({
          pathname: "/category-exercises",
          params: dailyExamenCategoryExerciseParams(),
        }),
    },
    {
      id: "readings",
      label: "Scripture readings",
      meta: "USCCB",
      icon: "book-outline",
      onPress: () => Linking.openURL(buildUsccbDailyReadingsUrl()),
    },
    {
      id: "l4",
      label: "Live the Fourth",
      meta: `${l4Total}/2 this week`,
      icon: "flame-outline",
      onPress: onOpenLiveFourth,
    },
    {
      id: "mental",
      label: "Mood check-in",
      meta: "Mental tab",
      icon: "leaf-outline",
      onPress: onOpenMental ?? (() => router.push("/(tabs)/mental")),
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Start here</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={item.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={styles.iconBox}>
            <Ionicons name={item.icon} size={18} color="#e8a045" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowMeta}>{item.meta}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.subMuted} />
        </TouchableOpacity>
      ))}
      {typeof onOpenWellness === "function" ? (
        <TouchableOpacity style={styles.wellnessLink} onPress={onOpenWellness} activeOpacity={0.7}>
          <Ionicons name="pulse-outline" size={14} color={T.subMuted} />
          <Text style={styles.wellnessLinkTxt}>Campus wellness & daily pulse</Text>
          <Ionicons name="open-outline" size={14} color={T.subMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 160, 69, 0.18)",
    backgroundColor: "rgba(232, 160, 69, 0.04)",
    overflow: "hidden",
  },
  label: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(232, 160, 69, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: T.text, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: T.subMuted, fontSize: 12, marginTop: 2 },
  wellnessLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  wellnessLinkTxt: { color: T.subMuted, fontSize: 12, fontWeight: "600" },
});
