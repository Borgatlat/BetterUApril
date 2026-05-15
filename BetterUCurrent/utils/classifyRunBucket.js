/**
 * Run distance classification for post-run AI training plans.
 * Pure functions — safe to import anywhere (no React, no network).
 */

/** Statute miles per meter */
const METERS_PER_MILE = 1609.34;

/**
 * Convert Run Summary param distance to meters (must match `run-summary.js` saveRun()).
 * @param {number} distance - km or miles from GPS summary
 * @param {'km'|'miles'|string} unit
 * @returns {number}
 */
export function runSummaryDistanceToMeters(distance, unit) {
  const d = Number(distance) || 0;
  if (unit === 'miles') {
    return d * METERS_PER_MILE;
  }
  return d * 1000;
}

export function metersToMiles(meters) {
  const m = Number(meters) || 0;
  if (m <= 0) return 0;
  return m / METERS_PER_MILE;
}

/**
 * @param {number} distanceMeters
 * @returns {{ bucket: 'sprint'|'middle'|'long', distanceMeters: number, milesRounded: number, label: string }}
 */
export function classifyRunBucket(distanceMeters) {
  const m = Math.max(0, Number(distanceMeters) || 0);
  const milesRounded = Number(metersToMiles(m).toFixed(2));

  let bucket;
  let label;
  if (m < 400) {
    bucket = 'sprint';
    label = 'Sprint / speed–power';
  } else if (m <= 1600) {
    bucket = 'middle';
    label = 'Middle distance';
  } else {
    bucket = 'long';
    label = 'Long distance';
  }

  return { bucket, distanceMeters: m, milesRounded, label };
}
