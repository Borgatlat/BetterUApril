import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { insertPrayerIntention } from "../../../lib/spiritualSchoolClient";
import { spiritualTheme } from "./spiritualTheme";

/** Private journaling + optional moderated community prayer request. */
export function IntentionsBoardCard({ orgId, orgReady = true }) {
  const [body, setBody] = useState("");
  const [shareAnon, setShareAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(null);

  const locked = !orgReady || !orgId;

  const submit = async () => {
    if (locked) {
      setHint("Link your school first (see banner at top).");
      return;
    }
    if (!body.trim()) {
      setHint("Write something first.");
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      await insertPrayerIntention({
        orgId,
        body: body.trim(),
        shareAnonymous: shareAnon,
      });
      setBody("");
      setShareAnon(false);
      setHint(
        shareAnon
          ? "Submitted. Campus ministers review before anything appears publicly."
          : "Saved privately for you.",
      );
    } catch (e) {
      setHint(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, locked && styles.wrapMuted]}>
      <Text style={styles.h2}>Intentions board</Text>
      <Text style={styles.lead}>Only you see this unless you enable the anonymous feed switch.</Text>
      {locked ? <Text style={styles.lockBanner}>Saving needs your school organization on file.</Text> : null}
      <TextInput
        style={[styles.input, locked && styles.inputDisabled]}
        placeholder="Type a prayer or intention..."
        placeholderTextColor="#586066"
        value={body}
        onChangeText={setBody}
        multiline
        editable={!locked}
      />
      <View style={[styles.switchRow, locked && styles.dimmed]} pointerEvents={locked ? "none" : "auto"}>
        <Text style={styles.switchLabel}>Share anonymously with the school prayer feed (reviewed by staff)</Text>
        <Switch
          trackColor={{ false: "#444", true: "#1a8066" }}
          thumbColor="#fff"
          value={shareAnon}
          onValueChange={setShareAnon}
        />
      </View>
      <TouchableOpacity
        style={[styles.btn, locked && styles.btnDisabled]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>Save intention</Text>}
      </TouchableOpacity>
      {hint ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
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
  lockBanner: { color: "#d4b896", fontSize: 12, marginBottom: 10, fontWeight: "600", lineHeight: 17 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17, marginBottom: 6 },
  lead: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  input: {
    color: "#e8eef1",
    minHeight: 104,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  inputDisabled: { opacity: 0.55 },
  dimmed: { opacity: 0.55 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  switchLabel: { flex: 1, color: "#b8c0c5", fontSize: 13, lineHeight: 18 },
  btn: {
    backgroundColor: spiritualTheme.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { backgroundColor: "#3a4849" },
  btnTxt: { color: "#000", fontWeight: "800", fontSize: 15 },
  hint: { marginTop: 10, fontSize: 13, color: "#8a9aa8", lineHeight: 18 },
});
