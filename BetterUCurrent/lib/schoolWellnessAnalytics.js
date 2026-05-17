/**
 * Build a small JSON export aligned with typical state youth mental-health aggregate reporting:
 * one row per metric, de-identified, with org slug and week end date.
 *
 * @param {import("../types/schoolWellness").SentinelMetrics} metrics - from get_org_pulse_sentinel
 * @param {object} opt
 * @param {string} opt.orgSlug
 * @param {string} opt.periodEndIso - ISO date end of reporting week
 * @returns {import("../types/schoolWellness").WeeklyWellnessExportRow[]}
 */
export function formatWeeklyAnonymizedExport(metrics, { orgSlug, periodEndIso }) {
  const sample = Number(metrics?.sample_size_7d ?? 0);
  const spike = !!metrics?.stress_spike_warning;

  return [
    {
      reporting_period_end: periodEndIso,
      org_slug: orgSlug,
      metric: "mood",
      seven_day_mean:
        metrics?.mood_avg_7d !== null && metrics?.mood_avg_7d !== undefined
          ? Math.round(metrics.mood_avg_7d * 1000) / 1000
          : null,
      sample_size: sample,
      systemic_stress_spike_flag: spike,
      data_classification: "aggregated_deidentified",
    },
    {
      reporting_period_end: periodEndIso,
      org_slug: orgSlug,
      metric: "stress_level",
      seven_day_mean:
        metrics?.stress_avg_7d !== null && metrics?.stress_avg_7d !== undefined
          ? Math.round(metrics.stress_avg_7d * 1000) / 1000
          : null,
      sample_size: sample,
      systemic_stress_spike_flag: spike,
      data_classification: "aggregated_deidentified",
    },
    {
      reporting_period_end: periodEndIso,
      org_slug: orgSlug,
      metric: "sleep_quality",
      seven_day_mean:
        metrics?.sleep_avg_7d !== null && metrics?.sleep_avg_7d !== undefined
          ? Math.round(metrics.sleep_avg_7d * 1000) / 1000
          : null,
      sample_size: sample,
      systemic_stress_spike_flag: spike,
      data_classification: "aggregated_deidentified",
    },
  ];
}

/**
 * Client-side mirror of the SQL spike rule (useful for tests / offline demos).
 * True if recentAvg > priorAvg * 1.25 and priorAvg > 0.
 */
export function detectStressSpike48h(recentAvg, priorAvg) {
  if (recentAvg == null || priorAvg == null) return false;
  if (priorAvg <= 0) return false;
  return recentAvg > priorAvg * 1.25;
}
