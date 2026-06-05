import { PREMIUM_WORKOUTS } from './workoutCatalog';

/**
 * Normalizes DB / scheduled / catalog shapes into what workout-detail expects.
 */
export function normalizeWorkoutForDetail(workout = {}) {
  const exercises = workout.exercises ?? workout.workout_exercises ?? [];
  const name = workout.name || workout.workout_name || 'Workout';

  return {
    ...workout,
    name,
    workout_name: workout.workout_name || name,
    exercises: Array.isArray(exercises) ? exercises : [],
  };
}

export function isPremiumCatalogWorkout(workout) {
  const name = workout?.name || workout?.workout_name;
  if (!name) return false;
  return PREMIUM_WORKOUTS.some((entry) => entry.name === name);
}

/**
 * True when `id` refers to `workouts` table (user template), not `scheduled_workouts`.
 */
export function shouldUseWorkoutIdForDetail(workout) {
  if (!workout?.id) return false;
  if (workout.isScheduled || workout.scheduledWorkoutId) return false;
  if (Array.isArray(workout.workout_exercises) && !workout.exercises) return false;
  return true;
}

export function buildWorkoutDetailParams(workout, options = {}) {
  const {
    startMode = 'custom',
    locked = false,
    title,
    workoutId,
    includeWorkoutId = true,
  } = options;

  const normalized = normalizeWorkoutForDetail(workout);
  const params = {
    workout: JSON.stringify(normalized),
    startMode,
    title: title || normalized.workout_name || normalized.name,
    locked: locked ? 'true' : 'false',
  };

  const resolvedId = workoutId ?? workout?.id;
  if (includeWorkoutId && shouldUseWorkoutIdForDetail(workout) && resolvedId) {
    params.workoutId = String(resolvedId);
  }

  return params;
}

export function openWorkoutDetail(router, workout, options = {}) {
  router.push({
    pathname: '/workout-detail',
    params: buildWorkoutDetailParams(workout, options),
  });
}
