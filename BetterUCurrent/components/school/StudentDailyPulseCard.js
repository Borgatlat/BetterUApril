import React, { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  submitDailyPulse,
  createCounselorSupportAlert,
} from "../../lib/schoolWellnessClient";
import { schoolWellnessTheme as T } from "./schoolWellnessTheme";

const CRISIS_RED = "#dc2626";
const CRISIS_RED_BORDER = "rgba(248,113,113,0.45)";

function LikertRow({ label, value, onChange }) {
  return (
    <View style={styles.likertBlock}>
      <View style={styles.likertHeader}>
        <Text style={styles.likertLabel}>{label}</Text>
        <Text style={styles.likertValue}>{Math.round(value)}</Text>
      </View>
      <Slider
        minimumValue={1}
        maximumValue={5}
        step={0.01}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={T.accent}
        maximumTrackTintColor="#333"
        thumbTintColor={T.accent}
      />
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Text key={n} style={styles.scaleTick}>
            {n}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Student-only: daily pulse modal + counselor CTA.
 * Parent controls modal via modalOpen / onModalOpenChange; onPulseSaved refreshes banner.
 */
export const StudentDailyPulseCard = forwardRef(function StudentDailyPulseCard(
  {
    todayPulse = null,
    modalOpen: controlledOpen,
    onModalOpenChange,
    onPulseSaved,
    compact = false,
    /** When true, only renders the pulse modal (banner + quick row handle UI elsewhere). */
    surfaceHidden = false,
  },
  ref,
) {
  const { workspace, profile, user } = useAuthSession();
  const [internalOpen, setInternalOpen] = useState(false);
  const [mood, setMood] = useState(todayPulse?.mood ?? 3);
  const [stress, setStress] = useState(todayPulse?.stress_level ?? 3);
  const [sleep, setSleep] = useState(todayPulse?.sleep_quality ?? 3);
  const [anonymize, setAnonymize] = useState(todayPulse?.anonymize_aggregate ?? true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v) => {
    if (isControlled) onModalOpenChange?.(v);
    else setInternalOpen(v);
  };

  useEffect(() => {
    if (todayPulse) {
      setMood(todayPulse.mood ?? 3);
      setStress(todayPulse.stress_level ?? 3);
      setSleep(todayPulse.sleep_quality ?? 3);
      setAnonymize(todayPulse.anonymize_aggregate ?? true);
    }
  }, [todayPulse]);

  const onRequestCounselor = useCallback(() => {
    if (!profile?.org_id) return;
    Alert.alert(
      "Contact your counselor?",
      "Your name and school email go to your counseling team so they can reach you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send request",
          style: "destructive",
          onPress: async () => {
            setRequesting(true);
            try {
              await createCounselorSupportAlert({
                orgId: profile.org_id,
                studentName: profile.full_name || profile.username || "Student",
                studentEmail: profile.email || user?.email || "",
              });
              Alert.alert(
                "Request sent",
                "A counselor was notified. In an emergency, call 988 or your school crisis line.",
              );
            } catch (e) {
              Alert.alert("Could not send", e?.message ?? String(e));
            } finally {
              setRequesting(false);
            }
          },
        },
      ],
    );
  }, [profile, user]);

  useImperativeHandle(ref, () => ({
    openModal: () => setOpen(true),
    requestCounselor: onRequestCounselor,
  }));

  if (workspace !== "student" || !profile?.org_id) return null;

  const loggedToday = Boolean(todayPulse);

  const onSavePulse = async () => {
    setSaving(true);
    try {
      const saved = await submitDailyPulse({
        orgId: profile.org_id,
        mood: Math.round(mood),
        stressLevel: Math.round(stress),
        sleepQuality: Math.round(sleep),
        anonymizeAggregate: anonymize,
      });
      Alert.alert("Saved", "Pulse logged for today.");
      setOpen(false);
      onPulseSaved?.(saved);
    } catch (e) {
      Alert.alert("Could not save", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!surfaceHidden ? (
        <View style={[styles.card, compact && styles.cardCompact]}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Today's pulse</Text>
              <Text style={styles.cardSubtitle}>Mood, stress & sleep · scale 1–5</Text>
            </View>
            {loggedToday ? (
              <Ionicons name="checkmark-circle" size={26} color={T.pulseDone} accessibilityLabel="Logged today" />
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={loggedToday ? "Update pulse" : "Log pulse"}
          >
            <Ionicons name="pulse-outline" size={20} color="#000" style={styles.btnIcon} />
            <Text style={styles.primaryBtnText}>{loggedToday ? "Update pulse" : "Log pulse"}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.crisisBtn}
            onPress={onRequestCounselor}
            disabled={requesting}
            accessibilityRole="button"
            accessibilityLabel="Request counselor support"
          >
            {requesting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="heart" size={20} color="#fff" />
                <Text style={styles.crisisBtnText}>Request counselor support</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.crisisHint}>Shares your name with your school counseling team.</Text>
        </View>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardRoot}
        >
          <Pressable
            style={styles.modalDismissArea}
            onPress={() => setOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <View style={styles.modalSheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>Daily pulse</Text>
              <Text style={styles.modalHint}>1 = low · 5 = high</Text>
              <LikertRow label="Mood" value={mood} onChange={setMood} />
              <LikertRow label="Stress" value={stress} onChange={setStress} />
              <LikertRow label="Sleep" value={sleep} onChange={setSleep} />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Keep me anonymous on school dashboards</Text>
                <Switch
                  value={anonymize}
                  onValueChange={setAnonymize}
                  trackColor={{ false: "#444", true: "rgba(0,229,229,0.5)" }}
                  thumbColor={anonymize ? T.accent : "#aaa"}
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={onSavePulse} disabled={saving}>
                  {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.cardBg,
    borderRadius: T.radiusXl,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
  },
  cardCompact: { marginBottom: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: { color: T.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  cardSubtitle: { color: T.subMuted, fontSize: 13, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: T.accent,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnIcon: { marginRight: 8 },
  primaryBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginVertical: 14,
  },
  crisisBtn: {
    backgroundColor: CRISIS_RED,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: CRISIS_RED_BORDER,
  },
  crisisBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  crisisHint: {
    color: "#8a6b6b",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 15,
  },
  likertBlock: { marginBottom: 16 },
  likertHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  likertLabel: { color: "#ddd", fontWeight: "600", fontSize: 15 },
  likertValue: { color: T.accent, fontSize: 20, fontWeight: "800" },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleTick: { color: "#555", fontSize: 11 },
  keyboardRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  modalDismissArea: { flexGrow: 1, minHeight: 80 },
  modalSheet: {
    backgroundColor: "#111",
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  modalScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalTitle: { color: T.text, fontSize: 21, fontWeight: "800" },
  modalHint: { color: "#666", fontSize: 13, marginBottom: 16, marginTop: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 12 },
  switchLabel: { color: "#bbb", flex: 1, fontSize: 14, lineHeight: 19 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingBottom: 4,
  },
  cancelText: { color: "#888", fontSize: 16, paddingVertical: 8 },
});
