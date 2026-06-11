import AsyncStorage from '@react-native-async-storage/async-storage';

const OPEN_HOURS_KEY = '@BetterU_notification_open_hours';
const MAX_SAMPLES = 24;

/** Record the local hour when a user opens a notification (for "best time" hints). */
export async function recordNotificationOpen() {
  try {
    const hour = new Date().getHours();
    const raw = await AsyncStorage.getItem(OPEN_HOURS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [hour, ...list].slice(0, MAX_SAMPLES);
    await AsyncStorage.setItem(OPEN_HOURS_KEY, JSON.stringify(next));
    return hour;
  } catch {
    return null;
  }
}

/** Median hour users tend to open notifications — used for reminder scheduling hints. */
export async function getTypicalOpenHour() {
  try {
    const raw = await AsyncStorage.getItem(OPEN_HOURS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list) || list.length < 3) return null;

    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  } catch {
    return null;
  }
}

export function formatHourLabel(hour) {
  if (hour == null || !Number.isFinite(hour)) return null;
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
