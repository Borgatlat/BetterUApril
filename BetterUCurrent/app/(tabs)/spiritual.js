import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useAuth } from "../../context/AuthContext";
import { VolunteerPromoCard } from "../../components/school/VolunteerPromoCard";
import { StudentDailyPulseCard } from "../../components/school/StudentDailyPulseCard";
import { OrgGateNotice } from "../../components/school/spiritual/OrgGateNotice";
import { spiritualTheme } from "../../components/school/spiritual/spiritualTheme";
import { DailyReadingsCard } from "../../components/school/spiritual/DailyReadingsCard";
import { SpiritualPulseCard } from "../../components/school/spiritual/SpiritualPulseCard";
import { IntentionsBoardCard } from "../../components/school/spiritual/IntentionsBoardCard";
import { DailyExamenCta } from "../../components/school/spiritual/DailyExamenCta";
import { LiveTheFourthSection } from "../../components/school/spiritual/LiveTheFourthSection";
import { RetreatTracksSection } from "../../components/school/spiritual/RetreatTracksSection";
import { CampusCalendarList } from "../../components/school/spiritual/CampusCalendarList";
import {
  SpiritualBulletinFeed,
  SpiritualBulletinComposer,
} from "../../components/school/spiritual/SpiritualBulletinFeed";
import { PrayerWallList } from "../../components/school/spiritual/PrayerWallList";
import {
  fetchLiveFourthPrompts,
  fetchRetreatTracks,
  fetchRetreatTrackPrompts,
  fetchSpiritualCalendarEvents,
  fetchSpiritualBulletinApproved,
  fetchPrayerWallIntentions,
} from "../../lib/spiritualSchoolClient";
import { mergeLiveFourthPromptsWithFallback } from "../../lib/spiritualDefaults";

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export default function SpiritualTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orgId, workspace, isLoading: sessionLoading } = useAuthSession();
  const { refetchProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  // Defaults show immediately — merge also supplies fallbacks when orgId / API row set is empty.
  const [prompts, setPrompts] = useState(() => mergeLiveFourthPromptsWithFallback([], null));
  const [retreatData, setRetreatData] = useState([]);
  const [cal, setCal] = useState([]);
  const [bulletin, setBulletin] = useState([]);
  const [wall, setWall] = useState([]);
  const [err, setErr] = useState(null);

  const orgReady = Boolean(orgId);

  const load = useCallback(async () => {
    if (workspace !== "student") return;
    setErr(null);
    if (!orgId) {
      setPrompts(mergeLiveFourthPromptsWithFallback([], null));
      setRetreatData([]);
      setCal([]);
      setBulletin([]);
      setWall([]);
      setLoadingLists(false);
      return;
    }
    setLoadingLists(true);
    try {
      const [p, tracks, ev, bul, w] = await Promise.all([
        fetchLiveFourthPrompts(orgId),
        fetchRetreatTracks(orgId),
        fetchSpiritualCalendarEvents(orgId),
        fetchSpiritualBulletinApproved(orgId),
        fetchPrayerWallIntentions(orgId),
      ]);
      setPrompts(mergeLiveFourthPromptsWithFallback(p, orgId));
      const withPrompts = await Promise.all(
        (tracks ?? []).map(async (t) => ({
          track: t,
          prompts: await fetchRetreatTrackPrompts(t.id),
        })),
      );
      setRetreatData(withPrompts);
      setCal(ev);
      setBulletin(bul);
      setWall(w);
    } catch (e) {
      setErr(e?.message ?? String(e));
      setPrompts(mergeLiveFourthPromptsWithFallback([], orgId ?? null));
    } finally {
      setLoadingLists(false);
    }
  }, [orgId, workspace]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchProfile?.();
    } catch {
      /* non-fatal */
    }
    await load();
    setRefreshing(false);
  };

  if (workspace !== "student") {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.muted}>Spiritual dashboard is only for enrolled school accounts.</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/home")} accessibilityRole="button">
          <Text style={styles.link}>Go home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: insets.bottom + 120 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={spiritualTheme.accent}
          colors={[spiritualTheme.accent]}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1} accessibilityRole="header">
        Spiritual life
      </Text>
      <Text style={styles.sub}>
        Cura personalis: small steps for scripture, discernment, prayer, and chapel rhythm — alongside your
        school wellness pulse and mental tools when you need a reset.
      </Text>

      {sessionLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={spiritualTheme.accent} />
          <Text style={styles.loadingTxt}>Checking your profile…</Text>
        </View>
      ) : null}

      {!orgReady ? <OrgGateNotice onRetry={onRefresh} /> : null}

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {orgReady ? (
        <SectionCard style={styles.pulseInset}>
          <StudentDailyPulseCard />
        </SectionCard>
      ) : (
        <SectionCard style={styles.pulseInset}>
          <Text style={styles.placeholderTitle}>School wellness pulse</Text>
          <Text style={styles.placeholderBody}>
            After your school link appears above, you can log mood, stress, and sleep here — same card
            as the School tab.
          </Text>
        </SectionCard>
      )}

      <SectionCard>
        <VolunteerPromoCard />
      </SectionCard>

      <SectionCard>
        <DailyReadingsCard />
      </SectionCard>

      <SectionCard>
        <SpiritualPulseCard orgId={orgId} orgReady={orgReady} />
      </SectionCard>

      <SectionCard>
        <IntentionsBoardCard orgId={orgId} orgReady={orgReady} />
      </SectionCard>

      <SectionCard>
        <DailyExamenCta />
      </SectionCard>

      <SectionCard>
        <LiveTheFourthSection prompts={prompts} loading={false} />
      </SectionCard>

      <SectionCard>
        <CampusCalendarList events={cal} loading={loadingLists && orgReady} />
      </SectionCard>

      <SectionCard>
        <SpiritualBulletinFeed posts={bulletin} readonly canModerate={false} />
        <SpiritualBulletinComposer orgId={orgId} orgReady={orgReady} onPosted={load} />
      </SectionCard>

      <SectionCard>
        <PrayerWallList items={wall} loading={loadingLists && orgReady} />
      </SectionCard>

      <SectionCard style={{ borderBottomWidth: 0 }}>
        <RetreatTracksSection tracksWithPrompts={retreatData} loading={loadingLists && orgReady} />
      </SectionCard>

      <TouchableOpacity
        style={styles.footerLink}
        onPress={() => router.push("/(tabs)/home")}
        accessibilityRole="button"
        accessibilityLabel="Open home"
      >
        <Text style={styles.footerLinkTxt}>Home</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Organization: {orgId ?? "not linked"}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: spiritualTheme.screenBg },
  content: { paddingHorizontal: 20 },
  centered: { flex: 1, backgroundColor: spiritualTheme.screenBg, justifyContent: "center", padding: 24 },
  sectionCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: spiritualTheme.border,
  },
  pulseInset: { marginBottom: 8, borderBottomWidth: 0, paddingBottom: 0 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  loadingTxt: { color: spiritualTheme.sub, fontSize: 13 },
  h1: { color: spiritualTheme.text, fontSize: 28, fontWeight: "800", marginBottom: 8, letterSpacing: -0.5 },
  sub: { color: spiritualTheme.sub, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  muted: { color: spiritualTheme.subMuted, fontSize: 14, textAlign: "center" },
  link: { color: spiritualTheme.accent, marginTop: 14, fontWeight: "700", textAlign: "center" },
  err: { color: spiritualTheme.danger, marginBottom: 10, fontSize: 13, lineHeight: 18 },
  footerLink: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: spiritualTheme.accentDim,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.35)",
  },
  footerLinkTxt: { color: spiritualTheme.accent, fontWeight: "700", fontSize: 14 },
  footer: { color: "#3d454c", fontSize: 11, marginTop: 16, textAlign: "center" },
  placeholderTitle: { color: spiritualTheme.text, fontWeight: "700", fontSize: 16, marginBottom: 6 },
  placeholderBody: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19 },
});
