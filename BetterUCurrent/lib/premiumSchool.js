/**
 * School / B2B2C tenants: learners and staff mapped to an `organizations` row
 * (`profiles.org_id`). They receive in-app premium benefits without a Stripe/IAP subscription.
 */

/**
 * School partnership premium (premium UI gates, banners, limits).
 *
 * WHY not only `workspace === student`?
 * Teachers/counselors keep `staff` routing but often share the same `@school` email domain —
 * matching by `profiles.org_id` + role keeps them aligned with the partner rollout.
 *
 * @param {Record<string, unknown> | null | undefined} profile
 * @returns {boolean}
 */
export function receivesSchoolPartnershipPremium(profile) {
  if (!profile) return false;
  const orgId = profile.org_id ?? profile.orgId;
  if (!orgId || typeof orgId !== "string") return false;
  const t = String(profile.account_type ?? profile.accountType ?? "public").toLowerCase();
  return t === "student" || t === "counselor" || t === "admin";
}
