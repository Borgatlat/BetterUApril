import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import { createCompanionRequest } from "../../lib/emmausCompanionClient";
import { EmmausStepCategory } from "./EmmausStepCategory";
import { EmmausStepSupportType } from "./EmmausStepSupportType";
import { EmmausStepFormatUrgency } from "./EmmausStepFormatUrgency";
import { EmmausStepNotes } from "./EmmausStepNotes";
import { EmmausConfirmFrame } from "./EmmausConfirmFrame";
import { emmausTheme as T } from "./emmausTheme";

const TOTAL_STEPS = 4;

const INITIAL_DRAFT = {
  category: null,
  supportType: null,
  formatPreference: "text_chat",
  urgencyTier: "routine_check_in",
  studentNotes: "",
};

export function EmmausRequestWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orgId, workspace } = useAuthSession();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  const isSilent = draft.supportType === "silent_prayer_only";
  const maxStep = TOTAL_STEPS;

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(draft.category);
    if (step === 2) return Boolean(draft.supportType);
    if (step === 3) return true;
    return true;
  }, [step, draft]);

  const goNext = () => {
    if (!canNext) return;
    if (step < maxStep) setStep((s) => s + 1);
    else submit();
  };

  const goBack = () => {
    if (done) return;
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  };

  const submit = async () => {
    if (!orgId || workspace !== "student") {
      setErr("School link required. Refresh your profile or sign in with your school email.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createCompanionRequest({
        orgId,
        supportType: draft.supportType,
        category: draft.category,
        formatPreference: isSilent ? "text_chat" : draft.formatPreference,
        urgencyTier: draft.urgencyTier,
        studentNotes: draft.studentNotes,
      });
      setDone(true);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (workspace !== "student") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.gate}>Emmaus Companion is for enrolled school students.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name={done ? "close" : "chevron-back"} size={26} color={T.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emmaus Companion</Text>
        <View style={{ width: 26 }} />
      </View>

      {!done ? (
        <View style={styles.dots}>
          {[1, 2, 3, 4].map((n) => (
            <View key={n} style={[styles.dot, n <= step && styles.dotOn]} />
          ))}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {done ? (
          <EmmausConfirmFrame silentPrayer={isSilent} urgent={draft.urgencyTier === "urgent_today"} />
        ) : (
          <>
            {step === 1 ? (
              <EmmausStepCategory
                value={draft.category}
                onSelect={(category) => setDraft((d) => ({ ...d, category }))}
              />
            ) : null}
            {step === 2 ? (
              <EmmausStepSupportType
                value={draft.supportType}
                onSelect={(supportType) => setDraft((d) => ({ ...d, supportType }))}
              />
            ) : null}
            {step === 3 ? (
              <EmmausStepFormatUrgency
                formatPreference={draft.formatPreference}
                urgencyTier={draft.urgencyTier}
                onFormat={(formatPreference) => setDraft((d) => ({ ...d, formatPreference }))}
                onUrgency={(urgencyTier) => setDraft((d) => ({ ...d, urgencyTier }))}
                hideFormat={isSilent}
              />
            ) : null}
            {step === 4 ? (
              <EmmausStepNotes
                value={draft.studentNotes}
                onChange={(studentNotes) => setDraft((d) => ({ ...d, studentNotes }))}
              />
            ) : null}
          </>
        )}
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {done ? (
          <TouchableOpacity style={styles.primary} onPress={() => router.back()} activeOpacity={0.88}>
            <Text style={styles.primaryTxt}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primary, (!canNext || busy) && styles.primaryOff]}
            onPress={goNext}
            disabled={!canNext || busy}
            activeOpacity={0.88}
          >
            {busy ? (
              <ActivityIndicator color={T.textOnAccent} />
            ) : (
              <Text style={styles.primaryTxt}>{step === maxStep ? "Send request" : "Continue"}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "800" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)" },
  dotOn: { backgroundColor: T.accent },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  primary: {
    backgroundColor: T.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryOff: { opacity: 0.45 },
  primaryTxt: { color: T.textOnAccent, fontWeight: "800", fontSize: 16 },
  err: { color: T.danger, marginTop: 12, fontSize: 13, lineHeight: 18 },
  gate: { color: T.sub, textAlign: "center", padding: 24, fontSize: 15 },
  link: { color: T.accent, textAlign: "center", fontWeight: "700" },
});
