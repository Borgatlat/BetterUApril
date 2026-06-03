import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { emmausTheme as T } from "./emmausTheme";

export function EmmausStepNotes({ value, onChange }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Anything you want to share? (optional)</Text>
      <Text style={styles.sub}>Only your companion and campus staff can see this after you connect.</Text>
      <TextInput
        style={styles.input}
        placeholder="A few words if it helps…"
        placeholderTextColor={T.placeholder}
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <Text style={styles.count}>{value.length}/2000</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  lead: { color: T.text, fontWeight: "700", fontSize: 16 },
  sub: { color: T.subMuted, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: "rgba(0,0,0,0.28)",
    color: T.text,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
  },
  count: { color: T.subMuted, fontSize: 11, textAlign: "right" },
});
