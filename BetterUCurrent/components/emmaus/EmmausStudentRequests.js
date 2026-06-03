import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { fetchMyCompanionRequests } from "../../lib/emmausCompanionClient";
import { labelCategory, labelSupport } from "../../lib/emmausLabels";
import { emmausTheme as T } from "./emmausTheme";

/** Active companion threads for the signed-in student. */
export function EmmausStudentRequests() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyCompanionRequests();
      setRows(
        (data ?? []).filter(
          (r) =>
            r.support_type !== "silent_prayer_only" &&
            ["active_chat", "converted_to_in_person"].includes(r.status),
        ),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;
  if (!rows.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Your companion chats</Text>
      {rows.map((r) => (
        <TouchableOpacity
          key={r.id}
          style={styles.row}
          onPress={() => router.push(`/emmaus-chat/${r.id}`)}
          activeOpacity={0.88}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{labelSupport(r.support_type)}</Text>
            <Text style={styles.sub}>{labelCategory(r.category)}</Text>
          </View>
          <Text style={styles.open}>Open</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  label: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.border,
  },
  title: { color: T.text, fontWeight: "700", fontSize: 14 },
  sub: { color: T.subMuted, fontSize: 12, marginTop: 2 },
  open: { color: T.accent, fontWeight: "800", fontSize: 13 },
});
