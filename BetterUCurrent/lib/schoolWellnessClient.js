import { supabase } from "./supabase";

/** @param {string} email */
export function emailDomain(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  return email.split("@").pop().trim().toLowerCase();
}

/**
 * Returns today's date in YYYY-MM-DD (device local) for pulse log keying.
 */
export function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Upsert today's pulse for the logged-in student.
 */
export async function submitDailyPulse({
  orgId,
  mood,
  stressLevel,
  sleepQuality,
  anonymizeAggregate = true,
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const row = {
    profile_id: user.id,
    org_id: orgId,
    logged_date: localDateKey(),
    mood,
    stress_level: stressLevel,
    sleep_quality: sleepQuality,
    anonymize_aggregate: anonymizeAggregate,
  };

  const { data, error } = await supabase
    .from("daily_pulse_logs")
    .upsert(row, { onConflict: "profile_id,logged_date" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Today's pulse row for the logged-in student, or null if not logged yet.
 */
export async function fetchTodayPulse() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) return null;

  const { data, error } = await supabase
    .from("daily_pulse_logs")
    .select("mood, stress_level, sleep_quality, logged_date, anonymize_aggregate")
    .eq("profile_id", user.id)
    .eq("logged_date", localDateKey())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Counselor support: writes identifiable row (allowed only in this flow per product spec).
 * Then notifies staff via Edge Function (service role inserts in-app notifications).
 */
export async function createCounselorSupportAlert({ orgId, studentName, studentEmail }) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("counselor_alerts")
    .insert({
      org_id: orgId,
      student_id: user.id,
      student_name: studentName,
      student_email: studentEmail,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;

  try {
    await supabase.functions.invoke("notify-counselors", {
      body: { org_id: orgId, alert_id: data.id },
    });
  } catch (e) {
    console.warn("[schoolWellness] notify-counselors invoke failed:", e?.message ?? e);
  }

  return data;
}

export async function fetchSentinelMetrics(orgId) {
  const { data, error } = await supabase.rpc("get_org_pulse_sentinel", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data;
}

export async function fetchPendingAlertsForOrg(orgId) {
  const { data, error } = await supabase
    .from("counselor_alerts")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
