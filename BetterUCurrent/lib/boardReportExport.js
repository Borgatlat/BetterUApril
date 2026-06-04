import { supabase } from "./supabase";

/**
 * Client wrapper for the FERPA-safe board report (Feature 2).
 *
 * The actual de-identification, k-anon floor, and authorization live in the
 * SQL materialized view + SECURITY DEFINER RPCs. This module is just
 * formatting + Supabase glue.
 *
 * @typedef {import("../types/schoolWellness").BoardReportRow} BoardReportRow
 * @typedef {import("../types/schoolWellness").BoardReportSpiritualRow} BoardReportSpiritualRow
 * @typedef {import("../types/schoolWellness").FormattedBoardReport} FormattedBoardReport
 */

const FERPA_NOTICE =
  "This report contains only aggregated, de-identified cohort means. " +
  "Cohorts with fewer than 5 contributing students this week have been suppressed " +
  "to preserve student privacy under FERPA (34 CFR Part 99).";

/**
 * Fire the materialized-view refresh. Returns the RPC's status payload.
 * Should only be called from the admin "Refresh now" button.
 *
 * @returns {Promise<{ ok: boolean, refreshed_at: string, duration_ms: number }>}
 */
export async function refreshBoardReportCache() {
  const { data, error } = await supabase.rpc("refresh_wellness_analytics_cache");
  if (error) throw error;
  return data;
}

/**
 * Fetch the wellness cohort rows for an org.
 *
 * @param {string} orgId
 * @param {number} [weeksBack=12]
 * @returns {Promise<BoardReportRow[]>}
 */
export async function fetchBoardReportRows(orgId, weeksBack = 12) {
  const { data, error } = await supabase.rpc("get_anonymized_weekly_trends", {
    p_org_id: orgId,
    p_weeks_back: weeksBack,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch the spiritual cohort rows for an org.
 *
 * @param {string} orgId
 * @param {number} [weeksBack=12]
 * @returns {Promise<BoardReportSpiritualRow[]>}
 */
export async function fetchBoardReportSpiritualRows(orgId, weeksBack = 12) {
  const { data, error } = await supabase.rpc(
    "get_anonymized_weekly_spiritual_trends",
    {
      p_org_id: orgId,
      p_weeks_back: weeksBack,
    },
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Reshape the raw rows into a board-ready JSON payload.
 *
 * The shape is loosely modeled on what most US state youth-wellness reporting
 * frameworks expect: a small descriptive header + arrays grouped by cohort.
 *
 * @param {{
 *   orgId: string,
 *   wellnessRows: BoardReportRow[],
 *   spiritualRows?: BoardReportSpiritualRow[],
 *   weeksIncluded?: number,
 * }} args
 * @returns {FormattedBoardReport}
 */
export function formatBoardReport({
  orgId,
  wellnessRows,
  spiritualRows = [],
  weeksIncluded = 12,
}) {
  const sorted = [...wellnessRows].sort((a, b) => {
    // ISO date strings compare lexically — so descending sort gives newest week first.
    const dateCmp = b.week_start.localeCompare(a.week_start);
    if (dateCmp !== 0) return dateCmp;
    return a.grade_level.localeCompare(b.grade_level);
  });

  const dates = sorted.map((r) => r.week_start);
  const start = dates.length ? dates[dates.length - 1] : "";
  const end = dates.length ? dates[0] : "";

  return {
    school: orgId,
    reporting_period: {
      start,
      end,
      weeks_included: weeksIncluded,
    },
    generated_at: new Date().toISOString(),
    data_classification: "aggregated_deidentified",
    ferpa_notice: FERPA_NOTICE,
    k_anonymity_floor: 5,
    grade_cohorts: sorted.map((r) => ({
      grade_level: r.grade_level,
      week_start: r.week_start,
      avg_mood: roundOrNull(r.avg_mood, 3),
      avg_stress: roundOrNull(r.avg_stress, 3),
      avg_sleep: roundOrNull(r.avg_sleep, 3),
      sample_size: Number(r.sample_size ?? 0),
    })),
    spiritual_cohorts: spiritualRows.map((r) => ({
      grade_level: r.grade_level,
      week_start: r.week_start,
      avg_intensity: roundOrNull(r.avg_intensity, 3),
      consolation_count: Number(r.consolation_count ?? 0),
      desolation_count: Number(r.desolation_count ?? 0),
      sample_size: Number(r.sample_size ?? 0),
    })),
  };
}

/**
 * Convert the formatted board report to CSV text suitable for Share.share.
 * Helpful when leadership wants to paste straight into Google Sheets / Excel
 * for slide-deck graphs.
 *
 * @param {FormattedBoardReport} report
 * @returns {string}
 */
export function boardReportToCsv(report) {
  const header = [
    "school",
    "week_start",
    "grade_level",
    "avg_mood",
    "avg_stress",
    "avg_sleep",
    "sample_size",
    "data_classification",
  ].join(",");

  const rows = report.grade_cohorts.map((row) =>
    [
      report.school,
      row.week_start,
      row.grade_level,
      nullSafe(row.avg_mood),
      nullSafe(row.avg_stress),
      nullSafe(row.avg_sleep),
      row.sample_size,
      report.data_classification,
    ].join(","),
  );

  // Prepend a CSV-style comment lead-in. Excel ignores lines starting with #
  // when Data > From Text is used; Sheets just shows it as a row.
  const preamble = [
    `# BetterU board report — generated ${report.generated_at}`,
    `# ${report.ferpa_notice}`,
  ].join("\n");

  return [preamble, header, ...rows].join("\n");
}

function roundOrNull(value, places) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const factor = 10 ** places;
  return Math.round(num * factor) / factor;
}

function nullSafe(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}
