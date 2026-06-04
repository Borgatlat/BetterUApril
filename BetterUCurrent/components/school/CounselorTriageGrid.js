import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  fetchTriageQueue,
  subscribeToTriageQueue,
  assignTriageTicket,
  resolveTriageTicket,
  setTriageTier,
  compareTriageRows,
} from "../../lib/triageQueueClient";

const ACCENT = "#00e5e5";
const GREEN = "#5ce1a3";
const AMBER = "#e8c170";
const TIER3_RED = "#ff5b6b";
const PANEL = "#0c1115";

/**
 * Single-page Counselor Triage Grid (Feature 3 client UI).
 *
 * Subscribes to public:counselor_triage_queue via Supabase Realtime.
 * Tier 3 (crisis) tickets:
 *   - Flash a pulsing red border (Animated.loop)
 *   - Are pinned to the top (sort by tier weight DESC)
 *   - Show a sticky urgency banner above the list
 */
export function CounselorTriageGrid() {
  const insets = useSafeAreaInsets();
  const { orgId, workspace, accountType } = useAuthSession();
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyTicketId, setBusyTicketId] = useState(null);

  // `useRef` survives re-renders without triggering them. Perfect for storing
  // the animation driver value because Animated mutates it imperatively.
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // ---- Pulse animation for tier_3 borders --------------------------------
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false, // we animate borderColor which is non-native
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Animated.Value.interpolate creates a derived animated value. We map the
  // 0..1 driver to two colors so the border breathes between dim and bright red.
  const pulsingBorder = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,91,107,0.35)", "rgba(255,91,107,1)"],
  });

  // ---- Initial fetch -----------------------------------------------------
  const load = useCallback(async () => {
    if (!orgId || workspace !== "staff") return;
    setError(null);
    try {
      const data = await fetchTriageQueue(orgId);
      setRows([...data].sort(compareTriageRows));
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, workspace]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Realtime subscription --------------------------------------------
  useEffect(() => {
    if (!orgId || workspace !== "staff") return undefined;

    const sub = subscribeToTriageQueue(orgId, (event) => {
      // Simplest correct approach: refetch the enriched list after every
      // change. The RPC join is cheap and avoids stale joined-profile data.
      // Alternative would be optimistic merge from `event.new`, but then we'd
      // miss the student name/email until the next manual refresh.
      load();
    });

    return () => {
      sub.unsubscribe().catch((e) => {
        if (__DEV__) console.warn("[triage] unsubscribe failed:", e);
      });
    };
  }, [orgId, workspace, load]);

  // ---- Memoized derived collections --------------------------------------
  const tier3Count = useMemo(
    () => rows.filter((r) => r.risk_tier === "tier_3").length,
    [rows],
  );
  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "pending").length,
    [rows],
  );

  // ---- Action handlers ---------------------------------------------------
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAssign = async (id) => {
    setBusyTicketId(id);
    try {
      await assignTriageTicket(id);
      // Realtime will re-trigger load(), so no manual setRows here.
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleResolve = async (id) => {
    setBusyTicketId(id);
    try {
      await resolveTriageTicket(id);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleTierChange = async (id, tier) => {
    setBusyTicketId(id);
    try {
      await setTriageTier(id, tier);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyTicketId(null);
    }
  };

  // ---- Guard rails -------------------------------------------------------
  if (workspace !== "staff") {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={36} color="#555" />
        <Text style={styles.muted}>Triage queue is for counselor / admin accounts.</Text>
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
        <Text style={[styles.muted, { marginTop: 12 }]}>Loading triage queue…</Text>
      </View>
    );
  }

  // ---- Render ------------------------------------------------------------
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
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="pulse" size={24} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>MTSS · LIVE DISPATCH</Text>
            <Text style={styles.heroTitle}>Counselor triage queue</Text>
            <Text style={styles.heroSub}>
              Real-time student requests. Tier 3 crisis tickets pin to the top with a pulsing alert until assigned.
            </Text>
          </View>
        </View>

        {/* KPI strip */}
        <View style={styles.kpiRow}>
          <KpiTile label="Open" value={rows.length} tone="neutral" />
          <KpiTile label="Pending" value={pendingCount} tone="amber" />
          <KpiTile label="Tier 3" value={tier3Count} tone={tier3Count > 0 ? "red" : "ok"} />
        </View>

        {/* Tier 3 banner */}
        {tier3Count > 0 ? (
          <Animated.View style={[styles.crisisBanner, { borderColor: pulsingBorder }]}>
            <Ionicons name="alert-circle" size={26} color={TIER3_RED} />
            <View style={{ flex: 1 }}>
              <Text style={styles.crisisTitle}>
                {tier3Count} crisis-level request{tier3Count > 1 ? "s" : ""} need immediate triage
              </Text>
              <Text style={styles.crisisSub}>
                Route through your school's safeguarding protocol. Pulses below until acknowledged.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color="#ffb4b4" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* Empty */}
        {rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-outline" size={36} color="#4a5660" />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySub}>
              No active triage tickets. New requests will appear here instantly.
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <TriageCard
              key={row.id}
              row={row}
              busy={busyTicketId === row.id}
              pulsingBorder={pulsingBorder}
              onAssign={() => handleAssign(row.id)}
              onResolve={() => handleResolve(row.id)}
              onSetTier={(tier) => handleTierChange(row.id, tier)}
            />
          ))
        )}

        <Text style={styles.footer}>
          Live · subscribed to <Text style={{ color: ACCENT }}>public:counselor_triage_queue</Text> for org{" "}
          <Text style={{ color: "#fff" }}>{orgId}</Text>
        </Text>
      </ScrollView>
    </View>
  );
}

