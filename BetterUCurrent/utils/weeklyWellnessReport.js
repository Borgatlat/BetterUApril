import { supabase } from '../lib/supabase';
import { getStreakStatus } from './streakHelpers';
import { getUserContext } from './userStateMachine';
import { enrichWeeklyReport } from '../lib/premiumProblemSolver';

function startOfDaysAgoISO(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

async function countActivities(userId, sinceISO, untilISO) {
  const [workouts, mental, runs] = await Promise.all([
    supabase
      .from('user_workout_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', sinceISO)
      .lte('completed_at', untilISO),
    supabase
      .from('mental_session_logs')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', sinceISO)
      .lte('completed_at', untilISO),
    supabase
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', sinceISO)
      .lte('created_at', untilISO),
  ]);

  const w = workouts?.count ?? 0;
  const m = mental?.count ?? 0;
  const r = runs?.count ?? 0;
  return { workouts: w, mental: m, runs: r, total: w + m + r };
}

function buildInsight(thisWeek, lastWeek, streak) {
  const delta = thisWeek.total - lastWeek.total;
  if (thisWeek.total === 0) {
    return 'Start small — one 5-minute mental session counts as a win.';
  }
  if (delta > 0) {
    return `You logged ${delta} more session${delta === 1 ? '' : 's'} than last week. Momentum is building.`;
  }
  if (delta < 0) {
    return `You still showed up ${thisWeek.total} time${thisWeek.total === 1 ? '' : 's'}. Consistency beats perfection.`;
  }
  if (streak?.currentStreak >= 7) {
    return `${streak.currentStreak}-day streak — you're in a strong rhythm.`;
  }
  return 'Steady week. Keep stacking small wins.';
}

/**
 * Premium Weekly Wellness Report — last 7 days vs prior 7 days.
 */
export async function getWeeklyWellnessReport(userId) {
  if (!userId) return null;

  const thisStart = startOfDaysAgoISO(6);
  const thisEnd = endOfTodayISO();
  const lastStart = startOfDaysAgoISO(13);
  const lastEnd = startOfDaysAgoISO(7);

  try {
    const [thisWeek, lastWeek, streak, ctx] = await Promise.all([
      countActivities(userId, thisStart, thisEnd),
      countActivities(userId, lastStart, lastEnd),
      getStreakStatus(userId),
      getUserContext(userId),
    ]);

    const weekLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const base = {
      weekLabel,
      thisWeek,
      lastWeek,
      deltaTotal: thisWeek.total - lastWeek.total,
      streak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      insight: buildInsight(thisWeek, lastWeek, streak),
      highlights: [
        { icon: 'barbell', label: 'Workouts', value: thisWeek.workouts, color: '#00ff64' },
        { icon: 'leaf', label: 'Mental', value: thisWeek.mental, color: '#8b5cf6' },
        { icon: 'walk', label: 'Runs', value: thisWeek.runs, color: '#ff6464' },
      ],
    };

    return enrichWeeklyReport(base, ctx);
  } catch (e) {
    console.error('[getWeeklyWellnessReport]', e);
    return null;
  }
}
