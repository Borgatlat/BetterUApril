import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * Navigate to Volunteer opportunities (routes use legacy spelling "oppurtunities").
 * `compact` — fits the Spiritual Today stack; default card for Mental tab.
 */
export function VolunteerPromoCard({ compact = false }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.volunteerCard, compact && styles.volunteerCardCompact]}
      onPress={() => router.push("/volunteer-oppurtunities")}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Find volunteer opportunities"
    >
      <View style={styles.volunteerHeader}>
        <View style={[styles.volunteerIconContainer, compact && styles.volunteerIconCompact]}>
          <Ionicons name="heart-circle" size={compact ? 22 : 28} color="#00ffff" />
        </View>
        <View style={styles.volunteerTextContainer}>
          <Text style={[styles.volunteerTitle, compact && styles.volunteerTitleCompact]}>
            {compact ? "Volunteer today" : "Volunteer Opportunities"}
          </Text>
          <Text style={[styles.volunteerSubtitle, compact && styles.volunteerSubtitleCompact]}>
            {compact ? "Find roles · log service hours" : "Service hours & campus outreach"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={compact ? 18 : 22} color="#00ffff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  volunteerCard: {
    backgroundColor: "rgba(0, 229, 229, 0.06)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 229, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  volunteerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  volunteerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    marginRight: 12,
  },
  volunteerTextContainer: {
    flex: 1,
  },
  volunteerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  volunteerSubtitle: {
    color: "#8ddddd",
    fontSize: 13,
  },
  volunteerCardCompact: {
    padding: 14,
    borderRadius: 14,
  },
  volunteerIconCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  volunteerTitleCompact: {
    fontSize: 16,
    marginBottom: 0,
  },
  volunteerSubtitleCompact: {
    fontSize: 12,
    marginTop: 2,
  },
  volunteerStatBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 10,
    gap: 8,
  },
  volunteerStat: {
    flex: 1,
    color: "#9ea9b1",
    fontSize: 12,
    lineHeight: 18,
  },
});
