import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { insertSpiritualPulse } from "../../../lib/spiritualSchoolClient";
import { spiritualTheme } from "./spiritualTheme";
import { SpiritualPrimaryButton } from "./SpiritualPrimaryButton";

/**
 * Ignatian-style pulse (consolation / desolation). Intensity 1–5 is rounded before Postgres insert.
 */
export function SpiritualPulseCard({ orgId, orgReady = true }) {
  const [path, setPath] = useState("consolation");
  const [intensity, setIntensity] = useState(3);
  const [busy, setBusy] = useState(false);
  const [lastOk, setLastOk] = useState(null);
  const [isError, setIsError] = useState(false);

  const locked = !orgReady || !orgId;

  const save = async () => {
    if (locked) return;
    setBusy(true);
    setLastOk(null);
    setIsError(false);
    try {
      await insertSpiritualPulse({
        orgId,
        state: path,
        intensity: Math.round(intensity),
      });
      setLastOk("Saved. Be gentle with yourself — one check-in at a time.");
    } catch (e) {
      setIsError(true);
      setLastOk(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, locked && styles.wrapLocked]}>
      <Text style={styles.h2}>How&apos;s your spirit?</Text>
      <Text style={styles.muted}>
        Ignatian check-in: are you feeling drawn toward God (consolation) or pulled away / heavy
        (desolation)? There&apos;s no wrong answer — it helps you notice patterns.
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
            <Text style={styles.pathBtnTitle}>Consolation</Text>
            <Text style={styles.pathSm}>Peace · gratitude · motivation</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pathBtn, path === "desolation" && styles.pathActiveDes]}
            onPress={() => setPath("desolation")}
            accessibilityRole="button"
            accessibilityState={{ selected: path === "desolation" }}
          >
            <Text style={styles.pathBtnTitle}>Desolation</Text>
            <Text style={styles.pathSm}>Anxiety · heaviness · withdrawal</Text>
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

        <View style={{ marginTop: 14 }}>
          <SpiritualPrimaryButton
            label="Save check-in"
            disabledLabel="Save (needs school link)"
            onPress={save}
            disabled={locked}
            loading={busy}
          />
        </View>
      </View>
      {lastOk ? (
        <Text
          style={[styles.note, isError ? styles.noteErr : styles.noteOk]}
          accessibilityLiveRegion="polite"
        >
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
    color: spiritualTheme.lockBanner,
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
  pathBtnTitle: { color: spiritualTheme.text, fontWeight: "700", fontSize: 13 },
  pathSm: { color: spiritualTheme.subMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  intLabel: { color: spiritualTheme.sub, marginBottom: 8, fontWeight: "600", fontSize: 13 },
  note: { marginTop: 12, fontSize: 13, lineHeight: 18 },
  noteOk: { color: spiritualTheme.success },
  noteErr: { color: spiritualTheme.danger },
});
