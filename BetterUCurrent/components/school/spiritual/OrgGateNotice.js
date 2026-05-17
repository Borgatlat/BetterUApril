import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Shown when a student session has no org_id yet (profile sync lag or provisioning gap).
 */
export function OrgGateNotice({ onRetry }) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Ionicons name="school-outline" size={22} color="#ffb347" />
      <View style={styles.copy}>
        <Text style={styles.title}>School link needed</Text>
        <Text style={styles.body}>
          Your account is marked as a student but we don’t see an organization attached yet.
          Spiritual check-ins that save to your school need that link — try refreshing after a
          moment, or sign out and sign back in with your school email.
        </Text>
        {typeof onRetry === "function" ? (
          <TouchableOpacity style={styles.btn} onPress={onRetry} accessibilityRole="button">
            <Text style={styles.btnTxt}>Tap to retry loading</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 179, 71, 0.09)",
    borderWidth: 1,
    borderColor: "rgba(255, 179, 71, 0.35)",
    marginBottom: 16,
  },
  copy: { flex: 1 },
  title: { color: "#ffc46b", fontWeight: "800", fontSize: 15, marginBottom: 6 },
  body: { color: "#d4c4b0", fontSize: 13, lineHeight: 19 },
  btn: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
