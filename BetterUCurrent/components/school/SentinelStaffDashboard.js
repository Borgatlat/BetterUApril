import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  fetchSentinelMetrics,
  fetchPendingAlertsForOrg,
} from "../../lib/schoolWellnessClient";
import { formatWeeklyAnonymizedExport } from "../../lib/schoolWellnessAnalytics";
import { PastoralMinistryPanel } from "./PastoralMinistryPanel";

const ACCENT = "#00e5e5";
const GREEN = "#5ce1a3";
const AMBER = "#e8c170";

/**
 * Leadership & counseling overview: cohort-level wellness signals plus identified support requests.
 * FERPA-style posture documented in-copy; no per-student named scores on aggregate cards.
 */
export function SentinelStaffDashboard() {
  const insets = useSafeAreaInsets();
  const { orgId, workspace } = useAuthSession();
  const [dashTab, setDashTab] = useState("wellness");
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgId || workspace !== "staff") return;
    setError(null);
    try {
      const [m, a] = await Promise.all([
        fetchSentinelMetrics(orgId),
        fetchPendingAlertsForOrg(orgId),
      ]);
      setMetrics(m);
      setAlerts(a);
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }, [orgId, workspace]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const exportJson = async () => {
    if (!metrics || !orgId) return;
    const rows = formatWeeklyAnonymizedExport(metrics, {
      orgSlug: orgId,
      periodEndIso: new Date().toISOString().slice(0, 10),
    });
    const payload = JSON.stringify(rows, null, 2);
    try {
      await Share.share({
        message: payload,
        title: "Anonymized weekly wellness export",
      });
    } catch (e) {
      console.warn(e);
    }
  };

  if (workspace !== "staff") {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Not available for this account.</Text>
      </View>
    );
  }

  if (!orgId) {
    return (
      <View style={styles.centered}>
        <Ionicons name="business-outline" size={40} color="#555" style={{ alignSelf: "center", marginBottom: 12 }} />
        <Text style={styles.muted}>No organization is linked to this staff profile.</Text>
        <Text style={[styles.small, { marginTop: 10, textAlign: "center" }]}>
          Ask your tech lead to attach your admin or counselor profile to your school slug in BetterU.
        </Text>
      </View>
    );
  }

  const n = metrics?.sample_size_7d ?? null;
  const lowSample = n !== null && n < 15;

  return (
    <View style={[styles.shell, { paddingTop: insets.top ? 6 : 0 }]}>
      <View style={styles.segmentWrap}>
        <Text style={styles.segmentLabel}>Dashboard</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, dashTab === "wellness" && styles.segmentOn]}
            onPress={() => setDashTab("wellness")}
            accessibilityRole="tab"
          >
            <Ionicons
              name={dashTab === "wellness" ? "pulse" : "pulse-outline"}
              size={18}
              color={dashTab === "wellness" ? "#fff" : "#888"}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.segmentTxt, dashTab === "wellness" && styles.segmentTxtOn]} numberOfLines={1}>
              Wellness overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, dashTab === "pastoral" && styles.segmentOn]}
            onPress={() => setDashTab("pastoral")}
            accessibilityRole="tab"
          >
            <Ionicons
              name={dashTab === "pastoral" ? "sparkles" : "sparkles-outline"}
              size={18}
              color={dashTab === "pastoral" ? "#fff" : "#888"}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.segmentTxt, dashTab === "pastoral" && styles.segmentTxtOn]} numberOfLines={1}>
              Pastoral formation
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {dashTab === "pastoral" ? (
        <PastoralMinistryPanel orgId={orgId} />
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="ribbon-outline" size={26} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Whole-student leadership view</Text>
                <Text style={styles.heroSub}>
                  Principals use this workspace to watch anonymized cohort patterns, pair them with pastoral
                  programs (cura personalis), and respond when students voluntarily ask for help.
                </Text>
              </View>
            </View>
            <View style={styles.orgChip}>
              <Text style={styles.orgChipTxt}>ORG · {orgId}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Why this satisfies day-to-day compliance conversations</Text>
            <Text style={styles.infoBody}>
              Many districts ask schools to show they are observing student wellbeing and escalating care through
              tiered supports — not burying distress. These cards surface{" "}
              <Text style={{ fontWeight: "700", color: "#e4eaed" }}>cohort-level</Text> mood, stress, and sleep
              (only from students who opt into aggregate pooling) plus stress velocity for early teamwork with
              counseling. Nothing here replaces mandated reporting policies, IEP teams, or your local handbook —
              but it gives leadership a repeatable weekly artifact to review with pastors and counselors.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Privacy & data handling</Text>
          <View style={styles.principleRow}>
            <Ionicons name="eye-off-outline" size={22} color={GREEN} />
            <Text style={styles.principleTxt}>
              <Text style={{ fontWeight: "700", color: "#fff" }}>Aggregate pulse.</Text> Students can keep names
              out of pooled averages via the anonymize toggle. Those rows power the averages below — no roster
              roll-up appears here.
            </Text>
          </View>
          <View style={styles.principleRow}>
            <Ionicons name="hand-left-outline" size={22} color={AMBER} />
            <Text style={styles.principleTxt}>
              <Text style={{ fontWeight: "700", color: "#fff" }}>Voluntary outreach.</Text> Counseling requests only
              show student contact info after the learner explicitly submits a ticket — aligning with deliberate,
              identifiable support pathways.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={22} color="#ffb4b4" />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>7-day cohort signals</Text>
          <Text style={styles.sectionMuted}>
            Averages drawn from anonymized pooling only. Trend across multiple weeks beats any single datapoint —
            screenshot this panel after pull-to-refresh for standing meetings.
          </Text>

          {lowSample ? (
            <View style={styles.warnPill}>
              <Ionicons name="information-circle-outline" size={18} color={AMBER} />
              <Text style={styles.warnPillTxt}>
                Fewer than 15 opt-in pulses in seven days — treat metrics as directional until adoption grows (run
                a homeroom push during advisory).
              </Text>
            </View>
          ) : null}

          <View style={styles.metricsRow}>
            <MetricTile
              icon="happy-outline"
              label="Avg mood"
              sub="Likert · higher is brighter mood"
              value={fmt(metrics?.mood_avg_7d)}
            />
            <MetricTile
              icon="flash-outline"
              label="Avg stress"
              sub="Higher = heavier load"
              value={fmt(metrics?.stress_avg_7d)}
            />
            <MetricTile
              icon="moon-outline"
              label="Avg sleep qual."
              sub="Higher = rested"
              value={fmt(metrics?.sleep_avg_7d)}
            />
          </View>

          <View style={styles.sampleCard}>
            <Text style={styles.sampleStrong}>Rolling sample</Text>
            <Text style={styles.sampleMuted}>
              Contributing pulse logs this week:{" "}
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 24 }}>{n ?? "—"}</Text>
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Sentinel • systemic stress drift</Text>
          <View
            style={[
              styles.banner,
              metrics?.stress_spike_warning ? styles.bannerWarn : styles.bannerOk,
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <Ionicons
                name={metrics?.stress_spike_warning ? "trending-up" : "checkmark-circle"}
                size={28}
                color={metrics?.stress_spike_warning ? "#ff9696" : GREEN}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  {metrics?.stress_spike_warning
                    ? "Cohort stress trending up materially"
                    : "No sentinel spike flagged"}
                </Text>
                <Text style={styles.bannerSub}>
                  Logic: comparing last 48h stress average versus the prior 48h block (+25%). Use this as one
                  input for assembly tone, retreats, grading windows, athletics load, etc.
                </Text>
                <Text style={[styles.bannerSub, { marginTop: 8 }]}>
                  Last 48h stress avg · <Text style={{ color: "#fff" }}>{fmt(metrics?.stress_avg_last_48h)}</Text>
                  {"\n"}
                  Previous 48h block ·{" "}
                  <Text style={{ color: "#fff" }}>{fmt(metrics?.stress_avg_prev_48h_block)}</Text>
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Suggested leadership rhythm</Text>
          <View style={styles.checklist}>
            <CheckStep n={1} text="Brief weekly review with counseling + chaplaincy using this dashboard." />
            <CheckStep n={2} text="Attach spiritual formation touchpoints where stress signals climb (examens, mentorship, accompaniment)." />
            <CheckStep n={3} text="Respond same school day whenever a learner opens a counselor support ticket." />
            <CheckStep n={4} text="Archive anonymized exports for board or accreditation conversations when asked." />
          </View>

          <TouchableOpacity style={styles.exportBtn} onPress={exportJson} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={22} color="#081012" />
            <Text style={styles.exportBtnText}>Export anonymized weekly JSON</Text>
          </TouchableOpacity>
          <Text style={styles.exportHint}>
            File tagged as aggregated/de-identified summary — align with counsel before sharing externally.
          </Text>

          <View style={styles.alertHeader}>
            <Text style={styles.sectionTitle}>Student-initiated support</Text>
            {alerts.length > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{alerts.length} open</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sectionMuted}>
            Identifiable only because learners chose to disclose — route through your safeguarding protocol.
          </Text>

          {alerts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-done-outline" size={32} color="#4a5660" />
              <Text style={styles.emptyTitle}>Clear queue</Text>
              <Text style={styles.emptySub}>Outstanding counselor requests appear here instantly.</Text>
            </View>
          ) : (
            alerts.map((item) => (
              <View key={item.id} style={styles.alertRow}>
                <View style={styles.alertTop}>
                  <Ionicons name="person-circle-outline" size={22} color={ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertName}>{item.student_name}</Text>
                    <Text style={styles.alertEmail}>{item.student_email}</Text>
                  </View>
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingTxt}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.alertMeta}>Created · {humanDate(item.created_at)}</Text>
              </View>
            ))
          )}

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteTxt}>
              Switch to <Text style={{ fontWeight: "700", color: ACCENT }}>Pastoral formation</Text> to publish Live
              the Fourth prompts, campus Mass hours, retreats, bulletin moderation — the cura complement to these wellness
              metrics.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
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

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v * 1000) / 1000;
}

