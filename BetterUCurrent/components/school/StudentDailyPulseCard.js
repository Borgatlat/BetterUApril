import React, { useState } from "react";
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

const ACCENT = "#00e5e5";

function LikertRow({ label, value, onChange }) {
  return (
    <View style={styles.likertBlock}>
      <Text style={styles.likertLabel}>{label}</Text>
      <Text style={styles.likertValue}>{Math.round(value)}</Text>
      <Slider
        minimumValue={1}
        maximumValue={5}
        step={0.01}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={ACCENT}
        maximumTrackTintColor="#333"
        thumbTintColor={ACCENT}
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
 * Student-only surface: daily pulse modal + persistent counselor CTA.
 * Returns null for non-students so public B2C layout is unchanged.
 */
export function StudentDailyPulseCard() {
  const { workspace, profile, user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [anonymize, setAnonymize] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  if (workspace !== "student" || !profile?.org_id) return null;

  const onSavePulse = async () => {
    setSaving(true);
    try {
      await submitDailyPulse({
        orgId: profile.org_id,
        mood: Math.round(mood),
        stressLevel: Math.round(stress),
        sleepQuality: Math.round(sleep),
        anonymizeAggregate: anonymize,
      });
      Alert.alert("Saved", "Your daily pulse was logged.");
      setOpen(false);
    } catch (e) {
      Alert.alert("Could not save", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const onRequestCounselor = () => {
    Alert.alert(
      "Request counselor support?",
      "Your name and school email will be shared with your school counseling team so they can reach you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
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
                "A counselor has been notified. If this is an emergency, also use your school’s crisis line or 988.",
              );
            } catch (e) {
              Alert.alert("Could not send request", e?.message ?? String(e));
            } finally {
              setRequesting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderIcon}>
          <Ionicons name="school-outline" size={22} color={ACCENT} />
        </View>
        <Text style={styles.cardTitle}>School wellness pulse</Text>
      </View>
      <Text style={styles.cardSubtitle}>
        Quick check-in for mood, stress, and sleep (1 = low / poor, 5 = high / good). When anonymized,
        principals see cohort wellness trends—not your name—to plan supports and pastoral outreach.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>Log today’s pulse</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.crisisBtn}
        onPress={onRequestCounselor}
        disabled={requesting}
        accessibilityRole="button"
      >
        {requesting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="alert-circle" size={22} color="#000" />
            <Text style={styles.crisisBtnText}>Request counselor support</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardRoot}
        >
          <Pressable style={styles.modalDismissArea} onPress={() => setOpen(false)} accessibilityLabel="Dismiss" />
          <View style={styles.modalSheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>Daily pulse</Text>
              <LikertRow label="Mood" value={mood} onChange={setMood} />
              <LikertRow label="Stress level" value={stress} onChange={setStress} />
              <LikertRow label="Sleep quality" value={sleep} onChange={setSleep} />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Anonymize my aggregate data for the school dashboard
                </Text>
                <Switch value={anonymize} onValueChange={setAnonymize} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(0,229,229,0.07)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.22)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  cardHeaderIcon: { marginRight: 8 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cardSubtitle: { color: "#9aa4ad", fontSize: 14, marginBottom: 14, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
  crisisBtn: {
    marginTop: 12,
    backgroundColor: "#ffb020",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  crisisBtnText: { color: "#000", fontWeight: "900", fontSize: 15 },
  likertBlock: { marginBottom: 14 },
  likertLabel: { color: "#ddd", marginBottom: 4, fontWeight: "600" },
  likertValue: { color: ACCENT, fontSize: 22, fontWeight: "800", marginBottom: 6 },
  scaleRow: { flexDirection: "row", justifyContent: "space-between" },
  scaleTick: { color: "#666", fontSize: 11 },
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
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  modalScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalTitle: { color: "#fff", fontSize: 21, fontWeight: "800", marginBottom: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", marginVertical: 14 },
  switchLabel: { color: "#ccc", flex: 1, fontSize: 14, lineHeight: 20 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingBottom: 4,
  },
  cancelText: { color: "#888", fontSize: 16, paddingVertical: 8 },
});
