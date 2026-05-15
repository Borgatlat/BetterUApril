/**
 * Get the Monday of the week for the given date (ISO week).
 * Used to key check-ins by week (YYYY-MM-DD).
 */
export function getWeekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Get a readable week label (e.g. "Mar 3 – Mar 9, 2025").
 */
export function getWeekLabel(weekStartDate) {
  const start = new Date(weekStartDate + 'T00:00:00Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Compute consecutive weeks both partners submitted (streak).
 * checkIns: array of { week_start_date, user_id } for this partnership.
 */
export function getCheckInStreak(checkIns, currentUserId) {
  const weeks = [...new Set(checkIns.map((ci) => ci.week_start_date))].sort(
    (a, b) => new Date(b) - new Date(a)
  );
  let streak = 0;
  const seen = new Set();
  for (const week of weeks) {
    const forWeek = checkIns.filter((ci) => ci.week_start_date === week);
    const bothCheckedIn =
      forWeek.length >= 2 ||
      (forWeek.length === 1 && forWeek.some((c) => c.user_id === currentUserId));
    if (!bothCheckedIn) break;
    if (seen.has(week)) continue;
    seen.add(week);
    streak++;
  }
  return streak;
}
