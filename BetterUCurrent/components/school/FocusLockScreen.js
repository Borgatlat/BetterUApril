import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  BackHandler,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useAuth } from "../../context/AuthContext";
import { formatApiError } from "../../lib/formatApiError";
import { notifyAccountabilityPartnersFocusForfeit } from "../../lib/focusAccountabilityNotify";
import {
  startFocusSession,
  completeFocusSession,
  forfeitFocusSession,
  claimFocusPoints,
  checkFocusSessionsAvailable,
} from "../../lib/focusSessionClient";

const KEEP_AWAKE_TAG = "betteru-focus-lock";

const ACCENT = "#00e5e5";
const GREEN = "#5ce1a3";
const TIER3_RED = "#ff5b6b";
const PANEL = "#0c1115";

const DURATION_PRESETS = [15, 25, 45, 60];

/**
 * Minimalist Phone-Free Focus Mode screen.
 *
 * Three visual states:
 *   - 'idle'      : duration picker + start button
 *   - 'running'   : full-screen timer + "End early" button
 *   - 'completed' : success card + points awarded
 *   - 'forfeited' : forfeit reason + try-again button
 *
 * AppState integration:
 *   When state === 'running' and AppState changes to 'background' or 'inactive',
 *   the session is immediately marked forfeit and the local countdown stops.
 *   The points RPC is NEVER called in this branch.
 */
