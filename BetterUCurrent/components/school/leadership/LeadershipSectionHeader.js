import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { institutionalTheme as I } from "../institutionalTheme";

export function LeadershipSectionHeader({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 12 },
  title: {
    color: I.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sub: { color: I.sub, fontSize: 13, lineHeight: 19, marginTop: 6 },
});