function MetricTile({ icon, label, sub, value }) {
  return (
    <View style={styles.metricTile}>
      <Ionicons name={icon} size={22} color={ACCENT} style={{ marginBottom: 10 }} />
      <Text style={styles.metricTileLabel}>{label}</Text>
      <Text style={styles.metricTileValue}>{value}</Text>
      <Text style={styles.metricTileSub}>{sub}</Text>
    </View>
  );
}

function CheckStep({ n, text }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkNum}>
        <Text style={styles.checkNumTxt}>{n}</Text>
      </View>
      <Text style={styles.checkTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#050708" },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  segmentLabel: { color: "#6d7882", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  segment: {
    flexDirection: "row",
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  segmentOn: { borderColor: "rgba(0,229,229,0.55)", backgroundColor: "rgba(0,229,229,0.12)" },
  segmentTxt: { color: "#8b949f", fontSize: 13, fontWeight: "700" },
  segmentTxtOn: { color: "#fff" },

  container: { flex: 1, backgroundColor: "#050708" },
  content: { paddingHorizontal: 16 },

  centered: {
    flex: 1,
    backgroundColor: "#050708",
    justifyContent: "center",
    padding: 28,
    paddingHorizontal: 32,
  },
  hero: {
    backgroundColor: "rgba(0,229,229,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.22)",
    padding: 18,
    marginBottom: 16,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(0,229,229,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 6,
    lineHeight: 26,
  },
  heroSub: { color: "#b9c5cc", fontSize: 13, lineHeight: 20 },

  orgChip: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  orgChipTxt: { color: "#8ecfd0", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  infoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 20,
  },
  infoTitle: { color: "#fff", fontWeight: "700", marginBottom: 10, fontSize: 15 },
  infoBody: { color: "#a8b5bd", fontSize: 13, lineHeight: 21 },

  sectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  sectionMuted: { color: "#7c8a93", fontSize: 13, lineHeight: 19, marginBottom: 12 },

  principleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  principleTxt: { flex: 1, color: "#b5bec4", fontSize: 13, lineHeight: 20 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,60,60,0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.35)",
  },
  errorTxt: { color: "#ffb4b4", flex: 1, fontSize: 13, lineHeight: 18 },

  warnPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(232,193,112,0.08)",
    borderWidth: 1,
    borderColor: "rgba(232,193,112,0.25)",
    marginBottom: 12,
  },
  warnPillTxt: { flex: 1, color: "#e8dfb8", fontSize: 13, lineHeight: 18 },

  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  metricTile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metricTileLabel: { color: "#cdd6dc", fontSize: 13, fontWeight: "700" },
  metricTileValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 4,
  },
  metricTileSub: { color: "#6d7982", fontSize: 11, lineHeight: 15 },

  sampleCard: {
    marginBottom: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(92,225,163,0.06)",
    borderWidth: 1,
    borderColor: "rgba(92,225,163,0.15)",
  },
  sampleStrong: { color: GREEN, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  sampleMuted: { color: "#9eb6aa", fontSize: 13, lineHeight: 20 },

  banner: {
    marginTop: 4,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerOk: {
    backgroundColor: "rgba(92,225,163,0.08)",
    borderColor: "rgba(92,225,163,0.22)",
  },
  bannerWarn: {
    backgroundColor: "rgba(255,94,94,0.09)",
    borderColor: "rgba(255,120,120,0.38)",
  },
  bannerTitle: { color: "#fff", fontWeight: "700", fontSize: 15, lineHeight: 21 },
  bannerSub: { color: "#c5cdd2", fontSize: 13, marginTop: 6, lineHeight: 18 },

  checklist: {
    gap: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 10,
    overflow: "hidden",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  checkNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(0,229,229,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkNumTxt: { color: ACCENT, fontWeight: "800", fontSize: 14 },
  checkTxt: { flex: 1, color: "#c7d2d9", fontSize: 13, lineHeight: 20 },

  exportBtn: {
    marginTop: 16,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  exportBtnText: {
    color: "#081012",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  exportHint: {
    marginTop: 8,
    color: "#5d6a71",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
  },

  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: -4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,180,100,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,180,100,0.35)",
  },
  badgeTxt: { color: AMBER, fontSize: 11, fontWeight: "800" },

  alertRow: {
    padding: 14,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  alertTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  alertName: { color: "#fff", fontWeight: "800", fontSize: 16 },
  alertEmail: { color: ACCENT, fontSize: 14, marginTop: 2 },
  alertMeta: { color: "#6d7982", fontSize: 12, marginLeft: 32 },
  pendingPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pendingTxt: { color: "#d0d9de", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginTop: 6,
    marginBottom: 10,
    gap: 8,
  },
  emptyTitle: { color: "#8a959c", fontWeight: "700", fontSize: 16 },
  emptySub: { color: "#5c6870", fontSize: 13, textAlign: "center", paddingHorizontal: 32, lineHeight: 18 },

  footerNote: {
    marginTop: 24,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  footerNoteTxt: { color: "#9daaaf", fontSize: 13, lineHeight: 20 },

  muted: { color: "#88929b", fontSize: 14, textAlign: "center" },
  small: { color: "#6d7982", fontSize: 12, lineHeight: 18 },
});