export function FocusLockScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orgId } = useAuthSession();
  const { user, profile, refetchProfile } = useAuth();

  const [phase, setPhase] = useState("idle");
  const [setupChecking, setSetupChecking] = useState(true);
  const [setupOk, setSetupOk] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [pointsResult, setPointsResult] = useState(null);
  const [error, setError] = useState(null);
  const [forfeitReason, setForfeitReason] = useState(null);
  const [starting, setStarting] = useState(false);
  const [partnersNotified, setPartnersNotified] = useState(false);

  // Refs survive re-renders without triggering them. We need:
  //   sessionIdRef → so the AppState handler can target the current row
  //   timerRef     → so we can clearInterval from anywhere (handler, unmount)
  //   phaseRef     → so the AppState listener can read the LATEST phase
  //                  without being stale-closure'd at subscription time
  const sessionIdRef = useRef(null);
  const timerRef = useRef(null);
  const phaseRef = useRef(phase);
  const forfeitHandledRef = useRef(false);
  const endEarlyRef = useRef(() => {});
  const studentName =
    profile?.full_name?.trim() || profile?.username?.trim() || "A student";

  // Keep phaseRef synced. Without this the AppState listener would see the
  // phase value from the render in which it was registered ("idle" forever).
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const runSetupCheck = useCallback(async () => {
    if (!user?.id) {
      setSetupChecking(false);
      setSetupOk(false);
      return;
    }
    setSetupChecking(true);
    try {
      await checkFocusSessionsAvailable();
      setSetupOk(true);
      if (phaseRef.current === "idle") setError(null);
    } catch (e) {
      setSetupOk(false);
      setError(formatApiError(e));
    } finally {
      setSetupChecking(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      runSetupCheck();
    }, [runSetupCheck]),
  );

  const applyForfeit = useCallback(
    async (reason) => {
      if (forfeitHandledRef.current) return;
      forfeitHandledRef.current = true;

      const id = sessionIdRef.current;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        /* optional */
      }

      if (id) {
        try {
          await forfeitFocusSession(id, reason);
        } catch (e) {
          if (__DEV__) console.warn("[focus] forfeit PATCH failed:", formatApiError(e));
        }
      }

      if (user?.id) {
        try {
          await notifyAccountabilityPartnersFocusForfeit({
            studentId: user.id,
            studentName,
            reason,
            durationMinutes,
            sessionId: id,
          });
          setPartnersNotified(true);
        } catch (e) {
          if (__DEV__) console.warn("[focus] partner notify:", formatApiError(e));
        }
      }

      setForfeitReason(reason);
      setPhase("forfeited");
    },
    [durationMinutes, studentName, user?.id],
  );

  // Keep screen awake while the timer runs (reduces accidental lock-screen exits).
  useEffect(() => {
    if (phase !== "running") {
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        /* optional */
      }
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      } catch (e) {
        if (__DEV__ && !cancelled) console.warn("[focus] keep awake:", e?.message ?? e);
      }
    })();

    return () => {
      cancelled = true;
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        /* optional */
      }
    };
  }, [phase]);

  // ------------------------------------------------------------------------
  // AppState subscription — the heart of the integrity contract.
  // ------------------------------------------------------------------------
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (phaseRef.current !== "running") return;

      if (nextAppState === "background" || nextAppState === "inactive") {
        const reason = nextAppState === "background" ? "app_backgrounded" : "app_inactive";
        await applyForfeit(reason);
      }
    });

    return () => subscription.remove();
  }, [applyForfeit]);

  // ------------------------------------------------------------------------
  // Block Android hardware back during a running session. Otherwise students
  // could exit the screen without backgrounding and silently keep points.
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const onBackPress = () => {
      if (phaseRef.current !== "running") return false; // allow back
      Alert.alert(
        "End focus session?",
        "Leaving now forfeits the points for this session.",
        [
          { text: "Keep going", style: "cancel" },
          { text: "End and forfeit", style: "destructive", onPress: () => endEarlyRef.current() },
        ],
        { cancelable: true },
      );
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  // ------------------------------------------------------------------------
  // Cleanup: clear the interval on unmount so it cannot fire on a stale screen.
  // ------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const finishCleanly = useCallback(
    async (id) => {
      const sessionId = id || sessionIdRef.current;
      if (!sessionId) {
        setError("Session lost — please start again.");
        setPhase("idle");
        return;
      }

      try {
        await completeFocusSession(sessionId);
        const result = await claimFocusPoints(sessionId);
        setPointsResult(result);
        setPhase("completed");
        try {
          await refetchProfile?.();
        } catch {
          /* non-fatal */
        }
      } catch (e) {
        setError(formatApiError(e));
        setPhase("idle");
      }
    },
    [refetchProfile],
  );

  const runFocusTimer = useCallback(() => {
    const startedAtMs = Date.now();
    const totalSec = durationMinutes * 60;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(async () => {
      const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
      const left = Math.max(0, totalSec - elapsedSec);
      setRemainingSec(left);

      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        await finishCleanly(sessionIdRef.current);
      }
    }, 250);
  }, [durationMinutes, finishCleanly]);

  const beginFocusSession = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Sign in to start a focus session.");
      return;
    }

    if (!setupOk) {
      Alert.alert(
        "Focus Lock unavailable",
        error || "Ask your admin to run the focus_sessions Supabase migration.",
      );
      return;
    }

    setError(null);
    setPointsResult(null);
    setForfeitReason(null);
    setPartnersNotified(false);
    forfeitHandledRef.current = false;
    setStarting(true);

    try {
      const row = await startFocusSession({ orgId, durationMinutes });
      if (!row?.id) {
        throw new Error("Could not create focus session.");
      }
      sessionIdRef.current = row.id;
      setRemainingSec(durationMinutes * 60);
      setPhase("running");
      runFocusTimer();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setStarting(false);
    }
  }, [user?.id, setupOk, error, orgId, durationMinutes, runFocusTimer]);

  const confirmAndStart = useCallback(() => {
    Alert.alert(
      "Start phone-free focus?",
      `Stay in BetterU for ${durationMinutes} minutes. Leaving the app forfeits points and may notify partners.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start", onPress: () => beginFocusSession() },
      ],
    );
  }, [beginFocusSession, durationMinutes]);

  const endEarly = useCallback(() => {
    Alert.alert(
      "End focus session?",
      "You will forfeit points and your accountability partners may be notified.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "End session",
          style: "destructive",
          onPress: () => applyForfeit("user_ended_early"),
        },
      ],
    );
  }, [applyForfeit]);

  endEarlyRef.current = endEarly;

  const resetToIdle = () => {
    sessionIdRef.current = null;
    forfeitHandledRef.current = false;
    setPhase("idle");
    setRemainingSec(durationMinutes * 60);
    setPointsResult(null);
    setForfeitReason(null);
    setPartnersNotified(false);
    setError(null);
  };

  // ------------------------------------------------------------------------
  // Derived display values
  // ------------------------------------------------------------------------
  const mmss = useMemo(() => formatMmSs(remainingSec), [remainingSec]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------
  if (!user?.id) {
    return (
      <View style={[styles.shell, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <SignedOutView onBack={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={[styles.shell, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      {phase === "idle" ? (
        <IdleView
          durationMinutes={durationMinutes}
          onPickDuration={(v) => {
            setDurationMinutes(v);
            setRemainingSec(v * 60);
          }}
          onStart={confirmAndStart}
          onBack={() => router.back()}
          error={error}
          starting={starting || setupChecking}
          setupOk={setupOk}
        />
      ) : null}

      {phase === "running" ? (
        <RunningView
          mmss={mmss}
          totalSec={durationMinutes * 60}
          remainingSec={remainingSec}
          onEndEarly={endEarly}
        />
      ) : null}

      {phase === "completed" ? (
        <CompletedView
          pointsResult={pointsResult}
          durationMinutes={durationMinutes}
          onAgain={resetToIdle}
          onDone={() => router.back()}
        />
      ) : null}

      {phase === "forfeited" ? (
        <ForfeitedView
          reason={forfeitReason}
          durationMinutes={durationMinutes}
          partnersNotified={partnersNotified}
          onAgain={resetToIdle}
          onDone={() => router.back()}
        />
      ) : null}
    </View>
  );
}

/* ===================== Phase views ===================== */

function SignedOutView({ onBack }) {
  return (
    <View style={styles.phaseWrap}>
      <TouchableOpacity onPress={onBack} style={styles.closeBtn} accessibilityRole="button">
        <Ionicons name="close" size={22} color="#8a949c" />
      </TouchableOpacity>
      <View style={styles.iconCircle}>
        <Ionicons name="log-in-outline" size={36} color={ACCENT} />
      </View>
      <Text style={[styles.title, { textAlign: "center" }]}>Sign in to use Focus Lock</Text>
      <Text style={[styles.subtitle, { textAlign: "center" }]}>
        Phone-free focus saves your session and awards focus points to your profile.
      </Text>
    </View>
  );
}

function IdleView({ durationMinutes, onPickDuration, onStart, onBack, error, starting, setupOk }) {
  return (
    <View style={styles.phaseWrap}>
      <TouchableOpacity onPress={onBack} style={styles.closeBtn} accessibilityRole="button">
        <Ionicons name="close" size={22} color="#8a949c" />
      </TouchableOpacity>

      <View style={styles.iconCircle}>
        <Ionicons name="phone-portrait-outline" size={36} color={ACCENT} />
      </View>

      <Text style={styles.title}>Phone-free focus</Text>
      <Text style={styles.subtitle}>
        Stay in BetterU for the full timer to earn focus points. Leaving the app ends the session.
      </Text>

      <Text style={styles.pickerLabel}>How long?</Text>
      <View style={styles.durationRow}>
        {DURATION_PRESETS.map((min) => (
          <TouchableOpacity
            key={min}
            onPress={() => onPickDuration(min)}
            style={[styles.durationBtn, durationMinutes === min && styles.durationBtnActive]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.durationTxt,
                durationMinutes === min && styles.durationTxtActive,
              ]}
            >
              {min}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color="#ffb4b4" />
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.startBtn, (starting || !setupOk) && styles.startBtnDisabled]}
        onPress={onStart}
        activeOpacity={0.85}
        disabled={starting || !setupOk}
      >
        {starting ? (
          <ActivityIndicator color="#062a2a" />
        ) : (
          <Ionicons name="play" size={22} color="#062a2a" />
        )}
        <Text style={styles.startBtnTxt}>{starting ? "Starting…" : "Start focus session"}</Text>
      </TouchableOpacity>

      <View style={styles.warnCard}>
        <Ionicons name="warning" size={20} color="#ffb020" />
        <View style={{ flex: 1 }}>
          <Text style={styles.warnTitle}>Do not switch apps</Text>
          <Text style={styles.warnTxt}>
            Instagram, messages, games, or your home screen will end this session immediately.
          </Text>
        </View>
      </View>

      <View style={styles.ruleCard}>
        <Ionicons name="people-outline" size={20} color={ACCENT} />
        <Text style={styles.ruleTxt}>
          Accountability partners receive a notification if you leave BetterU during focus lock.
        </Text>
      </View>
    </View>
  );
}

function RunningView({ mmss, totalSec, remainingSec, onEndEarly }) {
  const pct = Math.max(0, Math.min(1, 1 - remainingSec / Math.max(totalSec, 1)));

  return (
    <View style={[styles.phaseWrap, { justifyContent: "center" }]}>
      <View style={styles.ringWrap}>
        {/* Background ring */}
        <View style={styles.ringBg} />
        {/* Progress fill — a half-circle gradient would look slicker, but a
            solid arc using a clipped View keeps the dependency footprint tiny. */}
        <View
          style={[
            styles.ringFill,
            {
              transform: [{ rotate: `${pct * 360}deg` }],
            },
          ]}
        />
        <Text style={styles.timerTxt}>{mmss}</Text>
        <Text style={styles.timerSub}>FOCUS MODE</Text>
      </View>

      <View style={styles.runningWarn}>
        <Ionicons name="lock-closed" size={18} color="#ffb020" />
        <Text style={styles.runningWarnTxt}>
          Focus lock is on. Leaving BetterU notifies your accountability partners and forfeits points.
        </Text>
      </View>

      <Text style={[styles.subtitle, { textAlign: "center", marginTop: 16 }]}>
        Put your phone face-down if it helps. Locking the screen is OK —{" "}
        <Text style={{ color: "#fff", fontWeight: "700" }}>switching apps is not.</Text>
      </Text>

      <TouchableOpacity style={styles.endEarlyBtn} onPress={onEndEarly} activeOpacity={0.85}>
        <Ionicons name="stop" size={18} color={TIER3_RED} />
        <Text style={styles.endEarlyTxt}>End early (forfeit points)</Text>
      </TouchableOpacity>
    </View>
  );
}

function CompletedView({ pointsResult, durationMinutes, onAgain, onDone }) {
  const pts = pointsResult?.points ?? 0;
  const total = pointsResult?.total_focus_points ?? null;
  return (
    <View style={[styles.phaseWrap, { justifyContent: "center" }]}>
      <View style={[styles.iconCircle, { backgroundColor: "rgba(92,225,163,0.12)" }]}>
        <Ionicons name="checkmark-circle" size={48} color={GREEN} />
      </View>

      <Text style={[styles.title, { textAlign: "center" }]}>Session complete</Text>
      <Text style={[styles.subtitle, { textAlign: "center" }]}>
        You stayed focused for {durationMinutes} minutes. Your wallet just grew.
      </Text>

      <View style={styles.rewardCard}>
        <Text style={styles.rewardLabel}>POINTS EARNED</Text>
        <Text style={styles.rewardValue}>+{pts}</Text>
        {total !== null ? (
          <Text style={styles.rewardTotal}>Lifetime focus points: {total}</Text>
        ) : null}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onAgain} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnTxt}>Go again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={styles.primaryBtnTxt}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ForfeitedView({ reason, durationMinutes, partnersNotified, onAgain, onDone }) {
  const label =
    reason === "app_backgrounded"
      ? "BetterU was sent to the background."
      : reason === "app_inactive"
        ? "BetterU was interrupted (Control Center, notification pull-down, or call)."
        : reason === "user_ended_early"
          ? "You ended the session early."
          : "Session ended unexpectedly.";

  return (
    <View style={[styles.phaseWrap, { justifyContent: "center" }]}>
      <View style={[styles.iconCircle, { backgroundColor: "rgba(255,91,107,0.12)" }]}>
        <Ionicons name="alert-circle" size={48} color={TIER3_RED} />
      </View>

      <Text style={[styles.title, { textAlign: "center" }]}>Session forfeited</Text>
      <Text style={[styles.subtitle, { textAlign: "center" }]}>{label}</Text>
      <Text style={[styles.subtitle, { textAlign: "center", marginTop: 8, color: "#7d8993" }]}>
        No focus points for this {durationMinutes}-minute attempt. Keep BetterU open the full time
        to earn next time.
      </Text>
      {partnersNotified ? (
        <Text style={styles.partnerNote}>Your accountability partners were notified.</Text>
      ) : null}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnTxt}>Exit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={onAgain} activeOpacity={0.85}>
          <Text style={styles.primaryBtnTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ===================== helpers ===================== */

function formatMmSs(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ===================== styles ===================== */

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#050708",
    paddingHorizontal: 24,
  },
  phaseWrap: { flex: 1, alignItems: "stretch" },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 8,
    marginRight: -8,
    marginBottom: 12,
  },

  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "rgba(0,229,229,0.12)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 14,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#9aa6ae",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },

  pickerLabel: {
    color: "#8a949c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: "center",
  },
  durationRow: { flexDirection: "row", gap: 10, marginBottom: 24, justifyContent: "center" },
  durationBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: PANEL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 64,
    alignItems: "center",
  },
  durationBtnActive: {
    backgroundColor: "rgba(0,229,229,0.14)",
    borderColor: "rgba(0,229,229,0.45)",
  },
  durationTxt: { color: "#8a949c", fontWeight: "800", fontSize: 16 },
  durationTxtActive: { color: ACCENT },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  startBtnDisabled: { opacity: 0.7 },
  startBtnTxt: { color: "#062a2a", fontWeight: "800", fontSize: 16 },

  warnCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "rgba(255,176,32,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,176,32,0.35)",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  warnTitle: { color: "#ffd080", fontWeight: "800", fontSize: 13, marginBottom: 4 },
  warnTxt: { color: "#c9b8a0", fontSize: 12, lineHeight: 17 },

  runningWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginTop: 24,
    backgroundColor: "rgba(255,91,107,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,91,107,0.35)",
  },
  runningWarnTxt: { flex: 1, color: "#ffc9cf", fontSize: 13, lineHeight: 18, fontWeight: "600" },

  partnerNote: {
    color: ACCENT,
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    fontWeight: "700",
  },

  ruleCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "rgba(0,229,229,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.18)",
    alignItems: "flex-start",
  },
  ruleTxt: { color: "#b3c7cc", fontSize: 12, lineHeight: 17, flex: 1 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(255,60,60,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.35)",
    marginBottom: 12,
  },
  errorTxt: { color: "#ffb4b4", flex: 1, fontSize: 13 },

  ringWrap: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringBg: {
    position: "absolute",
    inset: 0,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.06)",
  },
  ringFill: {
    position: "absolute",
    inset: 0,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: ACCENT,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    opacity: 0.5,
  },
  timerTxt: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  timerSub: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 4,
  },

  endEarlyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,91,107,0.35)",
    backgroundColor: "rgba(255,91,107,0.08)",
    alignSelf: "center",
    marginTop: 28,
  },
  endEarlyTxt: { color: TIER3_RED, fontSize: 13, fontWeight: "700" },

  rewardCard: {
    backgroundColor: "rgba(92,225,163,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(92,225,163,0.25)",
    paddingVertical: 22,
    paddingHorizontal: 28,
    alignItems: "center",
    marginVertical: 18,
    alignSelf: "center",
    minWidth: 200,
  },
  rewardLabel: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  rewardValue: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "800",
    marginVertical: 6,
    letterSpacing: -1,
  },
  rewardTotal: {
    color: "#a8c2b3",
    fontSize: 12,
  },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnTxt: { color: "#062a2a", fontWeight: "800", fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtnTxt: { color: "#cdd6dc", fontWeight: "700", fontSize: 14 },
});
