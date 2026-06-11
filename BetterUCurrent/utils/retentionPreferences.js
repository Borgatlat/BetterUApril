/**
 * User-configurable retention / notification personalization (Phase 2 roadmap).
 * Stored under profiles.notification_preferences.retention (JSON merge).
 */

export const RETENTION_INTENSITY = {
  light: { dailyCapLow: 2, dailyCapHigh: 4 },
  normal: { dailyCapLow: 3, dailyCapHigh: 6 },
  high: { dailyCapLow: 5, dailyCapHigh: 8 },
};

export const DEFAULT_RETENTION_PREFS = {
  intensity: 'normal',
  quiet_hours_enabled: true,
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  push_enabled: true,
};

export function normalizeRetentionPrefs(raw) {
  const base = { ...DEFAULT_RETENTION_PREFS, ...(raw || {}) };
  if (!RETENTION_INTENSITY[base.intensity]) {
    base.intensity = 'normal';
  }
  base.quiet_hours_start = clampHour(base.quiet_hours_start, 22);
  base.quiet_hours_end = clampHour(base.quiet_hours_end, 7);
  return base;
}

function clampHour(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 23) return fallback;
  return Math.floor(n);
}

/** True when local hour falls inside the user's quiet window (handles overnight spans). */
export function isInQuietHours(prefs, date = new Date()) {
  const p = normalizeRetentionPrefs(prefs);
  if (!p.quiet_hours_enabled) return false;

  const hour = date.getHours();
  const start = p.quiet_hours_start;
  const end = p.quiet_hours_end;

  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export function getDailyCaps(prefs) {
  const p = normalizeRetentionPrefs(prefs);
  return RETENTION_INTENSITY[p.intensity] || RETENTION_INTENSITY.normal;
}

export function retentionPrefsFromProfile(userProfile) {
  return normalizeRetentionPrefs(userProfile?.notification_preferences?.retention);
}
