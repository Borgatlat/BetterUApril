import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { normalizeSchoolProfile } from "../lib/schoolProfileNormalize";

/**
 * Central "two-door" session: derives workspace from profile.account_type + org_id.
 * CRITICAL: Missing DB fields are treated as public / no org so the live app never crashes.
 */
export { normalizeSchoolProfile };

export function useAuthSession() {
  const { user, profile, isLoading, session, ...rest } = useAuth();
  const normalized = useMemo(() => normalizeSchoolProfile(profile), [profile]);

  const workspace = useMemo(() => {
    if (!user) return "anon";
    const t = normalized?.account_type ?? "public";
    if (t === "admin" || t === "counselor") return "staff";
    if (t === "student") return "student";
    return "public";
  }, [user, normalized]);

  return {
    user,
    session,
    profile: normalized,
    accountType: normalized?.account_type ?? "public",
    orgId: normalized?.org_id ?? null,
    workspace,
    isLoading,
    ...rest,
  };
}
