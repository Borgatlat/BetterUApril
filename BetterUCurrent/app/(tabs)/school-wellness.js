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

import { StudentDailyPulseCard } from "../../components/school/StudentDailyPulseCard";

import { SchoolWellnessHeader } from "../../components/school/wellness/SchoolWellnessHeader";

import { SchoolWellnessSection } from "../../components/school/wellness/SchoolWellnessSection";

import { PulseStatusBanner } from "../../components/school/wellness/PulseStatusBanner";

import { SchoolSupportHub } from "../../components/school/wellness/SchoolSupportHub";

import {

  SchoolWellnessHubGrid,

  SchoolWellnessHubTile,

  SchoolWellnessHubGroupLabel,

} from "../../components/school/wellness/SchoolWellnessHubTile";

import { PrivacyExpandable } from "../../components/school/wellness/PrivacyExpandable";

import { CrisisSupportCard } from "../../components/school/wellness/CrisisSupportCard";
import { EmmausStudentRequests } from "../../components/emmaus/EmmausStudentRequests";

import { schoolWellnessTheme as T } from "../../components/school/schoolWellnessTheme";

import { useAuthSession } from "../../hooks/useAuthSession";

import { useAuth } from "../../context/AuthContext";

import {
  fetchSchoolDisplayName,
  formatOrgIdAsDisplayName,
} from "../../lib/schoolOrgDisplay";

