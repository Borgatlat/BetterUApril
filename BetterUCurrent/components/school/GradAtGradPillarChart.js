import React, { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { schoolWellnessTheme as T } from "./schoolWellnessTheme";
import {
  GRAD_AT_GRAD_PILLARS,
  GRAD_AT_GRAD_LABELS,
  gradAtGradSummaryToMap,
} from "../../lib/gradAtGradClient";

const PILLAR_COLORS = {
  open_to_growth: "#5ce1a3",
  intellectually_competent: "#00e5e5",
  religious: "#c4a8ff",
  loving: "#ff9aa6",
  committed_to_justice: "#ffd700",
};

/**
 * Five horizontal progress bars — Grad at Grad pillar balance for one student.
 *
 * @param {{ summaryRows: Array<{ pillar: string, total_points: number }>, loading?: boolean }} props
 */
export function GradAtGradPillarChart({ summaryRows, loading = false }) {
  const pointsMap = useMemo(() => gradAtGradSummaryToMap(summaryRows), [summaryRows]);
  const maxPoints = useMemo(
    () => Math.max(1, ...GRAD_AT_GRAD_PILLARS.map((p) => pointsMap[p])),
    [pointsMap],
  );
  const totalAll = useMemo(
    () => GRAD_AT_GRAD_PILLARS.reduce((sum, p) => sum + pointsMap[p], 0),
    [pointsMap],
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={T.accent} size="small" />
        <Text style={styles.loadingTxt}>Loading formation profile…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>
        {totalAll === 0
          ? "Complete service, spiritual check-ins, and campus activities to grow across all five pillars."
          : `${totalAll} formation points across the Profile of the Graduate at Graduation.`}
      </Text>
      {GRAD_AT_GRAD_PILLARS.map((pillar) => {
        const pts = pointsMap[pillar];
        const pct = Math.round((pts / maxPoints) * 100);
        const color = PILLAR_COLORS[pillar] ?? T.accent;
        return (
          <View key={pillar} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{GRAD_AT_GRAD_LABELS[pillar]}</Text>
              <Text style={[styles.pts, { color }]}>{pts}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  lead: {
    color: T.sub,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  row: { gap: 6 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: T.text,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  pts: {
    fontSize: 13,
    fontWeight: "800",
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingTxt: { color: T.sub, fontSize: 13 },
});
