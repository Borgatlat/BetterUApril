/**
 * User State Machine (Retention / Notifications)
 *
 * Why this exists:
 * - Your app already has streak data (`getStreakStatus`) and a motivation proxy (`getEngagementLevel`).
 * - To make notifications "context aware", we convert raw signals into a small set of STATES.
 *
 * States (from the plan):
 * - onTrack: user is active and not at risk
 * - atRisk: streak is at risk today OR engagement is dropping
 * - offTrack_recent: streak just reset OR user has been inactive for ~2-3 days
 * - offTrack_long: user has been inactive for 7+ days
 * - returning: user came back after being offTrack_long/offTrack_recent
 *
 * Important: this is intentionally a *simple* state machine.
 * If you change the thresholds (like 7 days → 5 days), you will shift which messages users get,
 * and that can increase or decrease retention depending on your audience.
 */

import { supabase } from '../lib/supabase';
import { getStreakStatus } from './streakHelpers';
import { getEngagementLevel } from './engagementService';
import { getProgressSummary } from './progressSummary';

/**
 * @typedef {'onTrack'|'atRisk'|'offTrack_recent'|'offTrack_long'|'returning'} UserState
 */

/**
 * Fetch the user's most recent activity timestamp across main activity tables.
 * We treat any completed workout, mental session, or run as "activity".
 *
 * Syntax note (beginner):
 * - `select(...).order(...).limit(1)` is "give me the newest row".
 * - We run 3 queries and then take the maximum timestamp.
 */
async function getLastActivityAt(userId) {
  const [workoutRes, mentalRes, runRes] = await Promise.all([
    supabase
      .from('user_workout_logs')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1),
    supabase
      .from('mental_session_logs')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1),
    supabase
      .from('runs')
      .select('created_at, completed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const candidates = [];

  const workoutAt = workoutRes?.data?.[0]?.completed_at;
  if (workoutAt) candidates.push(new Date(workoutAt));

  const mentalAt = mentalRes?.data?.[0]?.completed_at;
  if (mentalAt) candidates.push(new Date(mentalAt));

  // Some schemas store run completion differently; fallback to created_at.
  const runAt = runRes?.data?.[0]?.completed_at || runRes?.data?.[0]?.created_at;
  if (runAt) candidates.push(new Date(runAt));

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.getTime() - a.getTime());
  return candidates[0];
}

function daysSince(date) {
  if (!date) return Infinity;
  const ms = Date.now() - date.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Build the "context variables" for the user.
 * This is the raw data the state machine uses.
 */
export async function getUserContext(userId) {
  const [streakStatus, engagement, lastActivityAt, progress] = await Promise.all([
    getStreakStatus(userId).catch(() => null),
    getEngagementLevel(userId).catch(() => ({ level: 'high', reasons: [] })),
    getLastActivityAt(userId).catch(() => null),
    getProgressSummary(userId).catch(() => null),
  ]);

  const inactivityDays = daysSince(lastActivityAt);

  return {
    userId,
    streakStatus,
    engagement,
    lastActivityAt,
    inactivityDays,
    progress,
  };
}

/**
 * Decide the user's state from context.
 *
 * If you change the numeric thresholds here, you change how "supportive" the system feels:
 * - Lower `OFFTRACK_LONG_DAYS` means users get re-engagement sooner (can help retention but can feel spammy).
 * - Higher `OFFTRACK_RECENT_DAYS` means you wait longer before acknowledging they fell off (can feel less helpful).
 */
export function getUserState(context) {
  const OFFTRACK_RECENT_DAYS = 2.5; // ~2–3 days
  const OFFTRACK_LONG_DAYS = 7; // 7+ days

  const isAtRisk = context?.streakStatus?.isAtRisk === true;
  const justReset =
    (context?.streakStatus?.currentStreak === 0 || context?.streakStatus?.currentStreak === 1) &&
    (context?.streakStatus?.longestStreak ?? 0) > 0;

  const lowEngagement = context?.engagement?.level === 'low';
  const inactivityDays = context?.inactivityDays ?? Infinity;

  // Long inactivity beats everything else.
  if (inactivityDays >= OFFTRACK_LONG_DAYS) return 'offTrack_long';

  // Recent inactivity or a fresh streak reset implies they need compassionate restart.
  if (justReset || inactivityDays >= OFFTRACK_RECENT_DAYS) return 'offTrack_recent';

  // "At risk" is a warning state: user is slipping but can still succeed today.
  if (isAtRisk || lowEngagement) return 'atRisk';

  return 'onTrack';
}

