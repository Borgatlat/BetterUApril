import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getCurrentMonthKey } from './premiumPerks';

/**
 * Premium-exclusive monthly "League Circuit" — personal milestones
 * that complement the global team challenge.
 */
export const PREMIUM_CIRCUIT_MILESTONES = [
  { id: 'mental_3', label: '3 mental sessions', target: 3, icon: 'leaf', field: 'mental' },
  { id: 'workout_5', label: '5 workouts', target: 5, icon: 'barbell', field: 'workouts' },
  { id: 'active_5', label: '5 active days', target: 5, icon: 'calendar', field: 'activeDays' },
  { id: 'total_10', label: '10 total sessions', target: 10, icon: 'trophy', field: 'total' },
];

function monthRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString();
}

async function getMonthlyProgress(userId) {
  const since = monthRangeISO();
  const [workouts, mental, runs] = await Promise.all([
    supabase
      .from('user_workout_logs')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', since),
    supabase
      .from('mental_session_logs')
      .select('completed_at')
      .eq('profile_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', since),
    supabase
      .from('runs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', since),
  ]);

  const dates = new Set();
  const addDate = (ts) => {
    if (!ts) return;
    dates.add(new Date(ts).toDateString());
  };
  (workouts.data || []).forEach((r) => addDate(r.completed_at));
  (mental.data || []).forEach((r) => addDate(r.completed_at));
  (runs.data || []).forEach((r) => addDate(r.created_at));

  const w = workouts.data?.length ?? 0;
  const m = mental.data?.length ?? 0;
  const r = runs.data?.length ?? 0;

  return {
    workouts: w,
    mental: m,
    runs: r,
    total: w + m + r,
    activeDays: dates.size,
  };
}

function progressForField(progress, field) {
  return progress[field] ?? 0;
}

export async function getPremiumLeagueCircuit(userId) {
  if (!userId) return null;
  const monthKey = getCurrentMonthKey();
  const progress = await getMonthlyProgress(userId);

  const milestones = PREMIUM_CIRCUIT_MILESTONES.map((m) => {
    const current = progressForField(progress, m.field);
    return {
      ...m,
      current,
      complete: current >= m.target,
    };
  });

  const completedCount = milestones.filter((m) => m.complete).length;
  const storageKey = `premium_circuit_badge_${userId}_${monthKey}`;
  const earnedBadge = completedCount === milestones.length;
  if (earnedBadge) {
    await AsyncStorage.setItem(storageKey, '1');
  }

  return {
    monthKey,
    milestones,
    completedCount,
    totalMilestones: milestones.length,
    earnedPremiumCircuitBadge: earnedBadge,
    progress,
  };
}

export const PREMIUM_LEAGUE_BADGE = {
  label: 'Premium',
  icon: 'diamond',
  color: '#FFD700',
  description: 'Priority league member — exclusive monthly circuit',
};
