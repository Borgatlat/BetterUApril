import { supabase } from "./supabase";

/**
 * Load per-school branding from organizations (Tier 3).
 * @param {string | null | undefined} orgId
 */
export async function fetchOrgBranding(orgId) {
  if (!orgId) return null;

  const { data, error } = await supabase.rpc("get_org_branding", { p_org_id: orgId });
  if (error) {
    if (__DEV__) console.warn("[fetchOrgBranding]", error.message);
    return null;
  }
  if (!data?.ok) return null;
  return data;
}

/**
 * Merge org primary color into campus theme tokens.
 * @param {object} baseTheme
 * @param {{ primary_color?: string, secondary_color?: string } | null} branding
 */
export function mergeBrandingIntoTheme(baseTheme, branding) {
  if (!branding?.primary_color) return baseTheme;
  const primary = branding.primary_color;
  return {
    ...baseTheme,
    accent: primary,
    accentDim: hexToRgba(primary, 0.12),
  };
}

function hexToRgba(hex, alpha) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
