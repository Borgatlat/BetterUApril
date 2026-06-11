import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { dailyExamenCategoryExerciseParams } from "../../../lib/dailyExamNavigation";
import { spiritualTheme as T } from "./spiritualTheme";

/**
 * One-tap "start formation" hero — default landing CTA on Spiritual tab (Tier 2/3).
 */
export function FormationHeroCard({ onLiveTheFourth, labels }) {
  const router = useRouter();
  const L = labels ?? {
    formationHeroKicker: "Today's formation",
    formationHeroTitle: "Start Daily Examen",
    formationHeroSub: "Gratitude · review · mercy · tomorrow's resolution",
    liveTheFourthLabel: "Live the Fourth",
  };

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeTxt}>~3 min</Text>
      </View>
      <Text style={styles.kicker}>{L.formationHeroKicker}</Text>
      <Text style={styles.title}>{L.formationHeroTitle}</Text>
      <Text style={styles.sub}>{L.formationHeroSub}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: "/category-exercises",
              params: dailyExamenCategoryExerciseParams(),
            })
          }
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Start Daily Examen"
        >
          <Ionicons name="play" size={16} color={T.textOnAccent} />
          <Text style={styles.ctaTxt}>Begin now</Text>
        </TouchableOpacity>
        {typeof onLiveTheFourth === "function" ? (
          <TouchableOpacity
            style={styles.alt}
            onPress={onLiveTheFourth}
            accessibilityRole="button"
            accessibilityLabel="Open Live the Fourth weekly tasks"
          >
            <Ionicons name="flame-outline" size={16} color={T.accent} />
            <Text style={styles.altTxt}>{L.liveTheFourthLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(232, 160, 69, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeTxt: { color: "#b45309", fontSize: 11, fontWeight: "800" },
  kicker: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: { color: T.text, fontSize: 22, fontWeight: "800", marginBottom: 6 },
  sub: { color: T.sub, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaTxt: { color: T.textOnAccent, fontWeight: "800", fontSize: 14 },
  alt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.screenBg,
  },
  altTxt: { color: T.accent, fontWeight: "700", fontSize: 13 },
});
