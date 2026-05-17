import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import Slider from "@react-native-community/slider";
import { insertSpiritualPulse } from "../../../lib/spiritualSchoolClient";
import { spiritualTheme } from "./spiritualTheme";

/**
 * Ignatian-style pulse (consolation / desolation). Intensity 1–5 is rounded before Postgres insert.
 * @param {object} props
 * @param {string | null} props.orgId
 * @param {boolean} [props.orgReady=true] — false grays UI until school/org is linked
 */
export function SpiritualPulseCard({ orgId, orgReady = true }) {
  const [path, setPath] = useState("consolation");
  const [intensity, setIntensity] = useState(3);
  const [busy, setBusy] = useState(false);
  const [lastOk, setLastOk] = useState(null);

  const locked = !orgReady || !orgId;

  const save = async () => {
    if (locked) return;
    setBusy(true);
    setLastOk(null);
    try {
      await insertSpiritualPulse({
        orgId,
        state: path,
        intensity: Math.round(intensity),
      });
      setLastOk("Logged — gentle closeness beats harsh judgment.");
    } catch (e) {
      setLastOk(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, locked && styles.wrapLocked]} accessibilityElementsHidden={false}>
      <Text style={styles.h2}>Ignatian discernment pulse</Text>
      <Text style={styles.muted}>
        Tap what fits right now — consolation (drawn toward gratitude) vs desolation (heavy or withdrawn).
      </Text>
      {locked ? (
        <Text style={styles.lockBanner}>School link needed to save this privately to your campus.</Text>
      ) : null}

      <View pointerEvents={locked ? "none" : "auto"} style={locked && styles.dimmed}>
        <View style={styles.pathRow}>
          <TouchableOpacity
            style={[styles.pathBtn, path === "consolation" && styles.pathActive]}
            onPress={() => setPath("consolation")}
            accessibilityRole="button"
            accessibilityState={{ selected: path === "consolation" }}
          >
            <Text style={styles.pathBtnTitle}>Spiritual consolation</Text>
            <Text style={styles.pathSm}>Peace · Motivation · Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pathBtn, path === "desolation" && styles.pathActiveDes]}
            onPress={() => setPath("desolation")}
            accessibilityRole="button"
            accessibilityState={{ selected: path === "desolation" }}
          >
            <Text style={styles.pathBtnTitle}>Spiritual desolation</Text>
            <Text style={styles.pathSm}>Anxiety · Heavy heart · Withdrawal</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.intLabel}>How strong does this feel? {Math.round(intensity)} / 5</Text>
        <Slider
          minimumValue={1}
          maximumValue={5}
          step={1}
          value={intensity}
          minimumTrackTintColor={spiritualTheme.accent}
          maximumTrackTintColor="#393f44"
          thumbTintColor={spiritualTheme.accent}
          onValueChange={setIntensity}
          accessibilityLabel="Intensity slider from one to five"
        />

        <TouchableOpacity
          style={[styles.saveBtn, locked && styles.saveDisabled]}
          onPress={save}
          disabled={busy || locked}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || locked }}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveTxt}>{locked ? "Save (needs school link)" : "Save check-in"}</Text>
          )}
        </TouchableOpacity>
      </View>
      {lastOk ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {lastOk}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    borderRadius: spiritualTheme.radiusLg,
    backgroundColor: spiritualTheme.cardBg,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
  },
  wrapLocked: {
    borderColor: "rgba(255,179,71,0.2)",
  },
  lockBanner: {
    color: "#d4b896",
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  dimmed: { opacity: 0.5 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17, marginBottom: 6 },
  muted: { color: spiritualTheme.sub, fontSize: 13, marginBottom: 12, lineHeight: 19 },
  pathRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  pathBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  pathActive: { borderColor: spiritualTheme.accent, backgroundColor: "rgba(0,229,229,0.12)" },
  pathActiveDes: { borderColor: "#b388ff", backgroundColor: "rgba(179,136,255,0.1)" },
  pathBtnTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  pathSm: { color: "#8a9399", fontSize: 11, marginTop: 4, lineHeight: 15 },
  intLabel: { color: "#c5ccd1", marginBottom: 8, fontWeight: "600", fontSize: 13 },
  saveBtn: {
    marginTop: 14,
    backgroundColor: spiritualTheme.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveDisabled: { backgroundColor: "#3a4849" },
  saveTxt: { color: "#000", fontWeight: "800", fontSize: 15 },
  note: { color: "#7a8790", marginTop: 12, fontSize: 13, lineHeight: 18 },
});
