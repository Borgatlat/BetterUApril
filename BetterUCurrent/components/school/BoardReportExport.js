import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  fetchBoardReportRows,
  fetchBoardReportSpiritualRows,
  formatBoardReport,
  boardReportToCsv,
  refreshBoardReportCache,
} from "../../lib/boardReportExport";

const ACCENT = "#00e5e5";
const GREEN = "#5ce1a3";
const AMBER = "#e8c170";
const PANEL = "#0c1115";

/**
 * Admin "One-Click Board Report" UI (Feature 2 client).
 *
 * Calls the SECURITY DEFINER RPC get_anonymized_weekly_trends, formats rows,
 * renders a scannable table + exports JSON / CSV via Share.share.
 */
export function BoardReportExport() {
  const insets = useSafeAreaInsets();
  const { orgId, workspace } = useAuthSession();
  const [weeksBack, setWeeksBack] = useState(12);
  const [wellnessRows, setWellnessRows] = useState([]);
  const [spiritualRows, setSpiritualRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const load = useCallback(async () => {
    if (!orgId || workspace !== "staff") return;
    setError(null);
    try {
      // Promise.all parallelizes the two RPCs because they're independent.
      // Sequential await would double the time-to-first-paint.
      const [wellness, spiritual] = await Promise.all([
        fetchBoardReportRows(orgId, weeksBack),
        fetchBoardReportSpiritualRows(orgId, weeksBack),
      ]);
      setWellnessRows(wellness);
      setSpiritualRows(spiritual);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, workspace, weeksBack]);

  useEffect(() => {
    load();
  }, [load]);

  const report = useMemo(() => {
    if (!orgId) return null;
    return formatBoardReport({
      orgId,
      wellnessRows,
      spiritualRows,
      weeksIncluded: weeksBack,
    });
  }, [orgId, wellnessRows, spiritualRows, weeksBack]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRefreshCache = async () => {
    setRefreshingCache(true);
    setError(null);
    try {
      const result = await refreshBoardReportCache();
      setLastRefreshed(result?.refreshed_at ?? new Date().toISOString());
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setRefreshingCache(false);
    }
  };

  const handleExportJson = async () => {
    if (!report) return;
    try {
      await Share.share({
        title: `BetterU board report — ${orgId}`,
        message: JSON.stringify(report, null, 2),
      });
    } catch (e) {
      if (__DEV__) console.warn("share JSON:", e);
    }
  };

  const handleExportCsv = async () => {
    if (!report) return;
    try {
      await Share.share({
        title: `BetterU board report (CSV) — ${orgId}`,
        message: boardReportToCsv(report),
      });
    } catch (e) {
      if (__DEV__) console.warn("share CSV:", e);
    }
  };

  if (workspace !== "staff") {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={36} color="#555" />
        <Text style={styles.muted}>Board report is for counselor / admin accounts.</Text>
      </View>
    );
  }

  if (!orgId) {
    return (
      <View style={styles.centered}>
        <Ionicons name="business-outline" size={36} color="#555" />
        <Text style={styles.muted}>No organization linked to this staff profile.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={[styles.muted, { marginTop: 12 }]}>Loading anonymized trends…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.shell, { paddingTop: insets.top ? 0 : 8 }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={24} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>One-click board report</Text>
            <Text style={styles.heroSub}>
              FERPA-aligned cohort wellness data — organization × grade × week. No PII included.
            </Text>
          </View>
        </View>

        {/* FERPA banner */}
        <View style={styles.complianceBanner}>
          <Ionicons name="shield-checkmark-outline" size={22} color={GREEN} />
          <View style={{ flex: 1 }}>
            <Text style={styles.complianceTitle}>De-identified aggregate</Text>
            <Text style={styles.complianceBody}>
              Cohorts with fewer than <Text style={styles.bold}>5 contributing students</Text> per
              week are automatically suppressed (k-anonymity floor). Only students who opt into
              "anonymize for school dashboard" are included.
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <Text style={styles.controlsLabel}>Window</Text>
          <View style={styles.windowGroup}>
            {[4, 8, 12, 26].map((w) => (
              <TouchableOpacity
                key={w}
                onPress={() => setWeeksBack(w)}
                style={[styles.windowBtn, weeksBack === w && styles.windowBtnActive]}
              >
                <Text
                  style={[
                    styles.windowBtnTxt,
                    weeksBack === w && styles.windowBtnTxtActive,
                  ]}
                >
                  {w}w
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshCacheBtn}
          onPress={handleRefreshCache}
          disabled={refreshingCache}
          activeOpacity={0.85}
        >
          {refreshingCache ? (
            <ActivityIndicator color={ACCENT} size="small" />
          ) : (
            <Ionicons name="refresh-outline" size={16} color={ACCENT} />
          )}
          <Text style={styles.refreshCacheTxt}>
            {refreshingCache ? "Refreshing cache…" : "Refresh aggregate cache"}
          </Text>
        </TouchableOpacity>
        {lastRefreshed ? (
          <Text style={styles.lastRefreshed}>Cache rebuilt · {humanDate(lastRefreshed)}</Text>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color="#ffb4b4" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* Cohort table */}
        <Text style={styles.sectionTitle}>Wellness cohorts</Text>
        {report?.grade_cohorts.length ? (
          <CohortTable rows={report.grade_cohorts} />
        ) : (
          <EmptyState
            label="No qualifying cohorts in this window"
            hint="Increase the window or wait for more pulse contributions (5+ per grade/week)."
          />
        )}

        {/* Spiritual cohort table */}
        {report?.spiritual_cohorts.length ? (
          <>
            <Text style={styles.sectionTitle}>Spiritual cohorts</Text>
            <SpiritualTable rows={report.spiritual_cohorts} />
          </>
        ) : null}

        {/* Export */}
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportPrimary} onPress={handleExportJson} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={20} color="#062a2a" />
            <Text style={styles.exportPrimaryTxt}>Export JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportSecondary} onPress={handleExportCsv} activeOpacity={0.85}>
            <Ionicons name="grid-outline" size={20} color={ACCENT} />
            <Text style={styles.exportSecondaryTxt}>Share as CSV</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Generated {humanDate(report?.generated_at)} · classification:{" "}
          <Text style={{ color: ACCENT }}>{report?.data_classification}</Text>
        </Text>
      </ScrollView>
    </View>
  );
}

/* ===================== Subcomponents ===================== */

function CohortTable({ rows }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.thWeek, styles.th]}>Week</Text>
        <Text style={[styles.thGrade, styles.th]}>Grade</Text>
        <Text style={[styles.thMetric, styles.th]}>Mood</Text>
        <Text style={[styles.thMetric, styles.th]}>Stress</Text>
        <Text style={[styles.thMetric, styles.th]}>Sleep</Text>
        <Text style={[styles.thN, styles.th]}>n</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={`${r.week_start}-${r.grade_level}-${i}`}
          style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
        >
          <Text style={styles.tdWeek}>{r.week_start}</Text>
          <Text style={styles.tdGrade}>{r.grade_level}</Text>
          <Text style={styles.tdMetric}>{numOrDash(r.avg_mood)}</Text>
          <Text style={styles.tdMetric}>{numOrDash(r.avg_stress)}</Text>
          <Text style={styles.tdMetric}>{numOrDash(r.avg_sleep)}</Text>
          <Text style={styles.tdN}>{r.sample_size}</Text>
        </View>
      ))}
    </View>
  );
}

