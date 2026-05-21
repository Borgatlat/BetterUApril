import {
  fetchRecoveryWorkouts,
  computeMuscleRecovery,
  computeOverallRecoveryScore,
  buildRecoveryBreakdown,
} from './recoveryEngine';

const FALLBACK = {
  score: 100,
  hoursToRecoverLabel: 'Fully recovered',
  breakdown: {
    draggingDown: [],
    bringingUp: [],
  },
};

/**
 * Home recovery score — muscle map + personal volume baselines when enough history exists.
 */
export async function computeRecoveryScore(userId) {
  if (!userId) return FALLBACK;

  try {
    const workouts = await fetchRecoveryWorkouts(userId);
    const { recoveryPct, lastTrainedAt, muscleDetails } = computeMuscleRecovery(workouts);
    const { score, hoursToRecoverLabel } = computeOverallRecoveryScore(
      recoveryPct,
      lastTrainedAt,
      muscleDetails
    );
    const breakdown = buildRecoveryBreakdown(recoveryPct, lastTrainedAt, muscleDetails);

    return {
      score,
      hoursToRecoverLabel,
      breakdown,
    };
  } catch (_) {
    return FALLBACK;
  }
}
