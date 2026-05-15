/**
 * Engagement / Motivation Service
 * Computes user "engagement level" from streaks and recent activity so the app
 * can adjust workouts, mental content, and messaging (e.g. gentle reframes when
 * engagement drops).
 */

import { getStreakStatus } from './streakHelpers';
import { supabase } from '../lib/supabase';

/** @typedef {'high'|'medium'|'low'} EngagementLevel */

/**
 * Get engagement level for a user (high / medium / low) and optional reasons.
 * Used to tailor workout/mental generation and compassionate check-ins.
 * @param {string} userId - User UUID
 * @returns {Promise<{ level: EngagementLevel, reasons: string[] }>}
 */
export async function getEngagementLevel(userId) {
  const reasons = [];
  if (!userId) {
    return { level: 'high', reasons: [] };
  }

  try {
    const streakStatus = await getStreakStatus(userId);
    const { currentStreak, longestStreak, hasActivityToday, isAtRisk } = streakStatus;

    // Streak at risk = missed today so far (had activity yesterday)
    if (isAtRisk) {
      reasons.push('streak_at_risk');
    }

    // Just reset: current streak 0 or 1 and they had a streak before
    if ((currentStreak === 0 || currentStreak === 1) && longestStreak > 0) {
      reasons.push('streak_just_reset');
    }

    // Count workouts in last 14 days (try user_id first; some schemas use profile_id)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const { data: workoutLogs } = await supabase
      .from('user_workout_logs')
      .select('id, completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', fourteenDaysAgo.toISOString());

    const workoutCount = workoutLogs?.length ?? 0;
    const workoutsPerWeek = workoutCount / 2;
    if (workoutCount < 2) {
      reasons.push('low_workout_frequency');
    } else if (workoutsPerWeek < 2) {
      reasons.push('low_workout_frequency');
    }

    // Decide level from reasons
    if (reasons.includes('streak_just_reset') || (reasons.includes('streak_at_risk') && reasons.includes('low_workout_frequency'))) {
      return { level: 'low', reasons };
    }
    if (reasons.includes('streak_at_risk') || reasons.includes('low_workout_frequency')) {
      return { level: 'medium', reasons };
    }
    return { level: 'high', reasons };
  } catch (err) {
    console.warn('[engagementService] getEngagementLevel error:', err);
    return { level: 'high', reasons: [] };
  }
}
