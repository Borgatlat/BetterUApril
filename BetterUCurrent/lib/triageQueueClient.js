import { supabase } from "./supabase";

/**
 * Client wrapper for public.counselor_triage_queue (Feature 3).
 *
 * Naming convention matches the rest of /lib (lowerCamelCase exports).
 * All functions throw on Supabase errors so callers can use try/catch.
 *
 * @typedef {import("../types/schoolWellness").CounselorTriageRow} CounselorTriageRow
 * @typedef {import("../types/schoolWellness").CounselorTriageRowEnriched} CounselorTriageRowEnriched
 * @typedef {import("../types/schoolWellness").RiskTier} RiskTier
 * @typedef {import("../types/schoolWellness").TriageStatus} TriageStatus
 */

/**
 * Student-side helper: file a triage ticket from inside the app.
 * The "Request Counselor Support" button on the student wellness screen calls this.
 *
 * @param {{ orgId: string, riskTier?: RiskTier, triggerReason?: string }} args
 * @returns {Promise<CounselorTriageRow>}
 */
export async function createTriageTicket({ orgId, riskTier = "tier_3", triggerReason = "" }) {
  // getUser() reads the active session and ensures we have a server-verified
  // user id. Trusting a cached id from React state would let bugs propagate.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("counselor_triage_queue")
    .insert({
      org_id: orgId,
      student_id: user.id,
      risk_tier: riskTier,
      trigger_reason: triggerReason.slice(0, 1000),
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Staff: fetch the enriched (joined) triage queue for one org.
 * Goes through the SECURITY DEFINER RPC because plain SELECT on profiles is
 * RLS-blocked across users.
 *
 * @param {string} orgId
 * @returns {Promise<CounselorTriageRowEnriched[]>}
 */
export async function fetchTriageQueue(orgId) {
  const { data, error } = await supabase.rpc("staff_list_triage_queue", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Staff: mark a ticket as 'assigned'. The DB trigger fills in
 * assigned_counselor_id = auth.uid() automatically if null.
 *
 * @param {string} ticketId
 * @returns {Promise<CounselorTriageRow>}
 */
export async function assignTriageTicket(ticketId) {
  const { data, error } = await supabase
    .from("counselor_triage_queue")
    .update({ status: "assigned" })
    .eq("id", ticketId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Staff: mark a ticket as 'resolved'. The DB CHECK constraint requires
 * assigned_counselor_id to be non-null, so callers should assign first.
 *
 * @param {string} ticketId
 * @returns {Promise<CounselorTriageRow>}
 */
export async function resolveTriageTicket(ticketId) {
  const { data, error } = await supabase
    .from("counselor_triage_queue")
    .update({ status: "resolved" })
    .eq("id", ticketId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Staff: re-tier an active ticket (e.g. promote tier_1 → tier_3 after intake).
 *
 * @param {string} ticketId
 * @param {RiskTier} newTier
 */
export async function setTriageTier(ticketId, newTier) {
  const { data, error } = await supabase
    .from("counselor_triage_queue")
    .update({ risk_tier: newTier })
    .eq("id", ticketId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Subscribe to realtime INSERT and UPDATE events for an org's triage queue.
 *
 * Returns a "channel" object — call `.unsubscribe()` on the returned value in
 * useEffect cleanup so React Native does not leak websocket subscriptions
 * when the screen unmounts.
 *
 * NOTE: The realtime payload contains the RAW counselor_triage_queue row
 * (no joined student name). Callers should either (a) re-fetch via
 * fetchTriageQueue after each event, or (b) maintain a local profile cache.
 * The CounselorTriageGrid takes approach (a) for simplicity.
 *
 * @param {string} orgId
 * @param {(payload: { eventType: 'INSERT'|'UPDATE'|'DELETE', new: CounselorTriageRow, old: CounselorTriageRow }) => void} onEvent
 * @returns {{ unsubscribe: () => Promise<'ok'|'timed out'|'error'> }}
 */
export function subscribeToTriageQueue(orgId, onEvent) {
  // Channel name must be unique per subscription instance. Including orgId
  // keeps cross-org churn from creating extra event traffic.
  const channel = supabase
    .channel(`triage:${orgId}:${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "counselor_triage_queue",
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => onEvent({ eventType: "INSERT", new: payload.new, old: payload.old }),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "counselor_triage_queue",
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => onEvent({ eventType: "UPDATE", new: payload.new, old: payload.old }),
    )
    .subscribe((status) => {
      if (__DEV__) console.log(`[triage] channel status:`, status);
    });

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

/**
 * Numeric weight for risk tiers so we can sort ascending in JS.
 * tier_3 (crisis) is highest priority → highest weight.
 */
export const TIER_WEIGHT = Object.freeze({
  tier_3: 3,
  tier_2: 2,
  tier_1: 1,
});

/**
 * Sort comparator that mirrors the SQL ORDER BY: tier_3 first (DESC on enum),
 * then oldest first within a tier (FIFO inside each priority band).
 *
 * @param {CounselorTriageRowEnriched} a
 * @param {CounselorTriageRowEnriched} b
 */
export function compareTriageRows(a, b) {
  const tierDiff = (TIER_WEIGHT[b.risk_tier] ?? 0) - (TIER_WEIGHT[a.risk_tier] ?? 0);
  if (tierDiff !== 0) return tierDiff;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}
