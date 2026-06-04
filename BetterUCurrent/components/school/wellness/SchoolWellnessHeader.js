import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "../../../context/UserContext";
import { PremiumAvatar } from "../../../app/components/PremiumAvatar";
import NotificationBadge from "../../NotificationBadge";
import NotificationModal from "../../NotificationModal";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";
import { hexToRgba } from "../../../utils/homePageCustomization";

/**
 * Top bar: greeting + your school's name (not generic “whole you” marketing copy).
 */
export function SchoolWellnessHeader({ schoolName = "Your school" }) {
  const router = useRouter();
  const { userProfile } = useUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const accent = T.accent;
  const displaySchool = schoolName?.trim() || "Your school";
  const firstName =
    userProfile?.full_name?.split(" ")[0] || userProfile?.username || "there";

  return (
    <>
      <LinearGradient colors={T.heroGradient} style={styles.gradient}>
        <View style={styles.badgeRow}>
          <View style={styles.institutionalBadge}>
            <Text style={styles.badgeTxt}>SCHOOL WELLNESS</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={styles.greeting}>Hello, {firstName}</Text>
            <Text style={styles.h1} accessibilityRole="header" numberOfLines={2}>
              {displaySchool}
            </Text>
            <Text style={styles.tagline}>Wellness hub on BetterU</Text>
          </View>
          <View style={styles.actions}>
            <NotificationBadge
              onPress={() => setShowNotifications(true)}
              size="medium"
              showCount
              iconColor={accent}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: hexToRgba(accent, 0.06),
                  borderColor: hexToRgba(accent, 0.12),
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: hexToRgba(accent, 0.06),
                  borderColor: hexToRgba(accent, 0.12),
                },
              ]}
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.7}
              accessibilityLabel="Open profile"
            >
              <PremiumAvatar
                userId={userProfile?.id}
                source={userProfile?.avatar_url ? { uri: userProfile.avatar_url } : null}
                size={40}
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
      <NotificationModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    marginBottom: 4,
  },
  badgeRow: { marginBottom: 10 },
  institutionalBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: T.goldDim,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  badgeTxt: {
    color: T.goldMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  textCol: { flex: 1 },
  greeting: {
    color: T.sub,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  h1: {
    color: T.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  tagline: {
    color: T.subMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  iconBtn: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
});
