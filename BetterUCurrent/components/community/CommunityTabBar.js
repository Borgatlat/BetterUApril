import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COMMUNITY_THEME as T } from "../../config/communityTheme";

const TABS = [
  { id: "feed", label: "Feed", icon: "home" },
  { id: "friends", label: "Friends", icon: "people" },
  { id: "groups", label: "Groups", icon: "people-circle" },
  { id: "league", label: "League", icon: "trophy" },
];

/**
 * Single-row tab bar (Instagram-style) — one place to switch Community sections.
 */
export function CommunityTabBar({ activeTab, onChange, badges = {} }) {
  return (
    <View style={styles.wrap}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const badge = badges[tab.id] ?? 0;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={active ? tab.icon : `${tab.icon}-outline`}
              size={20}
              color={active ? T.communityAccent : T.communityTextMuted}
            />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
            {badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
              </View>
            ) : null}
            {active ? <View style={styles.indicator} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.communityBorder,
    marginBottom: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    position: "relative",
    minHeight: 52,
  },
  label: {
    color: T.communityTextMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  labelActive: {
    color: T.communityTextPrimary,
    fontWeight: "800",
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    left: "18%",
    right: "18%",
    height: 2,
    borderRadius: 2,
    backgroundColor: T.communityAccent,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: "22%",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T.communityBadgeRed,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
});
