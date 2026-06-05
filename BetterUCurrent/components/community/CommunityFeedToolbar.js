import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COMMUNITY_THEME as T } from "../../config/communityTheme";
import { PremiumAvatar } from "../../app/components/PremiumAvatar";

const FILTERS = [
  { value: "all", label: "All", icon: "grid-outline" },
  { value: "workout", label: "Workouts", icon: "barbell-outline" },
  { value: "run", label: "Runs", icon: "fitness-outline" },
  { value: "mental", label: "Mind", icon: "leaf-outline" },
  { value: "pr", label: "PRs", icon: "trophy-outline" },
  { value: "event", label: "Events", icon: "calendar-outline" },
];

/**
 * Feed top: share composer + horizontal type filters (no duplicate Filter/Event buttons).
 */
export function CommunityFeedToolbar({
  userProfile,
  activeFilter,
  onFilterChange,
  onSharePress,
  onCreateEvent,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.composer}>
        <PremiumAvatar
          userId={userProfile?.id}
          source={userProfile?.avatar_url ? { uri: userProfile.avatar_url } : null}
          size={40}
          username={userProfile?.username}
          fullName={userProfile?.full_name}
          isPremium={userProfile?.is_premium}
        />
        <TouchableOpacity style={styles.composerTap} onPress={onSharePress} activeOpacity={0.88}>
          <Text style={styles.composerPlaceholder} numberOfLines={1}>
            Share a workout, run, or win…
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.eventBtn}
          onPress={onCreateEvent}
          hitSlop={12}
          accessibilityLabel="Create community event"
        >
          <Ionicons name="calendar-outline" size={22} color={T.communityAccent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTERS.map((f) => {
          const active = activeFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onFilterChange(f.value)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={f.icon}
                size={14}
                color={active ? "#051a1a" : T.communityTextSecondary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.hint}>Tap the thumbs up on a post to like it</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: T.spacing.sm,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.communityCardBg,
    borderRadius: T.communityRadius,
    borderWidth: 1,
    borderColor: T.communityBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 10,
  },
  composerTap: {
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  composerPlaceholder: {
    color: T.communityTextMuted,
    fontSize: 15,
    fontWeight: "500",
  },
  eventBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.communityCardBgHover,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.communityBorderActive,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: T.communityCardBg,
    borderWidth: 1,
    borderColor: T.communityBorder,
  },
  chipActive: {
    backgroundColor: T.communityAccent,
    borderColor: T.communityAccent,
  },
  chipText: {
    color: T.communityTextSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#051a1a",
  },
  hint: {
    color: T.communityTextMuted,
    fontSize: 12,
    marginTop: 10,
    marginLeft: 4,
  },
});
