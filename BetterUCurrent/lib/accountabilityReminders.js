import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { accountabilityDayToWeekday } from '../utils/accountabilityUtils';

const STORAGE_KEY = 'accountability_local_reminder_ids_v1';

/** @returns {Promise<Record<string, string>>} */
async function loadIdMap() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveIdMap(map) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Schedule a repeating weekly local notification for one partnership.
 * Uses device local time for hour/minute; weekday from check_in_day.
 *
 * @param {{
 *   partnershipId: string,
 *   partnerName: string,
 *   checkInDay: string,
 *   reminderHourUtc?: number,
 *   enabled?: boolean,
 * }} opts
 */
export async function syncPartnershipLocalReminder({
  partnershipId,
  partnerName,
  checkInDay,
  reminderHourUtc = 18,
  enabled = true,
}) {
  const map = await loadIdMap();
  if (map[partnershipId]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(map[partnershipId]);
    } catch {
      /* already cancelled */
    }
    delete map[partnershipId];
  }

  if (!enabled) {
    await saveIdMap(map);
    return null;
  }

  const weekday = accountabilityDayToWeekday(checkInDay);
  if (weekday == null) {
    await saveIdMap(map);
    return null;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') return null;
  }

  // reminder_hour_utc stored as UTC; local trigger uses approximate local hour.
  // For school apps, matching local wall clock is usually what students expect.
  const hour = Math.min(23, Math.max(0, reminderHourUtc));
  const minute = 0;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Accountability check-in',
      body: `Weekly check-in with ${partnerName}. Open BetterU to reflect and send an update.`,
      sound: true,
      data: {
        type: 'accountability_check_in_reminder',
        partnershipId,
      },
    },
    trigger: {
      weekday,
      hour,
      minute,
      repeats: true,
    },
  });

  map[partnershipId] = id;
  await saveIdMap(map);
  return id;
}

/** Cancel all locally scheduled accountability reminders. */
export async function cancelAllPartnershipLocalReminders() {
  const map = await loadIdMap();
  await Promise.all(
    Object.values(map).map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
    ),
  );
  await AsyncStorage.removeItem(STORAGE_KEY);
}
