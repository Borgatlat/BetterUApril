import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spiritualTheme as T } from "./spiritualTheme";

/** Tab header — icon + title, matches wellness hub tone without the old gradient hero. */
export function SpiritualIntro({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Ionicons name="compass" size={24} color="#e8a045" />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 18,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(232, 160, 69, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(232, 160, 69, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, paddingTop: 2 },
  title: {
    color: T.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: T.sub,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
});
