import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SUPPORT_OPTIONS } from "../../lib/emmausLabels";
import { emmausTheme as T } from "./emmausTheme";

export function EmmausStepSupportType({ value, onSelect }) {
  const isSilent = value === "silent_prayer_only";

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>What kind of support are you hoping for?</Text>
      <View style={styles.chips}>
        {SUPPORT_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons name={opt.icon} size={18} color={selected ? T.textOnAccent : T.sub} />
              <Text style={[styles.chipTxt, selected && styles.chipTxtOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {isSilent ? (
        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={20} color={T.calm} />
          <Text style={styles.infoTxt}>
            Your intention goes straight to the pastoral prayer log — no chat thread will open.
            A campus minister will pray with your request in mind.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  lead: { color: T.sub, fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardBg,
  },
  chipOn: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  chipTxt: { color: T.sub, fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: T.textOnAccent, fontWeight: "800" },
  info: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: T.calmDim,
    borderWidth: 1,
    borderColor: "rgba(138,180,255,0.3)",
  },
  infoTxt: { flex: 1, color: T.sub, fontSize: 13, lineHeight: 19 },
});
