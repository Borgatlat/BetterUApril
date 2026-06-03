import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "@betteru/live_fourth_done";

export async function saveLiveFourthWeekProgress(weekCode, next) {
  await AsyncStorage.setItem(`${STORAGE_PREFIX}_${weekCode}`, JSON.stringify(next));
}

/** Count weeks where both challenge and journal were marked done. */
export async function countLiveFourthWeeksCompleted() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const weekKeys = keys.filter((k) => k.startsWith(`${STORAGE_PREFIX}_`));
    let count = 0;
    for (const key of weekKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.challenge && parsed?.journal) count += 1;
      } catch {
        /* skip malformed */
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/** Load this week's challenge/journal completion flags. */
export async function loadLiveFourthWeekProgress(weekCode) {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}_${weekCode}`);
    if (!raw) return { challenge: false, journal: false };
    const parsed = JSON.parse(raw);
    return {
      challenge: Boolean(parsed?.challenge),
      journal: Boolean(parsed?.journal),
    };
  } catch {
    return { challenge: false, journal: false };
  }
}
