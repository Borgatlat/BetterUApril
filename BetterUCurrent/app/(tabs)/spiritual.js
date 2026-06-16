import React, { useCallback, useState, useRef, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useAuth } from "../../context/AuthContext";
import { useOrgBranding } from "../../context/OrgBrandingContext";
import { useBottomChromeInsets } from "../../context/BottomChromeContext";
import { OrgGateNotice } from "../../components/school/spiritual/OrgGateNotice";
import { spiritualTheme as T } from "../../components/school/spiritual/spiritualTheme";
import { SpiritualIntro } from "../../components/school/spiritual/SpiritualIntro";
import { SpiritualNavStrip } from "../../components/school/spiritual/SpiritualNavStrip";
import { SpiritualSection } from "../../components/school/spiritual/SpiritualSection";
import { SpiritualFoldSection } from "../../components/school/spiritual/SpiritualFoldSection";
import { SpiritualPulseCard } from "../../components/school/spiritual/SpiritualPulseCard";
import { IntentionsBoardCard } from "../../components/school/spiritual/IntentionsBoardCard";
import { SpiritualTodaySection } from "../../components/school/spiritual/SpiritualTodaySection";
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
import {
  mergeLiveFourthPromptsWithFallback,
  getLiveFourthWeekCode,
} from "../../lib/spiritualDefaults";

export default function SpiritualTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useBottomChromeInsets();
  const scrollRef = useRef(null);
  const campusYRef = useRef(0);
  const todayYRef = useRef(0);

  const { orgId, workspace, isLoading: sessionLoading } = useAuthSession();
  const { labels } = useOrgBranding();
  const { refetchProfile } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [prompts, setPrompts] = useState(() => mergeLiveFourthPromptsWithFallback([], null));
  const [retreatData, setRetreatData] = useState([]);
  const [cal, setCal] = useState([]);
  const [bulletin, setBulletin] = useState([]);
  const [wall, setWall] = useState([]);
  const [err, setErr] = useState(null);
  const [scrollToCampus, setScrollToCampus] = useState(false);
  const [campusExpanded, setCampusExpanded] = useState(false);

  const orgReady = Boolean(orgId);
  const weekCode = getLiveFourthWeekCode(new Date());

  const formationPreview =
    retreatData.length > 0
      ? `${retreatData.length} retreat track${retreatData.length === 1 ? "" : "s"}`
      : "Retreat follow-up";

  const campusPreview =
    [
      cal.length > 0 ? `${cal.length} event${cal.length === 1 ? "" : "s"}` : null,
      bulletin.length > 0 ? `${bulletin.length} bulletin post${bulletin.length === 1 ? "" : "s"}` : null,
      wall.length > 0 ? `${wall.length} on prayer wall` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Calendar, bulletin, prayer wall";

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

  const scrollToTodaySection = useCallback(() => {
    if (todayYRef.current > 0) {
      scrollRef.current?.scrollTo({ y: todayYRef.current - 24, animated: true });
    }
  }, []);

  useEffect(() => {
    if (scrollToCampus && campusYRef.current > 0) {
      scrollRef.current?.scrollTo({ y: campusYRef.current - 24, animated: true });
      setScrollToCampus(false);
    }
  }, [scrollToCampus, wall, bulletin]);

  const onSharedForPrayerWall = useCallback(() => {
    setCampusExpanded(true);
    setScrollToCampus(true);
  }, []);

  if (workspace !== "student") {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Ionicons name="compass-outline" size={48} color={T.subMuted} style={{ marginBottom: 16 }} />
        <Text style={styles.muted}>Spiritual dashboard is only for enrolled school accounts.</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/home")} accessibilityRole="button">
          <Text style={styles.link}>Go home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: scrollPaddingBottom,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e8a045" colors={["#e8a045"]} />
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SpiritualIntro title={labels.spiritualTabTitle} subtitle={labels.spiritualTabSubtitle} />

      <SpiritualNavStrip
        weekCode={weekCode}
        onOpenLiveFourth={scrollToTodaySection}
        onOpenMental={() => router.push("/(tabs)/mental")}
        onOpenWellness={() => router.push("/(tabs)/school-wellness")}
      />

      {sessionLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#e8a045" />
          <Text style={styles.loadingTxt}>Checking your profile…</Text>
        </View>
      ) : null}

      {!orgReady ? <OrgGateNotice onRetry={onRefresh} /> : null}
      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.err}>{err}</Text>
        </View>
      ) : null}

      <View
        onLayout={(e) => {
          todayYRef.current = e.nativeEvent.layout.y;
        }}
      >
        <SpiritualSection
          title="Today"
          subtitle={`${labels.formationHeroKicker} · ${labels.serviceLabel}`}
        >
          <SpiritualTodaySection
            prompts={prompts}
            promptsLoading={loadingLists && orgReady}
            orgId={orgId}
            orgReady={orgReady}
          />
        </SpiritualSection>
      </View>

      <SpiritualSection title="Discernment" subtitle="Ignatian check-in · prayer intentions">
        <SpiritualPulseCard orgId={orgId} orgReady={orgReady} />
        <IntentionsBoardCard
          orgId={orgId}
          orgReady={orgReady}
          onSharedForPrayerWall={onSharedForPrayerWall}
        />
      </SpiritualSection>

      <SpiritualFoldSection
        title={labels.valuesSection}
        subtitle="Retreat tracks & campus prompts"
        defaultExpanded={false}
        preview={formationPreview}
      >
        <RetreatTracksSection tracksWithPrompts={retreatData} loading={loadingLists && orgReady} />
      </SpiritualFoldSection>

      <View
        onLayout={(e) => {
          campusYRef.current = e.nativeEvent.layout.y;
        }}
      >
        <SpiritualFoldSection
          title="Campus community"
          subtitle="Calendar, bulletin, prayer wall"
          defaultExpanded={false}
          expanded={campusExpanded}
          onExpandedChange={setCampusExpanded}
          preview={campusPreview}
          last
        >
          <CampusCalendarList events={cal} loading={loadingLists && orgReady} />
          <SpiritualBulletinFeed posts={bulletin} readonly canModerate={false} />
          <SpiritualBulletinComposer orgId={orgId} orgReady={orgReady} onPosted={load} />
          <PrayerWallList items={wall} loading={loadingLists && orgReady} />
        </SpiritualFoldSection>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.screenBg },
  content: { paddingHorizontal: 20 },
  centered: {
    flex: 1,
    backgroundColor: T.screenBg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  loadingTxt: { color: T.sub, fontSize: 13 },
  errBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  err: { color: T.danger, fontSize: 13, lineHeight: 18 },
  muted: { color: T.subMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  link: { color: T.accent, marginTop: 14, fontWeight: "700", textAlign: "center" },
});
