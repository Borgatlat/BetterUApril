import { supabase } from '../lib/supabase';

/**
 * Computes a lightweight recovery score for Home.
 * Returns a stable shape so UI never crashes:
 * { score, hoursToRecoverLabel, breakdown: { draggingDown, bringingUp } }
 */
export async function computeRecoveryScore(userId) {
  const fallback = {
    score: 75,
    hoursToRecoverLabel: 'Fully recovered',
    breakdown: {
      draggingDown: [],
      bringingUp: [],
    },
  };

  if (!userId) return fallback;

  try {
    // Look at the last 24h of workout logs as a simple fatigue signal.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('workout_logs')
      .select('duration, calories_burned, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error || !Array.isArray(data)) return fallback;

    const sessions = data.length;
    const totalMinutes = data.reduce((sum, row) => sum + Number(row.duration || 0), 0);
    const totalCalories = data.reduce((sum, row) => sum + Number(row.calories_burned || 0), 0);

    // Heuristic model: more recent load lowers readiness score.
    let score = 85 - Math.round(totalMinutes * 0.2) - Math.round(totalCalories * 0.01);
    score = Math.max(20, Math.min(98, score));

    const draggingDown = [];
    const bringingUp = [];

    if (sessions > 0) {
      draggingDown.push({
        label: 'Recent training load',
        detail: `${sessions} session(s) in last 24h`,
        impact: Math.min(20, Math.round(totalMinutes * 0.15)),
      });
    }
    if (totalMinutes >= 30) {
      bringingUp.push({
        label: 'Consistency',
        detail: 'You stayed active recently',
        impact: 5,
      });
    }

    const hoursToRecover = Math.max(0, Math.round((100 - score) * 0.35));
    const hoursToRecoverLabel = hoursToRecover <= 0 ? 'Fully recovered' : `${hoursToRecover}h`;

    return {
      score,
      hoursToRecoverLabel,
      breakdown: { draggingDown, bringingUp },
    };
  } catch (_) {
    return fallback;
  }
}

