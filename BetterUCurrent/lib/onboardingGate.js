/**
 * Single source of truth: should this user skip the consumer onboarding wizard?
 */
import { normalizeSchoolProfile } from "./schoolProfileNormalize";

/** @typedef {ReturnType<typeof normalizeSchoolProfile>} NormalizedProfile */

/**
 * @param {NormalizedProfile | null | undefined} profile
 */
export function hasCompletedAppOnboarding(profile) {
  const p = normalizeSchoolProfile(profile);
  if (!p) return false;

  if (p.onboarding_completed === true) return true;

  const accountType = p.account_type ?? "public";

  // School staff / parent portals — not the B2C onboarding funnel
  if (accountType === "parent") return true;
  if (accountType === "admin" || accountType === "counselor") return true;

  // Partner-school student linked to an org
  if (accountType === "student" && p.org_id) return true;

  return false;
}

/**
 * @param {NormalizedProfile | null | undefined} profile
 * @returns {'anon'|'public'|'student'|'staff'|'parent'}
 */
export function workspaceFromProfile(profile) {
  if (!profile) return "public";
  const t = profile.account_type ?? "public";
  if (t === "admin" || t === "counselor") return "staff";
  if (t === "parent") return "parent";
  if (t === "student") return "student";
  return "public";
}

/**
 * Where to send someone after auth when profile is known.
 * @param {'anon'|'public'|'student'|'staff'|'parent'} workspace
 * @param {NormalizedProfile | null | undefined} profile
 */
export function resolvePostAuthRoute(workspace, profile) {
  if (workspace === "staff") {
    return "/(school)/dashboard";
  }
  if (workspace === "parent") {
    return "/(parent)/dashboard";
  }
  if (hasCompletedAppOnboarding(profile)) {
    if (workspace === "student") {
      return "/(tabs)/spiritual";
    }
    return "/(tabs)/home";
  }
  return "/(auth)/onboarding/welcome";
}

/**
 * Convenience for login/signup after fetching a profiles row.
 * @param {NormalizedProfile | Record<string, unknown> | null | undefined} profile
 */
export function resolvePostAuthRouteForProfile(profile) {
  const normalized = normalizeSchoolProfile(profile);
  const workspace = workspaceFromProfile(normalized);
  return resolvePostAuthRoute(workspace, normalized);
}
