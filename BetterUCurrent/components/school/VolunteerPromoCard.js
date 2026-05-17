import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * Navigate to Volunteer opportunities (routes use legacy spelling "oppurtunities").
 * Presented on Mental + Spiritual dashboards.
 */
export function VolunteerPromoCard() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.volunteerCard}
      onPress={() => router.push("/volunteer-oppurtunities")}
      activeOpacity={0.85}
    >
      <View style={styles.volunteerHeader}>
        <View style={styles.volunteerIconContainer}>
          <Ionicons name="heart-circle" size={28} color="#00ffff" />
        </View>
        <View style={styles.volunteerTextContainer}>
          <Text style={styles.volunteerTitle}>Volunteer Opportunities</Text>
          <Text style={styles.volunteerSubtitle}>Give back and build social fitness</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#00ffff" />
      </View>

      <Text style={styles.volunteerDescription}>
        Find opportunities that match your skills and interests, and make a meaningful impact in
        your community.
      </Text>

      
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
    marginBottom: 12,
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
  volunteerDescription: {
    color: "#d7fefe",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
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
