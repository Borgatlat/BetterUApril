import { Platform } from 'react-native';
import { presentPremiumPaywall } from './purchases';
import { getPremiumBenefitByReason, PREMIUM_VALUE_ANCHOR } from './premiumBenefits';

/**
 * Route to the in-app paywall with optional context (shown in headline).
 * @param {import('expo-router').Router} router
 * @param {string} [reason] - e.g. "ai_messages", "guided_audio"
 */
export function navigateToPremiumPaywall(router, reason) {
  const path = reason
    ? `/purchase-subscription?reason=${encodeURIComponent(reason)}`
    : '/purchase-subscription';
  router.push(path);
}

/**
 * Try RevenueCat dashboard paywall first; fall back to custom screen.
 * @param {import('expo-router').Router} router
 * @param {string} [reason]
 */
export async function openPremiumUpgrade(router, reason) {
  if (Platform.OS === 'ios') {
    const purchased = await presentPremiumPaywall();
    if (purchased) return true;
  }
  navigateToPremiumPaywall(router, reason);
  return false;
}

/** Headlines when user hits a specific limit */
export const PREMIUM_UPGRADE_REASONS = {
  ai_messages: {
    title: 'Your AI coach & therapist — without limits',
    subtitle: 'Premium: 100 messages/day across AI Trainer and Eleos. Free stops at 10.',
  },
  ai_generation: {
    title: 'Build your day with AI',
    subtitle: '20 workouts, meals, and mental sessions daily — personalized to you.',
  },
  future_u: {
    title: 'Map your next 90 days',
    subtitle: 'Future U uses Claude for deep life planning — 15 sessions/day on Premium.',
  },
  guided_audio: {
    title: 'Close your eyes. Press play.',
    subtitle: 'Guided audio on every mental session — the perk members love most.',
  },
  public_groups: {
    title: 'Lead your own squad',
    subtitle: 'Create public groups, run challenges, and grow your community.',
  },
  nutrition_goals: {
    title: 'Nutrition on your terms',
    subtitle: 'Set custom calories, protein, water & macros — plus 10 photo meal scans/day.',
  },
  wellness_report: {
    title: 'Your personal weekly digest',
    subtitle: 'Premium Weekly Wellness Report — sessions, streaks, and insights every Sunday.',
  },
  league_circuit: {
    title: 'Premium League Circuit',
    subtitle: 'Exclusive monthly milestones + priority league badge for Premium members.',
  },
  daily_focus: {
    title: 'Get a plan built for your situation',
    subtitle: 'Premium: 3-step daily plan, weekly gaps & wins, streak shield, and 10× AI messages.',
  },
  nutrition_photo: {
    title: 'Stop typing every meal',
    subtitle: 'You used your free scan — Premium logs 10 photo meals per day with AI.',
  },
  default: {
    title: PREMIUM_VALUE_ANCHOR.headline,
    subtitle: `${PREMIUM_VALUE_ANCHOR.trialLabel} · ${PREMIUM_VALUE_ANCHOR.afterTrialLabel}`,
  },
};

export function getPremiumUpgradeCopy(reason) {
  const preset = PREMIUM_UPGRADE_REASONS[reason];
  if (preset) return preset;
  const benefit = getPremiumBenefitByReason(reason);
  if (benefit) {
    return {
      title: benefit.title,
      subtitle: benefit.description,
    };
  }
  return PREMIUM_UPGRADE_REASONS.default;
}
