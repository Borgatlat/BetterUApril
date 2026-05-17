/**
 * Shared profile normalization for school/B2B fields (no React imports — avoids circular deps).
 */
import { getSchoolProfileDevStudentOverride } from "./devSchoolTestOverride";

export function normalizeSchoolProfile(raw) {
  if (!raw) return null;

  const email = raw.email ?? raw.emailAddress ?? null;
  const devOverride = getSchoolProfileDevStudentOverride(email);

  const accountRaw = devOverride?.account_type ?? raw.account_type ?? raw.accountType ?? "public";
  const allowed = ["public", "student", "counselor", "admin"];
  let account_type = allowed.includes(accountRaw) ? accountRaw : "public";
  let org_id = devOverride?.org_id ?? raw.org_id ?? raw.orgId ?? null;

  if (!devOverride && account_type === "student" && !org_id) {
    account_type = "public";
  }
  return { ...raw, account_type, org_id };
}
