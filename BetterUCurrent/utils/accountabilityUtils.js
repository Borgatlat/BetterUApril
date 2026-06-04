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
const DAY_LABELS = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

/** Expo local notification weekday: 1 = Sunday … 7 = Saturday */
export function accountabilityDayToWeekday(dayName) {
  const map = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5,
    friday: 6,
    saturday: 7,
  };
  return map[String(dayName || '').toLowerCase()] ?? null;
}

export function formatDayLabel(dayName) {
  return DAY_LABELS[String(dayName || '').toLowerCase()] || dayName || '—';
}

/**
 * @param {{ check_in_day?: string, reminder_hour_utc?: number, meetup_day?: string|null, meetup_hour_local?: number|null, meetup_minute_local?: number, meetup_spot?: string }} partnership
 */
export function formatRhythmSummary(partnership) {
  if (!partnership) return '';
  const checkDay = formatDayLabel(partnership.check_in_day || 'sunday');
  const hour = partnership.reminder_hour_utc ?? 18;
  let meet = '';
  if (partnership.meetup_day) {
    const h = partnership.meetup_hour_local ?? 12;
    const m = partnership.meetup_minute_local ?? 0;
    const mm = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
    const ap = h >= 12 ? `${h === 12 ? 12 : h - 12}${mm} PM` : `${h === 0 ? 12 : h}${mm} AM`;
    meet = ` · In-person ${formatDayLabel(partnership.meetup_day)} ~${ap}`;
    if (partnership.meetup_spot?.trim()) meet += ` @ ${partnership.meetup_spot.trim()}`;
  }
  return `Check-in ${checkDay}s ~${hour}:00 UTC${meet}`;
}

/**
 * True if user has not submitted check-in for the current week.
 * @param {Array<{ week_start_date: string, user_id: string, status: string }>} history
 * @param {string} userId
 */
export function isCheckInDueThisWeek(history, userId) {
  const week = getWeekStartDate();
  const mine = (history || []).find(
    (c) => c.week_start_date === week && c.user_id === userId && c.status === 'submitted',
  );
  return !mine;
}

/**
 * @param {string} checkInDay e.g. 'sunday'
 */
export function isCheckInDayToday(checkInDay) {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = names[new Date().getDay()];
  return today === String(checkInDay || 'sunday').toLowerCase();
}

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
