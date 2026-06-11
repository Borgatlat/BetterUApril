/**
 * Shared profile normalization for school/B2B fields (no React imports — avoids circular deps).
 */
import { getSchoolProfileDevStudentOverride } from "./devSchoolTestOverride";

export function normalizeSchoolProfile(raw) {
  if (!raw) return null;

  const email = raw.email ?? raw.emailAddress ?? null;
  // QA email → student override only in dev builds. Release/TestFlight must trust Postgres profiles.
  const devOverride =
    typeof __DEV__ !== "undefined" && __DEV__
      ? getSchoolProfileDevStudentOverride(email)
      : null;

  const accountRaw = devOverride?.account_type ?? raw.account_type ?? raw.accountType ?? "public";
  const allowed = ["public", "student", "counselor", "admin", "parent"];
  let account_type = allowed.includes(accountRaw) ? accountRaw : "public";
  let org_id = devOverride?.org_id ?? raw.org_id ?? raw.orgId ?? null;

  if (!devOverride && account_type === "student" && !org_id) {
    account_type = "public";
  }
  const is_peer_mentor = Boolean(raw.is_peer_mentor ?? raw.isPeerMentor);
  return { ...raw, account_type, org_id, is_peer_mentor };
}
