/**
 * Progress Summary Helpers
 *
 * This supports retention by letting you:
 * - Show "lifetime wins" (not only streaks).
 * - Reframe a streak break as "you still practiced X times this month".
 */

import { supabase } from '../lib/supabase';

function startOfMonthISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString();
}

/**
 * Get simple progress counters for a user.
 * Returns safe defaults if anything fails.
 */
export async function getProgressSummary(userId) {
  if (!userId) {
    return {
      workoutsThisMonth: 0,
      mentalThisMonth: 0,
      runsThisMonth: 0,
      totalThisMonth: 0,
    };
  }

  const since = startOfMonthISO();

  try {
    const [workouts, mental, runs] = await Promise.all([
      supabase
        .from('user_workout_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .gte('completed_at', since),
      supabase
        .from('mental_session_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .gte('completed_at', since),
      supabase
        .from('runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since),
    ]);

    const workoutsThisMonth = workouts?.count ?? 0;
    const mentalThisMonth = mental?.count ?? 0;
    const runsThisMonth = runs?.count ?? 0;
    const totalThisMonth = workoutsThisMonth + mentalThisMonth + runsThisMonth;

    return { workoutsThisMonth, mentalThisMonth, runsThisMonth, totalThisMonth };
  } catch (_) {
    return {
      workoutsThisMonth: 0,
      mentalThisMonth: 0,
      runsThisMonth: 0,
      totalThisMonth: 0,
    };
  }
}