/* ===================== Subcomponents ===================== */

function TriageCard({ row, busy, pulsingBorder, onAssign, onResolve, onSetTier }) {
  const isCrisis = row.risk_tier === "tier_3";
  const isPending = row.status === "pending";
  const isAssigned = row.status === "assigned";

  // Wrap in Animated.View so the pulsing border animation can apply.
  // For non-tier-3 rows we use a flat View and a static border for cheaper renders.
  const Container = isCrisis ? Animated.View : View;
  const containerStyle = [
    styles.card,
    isCrisis
      ? { borderColor: pulsingBorder, borderWidth: 2, backgroundColor: "rgba(255,91,107,0.06)" }
      : styles.cardDefault,
  ];

  return (
    <Container style={containerStyle}>
      <View style={styles.cardTop}>
        <View style={[styles.tierPill, tierPillStyle(row.risk_tier)]}>
          <Text style={[styles.tierPillTxt, { color: tierColor(row.risk_tier) }]}>
            {tierLabel(row.risk_tier)}
          </Text>
        </View>
        <View style={[styles.statusPill, statusPillStyle(row.status)]}>
          <Text style={styles.statusPillTxt}>{row.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.studentName}>{row.student_full_name}</Text>
        <Text style={styles.studentMeta}>
          {row.student_email}
          {row.student_grade_level ? ` · Grade ${row.student_grade_level}` : ""}
        </Text>
        {row.trigger_reason ? (
          <Text style={styles.reasonTxt}>"{row.trigger_reason}"</Text>
        ) : (
          <Text style={[styles.reasonTxt, { fontStyle: "italic", color: "#5d6a72" }]}>
            No reason provided
          </Text>
        )}
        <Text style={styles.timestamp}>Created · {humanDate(row.created_at)}</Text>
        {row.assigned_counselor_name ? (
          <Text style={styles.assignedTxt}>
            <Ionicons name="person-outline" size={12} color={ACCENT} /> Assigned to{" "}
            <Text style={{ color: "#fff", fontWeight: "700" }}>{row.assigned_counselor_name}</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        {isPending ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionAssign]}
            onPress={onAssign}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add-outline" size={16} color="#062a2a" />
            <Text style={styles.actionAssignTxt}>{busy ? "…" : "Assign to me"}</Text>
          </TouchableOpacity>
        ) : null}

        {isAssigned ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionResolve]}
            onPress={onResolve}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#062a2a" />
            <Text style={styles.actionResolveTxt}>{busy ? "…" : "Mark resolved"}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Tier change menu (always available so staff can promote or demote) */}
        <View style={styles.tierBtnGroup}>
          {(["tier_1", "tier_2", "tier_3"]).map((tier) => (
            <TouchableOpacity
              key={tier}
              onPress={() => onSetTier(tier)}
              disabled={busy || row.risk_tier === tier}
              style={[
                styles.tierBtn,
                row.risk_tier === tier && styles.tierBtnActive,
                tier === "tier_3" && styles.tierBtnCrisis,
              ]}
              accessibilityLabel={`Set tier ${tier}`}
            >
              <Text
                style={[
                  styles.tierBtnTxt,
                  row.risk_tier === tier && { color: "#fff" },
                  tier === "tier_3" && { color: TIER3_RED },
                ]}
              >
                {tier.replace("tier_", "T")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Container>
  );
}

function KpiTile({ label, value, tone }) {
  const color =
    tone === "red"
      ? TIER3_RED
      : tone === "amber"
        ? AMBER
        : tone === "ok"
          ? GREEN
          : "#fff";
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

/* ===================== helpers ===================== */

function tierLabel(tier) {
  if (tier === "tier_3") return "TIER 3 · CRISIS";
  if (tier === "tier_2") return "TIER 2 · ELEVATED";
  return "TIER 1 · UNIVERSAL";
}

function tierColor(tier) {
  if (tier === "tier_3") return TIER3_RED;
  if (tier === "tier_2") return AMBER;
  return GREEN;
}

function tierPillStyle(tier) {
  if (tier === "tier_3")
    return { backgroundColor: "rgba(255,91,107,0.14)", borderColor: "rgba(255,91,107,0.4)" };
  if (tier === "tier_2")
    return { backgroundColor: "rgba(232,193,112,0.14)", borderColor: "rgba(232,193,112,0.4)" };
  return { backgroundColor: "rgba(92,225,163,0.12)", borderColor: "rgba(92,225,163,0.35)" };
}

function statusPillStyle(status) {
  if (status === "pending")
    return { backgroundColor: "rgba(255,180,100,0.12)" };
  if (status === "assigned")
    return { backgroundColor: "rgba(0,229,229,0.12)" };
  return { backgroundColor: "rgba(92,225,163,0.12)" };
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
  heroEyebrow: {
    color: "#8ecfd0",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  heroSub: { color: "#b4bec6", fontSize: 13, lineHeight: 19, marginTop: 4 },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  kpi: {
    flex: 1,
    backgroundColor: PANEL,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  kpiValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  kpiLabel: { color: "#8a949c", fontSize: 12, fontWeight: "700", marginTop: 4, letterSpacing: 0.5 },

  crisisBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: "rgba(255,91,107,0.08)",
    marginBottom: 14,
  },
  crisisTitle: { color: "#ffd1d6", fontWeight: "800", fontSize: 14 },
  crisisSub: { color: "#cbb5b8", fontSize: 12, marginTop: 4, lineHeight: 17 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(255,60,60,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.35)",
    marginBottom: 12,
  },
  errorTxt: { color: "#ffb4b4", flex: 1, fontSize: 13 },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 8,
    marginBottom: 18,
  },
  emptyTitle: { color: "#8a959c", fontWeight: "700", fontSize: 16 },
  emptySub: { color: "#5c6870", fontSize: 13, textAlign: "center", paddingHorizontal: 32, lineHeight: 18 },

  card: {
    backgroundColor: PANEL,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardDefault: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierPillTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  statusPill: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillTxt: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },

  cardBody: { marginBottom: 12 },
  studentName: { color: "#fff", fontSize: 17, fontWeight: "800" },
  studentMeta: { color: "#9aa6ae", fontSize: 12, marginTop: 4 },
  reasonTxt: {
    color: "#d4dde2",
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  timestamp: { color: "#5d6a72", fontSize: 11, marginTop: 8 },
  assignedTxt: { color: "#a4b1b8", fontSize: 12, marginTop: 6 },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionAssign: { backgroundColor: ACCENT },
  actionAssignTxt: { color: "#062a2a", fontWeight: "800", fontSize: 13 },
  actionResolve: { backgroundColor: GREEN },
  actionResolveTxt: { color: "#062a2a", fontWeight: "800", fontSize: 13 },

  tierBtnGroup: {
    flexDirection: "row",
    marginLeft: "auto",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tierBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tierBtnActive: { backgroundColor: "rgba(0,229,229,0.18)" },
  tierBtnCrisis: {},
  tierBtnTxt: { color: "#a8b3ba", fontSize: 11, fontWeight: "800" },

  footer: {
    color: "#3d454c",
    fontSize: 11,
    marginTop: 18,
    textAlign: "center",
    lineHeight: 16,
  },
});

/* Web/iOS only: silence unused Platform import if tree-shaken builds nag. */
void Platform;
