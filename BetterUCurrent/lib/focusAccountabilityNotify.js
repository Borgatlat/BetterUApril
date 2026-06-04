import { supabase } from "./supabase";
import { createNotificationWithPush } from "../utils/notificationHelpers";

const REASON_LABELS = {
  app_backgrounded: "left BetterU (switched to another app)",
  app_inactive: "left the focus screen (Control Center, notifications, or call)",
  user_ended_early: "ended the focus session early",
  system_crash: "lost the session unexpectedly",
};

/**
 * Tell each accountability partner that the student broke focus lock.
 * Best-effort: failures are logged but never block the forfeit UI.
 *
 * @param {{ studentId: string, studentName: string, reason: string, durationMinutes: number, sessionId?: string|null }} args
 */
export async function notifyAccountabilityPartnersFocusForfeit({
  studentId,
  studentName,
  reason,
  durationMinutes,
  sessionId = null,
}) {
  if (!studentId) return;

  const { data: rows, error } = await supabase
    .from("accountability_partners")
    .select("id, user_id, partner_id")
    .or(`user_id.eq.${studentId},partner_id.eq.${studentId}`);

  if (error) {
    if (__DEV__) console.warn("[focus] partner lookup failed:", error.message ?? error);
    return;
  }

  const partners = rows ?? [];
  if (partners.length === 0) return;

  const reasonText = REASON_LABELS[reason] ?? "left focus mode";
  const title = `${studentName} left focus lock`;
  const message = `${studentName} ${reasonText} during a ${durationMinutes}-minute phone-free session. No focus points were earned.`;

  const notified = new Set();

  await Promise.all(
    partners.map(async (row) => {
      const partnerUserId = row.user_id === studentId ? row.partner_id : row.user_id;
      if (!partnerUserId || notified.has(partnerUserId)) return;
      notified.add(partnerUserId);

      try {
        await createNotificationWithPush({
          toUserId: partnerUserId,
          type: "app_message",
          title,
          message,
          data: {
            kind: "focus_session_forfeited",
            session_id: sessionId,
            student_id: studentId,
            forfeit_reason: reason,
            duration_minutes: durationMinutes,
          },
          priority: 3,
        });
      } catch (e) {
        if (__DEV__) console.warn("[focus] partner notify failed:", e?.message ?? e);
      }
    }),
  );
}