import { fetchTodayPulse } from "../../lib/schoolWellnessClient";
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
  const { branding } = useOrgBranding();

  const { refetchProfile, user } = useAuth();

  const pulseRef = useRef(null);

  const [refreshing, setRefreshing] = useState(false);

  const [pulseLoading, setPulseLoading] = useState(true);

  const [todayPulse, setTodayPulse] = useState(null);

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

      return;

    }

    setLoadErr(null);

    try {

      const row = await fetchTodayPulse();

      setTodayPulse(row);

    } catch (e) {

      setLoadErr(e?.message ?? String(e));

    } finally {

      setPulseLoading(false);

    }

  }, [workspace]);



  const loadAssignment = useCallback(async () => {

    if (workspace !== "student") return;

    try {

      const row = await fetchPendingAssignmentForStudent();

      setPendingAssignment(row);

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

      const rows = await fetchGradAtGradSummary();

      setGradSummary(rows);

    } catch (e) {

      if (__DEV__) console.warn("[school-wellness] grad at grad load:", e);

    } finally {

      setGradLoading(false);

    }

  }, [workspace]);



  useFocusEffect(

    useCallback(() => {

      setPulseLoading(true);

      setGradLoading(true);

      loadPulse();

      loadAssignment();

      loadGradAtGrad();

    }, [loadPulse, loadAssignment, loadGradAtGrad]),

  );



  useEffect(() => {

    if (!user?.id || workspace !== "student") return undefined;

    const sub = subscribeToStudentAssignments(user.id, () => {

      loadAssignment();

    });

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



  const onPulseSaved = useCallback((saved) => {

    setTodayPulse(saved ?? null);

    loadPulse();

  }, [loadPulse]);



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

        {

          paddingTop: Math.max(insets.top, 12),

          paddingBottom: Math.max(scrollPaddingBottom, insets.bottom + 96),

        },

      ]}

      refreshControl={

        <RefreshControl

          refreshing={refreshing}

          onRefresh={onRefresh}

          tintColor={T.accent}

          colors={[T.accent]}

        />

      }

      keyboardShouldPersistTaps="handled"

      showsVerticalScrollIndicator={false}

    >

      <SchoolWellnessHeader
        schoolName={schoolName}
        onBackHome={() => router.replace("/(tabs)/home")}
        logoUrl={branding?.logo_url}
        accentColor={branding?.primary_color}
      />

      {setupWarning ? (
        <View style={styles.setupBanner}>
          <Text style={styles.setupBannerText}>{setupWarning}</Text>
        </View>
      ) : null}

      {loadErr ? (

        <TouchableOpacity onPress={loadPulse} style={styles.errRow} accessibilityRole="button">

          <Text style={styles.errText}>{loadErr}</Text>

          <Text style={styles.errRetry}>Tap to retry</Text>

        </TouchableOpacity>

      ) : null}



      {pendingAssignment ? (
        <SchoolWellnessSection title="Needs your attention" subtitle="From your dean or counselor" inCard>

          <ReflectiveAssignmentCard

            assignment={pendingAssignment}

            onSubmitted={onAssignmentSubmitted}

          />

        </SchoolWellnessSection>

      ) : null}



      <SchoolWellnessSection title="Daily check-in" subtitle="How you're doing today" inCard>

        <PulseStatusBanner
          todayPulse={todayPulse}
          loading={pulseLoading && !refreshing}
          onPress={() => setPulseModalOpen(true)}
        />

        <StudentDailyPulseCard

          ref={pulseRef}

          todayPulse={todayPulse}

          modalOpen={pulseModalOpen}

          onModalOpenChange={setPulseModalOpen}

          onPulseSaved={onPulseSaved}

          surfaceHidden

        />

      </SchoolWellnessSection>



      <SchoolWellnessSection title="Support" subtitle="Focus · partners · Emmaus · counselor" inCard>
        <SchoolSupportHub
          onFocusLock={() => router.push("/focus-lock")}
          onAccountability={() => router.push("/accountability")}
          onEmmaus={() => router.push("/(modals)/emmaus-request")}
          onCounselor={() => pulseRef.current?.requestCounselor?.()}
        />
      </SchoolWellnessSection>



      <SchoolWellnessSection title="Explore campus" subtitle="Wellness tools linked to your school" inCard>

        <SchoolWellnessHubGroupLabel>Mind & spirit</SchoolWellnessHubGroupLabel>

        <SchoolWellnessHubGrid>

          <SchoolWellnessHubTile

            icon="compass-outline"

            title="Spiritual life"

            hint="Examen · Live the Fourth"

            iconColor={T.accent}

            iconBg={T.accentDim}

            onPress={() => router.push("/(tabs)/spiritual")}

          />

          <SchoolWellnessHubTile

            icon="leaf-outline"

            title="Mental sessions"

            hint="Exercises & Eleos"

            iconColor={T.purple}

            iconBg={T.purpleDim}

            onPress={() => router.push("/(tabs)/mental")}

          />

        </SchoolWellnessHubGrid>



        <SchoolWellnessHubGroupLabel>Body & community</SchoolWellnessHubGroupLabel>

        <SchoolWellnessHubGrid>

          <SchoolWellnessHubTile

            icon="home-outline"

            title="Fitness home"

            hint="Workouts & schedule"

            iconColor={T.accent}

            iconBg={T.accentDim}

            onPress={() => router.replace("/(tabs)/home")}

          />

          <SchoolWellnessHubTile

            icon="people-outline"

            title="Accountability"

            hint="Partners & check-ins"

            iconColor={T.gold}

            iconBg={T.goldDim}

            onPress={() => router.push("/accountability")}

          />

        </SchoolWellnessHubGrid>



        <SchoolWellnessHubGroupLabel>Service & support</SchoolWellnessHubGroupLabel>

        <SchoolWellnessHubGrid>

          <SchoolWellnessHubTile

            icon="heart-circle-outline"

            title="Volunteer"

            hint="Log service hours"

            iconColor={T.accent}

            iconBg={T.accentDim}

            onPress={() => router.push("/volunteer-oppurtunities")}

          />

          <SchoolWellnessHubTile

            icon="walk-outline"

            title="Emmaus Companion"

            hint="Peer pastoral support"

            iconColor="#8ab4ff"

            iconBg="rgba(138, 180, 255, 0.12)"

            onPress={() => router.push("/(modals)/emmaus-request")}

          />

        </SchoolWellnessHubGrid>

      </SchoolWellnessSection>



      <SchoolWellnessSection title="Grad at Grad" subtitle="Profile of the Graduate · five pillars" inCard>

        <GradAtGradPillarChart summaryRows={gradSummary} loading={gradLoading && !refreshing} />

      </SchoolWellnessSection>



      <SchoolWellnessSection title="Companion care" subtitle="Active peer mentor conversations" inCard>

        <EmmausStudentRequests />

        {isPeerMentor ? (
          <TouchableOpacity
            style={styles.mentorLink}
            onPress={() => router.push("/(school)/emmaus")}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <Text style={styles.mentorLinkTxt}>Open Emmaus mentor triage board</Text>
          </TouchableOpacity>
        ) : null}

      </SchoolWellnessSection>



      <SchoolWellnessSection title="Support & privacy" subtitle="Crisis lines and how your data is used" last inCard>

        <PrivacyExpandable />

        <CrisisSupportCard />

      </SchoolWellnessSection>



      {refreshing ? (

        <View style={styles.inlineLoader}>

          <ActivityIndicator size="small" color={T.accent} />

        </View>

      ) : null}

    </ScrollView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: T.screenBg },

  content: { paddingHorizontal: 20 },

  centered: { flex: 1, backgroundColor: T.screenBg, justifyContent: "center", padding: 24 },

  muted: { color: T.sub, fontSize: 14, textAlign: "center" },

  link: { color: T.accent, marginTop: 14, fontWeight: "700", textAlign: "center" },

  setupBanner: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.35)",
  },
  setupBannerText: { color: "#b45309", fontSize: 12, lineHeight: 17 },
  errRow: { marginBottom: 12 },

  errText: { color: T.danger, fontSize: 13 },

  errRetry: { color: T.accent, fontSize: 12, marginTop: 4, fontWeight: "600" },

  inlineLoader: { alignItems: "center", marginVertical: 8 },

  mentorLink: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(138, 180, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(138, 180, 255, 0.3)",
    alignItems: "center",
  },

  mentorLinkTxt: { color: "#8ab4ff", fontWeight: "800", fontSize: 14 },

});


