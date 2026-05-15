/**
 * Background run location tracking using expo-location + expo-task-manager.
 * watchPositionAsync only delivers updates while the app is in the foreground.
 * startLocationUpdatesAsync + a defined task delivers updates in background too
 * (and foreground), so runs are tracked when the app is backgrounded or screen is locked.
 *
 * This module:
 * - Defines the background task (must be at top-level so it's registered at app load).
 * - Persists locations to AsyncStorage so when the app comes back we can merge them.
 * - Emits events when in foreground so the UI can update in real time.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = '@betteru_run_background_locations';
export const BACKGROUND_RUN_TASK_NAME = 'BACKGROUND_RUN_LOCATION_TASK';

const listeners = new Set();

function normalizeLocation(loc) {
  if (!loc?.coords) return null;
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp,
    speed: loc.coords.speed ?? null,
    accuracy: loc.coords.accuracy ?? null,
  };
}

function emitLocations(locations) {
  listeners.forEach((cb) => {
    try {
      cb(locations);
    } catch (e) {
      console.warn('Run background location listener error:', e);
    }
  });
}

TaskManager.defineTask(BACKGROUND_RUN_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[RunBackgroundLocation] Task error:', error.message);
    return;
  }
  const locations = data?.locations;
  if (!locations?.length) return;

  const normalized = locations.map(normalizeLocation).filter(Boolean);
  if (normalized.length === 0) return;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const merged = [...existing, ...normalized];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    emitLocations(normalized);
  } catch (e) {
    console.warn('[RunBackgroundLocation] Storage error:', e);
  }
});

export async function getStoredLocationsAsync() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearStoredLocationsAsync() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[RunBackgroundLocation] Clear error:', e);
  }
}

export function addLocationListener(callback) {
  listeners.add(callback);
}

export function removeLocationListener(callback) {
  listeners.delete(callback);
}

/**
 * Start background location updates. Call when user starts a run.
 * On Android this shows a foreground service notification so the app isn't killed.
 */
export async function startBackgroundRunTracking(options = {}) {
  const {
    timeInterval = 1000,
    distanceInterval = 1,
    accuracy = Location.Accuracy.BestForNavigation,
  } = options;

  const taskOptions = {
    accuracy,
    timeInterval,
    distanceInterval,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.Fitness,
  };

  if (Platform.OS === 'android') {
    taskOptions.foregroundService = {
      notificationTitle: 'BetterU',
      notificationBody: 'Tracking your run',
      notificationColor: '#00ffff',
    };
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_RUN_TASK_NAME, taskOptions);
}

/**
 * Stop background location updates. Call when user stops the run.
 */
export async function stopBackgroundRunTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_RUN_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_RUN_TASK_NAME);
  }
}
