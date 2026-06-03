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
export function DailyReadingsCard({ compact = false }) {
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
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onOpen}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityHint="Opens readings in your browser"
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
          <Ionicons name="book-outline" size={compact ? 20 : 24} color="#d4b56a" />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Mass readings</Text>
          <Text style={[styles.sub, compact && styles.subCompact]}>
            {compact ? "USCCB · today" : "USCCB · today’s Mass texts (opens in browser)"}
          </Text>
          {!compact ? (
            <Text style={styles.meta} numberOfLines={1}>
              {url.replace("https://", "")}
            </Text>
          ) : null}
        </View>
        <Ionicons name="open-outline" size={compact ? 18 : 22} color={spiritualTheme.subMuted} />
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
    flex: 1,
  },
  cardCompact: {
    padding: 12,
    minHeight: 100,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(212,181,106,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapCompact: { width: 36, height: 36, borderRadius: 10 },
  textCol: { flex: 1 },
  title: { color: spiritualTheme.text, fontWeight: "800", fontSize: 17 },
  titleCompact: { fontSize: 15 },
  sub: { color: spiritualTheme.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  subCompact: { fontSize: 11, lineHeight: 15 },
  meta: { color: spiritualTheme.subMuted, fontSize: 11, marginTop: 6 },
});
