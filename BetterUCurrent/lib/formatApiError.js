/**
 * Turn Supabase / network errors into readable strings (never "[object Object]").
 * @param {unknown} e
 * @returns {string}
 */
export function formatApiError(e) {
  if (!e) return "Something went wrong. Please try again.";
  if (typeof e === "string") return e;
  if (e instanceof Error && typeof e.message === "string" && e.message) return e.message;

  const err = /** @type {Record<string, unknown>} */ (e);
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message : "";

  if (code === "42P01" || (message.includes("does not exist") && !message.includes("function"))) {
    if (message.includes("companion_requests") || message.includes("companion")) {
      return "Emmaus Companion is not set up on the server yet. Run Supabase migration 20260605000000_emmaus_companion_network.sql.";
    }
    if (message.includes("accountability_partners") || message.includes("accountability_check_ins")) {
      return "Accountability partners is not set up on Supabase yet. Run migration 20260602000000_accountability_partners_repair.sql in the SQL editor.";
    }
    return "This feature is not set up on the server yet. Ask your admin to run the latest Supabase migrations.";
  }
  if (
    code === "42883" ||
    message.includes("add_accountability_partner") ||
    message.includes("Could not find the function") ||
    message.includes("increment_student_rewards_points")
  ) {
    if (message.includes("accountability")) {
      return "Accountability partner RPC is missing. Run migration 20260602000000_accountability_partners_repair.sql in Supabase.";
    }
    return "Focus Lock is not set up on the server yet. Ask your admin to run the latest Supabase migrations (focus_sessions + focus_points).";
  }
  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    if (message.includes("companion")) {
      return "Could not send your Emmaus request. Make sure you are signed in with your school account and your profile is linked to your school.";
    }
    return "You do not have permission for this action. Try signing in again.";
  }
  if (code === "23503" && (message.includes("org_id") || message.includes("organizations"))) {
    return "Your school is not linked in BetterU yet. Ask your campus admin to finish school setup, then try again.";
  }
  if (code === "22P02" || message.includes("invalid input value for enum")) {
    return "Something in this request did not match the server. Close the form and try again, or update the app.";
  }
  if (code === "23503" && message.includes("student_id")) {
    return "Your profile is not linked yet. Finish signing in, then try Focus Lock again.";
  }
  if (code === "23503" && message.includes("org_id")) {
    return "Your school link could not be saved for this session. Starting without school tracking.";
  }
  if (code === "42501" || message.toLowerCase().includes("not authorized")) {
    return "You do not have permission for this action. Try signing in again.";
  }
  if (message) {
    const details = typeof err.details === "string" ? err.details : "";
    const hint = typeof err.hint === "string" ? err.hint : "";
    return [message, details, hint].filter(Boolean).join(" — ");
  }
  if (typeof err.error_description === "string") return err.error_description;

  try {
    return JSON.stringify(e);
  } catch {
    return "Something went wrong. Please try again.";
  }
}
