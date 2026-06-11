import { supabase } from "./supabase";
import { formatApiError } from "./formatApiError";

/** Tables the school pilot depends on (order = runbook order). */
const SCHOOL_TABLE_CHECKS = [
  { table: "organizations", label: "School organizations" },
  { table: "daily_pulse_logs", label: "Daily pulse" },
  { table: "counselor_alerts", label: "Counselor alerts" },
  { table: "counselor_triage_queue", label: "Counselor triage" },
  { table: "companion_requests", label: "Emmaus Companion" },
  { table: "accountability_partners", label: "Accountability partners" },
  { table: "focus_sessions", label: "Focus Lock" },
  { table: "prayer_intentions", label: "Spiritual / prayer wall" },
  { table: "futureu_chat_sessions", label: "Future U chat history" },
];

/**
 * Probes Supabase for school feature tables. Used on School Wellness open.
 * @returns {Promise<{ ok: boolean, missing: string[], details: string[] }>}
 */
export async function checkSchoolFeaturesHealth() {
  const missing = [];
  const details = [];

  for (const { table, label } of SCHOOL_TABLE_CHECKS) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      const code = error.code ?? "";
      const msg = (error.message ?? "").toLowerCase();
      if (code === "42P01" || msg.includes("does not exist")) {
        missing.push(label);
        details.push(`${label}: run school migrations (see docs/SCHOOL_MIGRATION_RUNBOOK.md).`);
      } else if (code === "42501") {
        details.push(`${label}: permission issue — check RLS for your account.`);
      }
    }
  }

  if (missing.length === 0 && details.length === 0) {
    return { ok: true, missing: [], details: [] };
  }

  return {
    ok: missing.length === 0,
    missing,
    details,
  };
}

/**
 * Confirms the signed-in user's org exists in organizations.
 * @param {string | null} orgId
 */
export async function checkSchoolOrgLinked(orgId) {
  if (!orgId) {
    return {
      ok: false,
      message: "Your profile is not linked to a school yet. Sign in with your school email.",
    };
  }

  const { data, error } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle();
  if (error) {
    return { ok: false, message: formatApiError(error) };
  }
  if (!data) {
    return {
      ok: false,
      message: `School "${orgId}" is not registered in Supabase yet. Ask your admin to add it.`,
    };
  }
  return { ok: true, message: null };
}
