import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Full in-progress gym workout snapshot (exercises, timer, session id, etc.). */
export const PENDING_ACTIVE_WORKOUT_KEY = 'pendingActiveWorkout';

/** Legacy key — kept in sync so older code paths still find exercise data. */
const LEGACY_CURRENT_WORKOUT_KEY = 'currentWorkout';

/**
 * True when the user has done anything worth restoring (timer, sets, or freeform exercises).
 */
export function workoutHasProgress(workout, elapsedTime = 0) {
  if (Number(elapsedTime) > 0) return true;
  if (!workout || !Array.isArray(workout.exercises)) return false;

  return workout.exercises.some((exercise) => {
    if (!Array.isArray(exercise.sets)) return false;
    return exercise.sets.some((set) => {
      if (set?.completed) return true;
      const weight = String(set?.weight ?? '').trim();
      const reps = String(set?.reps ?? '').trim();
      return weight !== '' || reps !== '';
    });
  });
}

export async function savePendingActiveWorkout(snapshot) {
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...snapshot,
  };
  await AsyncStorage.setItem(PENDING_ACTIVE_WORKOUT_KEY, JSON.stringify(payload));
  if (snapshot?.workout) {
    await AsyncStorage.setItem(LEGACY_CURRENT_WORKOUT_KEY, JSON.stringify(snapshot.workout));
  }
}

export async function loadPendingActiveWorkout() {
  const raw = await AsyncStorage.getItem(PENDING_ACTIVE_WORKOUT_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to legacy
    }
  }

  const legacy = await AsyncStorage.getItem(LEGACY_CURRENT_WORKOUT_KEY);
  if (!legacy) return null;
  try {
    const workout = JSON.parse(legacy);
    return {
      version: 0,
      workout,
      elapsedTime: 0,
      calories: 0,
    };
  } catch {
    return null;
  }
}

export async function clearPendingActiveWorkout() {
  await AsyncStorage.multiRemove([
    PENDING_ACTIVE_WORKOUT_KEY,
    LEGACY_CURRENT_WORKOUT_KEY,
    'workoutTimerData',
  ]);
}

/** Human-readable elapsed time for the resume banner. */
/**
 * If a workout is saved locally, ask Resume vs Start new before navigating.
 */
export async function promptResumeOrStartNew({ onResume, onStartNew }) {
  const pending = await loadPendingActiveWorkout();
  if (!pending?.workout || !workoutHasProgress(pending.workout, pending.elapsedTime)) {
    onStartNew();
    return;
  }

  const workoutName = pending.workout?.name || 'Workout';
  Alert.alert(
    'Workout in progress',
    `"${workoutName}" is saved. Resume it or start a new workout?`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resume', onPress: onResume },
      {
        text: 'Start new',
        style: 'destructive',
        onPress: async () => {
          await clearPendingActiveWorkout();
          onStartNew();
        },
      },
    ]
  );
}

export function formatPendingWorkoutElapsed(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
