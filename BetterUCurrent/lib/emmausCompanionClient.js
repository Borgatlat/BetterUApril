import { supabase } from "./supabase";

/**
 * Emmaus Companion Network client.
 *
 * @typedef {import("../types/emmausCompanion").CompanionRequest} CompanionRequest
 * @typedef {import("../types/emmausCompanion").CompanionRequestAnon} CompanionRequestAnon
 * @typedef {import("../types/emmausCompanion").CompanionRequestEnriched} CompanionRequestEnriched
 * @typedef {import("../types/emmausCompanion").CompanionMessage} CompanionMessage
 * @typedef {import("../types/emmausCompanion").CreateCompanionRequestPayload} CreateCompanionRequestPayload
 * @typedef {import("../types/emmausCompanion").CompanionStatus} CompanionStatus
 */

/**
 * @param {CreateCompanionRequestPayload} payload
 * @returns {Promise<CompanionRequest>}
 */
export async function createCompanionRequest({
  orgId,
  supportType,
  category,
  formatPreference = "text_chat",
  urgencyTier = "routine_check_in",
  studentNotes = "",
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const notes = (studentNotes ?? "").trim().slice(0, 2000) || null;

  const { data, error } = await supabase
    .from("companion_requests")
    .insert({
      org_id: orgId,
      student_id: user.id,
      support_type: supportType,
      category,
      format_preference: formatPreference,
      urgency_tier: urgencyTier,
      student_notes: notes,
      status: "unassigned",
    })
    .select()
    .single();

  if (error) throw error;

  if (urgencyTier === "urgent_today" && supportType !== "silent_prayer_only") {
    try {
      await supabase.functions.invoke("notify-counselors", {
        body: { org_id: orgId, source: "emmaus_urgent", request_id: data.id },
      });
    } catch (e) {
      if (__DEV__) console.warn("[emmaus] notify-counselors:", e?.message ?? e);
    }
  }

  return data;
}

/** @returns {Promise<CompanionRequest[]>} */
export async function fetchMyCompanionRequests() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("companion_requests")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** @param {string} orgId @returns {Promise<CompanionRequestAnon[]>} */
export async function fetchCompanionQueueAnon(orgId) {
  const { data, error } = await supabase.rpc("staff_list_companion_queue_anon", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data ?? [];
}

/** @param {string} orgId @returns {Promise<CompanionRequestEnriched[]>} */
export async function fetchCompanionActive(orgId) {
  const { data, error } = await supabase.rpc("staff_list_companion_active", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data ?? [];
}

/** @param {string} requestId @returns {Promise<CompanionRequestEnriched>} */
export async function acceptCompanionRequest(requestId) {
  const { data, error } = await supabase.rpc("staff_accept_companion_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Accept failed — request may already be taken");
  return row;
}

/**
 * @param {string} requestId
 * @param {CompanionStatus} status
 */
export async function setCompanionStatus(requestId, status) {
  const { data, error } = await supabase
    .from("companion_requests")
    .update({ status })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** @param {string} requestId @returns {Promise<CompanionMessage[]>} */
export async function fetchCompanionMessages(requestId) {
  const { data, error } = await supabase
    .from("companion_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** @param {string} requestId @param {string} body */
export async function sendCompanionMessage(requestId, body) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { data, error } = await supabase
    .from("companion_messages")
    .insert({
      request_id: requestId,
      sender_id: user.id,
      body: trimmed.slice(0, 4000),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Fetch one request the current user may access (student or assigned mentor/staff). */
export async function fetchCompanionRequestById(requestId) {
  const { data, error } = await supabase
    .from("companion_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {string} orgId
 * @param {(payload: { eventType: string, new: object, old: object }) => void} onEvent
 */
export function subscribeToCompanionRequests(orgId, onEvent) {
  const channel = supabase
    .channel(`emmaus:${orgId}:${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "companion_requests",
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => onEvent({ eventType: "INSERT", new: payload.new, old: payload.old }),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "companion_requests",
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => onEvent({ eventType: "UPDATE", new: payload.new, old: payload.old }),
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

/**
 * @param {string} requestId
 * @param {(payload: { eventType: string, new: CompanionMessage }) => void} onEvent
 */
export function subscribeToCompanionMessages(requestId, onEvent) {
  const channel = supabase
    .channel(`emmaus:msg:${requestId}:${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "companion_messages",
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => onEvent({ eventType: "INSERT", new: payload.new }),
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

export const URGENCY_WEIGHT = Object.freeze({
  urgent_today: 2,
  routine_check_in: 1,
});

/** @param {CompanionRequestAnon} a @param {CompanionRequestAnon} b */
export function compareAnonRequests(a, b) {
  const u = (URGENCY_WEIGHT[b.urgency_tier] ?? 0) - (URGENCY_WEIGHT[a.urgency_tier] ?? 0);
  if (u !== 0) return u;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}
