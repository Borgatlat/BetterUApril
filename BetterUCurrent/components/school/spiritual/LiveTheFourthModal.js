import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { spiritualTheme } from "./spiritualTheme";

function Tag({ row }) {
  if (!row) return null;
  if (row.org_id) return <Text style={styles.tag}>From your school</Text>;
  if (row._fallback) return <Text style={styles.tagStarter}>Starter prompt</Text>;
  return <Text style={styles.tagDef}>Shared prompt</Text>;
}

/**
 * Full-screen sheet for this week's Live the Fourth challenge + journal body text.
 */
export function LiveTheFourthModal({ visible, onClose, focus }) {
  const insets = useSafeAreaInsets();
  const ch = focus?.challenge;
  const jn = focus?.journal;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.modalBackdrop, { paddingBottom: Math.max(16, insets.bottom + 12) }]}
        onPress={onClose}
      >
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Live the Fourth</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close-circle" size={28} color={spiritualTheme.sub} />
            </TouchableOpacity>
          </View>

          {focus?.weekRangeLabel ? (
            <Text style={styles.modalWeek}>{focus.weekRangeLabel}</Text>
          ) : null}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollInner}
          >
            {ch ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>Challenge</Text>
                <Text style={styles.blockTitle}>{ch.title}</Text>
                <Text style={styles.blockBody}>{ch.body}</Text>
                <Tag row={ch} />
              </View>
            ) : null}

            {jn ? (
              <View style={[styles.block, ch ? { marginTop: 16 } : null]}>
                <Text style={styles.blockLabel}>Journal</Text>
                <Text style={styles.blockTitle}>{jn.title}</Text>
                <Text style={styles.blockBody}>{jn.body}</Text>
                <Tag row={jn} />
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnTxt}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  modalWeek: { color: "#fff", fontWeight: "700", fontSize: 15, paddingHorizontal: 18, marginBottom: 8 },
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
