import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pickLiveFourthWeekFocus, getLiveFourthWeekCode } from "../../../lib/spiritualDefaults";
import {
  loadLiveFourthWeekProgress,
  saveLiveFourthWeekProgress,
  countLiveFourthWeeksCompleted,
} from "../../../lib/liveFourthProgress";
import { spiritualTheme } from "./spiritualTheme";
import { LiveTheFourthModal } from "./LiveTheFourthModal";

function TaskRow({ label, title, done, onToggle, onOpenDetails }) {
  return (
    <View style={styles.taskRow}>
      <Pressable
        onPress={onToggle}
        style={[styles.check, done && styles.checkDone]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Mark ${label} complete`}
      >
        {done ? <Ionicons name="checkmark" size={16} color={spiritualTheme.textOnAccent} /> : null}
      </Pressable>
      <TouchableOpacity style={styles.taskText} onPress={onOpenDetails} activeOpacity={0.85}>
        <Text style={styles.taskLabel}>{label}</Text>
        <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
          {title}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onOpenDetails} hitSlop={10} accessibilityLabel={`Open ${label} details`}>
        <Ionicons name="information-circle-outline" size={22} color={spiritualTheme.subMuted} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Today hub: this week's Live the Fourth challenge + journal as checkable tasks.
 */
export function LiveTheFourthTodayTasks({ prompts, loading }) {
  const rows = useMemo(() => prompts ?? [], [prompts]);
  const weekStamp = getLiveFourthWeekCode(new Date());
  const focus = useMemo(() => pickLiveFourthWeekFocus(rows, new Date()), [rows, weekStamp]);

  const [done, setDone] = useState({ challenge: false, journal: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [weeksCompleted, setWeeksCompleted] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, weeks] = await Promise.all([
        loadLiveFourthWeekProgress(focus.weekCode),
        countLiveFourthWeeksCompleted(),
      ]);
      if (!cancelled) {
        setDone(saved);
        setWeeksCompleted(weeks);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focus.weekCode]);

  const toggle = useCallback(
    async (key) => {
      const next = { ...done, [key]: !done[key] };
      setDone(next);
      try {
        await saveLiveFourthWeekProgress(focus.weekCode, next);
        if (next.challenge && next.journal) {
          const weeks = await countLiveFourthWeeksCompleted();
          setWeeksCompleted(weeks);
        }
      } catch {
        /* non-fatal */
      }
    },
    [done, focus.weekCode],
  );

  const ch = focus.challenge;
  const jn = focus.journal;
  const hasAnything = Boolean(ch ?? jn);
  const completedCount = (done.challenge ? 1 : 0) + (done.journal ? 1 : 0);
  const totalTasks = (ch ? 1 : 0) + (jn ? 1 : 0);
  const allDone = totalTasks > 0 && completedCount >= totalTasks;
  const progressRatio = totalTasks > 0 ? completedCount / totalTasks : 0;

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live the Fourth</Text>
        <View style={styles.loader}>
          <ActivityIndicator color={spiritualTheme.accent} />
          <Text style={styles.loadingTxt}>Loading this week…</Text>
        </View>
      </View>
    );
  }

  if (!hasAnything) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live the Fourth</Text>
        <Text style={styles.muted}>Weekly tasks unavailable right now.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.flameIcon}>
            <Ionicons name="flame" size={20} color={spiritualTheme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Live the Fourth</Text>
            <Text style={styles.weekLabel}>{focus.weekRangeLabel}</Text>
            {weeksCompleted > 0 ? (
              <Text style={styles.streak}>Weeks fully completed: {weeksCompleted}</Text>
            ) : null}
          </View>
          {totalTasks > 0 ? (
            <Text style={styles.progressPill}>
              {completedCount}/{totalTasks}
            </Text>
          ) : null}
        </View>

        {totalTasks > 0 ? (
          <View style={styles.progressTrack} accessibilityLabel={`${completedCount} of ${totalTasks} tasks done`}>
            <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
          </View>
        ) : null}

        {ch ? (
          <TaskRow
            label="Challenge"
            title={ch.title}
            done={done.challenge}
            onToggle={() => toggle("challenge")}
            onOpenDetails={() => setModalOpen(true)}
          />
        ) : null}

        {jn ? (
          <TaskRow
            label="Journal"
            title={jn.title}
            done={done.journal}
            onToggle={() => toggle("journal")}
            onOpenDetails={() => setModalOpen(true)}
          />
        ) : null}

        {allDone ? (
          <Text style={styles.successLine}>You finished this week — great work living the Fourth!</Text>
        ) : null}

        <TouchableOpacity style={styles.readMore} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
          <Text style={styles.readMoreText}>Read full prompts</Text>
          <Ionicons name="chevron-forward" size={16} color={spiritualTheme.accent} />
        </TouchableOpacity>

        <Text style={styles.hint}>New pair every Monday · tap ℹ for details</Text>
      </View>

      <LiveTheFourthModal visible={modalOpen} onClose={() => setModalOpen(false)} focus={focus} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spiritualTheme.radiusLg,
    padding: 14,
    backgroundColor: spiritualTheme.cardBg,
    borderWidth: 1,
    borderColor: spiritualTheme.border,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  flameIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: spiritualTheme.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: spiritualTheme.text, fontWeight: "800", fontSize: 16 },
  weekLabel: { color: spiritualTheme.subMuted, fontSize: 12, marginTop: 2 },
  streak: { color: spiritualTheme.success, fontSize: 11, marginTop: 4, fontWeight: "600" },
  progressPill: {
    color: spiritualTheme.accent,
    fontWeight: "800",
    fontSize: 13,
    backgroundColor: spiritualTheme.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: spiritualTheme.accent,
    borderRadius: 2,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: spiritualTheme.border,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: spiritualTheme.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: {
    backgroundColor: spiritualTheme.accent,
    borderColor: spiritualTheme.accent,
  },
  taskText: { flex: 1 },
  taskLabel: {
    color: spiritualTheme.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  taskTitle: { color: spiritualTheme.text, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  taskTitleDone: { color: spiritualTheme.subMuted, textDecorationLine: "line-through" },
  successLine: {
    color: spiritualTheme.success,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  readMoreText: { color: spiritualTheme.accent, fontWeight: "700", fontSize: 13 },
  hint: { color: spiritualTheme.sub, fontSize: 12, textAlign: "center", marginTop: 2 },
  loader: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingTxt: { color: spiritualTheme.sub, fontSize: 13 },
  muted: { color: spiritualTheme.subMuted, fontSize: 13 },
});
