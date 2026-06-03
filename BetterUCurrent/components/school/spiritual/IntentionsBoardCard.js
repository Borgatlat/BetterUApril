import React, { useState } from "react";
import { View, Text, TextInput, Switch, StyleSheet } from "react-native";
import { insertPrayerIntention } from "../../../lib/spiritualSchoolClient";
import { spiritualTheme } from "./spiritualTheme";
import { SpiritualPrimaryButton } from "./SpiritualPrimaryButton";

/** Private journaling + optional moderated community prayer request. */
export function IntentionsBoardCard({ orgId, orgReady = true, onSharedForPrayerWall }) {
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
      const wasShared = shareAnon;
      setShareAnon(false);
      if (wasShared) {
        setHint(
          "Submitted for review. Campus ministers approve before anything appears on the prayer wall.",
        );
        onSharedForPrayerWall?.();
      } else {
        setHint("Saved privately for you.");
      }
    } catch (e) {
      setHint(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, locked && styles.wrapMuted]}>
      <Text style={styles.h2}>Intentions board</Text>
      <Text style={styles.lead}>Only you see this unless you turn on sharing below.</Text>
      {locked ? (
        <Text style={styles.lockBanner}>Saving needs your school organization on file.</Text>
      ) : null}
      <TextInput
        style={[styles.input, locked && styles.inputDisabled]}
        placeholder="Type a prayer or intention..."
        placeholderTextColor={spiritualTheme.placeholder}
        value={body}
        onChangeText={setBody}
        multiline
        editable={!locked}
      />
      <View style={[styles.switchRow, locked && styles.dimmed]} pointerEvents={locked ? "none" : "auto"}>
        <Text style={styles.switchLabel}>
          Share anonymously with campus ministers (not on the prayer wall until approved)
        </Text>
        <Switch
          trackColor={{ false: "#444", true: "#1a8066" }}
          thumbColor="#fff"
          value={shareAnon}
          onValueChange={setShareAnon}
        />
      </View>
      <SpiritualPrimaryButton
        label="Save intention"
        disabledLabel="Save (needs school link)"
        onPress={submit}
        disabled={locked}
        loading={busy}
      />
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
  lockBanner: {
    color: spiritualTheme.lockBanner,
    fontSize: 12,
    marginBottom: 10,
    fontWeight: "600",
    lineHeight: 17,
  },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17, marginBottom: 6 },
  lead: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  input: {
    color: spiritualTheme.text,
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
  switchLabel: { flex: 1, color: spiritualTheme.sub, fontSize: 13, lineHeight: 18 },
  hint: { marginTop: 10, fontSize: 13, color: spiritualTheme.sub, lineHeight: 18 },
});
