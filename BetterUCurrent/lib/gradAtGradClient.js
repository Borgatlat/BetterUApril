import { supabase } from "./supabase";

/**
 * @typedef {import("../types/schoolWellness").GradAtGradPillarSummary} GradAtGradPillarSummary
 * @typedef {import("../types/schoolWellness").GradAtGradPillar} GradAtGradPillar
 */

/** All five Grad at Grad pillars (JSN Profile of the Graduate). */
export const GRAD_AT_GRAD_PILLARS = Object.freeze([
  "open_to_growth",
  "intellectually_competent",
  "religious",
  "loving",
  "committed_to_justice",
]);

/** Human-readable labels for pillar progress UI. */
export const GRAD_AT_GRAD_LABELS = Object.freeze({
  open_to_growth: "Open to Growth",
  intellectually_competent: "Intellectually Competent",
  religious: "Religious",
  loving: "Loving",
  committed_to_justice: "Committed to Justice",
});

/**
 * Fetch summed pillar points for the signed-in student (or staff viewing a student).
 *
 * @param {string} [studentId] — defaults to auth.uid() via RPC default
 * @returns {Promise<GradAtGradPillarSummary[]>}
 */
export async function fetchGradAtGradSummary(studentId) {
  const args = studentId ? { p_student_id: studentId } : {};
  const { data, error } = await supabase.rpc("get_student_grad_at_grad_summary", args);
  if (error) throw error;
  return data ?? [];
}

/**
 * Normalize RPC rows into a map with zero-filled pillars for chart rendering.
 *
 * @param {GradAtGradPillarSummary[]} rows
 * @returns {Record<GradAtGradPillar, number>}
 */
export function gradAtGradSummaryToMap(rows) {
  /** @type {Record<GradAtGradPillar, number>} */
  const map = {
    open_to_growth: 0,
    intellectually_competent: 0,
    religious: 0,
    loving: 0,
    committed_to_justice: 0,
  };
  for (const row of rows ?? []) {
    if (row.pillar in map) {
      map[row.pillar] = Number(row.total_points) || 0;
    }
  }
  return map;
}
