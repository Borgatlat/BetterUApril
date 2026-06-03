import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FORMAT_OPTIONS, URGENCY_OPTIONS } from "../../lib/emmausLabels";
import { emmausTheme as T } from "./emmausTheme";

function OptionGrid({ title, options, value, onSelect, urgentHighlight }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value === opt.id;
          const urgent = urgentHighlight && opt.id === "urgent_today";
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.cell,
                selected && styles.cellOn,
                urgent && selected && styles.cellUrgent,
              ]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={opt.icon}
                size={22}
                color={selected ? (urgent ? T.urgent : T.accent) : T.sub}
              />
              <Text style={[styles.cellTxt, selected && styles.cellTxtOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function EmmausStepFormatUrgency({
  formatPreference,
  urgencyTier,
  onFormat,
  onUrgency,
  hideFormat,
}) {
  return (
    <View style={styles.wrap}>
      {!hideFormat ? (
        <OptionGrid
          title="How would you like to connect?"
          options={FORMAT_OPTIONS}
          value={formatPreference}
          onSelect={onFormat}
        />
      ) : (
        <Text style={styles.skipNote}>Format not needed for silent prayer — we&apos;ll route you to pastoral care.</Text>
      )}
      <OptionGrid
        title="When do you need someone?"
        options={URGENCY_OPTIONS}
        value={urgencyTier}
        onSelect={onUrgency}
        urgentHighlight
      />
      {urgencyTier === "urgent_today" ? (
        <Text style={styles.urgentHint}>
          Campus mentors and counselors will be flagged today. If you are in immediate danger, also use
          crisis resources on the wellness tab.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  skipNote: { color: T.subMuted, fontSize: 13, lineHeight: 18, fontStyle: "italic" },
  block: { gap: 10 },
  blockTitle: { color: T.text, fontWeight: "700", fontSize: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    flex: 1,
    minWidth: "30%",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardBg,
    gap: 6,
  },
  cellOn: { borderColor: T.accent, backgroundColor: T.accentDim },
  cellUrgent: { borderColor: T.urgent, backgroundColor: T.urgentDim },
  cellTxt: { color: T.sub, fontSize: 12, fontWeight: "600", textAlign: "center" },
  cellTxtOn: { color: T.text, fontWeight: "800" },
  urgentHint: { color: T.urgent, fontSize: 12, lineHeight: 17 },
});
