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

import { SchoolWellnessQuickRow } from "../../components/school/wellness/SchoolWellnessQuickRow";

import {

  SchoolWellnessHubGrid,

  SchoolWellnessHubTile,

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
import { fetchGradAtGradSummary } from "../../lib/gradAtGradClient";
import {
  fetchPendingAssignmentForStudent,
  subscribeToStudentAssignments,
} from "../../lib/administrativeAssignmentsClient";
import { GradAtGradPillarChart } from "../../components/school/GradAtGradPillarChart";
import { ReflectiveAssignmentCard } from "../../components/school/wellness/ReflectiveAssignmentCard";



export default function SchoolWellnessHome() {

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const { workspace, isPeerMentor, orgId } = useAuthSession();

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

        { paddingTop: Math.max(insets.top, 16) + 4, paddingBottom: insets.bottom + 96 },

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

      <SchoolWellnessHeader schoolName={schoolName} />

      {loadErr ? (

        <TouchableOpacity onPress={loadPulse} style={styles.errRow} accessibilityRole="button">

          <Text style={styles.errText}>{loadErr}</Text>

          <Text style={styles.errRetry}>Tap to retry</Text>

        </TouchableOpacity>

      ) : null}



      <SchoolWellnessSection title="Today" subtitle="Check in · focus · support">

        {pendingAssignment ? (

          <ReflectiveAssignmentCard

            assignment={pendingAssignment}

            onSubmitted={onAssignmentSubmitted}

          />

        ) : null}

        <PulseStatusBanner todayPulse={todayPulse} loading={pulseLoading && !refreshing} />

        <SchoolWellnessQuickRow
          onLogPulse={() => setPulseModalOpen(true)}
          onFocusLock={() => router.push("/focus-lock")}
          onCounselor={() => pulseRef.current?.requestCounselor?.()}
          onAccountability={() => router.push("/accountability")}
          onEmmaus={() => router.push("/(modals)/emmaus-request")}
        />

        <StudentDailyPulseCard

          ref={pulseRef}

          todayPulse={todayPulse}

          modalOpen={pulseModalOpen}

          onModalOpenChange={setPulseModalOpen}

          onPulseSaved={onPulseSaved}

          compact

        />

      </SchoolWellnessSection>



      <SchoolWellnessSection title="Grad at Grad" subtitle="Profile of the Graduate · five pillars">

        <GradAtGradPillarChart summaryRows={gradSummary} loading={gradLoading && !refreshing} />

      </SchoolWellnessSection>



      <SchoolWellnessSection title={schoolName} subtitle="Fitness, faith, mind & service">

        <SchoolWellnessHubGrid>

          <SchoolWellnessHubTile

            icon="home-outline"

            title="Fitness & community"

            hint="Workouts & friends"

            iconColor={T.accent}

            iconBg={T.accentDim}

            onPress={() => router.replace("/(tabs)/home")}

          />

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

          <SchoolWellnessHubTile

            icon="heart-circle-outline"

            title="Volunteer"

            hint="Service hours"

            iconColor={T.accent}

            iconBg={T.accentDim}

            onPress={() => router.push("/volunteer-oppurtunities")}

          />

          <SchoolWellnessHubTile

            icon="people-outline"

            title="Accountability"

            hint="Partners & check-ins"

            iconColor={T.gold}

            iconBg={T.goldDim}

            onPress={() => router.push("/accountability")}

          />

          <SchoolWellnessHubTile

            icon="walk-outline"

            title="Emmaus Companion"

            hint="Raise your hand · peer support"

            iconColor="#8ab4ff"

            iconBg="rgba(138, 180, 255, 0.12)"

            onPress={() => router.push("/(modals)/emmaus-request")}

          />

        </SchoolWellnessHubGrid>

      </SchoolWellnessSection>



      <SchoolWellnessSection title="Companion care" subtitle="Peer mentors & pastoral connection">

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



      <SchoolWellnessSection title="Support" subtitle="Privacy & crisis resources" last>

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


