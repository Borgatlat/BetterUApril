import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { submitServiceHourLog, fetchMyTotalApprovedServiceHours } from "../../../lib/spiritualSchoolClient";
import { spiritualTheme } from "./spiritualTheme";

/** Form to submit service hours pending staff approval. */
export function ServiceHourSubmitCard({ orgId, orgReady = true }) {
  const [hoursTxt, setHoursTxt] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(null);
  const [totalApproved, setTotalApproved] = useState(null);

  const locked = !orgReady || !orgId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await fetchMyTotalApprovedServiceHours();
        if (!cancelled) setTotalApproved(v);
      } catch {
        if (!cancelled) setTotalApproved(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hint, busy]);

  const submit = async () => {
    if (locked) {
      setHint("School link required.");
      return;
    }
    const n = parseFloat(hoursTxt);
    if (!Number.isFinite(n) || n <= 0) {
      setHint("Enter a positive number of hours.");
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      await submitServiceHourLog({ orgId, hours: n, description: desc });
      setHoursTxt("");
      setDesc("");
      setHint("Sent for review — you’ll see approved hours updated after staff approves.");
    } catch (e) {
      setHint(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, locked && styles.wrapMuted]}>
      <Text style={styles.h2}>Service hours</Text>
      <Text style={styles.sm}>
        Approved total on your profile:{" "}
        <Text style={styles.smHi}>{totalApproved === null ? "—" : `${totalApproved} h`}</Text>
      </Text>
      {locked ? (
        <Text style={styles.lockBanner}>Submit when your campus link is active.</Text>
      ) : (
        <Text style={styles.sm2}>Hours are reviewed by your campus minister before they count.</Text>
      )}
      <TextInput
        style={[styles.single, locked && styles.fieldOff]}
        placeholder="Hours (e.g. 2.5)"
        placeholderTextColor="#555"
        keyboardType="decimal-pad"
        value={hoursTxt}
        onChangeText={setHoursTxt}
        editable={!locked}
      />
      <TextInput
        style={[styles.area, locked && styles.fieldOff]}
        placeholder="What did you do? Where? (helps staff verify)"
        placeholderTextColor="#555"
        value={desc}
        onChangeText={setDesc}
        multiline
        editable={!locked}
      />
      <TouchableOpacity
        style={[styles.btn, locked && styles.btnDisabled]}
        onPress={submit}
        disabled={busy || locked}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.bt}>Submit for approval</Text>}
      </TouchableOpacity>
      {hint ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    borderRadius: spiritualTheme.radiusLg,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
    backgroundColor: spiritualTheme.cardBg,
  },
  wrapMuted: { borderColor: "rgba(255,179,71,0.18)" },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17, marginBottom: 6 },
  sm: { color: spiritualTheme.sub, fontSize: 13, marginBottom: 4, lineHeight: 19 },
  sm2: { color: spiritualTheme.subMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  lockBanner: { color: "#d4b896", fontSize: 12, marginBottom: 10, fontWeight: "600" },
  smHi: { color: "#fff", fontWeight: "800" },
  single: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#fff",
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  area: {
    minHeight: 76,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#fff",
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  fieldOff: { opacity: 0.5 },
  btn: {
    paddingVertical: 14,
    backgroundColor: spiritualTheme.accent,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { backgroundColor: "#3a4849" },
  bt: { color: "#000", fontWeight: "800", fontSize: 15 },
  note: { marginTop: 10, fontSize: 13, color: "#8a9aa8", lineHeight: 18 },
});
