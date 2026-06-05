/**
 * Normalizes saved custom workouts for /active-workout.
 * DB rows often store exercises as { name, sets: '3', reps: '8' } while
 * the active screen expects sets: [{ weight, reps, completed }, ...].
 */

import { formatTargetMusclesForExercise } from './workoutMuscleMap';

function normalizeInstructions(instructions) {
  if (Array.isArray(instructions) && instructions.length > 0) {
    return instructions.map((line) => String(line));
  }
  if (typeof instructions === 'string' && instructions.trim()) {
    return [instructions.trim()];
  }
  return ['No specific instructions available.'];
}

function findTemplateExercise(exerciseName, workoutData) {
  if (!exerciseName || !workoutData) return null;
  const target = String(exerciseName).toLowerCase();
  for (const template of Object.values(workoutData)) {
    if (!Array.isArray(template?.exercises)) continue;
    const found = template.exercises.find(
      (e) => e?.name && String(e.name).toLowerCase() === target
    );
    if (found) return found;
  }
  return null;
}

function buildSetsFromTemplate(templateExercise, fallbackReps = '8') {
  const templateSets = Array.isArray(templateExercise?.sets) ? templateExercise.sets : [];
  const count = Math.max(1, templateSets.length || 3);
  const defaultReps = templateSets[0]?.reps != null ? String(templateSets[0].reps) : fallbackReps;

  return Array.from({ length: count }, (_, index) => ({
    weight: '',
    reps:
      templateSets[index]?.reps != null
        ? String(templateSets[index].reps)
        : defaultReps,
    completed: false,
  }));
}

/**
 * @param {string|object} ex - Exercise from DB (string name or object)
 */
export function normalizeExerciseForActiveWorkout(ex, index, { workoutData, getExerciseInfo }) {
  if (typeof ex === 'string') {
    const trimmed = ex.trim();
    const found = findTemplateExercise(trimmed, workoutData);
    if (found) {
      return {
        ...found,
        name: found.name || trimmed,
        instructions: normalizeInstructions(found.instructions),
        sets: buildSetsFromTemplate(found),
      };
    }
    const info = getExerciseInfo?.(trimmed);
    return {
      name: trimmed,
      targetMuscles:
        (info?.targetMuscles && info.targetMuscles.trim()) ||
        formatTargetMusclesForExercise(trimmed),
      instructions: normalizeInstructions(info?.instructions),
      sets: buildSetsFromTemplate(null, '8'),
    };
  }

  if (!ex || typeof ex !== 'object') {
    return {
      name: `Exercise ${index + 1}`,
      targetMuscles: 'Full Body',
      instructions: normalizeInstructions(null),
      sets: buildSetsFromTemplate(null, '8'),
    };
  }

  const name = ex.name || ex.exercise_name || `Exercise ${index + 1}`;
  const info = getExerciseInfo?.(name);

  if (Array.isArray(ex.sets) && ex.sets.length > 0) {
    const sets = ex.sets.map((set) => {
      if (typeof set === 'object' && set !== null) {
        return {
          weight: set.weight != null ? String(set.weight) : '',
          reps: set.reps != null ? String(set.reps) : '8',
          completed: Boolean(set.completed),
        };
      }
      return { weight: '', reps: '8', completed: false };
    });

    return {
      name: String(name),
      targetMuscles:
        ex.targetMuscles ||
        (info?.targetMuscles && info.targetMuscles.trim()) ||
        formatTargetMusclesForExercise(name),
      instructions: normalizeInstructions(ex.instructions || info?.instructions),
      sets,
    };
  }

  const setCount = Math.max(1, parseInt(String(ex.sets), 10) || 3);
  const reps = ex.reps != null && String(ex.reps).trim() !== '' ? String(ex.reps) : '8';

  return {
    name: String(name),
    targetMuscles:
      ex.targetMuscles ||
      (info?.targetMuscles && info.targetMuscles.trim()) ||
      formatTargetMusclesForExercise(name),
    instructions: normalizeInstructions(ex.instructions || info?.instructions),
    sets: Array.from({ length: setCount }, () => ({
      weight: '',
      reps,
      completed: false,
    })),
  };
}

export function parseExercisesField(exercisesField) {
  if (Array.isArray(exercisesField)) return exercisesField;
  if (typeof exercisesField === 'string') {
    try {
      const parsed = JSON.parse(exercisesField);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Builds the workout object active-workout expects.
 */
export function buildActiveWorkoutFromSource(source, { workoutData, getExerciseInfo }) {
  if (!source || typeof source !== 'object') {
    throw new Error('Invalid workout data');
  }

  const name = source.name || source.workout_name || 'Workout';
  const exercisesField =
    source.exercises != null ? source.exercises : source.workout_exercises;
  const rawExercises = parseExercisesField(exercisesField);

  if (rawExercises.length === 0) {
    throw new Error('Invalid workout structure: no exercises found');
  }

  const exercises = rawExercises.map((ex, index) =>
    normalizeExerciseForActiveWorkout(ex, index, { workoutData, getExerciseInfo })
  );

  return {
    name: String(name),
    exercises: exercises.map((exercise) => ({
      name: exercise.name,
      targetMuscles: exercise.targetMuscles,
      instructions: normalizeInstructions(exercise.instructions),
      sets: Array.isArray(exercise.sets)
        ? exercise.sets.map((set) => ({
            weight: set.weight != null ? String(set.weight) : '',
            reps: set.reps != null ? String(set.reps) : '8',
            completed: Boolean(set.completed),
          }))
        : buildSetsFromTemplate(null, '8'),
    })),
  };
}

export function parseRouteWorkoutJson(workoutParam) {
  const raw = Array.isArray(workoutParam) ? workoutParam[0] : workoutParam;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  return null;
}
