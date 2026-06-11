import React, { useCallback, useState, useRef } from "react";

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

import { OrgGateNotice } from "../../components/school/spiritual/OrgGateNotice";

import { spiritualTheme } from "../../components/school/spiritual/spiritualTheme";

import { SpiritualPulseCard } from "../../components/school/spiritual/SpiritualPulseCard";

import { IntentionsBoardCard } from "../../components/school/spiritual/IntentionsBoardCard";

import { SpiritualTodaySection } from "../../components/school/spiritual/SpiritualTodaySection";
import { FormationHeroCard } from "../../components/school/spiritual/FormationHeroCard";
import { useOrgBranding } from "../../context/OrgBrandingContext";

import { SpiritualTodayProgress } from "../../components/school/spiritual/SpiritualTodayProgress";

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

import { mergeLiveFourthPromptsWithFallback, getLiveFourthWeekCode } from "../../lib/spiritualDefaults";



function SectionHeader({ title, subtitle, preview, expanded, onToggle }) {

  return (

    <TouchableOpacity

      style={styles.sectionHeaderTouch}

      onPress={onToggle}

      activeOpacity={onToggle ? 0.7 : 1}

      disabled={!onToggle}

      accessibilityRole={onToggle ? "button" : "header"}

      accessibilityState={{ expanded }}

    >

      <View style={styles.sectionHeaderRow}>

        <View style={{ flex: 1 }}>

          <Text style={styles.sectionTitle}>{title}</Text>

          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}

          {!expanded && preview ? <Text style={styles.sectionPreview}>{preview}</Text> : null}

        </View>

        {onToggle ? (

          <Ionicons

            name={expanded ? "chevron-up" : "chevron-down"}

            size={20}

            color={spiritualTheme.subMuted}

          />

        ) : null}

      </View>

    </TouchableOpacity>

  );

}



