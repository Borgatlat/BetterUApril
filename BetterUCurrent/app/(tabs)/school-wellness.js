import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { StudentDailyPulseCard } from "../../components/school/StudentDailyPulseCard";
import { SchoolWellnessHeader } from "../../components/school/wellness/SchoolWellnessHeader";
import { SchoolWellnessSection } from "../../components/school/wellness/SchoolWellnessSection";
import { PulseStatusBanner } from "../../components/school/wellness/PulseStatusBanner";
import { CampusPulseTodayCard } from "../../components/school/wellness/CampusPulseTodayCard";
import { WellnessNavStrip } from "../../components/school/wellness/WellnessNavStrip";
import {
  SchoolWellnessHubGrid,
  SchoolWellnessHubTile,
} from "../../components/school/wellness/SchoolWellnessHubTile";
import { PrivacyExpandable } from "../../components/school/wellness/PrivacyExpandable";
import { CrisisSupportCard } from "../../components/school/wellness/CrisisSupportCard";
import { EmmausStudentRequests } from "../../components/emmaus/EmmausStudentRequests";
import { SpiritualFoldSection } from "../../components/school/spiritual/SpiritualFoldSection";
import { schoolWellnessTheme as T } from "../../components/school/schoolWellnessTheme";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useAuth } from "../../context/AuthContext";
import { fetchSchoolDisplayName, formatOrgIdAsDisplayName } from "../../lib/schoolOrgDisplay";
import {
  fetchTodayPulse,
  fetchOrgPulseTodayAggregate,
} from "../../lib/schoolWellnessClient";
import { checkSchoolFeaturesHealth, checkSchoolOrgLinked } from "../../lib/schoolHealthCheck";
import { useOrgBranding } from "../../context/OrgBrandingContext";
import { fetchGradAtGradSummary } from "../../lib/gradAtGradClient";
import {
  fetchPendingAssignmentForStudent,
  subscribeToStudentAssignments,
} from "../../lib/administrativeAssignmentsClient";
import { GradAtGradPillarChart } from "../../components/school/GradAtGradPillarChart";
import { ReflectiveAssignmentCard } from "../../components/school/wellness/ReflectiveAssignmentCard";
import { useBottomChromeInsets } from "../../context/BottomChromeContext";

