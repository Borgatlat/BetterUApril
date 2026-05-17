/**
 * Dev / QA: force specific emails to **student** school UX (School / Spiritual tabs, org-scoped data).
 *
 * WHY migration + this map?
 * - Postgres `profiles` + RLS use real `account_type` / `org_id` — run the matching migrations on Supabase.
 * - This map aligns routing if local profile JSON is stale for a beat after sign-in.
 */

/** Maps normalized email → organizations.id slug (same as `profiles.org_id`). */
const DEV_STUDENT_EMAIL_TO_ORG = Object.freeze({
  "lborgarello27@mail.strakejesuit.org": "strake-jesuit",
  "lborgar1@jh.edu": "jh-edu",
});

/** Exported for tests or scripts that reference the primary Strake tester. */
export const SCHOOL_TEST_STRAKE_EMAIL = "lborgarello27@mail.strakejesuit.org";
/** @deprecated Not every dev student uses Strake — prefer `DEV_STUDENT_EMAIL_TO_ORG` keys. */
export const SCHOOL_TEST_STRAKE_ORG_SLUG = "strake-jesuit";

/**
 * Returns a student override only when `email` exactly matches one of our QA accounts (after trim + lower-case).
 *
 * @param {string | null | undefined} email
 * @returns {{ account_type: 'student'; org_id: string } | null}
 */
export function getSchoolProfileDevStudentOverride(email) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return null;
  const orgId = DEV_STUDENT_EMAIL_TO_ORG[e];
  if (!orgId) return null;
  return { account_type: "student", org_id: orgId };
}
