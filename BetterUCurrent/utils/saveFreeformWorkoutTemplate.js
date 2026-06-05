import { supabase } from '../lib/supabase';

/**
 * Converts active-workout exercise rows into the shape stored in `workouts.exercises`.
 */
export function buildTemplateExercisesFromActiveWorkout(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) return [];

  return exercises
    .filter((exercise) => exercise?.name)
    .map((exercise) => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      const repValues = sets
        .map((set) => String(set?.reps ?? '').trim())
        .filter(Boolean);
      const uniqueReps = [...new Set(repValues)];
      const reps =
        uniqueReps.length === 1
          ? uniqueReps[0]
          : repValues[repValues.length - 1] || '8';

      return {
        name: String(exercise.name).trim(),
        sets: String(Math.max(1, sets.length)),
        reps,
      };
    });
}

export async function saveFreeformWorkoutTemplate({ userId, workoutName, exercises }) {
  const trimmedName = String(workoutName || '').trim();
  if (!trimmedName) {
    throw new Error('Please enter a workout name.');
  }
  if (!Array.isArray(exercises) || exercises.length === 0) {
    throw new Error('Add at least one exercise before saving.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  const profileId = profile?.id || userId;

  const { error } = await supabase.from('workouts').insert([
    {
      profile_id: profileId,
      workout_name: trimmedName,
      exercises,
    },
  ]);

  if (error) throw error;
}