function SpiritualTable({ rows }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.thWeek, styles.th]}>Week</Text>
        <Text style={[styles.thGrade, styles.th]}>Grade</Text>
        <Text style={[styles.thMetric, styles.th]}>Intensity</Text>
        <Text style={[styles.thMetric, styles.th]}>Consol.</Text>
        <Text style={[styles.thMetric, styles.th]}>Desol.</Text>
        <Text style={[styles.thN, styles.th]}>n</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={`${r.week_start}-${r.grade_level}-${i}`}
          style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
        >
          <Text style={styles.tdWeek}>{r.week_start}</Text>
          <Text style={styles.tdGrade}>{r.grade_level}</Text>
          <Text style={styles.tdMetric}>{numOrDash(r.avg_intensity)}</Text>
          <Text style={[styles.tdMetric, { color: GREEN }]}>{r.consolation_count}</Text>
          <Text style={[styles.tdMetric, { color: AMBER }]}>{r.desolation_count}</Text>
          <Text style={styles.tdN}>{r.sample_size}</Text>
        </View>
      ))}
    </View>
  );
}

function EmptyState({ label, hint }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="bar-chart-outline" size={28} color="#4a5660" />
      <Text style={styles.emptyTitle}>{label}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

/* ===================== helpers ===================== */

function numOrDash(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}

function humanDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/* ===================== styles ===================== */

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#050708" },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  centered: {
    flex: 1,
    backgroundColor: "#050708",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    gap: 12,
  },
  muted: { color: "#88929b", fontSize: 14, textAlign: "center" },
  bold: { fontWeight: "800", color: "#fff" },

  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "rgba(0,229,229,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.22)",
    padding: 16,
    marginBottom: 14,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(0,229,229,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  heroSub: { color: "#b9c5cc", fontSize: 13, lineHeight: 19, marginTop: 4 },

  complianceBanner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(92,225,163,0.06)",
    borderWidth: 1,
    borderColor: "rgba(92,225,163,0.22)",
    marginBottom: 14,
    alignItems: "flex-start",
  },
  complianceTitle: { color: "#cfeedd", fontWeight: "800", fontSize: 14 },
  complianceBody: { color: "#b3c5b9", fontSize: 12, marginTop: 4, lineHeight: 18 },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  controlsLabel: { color: "#8a949c", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  windowGroup: {
    flexDirection: "row",
    backgroundColor: PANEL,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  windowBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  windowBtnActive: { backgroundColor: "rgba(0,229,229,0.18)" },
  windowBtnTxt: { color: "#a8b3ba", fontWeight: "800", fontSize: 12 },
  windowBtnTxtActive: { color: ACCENT },

  refreshCacheBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,229,229,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.25)",
    marginTop: 8,
  },
  refreshCacheTxt: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  lastRefreshed: { color: "#5d6a72", fontSize: 11, marginTop: 4 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(255,60,60,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.35)",
    marginTop: 12,
  },
  errorTxt: { color: "#ffb4b4", flex: 1, fontSize: 13 },

  sectionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 20,
    marginBottom: 8,
  },

  table: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    backgroundColor: PANEL,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,229,229,0.05)",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  th: { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  thWeek: { flex: 2 },
  thGrade: { flex: 1 },
  thMetric: { flex: 1, textAlign: "right" },
  thN: { flex: 0.6, textAlign: "right" },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRowAlt: { backgroundColor: "rgba(255,255,255,0.02)" },
  tdWeek: { flex: 2, color: "#d4dde2", fontSize: 12 },
  tdGrade: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "700" },
  tdMetric: { flex: 1, color: "#cdd6dc", fontSize: 12, textAlign: "right" },
  tdN: { flex: 0.6, color: "#8a949c", fontSize: 12, textAlign: "right" },

  empty: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 6,
  },
  emptyTitle: { color: "#8a959c", fontWeight: "700", fontSize: 14 },
  emptyHint: { color: "#5c6870", fontSize: 12, textAlign: "center", paddingHorizontal: 32, lineHeight: 17 },

  exportRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  exportPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  exportPrimaryTxt: { color: "#062a2a", fontWeight: "800", fontSize: 14 },
  exportSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.4)",
    backgroundColor: "rgba(0,229,229,0.08)",
  },
  exportSecondaryTxt: { color: ACCENT, fontWeight: "800", fontSize: 14 },

  footer: { color: "#3d454c", fontSize: 11, marginTop: 16, textAlign: "center", lineHeight: 16 },
});
