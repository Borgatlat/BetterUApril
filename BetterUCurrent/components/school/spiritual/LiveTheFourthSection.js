import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { pickLiveFourthWeekFocus, getLiveFourthWeekCode } from "../../../lib/spiritualDefaults";
import { spiritualTheme } from "./spiritualTheme";

/** Card + modal: exactly one rotated challenge & one rotated journal prompt per calendar week (local Monday). */
export function LiveTheFourthSection({ prompts, loading }) {
  const insets = useSafeAreaInsets();
  const rows = useMemo(() => prompts ?? [], [prompts]);
  const weekStamp = getLiveFourthWeekCode(new Date());

  /**
   * `weekStamp` in deps means when Monday rolls over, memo picks refresh without navigating away.
   * `pickLiveFourthWeekFocus` maps the full merged list → two pools → deterministic indices from `weekCode`.
   */
  const focus = useMemo(
    () => pickLiveFourthWeekFocus(rows, new Date()),
    [rows, weekStamp],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const ch = focus.challenge;
  const jn = focus.journal;

  const hasAnything = Boolean(ch ?? jn);
  /** Treat defaults as prompts where `_fallback === true`; campus rows usually omit `_fallback`. */
  const hasFallback = Boolean(ch?._fallback || jn?._fallback);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Live the Fourth</Text>
        <View style={styles.loader}>
          <ActivityIndicator color={spiritualTheme.accent} />
          <Text style={styles.loadingTxt}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!hasAnything) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h2}>Live the Fourth</Text>
        <Text style={styles.mutedMuted}>Prompts unavailable right now.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.wrap}>
        <Text style={styles.h2}>Live the Fourth</Text>
        <Text style={styles.muted}>
          {hasFallback
            ? "Starter rhythm until campus ministers publish their own. One challenge and one journal focus each week — tap to open."
            : "One challenge and one journal focus each week from your campus — tap to open."}
        </Text>

        <TouchableOpacity
          style={styles.openCard}
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Live the Fourth modal for this week"
          activeOpacity={0.88}
        >
          <View style={styles.openIconCircle}>
            <Ionicons name="flame" size={24} color={spiritualTheme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.openTitle}>This week</Text>
            <Text style={styles.openSubtitle} numberOfLines={2}>
              {focus.weekRangeLabel}
            </Text>
            <Text style={styles.openTeaser} numberOfLines={2}>
              {[ch?.title, jn?.title].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={spiritualTheme.sub} />
        </TouchableOpacity>

        <Text style={styles.mutedMuted}>Fresh pair every Monday (your device calendar).</Text>
      </View>

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        /** Android: taps outside pass through unless we backdrop */
        statusBarTranslucent
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { paddingBottom: Math.max(16, insets.bottom + 12) }]}
          onPress={() => setModalOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Live the Fourth</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close-circle" size={28} color={spiritualTheme.sub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalWeek}>{focus.weekRangeLabel}</Text>
            <Text style={styles.modalHint}>Shown one challenge + one journal at a time. Next week rotates.</Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollInner}
            >
              {ch ? (
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>This week’s challenge</Text>
                  <Text style={styles.blockTitle}>{ch.title}</Text>
                  <Text style={styles.blockBody}>{ch.body}</Text>
                  <Tag row={ch} />
                </View>
              ) : null}

              {jn ? (
                <View style={[styles.block, ch ? { marginTop: 16 } : null]}>
                  <Text style={styles.blockLabel}>This week’s journal prompt</Text>
                  <Text style={styles.blockTitle}>{jn.title}</Text>
                  <Text style={styles.blockBody}>{jn.body}</Text>
                  <Tag row={jn} />
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={styles.doneBtn} onPress={() => setModalOpen(false)} activeOpacity={0.85}>
              <Text style={styles.doneBtnTxt}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Tag({ row }) {
  if (!row) return null;
  if (row.org_id) return <Text style={styles.tag}>From your school</Text>;
  if (row._fallback) return <Text style={styles.tagStarter}>Starter (campus can replace)</Text>;
  return <Text style={styles.tagDef}>Shared prompt</Text>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17 },
  muted: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  mutedMuted: { color: spiritualTheme.subMuted, fontSize: 12, lineHeight: 17 },
  loader: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingTxt: { color: spiritualTheme.sub, fontSize: 13 },
  openCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: spiritualTheme.cardBg,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
  },
  openIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: spiritualTheme.accentDim,
    justifyContent: "center",
    alignItems: "center",
  },
  openTitle: { color: spiritualTheme.text, fontWeight: "800", fontSize: 15 },
  openSubtitle: { color: spiritualTheme.sub, fontSize: 12, marginTop: 3 },
  openTeaser: { color: "#c5ced3", fontSize: 13, marginTop: 6, lineHeight: 19 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: 12,
    paddingTop: 48,
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: "#0c0f11",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  modalTitle: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 18 },
  modalWeek: { color: "#fff", fontWeight: "700", fontSize: 15, paddingHorizontal: 18 },
  modalHint: {
    color: spiritualTheme.subMuted,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 18,
    marginBottom: 10,
    marginTop: 4,
  },
  modalScrollInner: { paddingHorizontal: 18, paddingBottom: 14 },
  block: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: spiritualTheme.border,
  },
  blockLabel: {
    color: spiritualTheme.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.75,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  blockTitle: { color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 8 },
  blockBody: { color: "#c5ced3", fontSize: 14, lineHeight: 21 },
  tag: { marginTop: 10, color: "#5ce1a3", fontSize: 11, fontWeight: "600" },
  tagDef: { marginTop: 10, color: "#9aacff", fontSize: 11, fontWeight: "600" },
  tagStarter: { marginTop: 10, color: "#e8c170", fontSize: 11, fontWeight: "600" },
  doneBtn: {
    marginHorizontal: 18,
    marginVertical: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: spiritualTheme.accentDim,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.45)",
    alignItems: "center",
  },
  doneBtnTxt: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 16 },
});
