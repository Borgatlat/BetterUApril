import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StudentDailyPulseCard } from "../../components/school/StudentDailyPulseCard";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useAuth } from "../../context/AuthContext";

const ACCENT = "#00e5e5";

/**
 * Institutional “home” for students — pulse, quick links, calm resources.
 */
export default function SchoolWellnessHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orgId, workspace } = useAuthSession();
  const { refetchProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchProfile?.();
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile]);

  // SAFETY NET: if a non-student lands here (e.g. via stale router
  // history or a bad deep link), silently redirect to /home instead
  // of showing the "verified school students only" stub screen.
  // useEffect runs AFTER render — using router.replace inside it is
  // the correct pattern for "redirect on mount" because calling
  // navigation methods during render itself would warn / loop.
  useEffect(() => {
    if (workspace && workspace !== "student") {
      router.replace("/(tabs)/home");
    }
  }, [workspace, router]);

  // While the redirect is in flight (or workspace is still loading),
  // render NOTHING. We used to render a "this screen is for verified
  // school students" message here, but that was the screen the user
  // was occasionally seeing on back-navigation. Returning null gives
  // the user a clean black flash that's gone in one frame.
  if (workspace !== "student") {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 16) + 4, paddingBottom: insets.bottom + 96 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>BetterU · School wellness</Text>
      <Text style={styles.tagline}>Cura personalis — caring for mind, body, and spirit.</Text>
      <Text style={styles.sub}>
        Private pulse check-ins and calm pathways. Strength training and classmates live on Home; this hub stays restorative.
      </Text>

      <View style={styles.trustStrip}>
        <Ionicons name="shield-checkmark-outline" size={18} color={ACCENT} style={{ marginRight: 10 }} />
        <Text style={styles.trustStripTxt}>
          Pulses sent with “anonymize for school dashboard” never show your name in leadership charts — counselors only see identity if you open a formal support request yourself.
        </Text>
      </View>

      <StudentDailyPulseCard />

      <TouchableOpacity
        style={styles.navCard}
        onPress={() => router.push("/(tabs)/spiritual")}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Open spiritual life dashboard"
      >
        <View style={styles.navIcon}>
          <Ionicons name="compass-outline" size={22} color={ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Spiritual life</Text>
          <Text style={styles.navSub}>Scripture, discernment, prayer wall, bulletin, campus schedule</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={ACCENT} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navCardSecondary}
        onPress={() => router.push("/(tabs)/mental")}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Open mental wellness tab"
      >
        <View style={[styles.navIcon, { backgroundColor: "rgba(139,92,246,0.15)" }]}>
          <Ionicons name="leaf-outline" size={22} color="#c4a8ff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Mental wellness</Text>
          <Text style={styles.navSub}>Sessions, mood tools, and guided exercises</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#c4a8ff" />
      </TouchableOpacity>


      <View style={styles.growthCard}>
        <View style={styles.growthIcon}>
          <Ionicons name="rose-outline" size={22} color="#f0abfc" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.growthTitle}>Whole-person rhythms</Text>
          <Text style={styles.growthBody}>
            Use <Text style={styles.boldInline}>Spiritual life</Text> for weekly Live the Fourth, prayer, retreats, & chapel bulletin;
            pair with <Text style={styles.boldInline}>Mental wellness</Text> exercises for stress resets. Accountability friends & training stay on Home.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Mental health resources</Text>
        <ResourceRow
          icon="call-outline"
          label="988 Suicide & Crisis Lifeline"
          onPress={() => Linking.openURL("tel:988")}
        />
        <ResourceRow
          icon="globe-outline"
          label="Crisis Text Line (text HOME to 741741)"
          onPress={() => Linking.openURL("https://www.crisistextline.org/")}
        />
      </View>

      {refreshing ? (
        <View style={styles.inlineLoader}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : null}

      <Text style={styles.footer}>{orgId ? `School: ${orgId}` : "School: not linked"}</Text>
    </ScrollView>
  );
}

function ResourceRow({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.resource} onPress={onPress} accessibilityRole="button">
      <View style={{ marginRight: 12 }}>
        <Ionicons name={icon} size={22} color={ACCENT} />
      </View>
      <Text style={styles.resourceText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#555" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050708" },
  content: { paddingHorizontal: 20 },
  centered: { flex: 1, backgroundColor: "#050708", justifyContent: "center", padding: 24 },
  h1: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 6, letterSpacing: -0.3 },
  tagline: { color: ACCENT, fontSize: 14, fontWeight: "700", marginBottom: 8, letterSpacing: 0.2 },
  sub: { color: "#9aa4ad", fontSize: 15, lineHeight: 22, marginBottom: 14 },
  trustStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  trustStripTxt: { flex: 1, color: "#a8b8bc", fontSize: 12, lineHeight: 17 },
  growthCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(240,171,252,0.06)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(232,159,246,0.22)",
  },
  growthIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(240,171,252,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  growthTitle: { color: "#f5dafb", fontWeight: "800", fontSize: 16, marginBottom: 8 },
  growthBody: { color: "#cbc2d6", fontSize: 13, lineHeight: 19 },
  boldInline: { fontWeight: "800", color: "#fff" },
  /** Section titles inside bordered cards — keeps hierarchy under the main page `h1`. */
  h2: { color: ACCENT, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,229,229,0.07)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.28)",
  },
  navCardSecondary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.06)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
  },
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,229,229,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  navTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  navSub: { color: "#88929a", fontSize: 13, lineHeight: 18, marginTop: 4 },
  muted: { color: "#7a8790", fontSize: 13, lineHeight: 19 },
  resource: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  resourceText: { color: "#e4eaed", flex: 1, fontSize: 15 },
  link: { color: ACCENT, marginTop: 14, fontWeight: "700", textAlign: "center" },
  inlineLoader: { alignItems: "center", marginVertical: 8 },
  footer: { color: "#3d454c", fontSize: 11, marginTop: 12, textAlign: "center" },
});