function SectionGroup({
  title,
  subtitle,
  children,
  last,
  defaultExpanded = true,
  preview,
  expanded: controlledExpanded,
  onExpandedChange,
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = onExpandedChange ?? setInternalExpanded;
  const collapsible = defaultExpanded === false || onExpandedChange != null;

  return (
    <View style={[styles.sectionGroup, last && styles.sectionGroupLast]}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        preview={preview}
        expanded={expanded}
        onToggle={collapsible ? () => setExpanded(!expanded) : undefined}
      />
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}



export default function SpiritualTab() {

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const scrollRef = useRef(null);

  const campusYRef = useRef(0);
  const todayYRef = useRef(0);

  const { orgId, workspace, isLoading: sessionLoading } = useAuthSession();
  const { labels, branding } = useOrgBranding();

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



  const campusPreview = [

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



  const scrollToCampusSection = useCallback(() => {

    setScrollToCampus(true);

  }, []);

  const scrollToTodaySection = useCallback(() => {
    if (todayYRef.current > 0) {
      scrollRef.current?.scrollTo({ y: todayYRef.current - 24, animated: true });
    }
  }, []);



  React.useEffect(() => {

    if (scrollToCampus && campusYRef.current > 0) {

      scrollRef.current?.scrollTo({ y: campusYRef.current - 24, animated: true });

      setScrollToCampus(false);

    }

  }, [scrollToCampus, wall, bulletin]);



  const onSharedForPrayerWall = useCallback(() => {
    setCampusExpanded(true);
    scrollToCampusSection();
  }, [scrollToCampusSection]);



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

      ref={scrollRef}

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
        {labels.spiritualTabTitle}
      </Text>
      <Text style={styles.sub}>{labels.spiritualTabSubtitle}</Text>

      <FormationHeroCard labels={labels} onLiveTheFourth={scrollToTodaySection} />

      <TouchableOpacity

        style={styles.mentalChip}

        onPress={() => router.push("/(tabs)/mental")}

        activeOpacity={0.85}

        accessibilityRole="button"

        accessibilityLabel="Open Mental tab for wellness mood check"

      >

        <Ionicons name="pulse-outline" size={18} color={spiritualTheme.accent} />

        <Text style={styles.mentalChipText}>Wellness mood check → Mental</Text>

        <Ionicons name="chevron-forward" size={16} color={spiritualTheme.subMuted} />

      </TouchableOpacity>



      <SpiritualTodayProgress weekCode={weekCode} onOpenLiveFourth={scrollToTodaySection} />



      {sessionLoading ? (

        <View style={styles.loadingRow}>

          <ActivityIndicator color={spiritualTheme.accent} />

          <Text style={styles.loadingTxt}>Checking your profile…</Text>

        </View>

      ) : null}



      {!orgReady ? <OrgGateNotice onRetry={onRefresh} /> : null}



      {err ? <Text style={styles.err}>{err}</Text> : null}



      <View
        onLayout={(e) => {
          todayYRef.current = e.nativeEvent.layout.y;
        }}
      >
      <SectionGroup title="Today" subtitle={`${labels.formationHeroKicker} · ${labels.serviceLabel}`} defaultExpanded>

        <SpiritualTodaySection

          prompts={prompts}

          promptsLoading={loadingLists && orgReady}

          orgId={orgId}

          orgReady={orgReady}

        />

      </SectionGroup>
      </View>



      <SectionGroup title="Discernment" subtitle="How is your spirit right now?" defaultExpanded>

        <SpiritualPulseCard orgId={orgId} orgReady={orgReady} />

        <IntentionsBoardCard

          orgId={orgId}

          orgReady={orgReady}

          onSharedForPrayerWall={onSharedForPrayerWall}

        />

      </SectionGroup>



      <SectionGroup

        title={labels.valuesSection}

        subtitle="Retreat tracks & campus prompts"

        defaultExpanded={false}

        preview={formationPreview}

      >

        <RetreatTracksSection tracksWithPrompts={retreatData} loading={loadingLists && orgReady} />

      </SectionGroup>



      <View

        onLayout={(e) => {

          campusYRef.current = e.nativeEvent.layout.y;

        }}

      >

        <SectionGroup
          title="Campus"
          subtitle="Calendar, bulletin, prayer wall"
          last
          defaultExpanded={false}
          expanded={campusExpanded}
          onExpandedChange={setCampusExpanded}
          preview={campusPreview}
        >

          <CampusCalendarList events={cal} loading={loadingLists && orgReady} />

          <SpiritualBulletinFeed posts={bulletin} readonly canModerate={false} />

          <SpiritualBulletinComposer orgId={orgId} orgReady={orgReady} onPosted={load} />

          <PrayerWallList items={wall} loading={loadingLists && orgReady} />

        </SectionGroup>

      </View>

    </ScrollView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: spiritualTheme.screenBg },

  content: { paddingHorizontal: 20 },

  centered: { flex: 1, backgroundColor: spiritualTheme.screenBg, justifyContent: "center", padding: 24 },

  sectionGroup: {

    marginBottom: 28,

    paddingBottom: 20,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: spiritualTheme.border,

  },

  sectionGroupLast: {

    borderBottomWidth: 0,

    marginBottom: 8,

    paddingBottom: 0,

  },

  sectionHeaderTouch: { marginBottom: 14 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },

  sectionTitle: {

    color: spiritualTheme.text,

    fontSize: 13,

    fontWeight: "800",

    letterSpacing: 1.1,

    textTransform: "uppercase",

  },

  sectionSubtitle: {

    color: spiritualTheme.sub,

    fontSize: 13,

    marginTop: 4,

    lineHeight: 18,

  },

  sectionPreview: {

    color: spiritualTheme.subMuted,

    fontSize: 12,

    marginTop: 6,

    fontStyle: "italic",

  },

  sectionBody: { gap: 14 },

  loadingRow: {

    flexDirection: "row",

    alignItems: "center",

    gap: 10,

    marginBottom: 12,

  },

  loadingTxt: { color: spiritualTheme.sub, fontSize: 13 },

  h1: { color: spiritualTheme.text, fontSize: 28, fontWeight: "800", marginBottom: 8, letterSpacing: -0.5 },

  sub: { color: spiritualTheme.sub, fontSize: 15, lineHeight: 22, marginBottom: 14 },

  mentalChip: {

    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    marginBottom: 12,

    paddingVertical: 10,

    paddingHorizontal: 12,

    borderRadius: 12,

    backgroundColor: spiritualTheme.accentDim,

    borderWidth: 1,

    borderColor: "rgba(0,229,229,0.22)",

  },

  mentalChipText: { flex: 1, color: spiritualTheme.sub, fontSize: 13, fontWeight: "600" },

  muted: { color: spiritualTheme.subMuted, fontSize: 14, textAlign: "center" },

  link: { color: spiritualTheme.accent, marginTop: 14, fontWeight: "700", textAlign: "center" },

  err: { color: spiritualTheme.danger, marginBottom: 10, fontSize: 13, lineHeight: 18 },

});

