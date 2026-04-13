/**
 * Notification Template Selector
 *
 * Goal:
 * - Given a UserState + context, pick a supportive message template.
 *
 * Beginner note:
 * - A "template" is just a JS object with text + metadata.
 * - Later, if you move templates into the database, this file becomes the "fallback defaults".
 */

/**
 * @typedef {'push'|'email'} Channel
 * @typedef {'onTrack'|'atRisk'|'offTrack_recent'|'offTrack_long'|'returning'} UserState
 */

function pluralize(n, singular, plural = singular + 's') {
  return n === 1 ? singular : plural;
}

function safeName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length > 0 ? trimmed : 'friend';
}

/**
 * Pick a single best template for a given state.
 *
 * Important:
 * - `templateId` is what you log for analytics/A-B tests.
 * - `priority` loosely maps to "importance" (higher = more likely to send).
 * - `actionData` matches your existing `createNotificationWithPush` navigation shape.
 */
export function selectNotificationTemplate({
  state,
  channel = 'push',
  displayName,
  streakStatus,
  engagement,
  progress,
}) {
  const name = safeName(displayName);
  const currentStreak = streakStatus?.currentStreak ?? 0;
  const longestStreak = streakStatus?.longestStreak ?? 0;
  const isAtRisk = streakStatus?.isAtRisk === true;
  const lowEngagement = engagement?.level === 'low';
  const totalThisMonth = progress?.totalThisMonth ?? null;

  // Shared "quick action" deep link. If you change the screen, the notification takes users elsewhere.
  const defaultAction = {
    isActionable: true,
    actionType: 'navigate',
    actionData: { screen: '/(tabs)/workout', params: { tab: 'workout' } },
  };

  if (state === 'onTrack') {
    return {
      templateId: channel === 'email' ? 'onTrack_email_weeklySummary' : 'onTrack_push_gentleReminder',
      title: 'Keep your momentum',
      message: `Hey ${name}, small actions stack up. Want to keep your momentum today?`,
      priority: 1,
      ...defaultAction,
    };
  }

  if (state === 'atRisk') {
    // At-risk messaging: reduce shame + reduce friction.
    // If you make this more intense (“don’t break your streak!”), some users will churn.
    const title = isAtRisk ? 'Your streak is still alive' : 'A tiny win counts';
    const message = isAtRisk || lowEngagement
      ? `Hey ${name}, one quick activity today keeps things moving — even 5 minutes is enough.`
      : `Hey ${name}, today can be light. One small step is a win.`;

    return {
      templateId: 'atRisk_push_tinyStep',
      title,
      message,
      priority: 2,
      ...defaultAction,
    };
  }

  if (state === 'offTrack_recent') {
    // Recent streak break / recent inactivity: compassion + restart.
    const hasHistory = longestStreak > 0;
    const title = 'Fresh start today';
    const message = hasHistory
      ? `You did ${longestStreak} ${pluralize(longestStreak, 'day')} in a row — that's real progress.${typeof totalThisMonth === 'number' ? ` This month you’ve shown up ${totalThisMonth} ${pluralize(totalThisMonth, 'time')}.` : ''} Today can be a gentle restart. One short session counts.`
      : `No pressure, ${name}. A gentle restart today is enough — one short session counts.`;

    return {
      templateId: 'offTrack_recent_push_compassionateRestart',
      title,
      message,
      priority: 2,
      ...defaultAction,
    };
  }

  if (state === 'offTrack_long') {
    // Long inactivity: warm re-engagement + choice.
    // If you send too often here, users will disable notifications.
    return {
      templateId: 'offTrack_long_push_welcomeBack',
      title: `Hey ${name}, checking in`,
      message: `We’ve missed you. If things got hard, that’s okay. Want to come back with one simple habit today?`,
      priority: 2,
      ...defaultAction,
    };
  }

  if (state === 'returning') {
    return {
      templateId: 'returning_push_rewardComeback',
      title: 'Welcome back',
      message: `You came back — that’s huge. Want to lock in a tiny 2-day mini streak?`,
      priority: 2,
      ...defaultAction,
    };
  }

  // Fallback: safe generic
  return {
    templateId: 'fallback_push_generic',
    title: 'BetterU Reminder',
    message: `Hey ${name}, time for a quick BetterU check-in.`,
    priority: 1,
    ...defaultAction,
  };
}

