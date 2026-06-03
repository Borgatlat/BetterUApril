import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_OPTIONS } from "../../lib/emmausLabels";
import { emmausTheme as T } from "./emmausTheme";

export function EmmausStepCategory({ value, onSelect }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>What feels heaviest right now?</Text>
      <View style={styles.grid}>
        {CATEGORY_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.card, selected && styles.cardOn]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons name={opt.icon} size={28} color={selected ? T.accent : T.sub} />
              <Text style={[styles.title, selected && styles.titleOn]}>{opt.label}</Text>
              <Text style={styles.hint}>{opt.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  lead: { color: T.sub, fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "48%",
    minHeight: 120,
    padding: 14,
    borderRadius: T.radiusLg,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
    gap: 6,
  },
  cardOn: {
    borderColor: T.accent,
    backgroundColor: T.accentDim,
  },
  title: { color: T.text, fontWeight: "800", fontSize: 15 },
  titleOn: { color: T.accent },
  hint: { color: T.subMuted, fontSize: 12, lineHeight: 16 },
});
