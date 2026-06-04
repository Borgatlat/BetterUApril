import { supabase } from "./supabase";

/**
 * @typedef {import("../types/schoolWellness").JsnAccreditationMetricsRow} JsnAccreditationMetricsRow
 */

/**
 * Staff-only: fetch org-level JSN accreditation aggregates for the current academic year.
 *
 * @param {string} orgId
 * @param {string | null} [academicYearStart] — ISO date (YYYY-MM-DD); null = server default (Aug 1)
 * @returns {Promise<JsnAccreditationMetricsRow | null>}
 */
export async function fetchJsnAccreditationMetrics(orgId, academicYearStart = null) {
  const { data, error } = await supabase.rpc("get_jsn_accreditation_metrics", {
    p_org_id: orgId,
    p_academic_year_start: academicYearStart,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Staff-only: refresh the materialized view before reading (optional; pull-to-refresh).
 *
 * @returns {Promise<{ ok: boolean }>}
 */
export async function refreshJsnAccreditationCache() {
  const { data, error } = await supabase.rpc("refresh_jsn_accreditation_cache");
  if (error) throw error;
  return data ?? { ok: true };
}
