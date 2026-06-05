import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_ACTIVITY_SUMMARY_KEY = 'pendingActivitySummary';

export async function storePendingActivitySummary(payload) {
  await AsyncStorage.setItem(PENDING_ACTIVITY_SUMMARY_KEY, JSON.stringify(payload));
}

export async function loadPendingActivitySummary() {
  const raw = await AsyncStorage.getItem(PENDING_ACTIVITY_SUMMARY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearPendingActivitySummary() {
  await AsyncStorage.removeItem(PENDING_ACTIVITY_SUMMARY_KEY);
}

export function parseActivityLocations(locationsField) {
  if (Array.isArray(locationsField)) return locationsField;
  if (typeof locationsField === 'string') {
    try {
      const parsed = JSON.parse(locationsField);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeLocationForMap(point) {
  if (!point || typeof point !== 'object') return null;
  const lat = point.latitude ?? point.lat;
  const lng = point.longitude ?? point.lng ?? point.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

export function normalizeLocationsForMap(locations) {
  const arr = Array.isArray(locations) ? locations : [];
  return arr.map(normalizeLocationForMap).filter(Boolean);
}

/** DB only allows run | walk | bike — map sprint / unknown types to run. */
export function activityTypeForDatabase(activityType) {
  if (activityType === 'walk' || activityType === 'bike' || activityType === 'run') {
    return activityType;
  }
  return 'run';
}

export function parseRouteNumber(value, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : fallback;
}
