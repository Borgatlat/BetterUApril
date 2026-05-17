import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { dailyExamenCategoryExerciseParams } from "../../../lib/dailyExamNavigation";
import { spiritualTheme } from "./spiritualTheme";

/** Opens the shared Daily Examen flow (same as Mental tab category). */
export function DailyExamenCta() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/category-exercises",
          params: dailyExamenCategoryExerciseParams(),
        })
      }
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Start Daily Examen, three minute review"
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="search" size={24} color="#e8a045" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.t}>Daily Examen</Text>
          <Text style={styles.s}>Three-minute Ignatian review · same guided steps as Mental wellness</Text>
        </View>
        <Ionicons name="play-circle-outline" size={28} color="#e8a045" />
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
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(232,160,69,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  t: { color: "#fff", fontWeight: "800", fontSize: 17 },
  s: { color: "#d8c9b0", fontSize: 13, marginTop: 4, lineHeight: 20 },
});
