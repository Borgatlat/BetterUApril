import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { buildUsccbDailyReadingsUrl } from "../../../lib/spiritualDefaults";
import { spiritualTheme } from "./spiritualTheme";

/** Opens USCCB Mass readings in the system browser (canonical daily lectionary). */
export function DailyReadingsCard() {
  const url = buildUsccbDailyReadingsUrl();

  const onOpen = async () => {
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert("Cannot open link", "Try again on a device with a browser installed.");
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityHint="Opens readings in your browser"
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="book-outline" size={24} color="#d4b56a" />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>Daily Mass readings</Text>
          <Text style={styles.sub}>USCCB · today’s Mass texts (opens outside the app)</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {url.replace("https://", "")}
          </Text>
        </View>
        <Ionicons name="open-outline" size={22} color="#8a9196" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(212,181,106,0.08)",
    borderRadius: spiritualTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212,181,106,0.28)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(212,181,106,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1 },
  title: { color: "#fff", fontWeight: "800", fontSize: 17 },
  sub: { color: "#c9bc98", fontSize: 13, marginTop: 4, lineHeight: 19 },
  meta: { color: spiritualTheme.subMuted, fontSize: 11, marginTop: 8 },
});
