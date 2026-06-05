import { supabase } from "./supabase";
import { formatApiError } from "./formatApiError";

/**
 * Client wrapper for public.focus_sessions + increment_student_rewards_points
 * (Feature 4: Phone-Free Focus Mode).
 */

const PROBE_SESSION_ID = "00000000-0000-0000-0000-000000000001";

async function requireUserId() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");
  return user.id;
}

function isMissingRpcError(error) {
  const code = error?.code ?? "";
  const msg = String(error?.message ?? "").toLowerCase();
  return (
    code === "42883" ||
    msg.includes("could not find the function") ||
    msg.includes("increment_student_rewards_points")
  );
}

function isMissingTableError(error) {
  const code = error?.code ?? "";
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "42P01" || msg.includes("focus_sessions") || msg.includes("does not exist");
}

function isFocusSessionsRlsDenied(error) {
  const code = error?.code ?? "";
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "42501" || msg.includes("row-level security") || msg.includes("permission denied");
}

function isFocusRpcProbeSuccess(error) {
  const raw = String(error?.message ?? "").toLowerCase();
  return (
    raw.includes("not found") ||
    raw.includes("not owned") ||
    raw.includes("not completed") ||
    raw.includes("points denied") ||
    raw.includes("focus session not found")
  );
}

/**
 * @param {string} userId
 * @param {string|null|undefined} orgId
 * @param {number} durationMinutes
 */
async function insertFocusSessionRow(userId, orgId, durationMinutes) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      student_id: userId,
      org_id: orgId ?? null,
      duration_minutes: Math.floor(durationMinutes),
      completed_successfully: false,
      points_earned: 0,
    })
    .select("id, student_id, org_id, duration_minutes, started_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Verifies focus_sessions table + increment_student_rewards_points RPC exist.
 */
export async function checkFocusSessionsAvailable() {
  const { error: tableError } = await supabase.from("focus_sessions").select("id").limit(1);
  if (tableError) {
    if (isMissingTableError(tableError)) {
      throw new Error(
        "Focus Lock is not set up yet. Run Supabase migrations 20260601000300_focus_sessions.sql and 20260601000000_grade_level_and_focus_points.sql.",
      );
    }
    if (isFocusSessionsRlsDenied(tableError)) {
      throw new Error(
        "Focus Lock access denied. Run Supabase migration 20260601000300_focus_sessions.sql and sign in again.",
      );
    }
    throw new Error(formatApiError(tableError));
  }

  const { error: rpcError } = await supabase.rpc("increment_student_rewards_points", {
    p_session_id: PROBE_SESSION_ID,
  });

  if (rpcError) {
    if (isMissingRpcError(rpcError)) {
      throw new Error(
        "Focus points are not set up yet. Run Supabase migration 20260601000300_focus_sessions.sql on your project.",
      );
    }
    // Probe uses a fake session id; RPC returns 42501 with "not owned" — check raw message
    // before formatApiError, which would replace it with a generic permission string.
    if (isFocusRpcProbeSuccess(rpcError)) {
      return true;
    }
    throw new Error(formatApiError(rpcError));
  }

  return true;
}

/** @deprecated alias */
export const checkFocusLockReady = checkFocusSessionsAvailable;

/**
 * @param {{ orgId?: string|null, durationMinutes: number }} args
 */
export async function startFocusSession({ orgId = null, durationMinutes }) {
  const userId = await requireUserId();

  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
    throw new Error("Pick a session between 1 and 240 minutes.");
  }

  try {
    return await insertFocusSessionRow(userId, orgId, durationMinutes);
  } catch (firstError) {
    if (orgId && firstError?.code === "23503") {
      try {
        return await insertFocusSessionRow(userId, null, durationMinutes);
      } catch (retryError) {
        throw new Error(formatApiError(retryError));
      }
    }
    throw new Error(formatApiError(firstError));
  }
}

export async function completeFocusSession(sessionId) {
  if (!sessionId) throw new Error("Missing session id");

  const { data, error } = await supabase
    .from("focus_sessions")
    .update({
      completed_successfully: true,
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw new Error(formatApiError(error));
  return data;
}

export async function forfeitFocusSession(sessionId, reason) {
  if (!sessionId) return null;

  const { data, error } = await supabase
    .from("focus_sessions")
    .update({
      completed_successfully: false,
      forfeit_reason: reason,
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw new Error(formatApiError(error));
  return data;
}

export async function claimFocusPoints(sessionId) {
  if (!sessionId) throw new Error("Missing session id");

  const { data, error } = await supabase.rpc("increment_student_rewards_points", {
    p_session_id: sessionId,
  });

  if (error) throw new Error(formatApiError(error));

  if (data && typeof data === "object") {
    return {
      ok: Boolean(data.ok ?? true),
      points: Number(data.points ?? 0),
      total_focus_points:
        data.total_focus_points != null ? Number(data.total_focus_points) : null,
      already_awarded: Boolean(data.already_awarded),
    };
  }

  throw new Error("Could not award focus points. Please try again.");
}

export async function fetchRecentFocusSessions(limit = 10) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(formatApiError(error));
  return data ?? [];
}
