import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { schoolWellnessTheme as T } from "../schoolWellnessTheme";
import { submitAssignmentResponse } from "../../../lib/administrativeAssignmentsClient";

const URGENT = "#ff5b6b";
const URGENT_DIM = "rgba(255, 91, 107, 0.14)";

/**
 * High-priority card shown when the student has a pending reflective assignment.
 *
 * @param {{
 *   assignment: import("../../../types/schoolWellness").AdministrativeAssignmentRow;
 *   onSubmitted?: () => void;
 * }} props
 */
export function ReflectiveAssignmentCard({ assignment, onSubmitted }) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (!assignment) return null;

  const due = new Date(assignment.due_at);
  const dueLabel = due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const typeLabel =
    assignment.assignment_type === "restorative_plan"
      ? "Restorative plan"
      : "Reflective journal";

  const handleSubmit = async () => {
    const trimmed = response.trim();
    if (!trimmed) {
      Alert.alert("Required", "Please write your reflection before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await submitAssignmentResponse(assignment.id, trimmed);
      Alert.alert("Submitted", "Your reflection was sent to your dean for review.");
      onSubmitted?.();
    } catch (e) {
      Alert.alert("Error", e?.message ?? "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.iconRing}>
          <Ionicons name="document-text" size={22} color={URGENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>Required · {typeLabel}</Text>
          <Text style={styles.title}>Complete your reflection assignment</Text>
          <Text style={styles.due}>Due {dueLabel}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#aaa" />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.promptLabel}>Prompt</Text>
          <Text style={styles.prompt}>{assignment.prompt_text}</Text>

          <Text style={styles.inputLabel}>Your response</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Write thoughtfully and honestly…"
            placeholderTextColor="#666"
            value={response}
            onChangeText={setResponse}
            editable={!submitting}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitTxt}>Submit reflection</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: T.radiusLg,
    borderWidth: 2,
    borderColor: URGENT,
    backgroundColor: URGENT_DIM,
    overflow: "hidden",
    marginBottom: T.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: URGENT,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    color: URGENT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: T.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  due: {
    color: T.sub,
    fontSize: 12,
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,91,107,0.25)",
  },
  promptLabel: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  prompt: {
    color: T.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputLabel: {
    color: T.subMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  input: {
    minHeight: 120,
    borderRadius: T.radiusLg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.35)",
    color: T.text,
    fontSize: 15,
    padding: 12,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: URGENT,
    borderRadius: T.radiusLg,
    paddingVertical: 14,
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