export default function SchoolWellnessHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useBottomChromeInsets();
  const { workspace, isPeerMentor, orgId } = useAuthSession();
  const { branding, modules } = useOrgBranding();
  const { refetchProfile, user } = useAuth();
  const pulseRef = useRef(null);

  const [refreshing, setRefreshing] = useState(false);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [campusPulseLoading, setCampusPulseLoading] = useState(true);
  const [todayPulse, setTodayPulse] = useState(null);
  const [campusPulse, setCampusPulse] = useState(null);
  const [pulseModalOpen, setPulseModalOpen] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [gradSummary, setGradSummary] = useState([]);
  const [gradLoading, setGradLoading] = useState(true);
  const [schoolName, setSchoolName] = useState(() => formatOrgIdAsDisplayName(orgId));
  const [setupWarning, setSetupWarning] = useState(null);

  useEffect(() => {
    if (!orgId) {
      setSchoolName("Your school");
      return;
    }
    let cancelled = false;
    fetchSchoolDisplayName(orgId).then((name) => {
      if (!cancelled) setSchoolName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const loadPulse = useCallback(async () => {
    if (workspace !== "student") {
      setPulseLoading(false);
      setCampusPulseLoading(false);
      return;
    }
    setLoadErr(null);
    setPulseLoading(true);
    setCampusPulseLoading(true);
    try {
      const [row, aggregate] = await Promise.all([
        fetchTodayPulse(),
        orgId ? fetchOrgPulseTodayAggregate(orgId) : Promise.resolve(null),
      ]);
      setTodayPulse(row);
      setCampusPulse(aggregate);
    } catch (e) {
      setLoadErr(e?.message ?? String(e));
    } finally {
      setPulseLoading(false);
      setCampusPulseLoading(false);
    }
  }, [workspace, orgId]);

  const loadAssignment = useCallback(async () => {
    if (workspace !== "student") return;
    try {
      setPendingAssignment(await fetchPendingAssignmentForStudent());
    } catch (e) {
      if (__DEV__) console.warn("[school-wellness] assignment load:", e);
    }
  }, [workspace]);

  const loadGradAtGrad = useCallback(async () => {
    if (workspace !== "student") {
      setGradLoading(false);
      return;
    }
    try {
      setGradSummary(await fetchGradAtGradSummary());
    } catch (e) {
      if (__DEV__) console.warn("[school-wellness] grad at grad load:", e);
    } finally {
      setGradLoading(false);
    }
  }, [workspace]);

  useFocusEffect(
    useCallback(() => {
      setPulseLoading(true);
      setCampusPulseLoading(true);
      setGradLoading(true);
      loadPulse();
      loadAssignment();
      loadGradAtGrad();
    }, [loadPulse, loadAssignment, loadGradAtGrad]),
  );

  useEffect(() => {
    if (!user?.id || workspace !== "student") return undefined;
    const sub = subscribeToStudentAssignments(user.id, loadAssignment);
    return () => {
      sub.unsubscribe().catch(() => {});
    };
  }, [user?.id, workspace, loadAssignment]);

  useFocusEffect(
    useCallback(() => {
      if (workspace !== "student") return;
      (async () => {
        const orgCheck = await checkSchoolOrgLinked(orgId);
        if (!orgCheck.ok) {
          setSetupWarning(orgCheck.message);
          return;
        }
        const health = await checkSchoolFeaturesHealth();
        if (health.missing.length > 0) {
          setSetupWarning(
            `Campus setup incomplete: ${health.missing.join(", ")}. Ask your admin to run school migrations.`,
          );
        } else {
          setSetupWarning(null);
        }
      })();
    }, [workspace, orgId]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchProfile?.();
      await loadPulse();
      await loadAssignment();
      await loadGradAtGrad();
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile, loadPulse, loadAssignment, loadGradAtGrad]);

  const onAssignmentSubmitted = useCallback(() => {
    setPendingAssignment(null);
  }, []);

  const onPulseSaved = useCallback(
    (saved) => {
      setTodayPulse(saved ?? null);
      loadPulse();
    },
    [loadPulse],
  );

  useEffect(() => {
    if (workspace && workspace !== "student") {
      router.replace("/(tabs)/home");
    }
  }, [workspace, router]);

  if (workspace !== "student") {
    return <View style={styles.container} />;
  }

  const accent = branding?.primary_color ?? T.accent;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: Math.max(scrollPaddingBottom, insets.bottom + 96),
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SchoolWellnessHeader
        schoolName={schoolName}
        onBackHome={() => router.replace("/(tabs)/home")}
        accentColor={accent}
      />

      {setupWarning ? (
        <View style={styles.setupBanner}>
          <Text style={styles.setupBannerText}>{setupWarning}</Text>
        </View>
      ) : null}

      {loadErr ? (
        <TouchableOpacity onPress={loadPulse} style={styles.errBox} accessibilityRole="button">
          <Text style={styles.errText}>{loadErr}</Text>
          <Text style={[styles.errRetry, { color: accent }]}>Tap to retry</Text>
        </TouchableOpacity>
      ) : null}

      {pendingAssignment ? (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Ionicons name="alert-circle" size={20} color={T.pulsePending} />
            <Text style={styles.alertTitle}>Needs your attention</Text>
          </View>
          <ReflectiveAssignmentCard assignment={pendingAssignment} onSubmitted={onAssignmentSubmitted} />
        </View>
      ) : null}

      <SchoolWellnessSection
        title="Daily pulse"
        subtitle="Your check-in and anonymous campus trends"
        accentColor={accent}
        inCard
      >
        <PulseStatusBanner
          todayPulse={todayPulse}
          loading={pulseLoading && !refreshing}
          onPress={() => setPulseModalOpen(true)}
        />
        <CampusPulseTodayCard
          aggregate={campusPulse}
          loading={campusPulseLoading && !refreshing}
          todayPulse={todayPulse}
        />
        <TouchableOpacity
          style={styles.counselorBtn}
          onPress={() => pulseRef.current?.requestCounselor?.()}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Request counselor support"
        >
          <Ionicons name="heart-outline" size={18} color="#fca5a5" />
          <Text style={styles.counselorBtnTxt}>Request counselor support</Text>
          <Ionicons name="chevron-forward" size={16} color={T.subMuted} />
        </TouchableOpacity>
        <StudentDailyPulseCard
          ref={pulseRef}
          todayPulse={todayPulse}
          modalOpen={pulseModalOpen}
          onModalOpenChange={setPulseModalOpen}
          onPulseSaved={onPulseSaved}
          surfaceHidden
        />
      </SchoolWellnessSection>

      <WellnessNavStrip
        accentColor={accent}
        todayPulse={todayPulse}
        onLogPulse={() => setPulseModalOpen(true)}
        onFocusLock={() => router.push("/focus-lock")}
        onCounselor={() => pulseRef.current?.requestCounselor?.()}
        onAccountability={() => router.push("/accountability")}
        onEmmaus={() => router.push("/(modals)/emmaus-request")}
        onSpiritual={() => router.push("/(tabs)/spiritual")}
        onMental={() => router.push("/(tabs)/mental")}
        onFitnessHome={() => router.replace("/(tabs)/home")}
      />

      <SchoolWellnessSection title="Go to" subtitle="Campus wellness tools" accentColor={accent}>
        <SchoolWellnessHubGrid>
          <SchoolWellnessHubTile
            icon="compass-outline"
            title="Spiritual life"
            hint="Examen & formation"
            iconColor={T.gold}
            iconBg={T.goldDim}
            onPress={() => router.push("/(tabs)/spiritual")}
          />
          <SchoolWellnessHubTile
            icon="leaf-outline"
            title="Mental"
            hint="Calm & mood"
            iconColor={T.purple}
            iconBg={T.purpleDim}
            onPress={() => router.push("/(tabs)/mental")}
          />
          <SchoolWellnessHubTile
            icon="phone-portrait-outline"
            title="Focus Lock"
            hint="Phone-free time"
            iconColor={accent}
            iconBg={`${accent}24`}
            onPress={() => router.push("/focus-lock")}
          />
          <SchoolWellnessHubTile
            icon="home-outline"
            title="Fitness home"
            hint="Workouts & schedule"
            iconColor={accent}
            iconBg={`${accent}24`}
            onPress={() => router.replace("/(tabs)/home")}
          />
          {modules?.nutrition ? (
            <SchoolWellnessHubTile
              icon="restaurant-outline"
              title="Nutrition"
              hint="Meals & macros"
              iconColor={accent}
              iconBg={`${accent}24`}
              onPress={() => router.push("/(tabs)/nutrition")}
            />
          ) : null}
        </SchoolWellnessHubGrid>
      </SchoolWellnessSection>

      <SpiritualFoldSection
        title="Grad at Grad"
        subtitle="Five pillars · your school profile"
        preview="Formation progress chart"
        defaultExpanded={false}
      >
        <GradAtGradPillarChart summaryRows={gradSummary} loading={gradLoading && !refreshing} />
      </SpiritualFoldSection>

      <SpiritualFoldSection
        title="Emmaus & privacy"
        subtitle="Peer companion · crisis lines · data use"
        preview="Companion care & FERPA-safe notes"
        defaultExpanded={false}
        last
      >
        <EmmausStudentRequests />
        {isPeerMentor ? (
          <TouchableOpacity
            style={[styles.mentorLink, { borderColor: `${accent}44`, backgroundColor: `${accent}12` }]}
            onPress={() => router.push("/(school)/emmaus")}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <Text style={[styles.mentorLinkTxt, { color: accent }]}>Open Emmaus mentor triage board</Text>
          </TouchableOpacity>
        ) : null}
        <PrivacyExpandable />
        <CrisisSupportCard />
      </SpiritualFoldSection>

      {refreshing ? (
        <View style={styles.inlineLoader}>
          <ActivityIndicator size="small" color={accent} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.screenBg },
  content: { paddingHorizontal: 20 },
  setupBanner: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.35)",
  },
  setupBannerText: { color: "#fbbf24", fontSize: 12, lineHeight: 17 },
  errBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  errText: { color: T.danger, fontSize: 13, lineHeight: 18 },
  errRetry: { fontSize: 12, marginTop: 4, fontWeight: "700" },
  alertCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: T.pulsePendingDim,
  },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  alertTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  counselorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.18)",
  },
  counselorBtnTxt: { flex: 1, color: T.text, fontSize: 14, fontWeight: "700" },
  inlineLoader: { alignItems: "center", marginVertical: 8 },
  mentorLink: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  mentorLinkTxt: { fontWeight: "800", fontSize: 14 },
});
