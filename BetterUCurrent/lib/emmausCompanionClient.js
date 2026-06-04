import { supabase } from "./supabase";
import { formatApiError } from "./formatApiError";

/**
 * Emmaus Companion Network client.
 *
 * @typedef {import("../types/emmausCompanion").CompanionRequest} CompanionRequest
 * @typedef {import("../types/emmausCompanion").CreateCompanionRequestPayload} CreateCompanionRequestPayload
 */

const VALID_SUPPORT = new Set([
  "listen_only",
  "prayer_request",
  "seeking_advice",
  "silent_prayer_only",
  "casual_hangout",
]);

const VALID_CATEGORY = new Set([
  "academic_stress",
  "social_isolation",
  "grief_loss",
  "general_wellbeing",
]);

const VALID_FORMAT = new Set(["text_chat", "in_person_casual", "sacramental_chapel"]);

const VALID_URGENCY = new Set(["routine_check_in", "urgent_today"]);

async function requireUserId() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");
  return user.id;
}

/**
 * Confirms Emmaus tables exist before the wizard enables Send.
 */
export async function checkEmmausCompanionAvailable() {
  const { error } = await supabase.from("companion_requests").select("id").limit(1);
  if (error) throw new Error(formatApiError(error));
  return true;
}

/**
 * Validates student + org before insert (clear errors instead of RLS/FK mysteries).
 */
async function assertStudentCanCreateRequest(orgId, userId) {
  if (!orgId) {
    throw new Error("Your school is not linked on your profile yet. Sign in with your school email or contact support.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_type, org_id, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(formatApiError(profileError));
  if (!profile) throw new Error("Profile not found. Try signing out and back in.");

  if (profile.account_type !== "student") {
    throw new Error("Emmaus Companion is only for enrolled school students.");
  }

  if (profile.org_id !== orgId) {
    throw new Error(
      "Your school link looks out of date. Pull down to refresh School wellness, then try again.",
    );
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();

  if (orgError) throw new Error(formatApiError(orgError));
  if (!org) {
    throw new Error(
      `Your school (${orgId}) is not registered in BetterU yet. Ask your admin to add it in Supabase organizations.`,
    );
  }
}

function validatePayload(payload) {
  const { supportType, category, formatPreference, urgencyTier } = payload;

  if (!VALID_SUPPORT.has(supportType)) {
    throw new Error("Pick a type of support before sending.");
  }
  if (!VALID_CATEGORY.has(category)) {
    throw new Error("Pick what feels heaviest before sending.");
  }
  if (!VALID_FORMAT.has(formatPreference)) {
    throw new Error("Pick how you would like to connect.");
  }
  if (!VALID_URGENCY.has(urgencyTier)) {
    throw new Error("Pick when you need support.");
  }
}

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
  const userId = await requireUserId();
  await assertStudentCanCreateRequest(orgId, userId);
  validatePayload({ supportType, category, formatPreference, urgencyTier });

  const notes = (studentNotes ?? "").trim().slice(0, 2000) || null;

  const row = {
    org_id: orgId,
    student_id: userId,
    support_type: supportType,
    category,
    format_preference: formatPreference,
    urgency_tier: urgencyTier,
    student_notes: notes,
    status: "unassigned",
  };

  const { data, error } = await supabase.from("companion_requests").insert(row).select().single();

  if (error) throw new Error(formatApiError(error));

  if (!data?.id) {
    throw new Error("Request was not saved. Please try again.");
  }

  if (urgencyTier === "urgent_today" && supportType !== "silent_prayer_only") {
    try {
      await supabase.functions.invoke("notify-counselors", {
        body: { org_id: orgId, source: "emmaus_urgent", request_id: data.id },
      });
    } catch (e) {
      if (__DEV__) console.warn("[emmaus] notify-counselors:", formatApiError(e));
    }
  }

  return data;
}

/** @returns {Promise<CompanionRequest[]>} */
export async function fetchMyCompanionRequests() {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("companion_requests")
    .select("*")
    .eq("student_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(formatApiError(error));
  return data ?? [];
}

/** @param {string} orgId @returns {Promise<import("../types/emmausCompanion").CompanionRequestAnon[]>} */
export async function fetchCompanionQueueAnon(orgId) {
  const { data, error } = await supabase.rpc("staff_list_companion_queue_anon", {
    p_org_id: orgId,
  });
  if (error) throw new Error(formatApiError(error));
  return data ?? [];
}

/** @param {string} orgId @returns {Promise<import("../types/emmausCompanion").CompanionRequestEnriched[]>} */
export async function fetchCompanionActive(orgId) {
  const { data, error } = await supabase.rpc("staff_list_companion_active", {
    p_org_id: orgId,
  });
  if (error) throw new Error(formatApiError(error));
  return data ?? [];
}

/** @param {string} requestId */
export async function acceptCompanionRequest(requestId) {
  const { data, error } = await supabase.rpc("staff_accept_companion_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(formatApiError(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Accept failed — request may already be taken");
  return row;
}

/**
 * @param {string} requestId
 * @param {import("../types/emmausCompanion").CompanionStatus} status
 */
export async function setCompanionStatus(requestId, status) {
  const { data, error } = await supabase
    .from("companion_requests")
    .update({ status })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw new Error(formatApiError(error));
  return data;
}

/** @param {string} requestId */
export async function fetchCompanionMessages(requestId) {
  const { data, error } = await supabase
    .from("companion_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(formatApiError(error));
  return data ?? [];
}

/** @param {string} requestId @param {string} body */
export async function sendCompanionMessage(requestId, body) {
  const userId = await requireUserId();

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { data, error } = await supabase
    .from("companion_messages")
    .insert({
      request_id: requestId,
      sender_id: userId,
      body: trimmed.slice(0, 4000),
    })
    .select()
    .single();
  if (error) throw new Error(formatApiError(error));
  return data;
}

export async function fetchCompanionRequestById(requestId) {
  const { data, error } = await supabase
    .from("companion_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(formatApiError(error));
  return data;
}

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

/** @param {import("../types/emmausCompanion").CompanionRequestAnon} a @param {import("../types/emmausCompanion").CompanionRequestAnon} b */
export function compareAnonRequests(a, b) {
  const u = (URGENCY_WEIGHT[b.urgency_tier] ?? 0) - (URGENCY_WEIGHT[a.urgency_tier] ?? 0);
  if (u !== 0) return u;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}
