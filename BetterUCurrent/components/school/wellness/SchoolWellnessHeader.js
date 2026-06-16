import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../../../context/UserContext";
import { PremiumAvatar } from "../../../app/components/PremiumAvatar";
import NotificationBadge from "../../NotificationBadge";
import NotificationModal from "../../NotificationModal";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";
import { hexToRgba } from "../../../utils/homePageCustomization";
import { WellnessIntro } from "./WellnessIntro";

/** Top bar + wellness intro with school name. */
export function SchoolWellnessHeader({
  schoolName = "Your school",
  onBack,
  onBackHome,
  accentColor,
}) {
  const router = useRouter();
  const { userProfile } = useUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const accent = accentColor || T.accent;
  const displaySchool = schoolName?.trim() || "Your school";
  const handleBack = onBack ?? onBackHome;

  return (
    <>
      <View style={styles.topBar}>
        {typeof handleBack === "function" ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={accent} />
            <Text style={[styles.backTxt, { color: accent }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}

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

      <WellnessIntro schoolName={displaySchool} accentColor={accent} />

      <NotificationModal visible={showNotifications} onClose={() => setShowNotifications(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backTxt: { fontSize: 13, fontWeight: "700" },
  backSpacer: { width: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { borderRadius: 12, borderWidth: 1, padding: 4 },
});
