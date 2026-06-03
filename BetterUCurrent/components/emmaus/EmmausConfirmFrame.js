import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { emmausTheme as T } from "./emmausTheme";

export function EmmausConfirmFrame({ silentPrayer, urgent }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name="checkmark-circle" size={56} color={T.success} />
      </View>
      <Text style={styles.title}>You&apos;re not alone</Text>
      {silentPrayer ? (
        <Text style={styles.body}>
          Your prayer intention was sent to the pastoral ministry log. Someone from campus ministry will
          hold you in prayer — quietly and with care.
        </Text>
      ) : (
        <Text style={styles.body}>
          Your request is with verified student leaders and campus staff. A companion may reach out when
          they accept your request.
          {urgent ? "\n\nBecause you marked this as urgent today, counselors have also been notified." : ""}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 24, gap: 14 },
  icon: { marginBottom: 8 },
  title: { color: T.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  body: { color: T.sub, fontSize: 15, lineHeight: 24, textAlign: "center", paddingHorizontal: 8 },
});
