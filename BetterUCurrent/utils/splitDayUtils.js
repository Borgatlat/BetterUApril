/**
 * Helpers for training-split day labels (Push, Rest, etc.).
 */

export function isSplitRestDay(day) {
  const d = String(day ?? '').trim().toLowerCase();
  return !d || d === 'rest';
}

export function normalizeSplitDayKey(day) {
  const s = String(day || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (s === 'fullbody') return 'full body';
  return s;
}

export function splitDayMatches(workoutSplitDay, todaySplitDay) {
  const w = normalizeSplitDayKey(workoutSplitDay);
  const t = normalizeSplitDayKey(todaySplitDay);
  if (!w || !t) return false;
  if (w === t) return true;
  if ((w === 'legs' || w === 'lower') && (t === 'legs' || t === 'lower')) return true;
  return false;
}

export function formatSplitDayLabel(day) {
  if (isSplitRestDay(day)) return 'Rest';
  const s = String(day || '').trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
