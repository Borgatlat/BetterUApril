import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";

function NavGroup({ label, children, accentColor, first = false }) {
  const accent = accentColor || T.accent;
  return (
    <View style={[styles.group, first && styles.groupFirst]}>
      <Text style={styles.groupLabel}>{label}</Text>
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { accentColor: accent, showDivider: index > 0 })
          : child,
      )}
    </View>
  );
}

function NavRow({ icon, label, meta, onPress, accentColor, showDivider = false }) {
  const accent = accentColor || T.accent;
  return (
    <TouchableOpacity
      style={[styles.row, showDivider && styles.rowDivider]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconBox, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={T.subMuted} />
    </TouchableOpacity>
  );
}

/**
 * List-style shortcuts — same UX pattern as SpiritualNavStrip (not chip grid).
 */
export function WellnessNavStrip({
  accentColor,
  todayPulse,
  onLogPulse,
  onFocusLock,
  onCounselor,
  onAccountability,
  onEmmaus,
  onSpiritual,
  onMental,
  onFitnessHome,
}) {
  const pulseMeta = todayPulse
    ? `Mood ${todayPulse.mood} · logged today`
    : "About 30 seconds · tap to start";

  return (
    <View style={[styles.wrap, { borderColor: `${accentColor || T.accent}2e` }]}>
      <NavGroup label="Quick actions" accentColor={accentColor} first>
        <NavRow
          icon={todayPulse ? "checkmark-circle-outline" : "pulse-outline"}
          label={todayPulse ? "Update today's pulse" : "Log today's pulse"}
          meta={pulseMeta}
          onPress={onLogPulse}
        />
        <NavRow icon="phone-portrait-outline" label="Focus Lock" meta="Phone-free timer" onPress={onFocusLock} />
        <NavRow icon="heart-outline" label="Counselor support" meta="Private request" onPress={onCounselor} />
        <NavRow icon="people-outline" label="Accountability partners" meta="Check-ins" onPress={onAccountability} />
        {typeof onEmmaus === "function" ? (
          <NavRow icon="walk-outline" label="Emmaus companion" meta="Peer support" onPress={onEmmaus} />
        ) : null}
      </NavGroup>

      <NavGroup label="Campus tools" accentColor={accentColor}>
        <NavRow icon="compass-outline" label="Spiritual life" meta="Examen & formation" onPress={onSpiritual} />
        <NavRow icon="leaf-outline" label="Mental wellness" meta="Calm & mood" onPress={onMental} />
        <NavRow icon="home-outline" label="Fitness home" meta="Workouts & schedule" onPress={onFitnessHome} />
      </NavGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(0, 229, 229, 0.03)",
    overflow: "hidden",
  },
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  groupFirst: { borderTopWidth: 0 },
  groupLabel: {
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
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: T.text, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: T.subMuted, fontSize: 12, marginTop: 2 },
});
