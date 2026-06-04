import { supabase } from "./supabase";

/**
 * Turn org slug (e.g. jesuit-houston) into a readable fallback name.
 * @param {string | null | undefined} orgId
 */
export function formatOrgIdAsDisplayName(orgId) {
  if (!orgId || typeof orgId !== "string") return "Your school";
  return orgId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Load the school's display name from organizations.name, else format the slug.
 * @param {string | null | undefined} orgId
 * @returns {Promise<string>}
 */
export async function fetchSchoolDisplayName(orgId) {
  if (!orgId) return "Your school";

  const { data, error } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  if (!error && data?.name?.trim()) {
    return data.name.trim();
  }

  return formatOrgIdAsDisplayName(orgId);
}
