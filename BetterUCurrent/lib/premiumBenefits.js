/**
 * Single source of truth for Premium marketing + paywall copy.
 * Keep numbers aligned with:
 * - context/SharedMessageLimitContext.js (10 free / 100 premium messages)
 * - utils/aiGenerationLimits.js (generation caps)
 * - utils/workoutCatalog.js (PREMIUM_WORKOUTS count)
 */

import { PREMIUM_WORKOUTS } from '../utils/workoutCatalog';
import { AI_GENERATION_LIMITS } from '../utils/aiGenerationLimits';

export const PREMIUM_WORKOUT_COUNT = PREMIUM_WORKOUTS.length;

/** Framing for ~$5/week — helps users compare to coffee, not a gym membership */
export const PREMIUM_VALUE_ANCHOR = {
  headline: 'Your full wellness team for less than a coffee a day',
  subline: 'AI coach, therapist, meal planner, guided audio & 43+ pro programs.',
  trialLabel: 'Free trial available on select plans · cancel anytime',
  afterTrialLabel: 'Pricing shown from the App Store for your selected plan',
};

/**
 * Outcome-first benefit groups shown on the paywall.
 * `badge` draws the eye to the highest-converting perks.
 */
/** Problems Premium actually solves (not feature fluff) */
export const PREMIUM_PROBLEMS_SOLVED = [
  { problem: 'I fall off and feel guilty', solution: 'Daily Focus + Easy Reset + Streak Shield' },
  { problem: 'AI stops mid-conversation', solution: '100 messages/day vs 10 free' },
  { problem: 'Logging food is tedious', solution: 'Photo meal scan — snap plate, AI logs macros' },
  { problem: 'I don\'t know what to do next', solution: 'Weekly Report with gaps, wins & action steps' },
  { problem: 'Stress builds silently', solution: 'Guided audio + AI mental sessions on demand' },
  { problem: 'I feel stuck on life goals', solution: 'Future U — 90-day AI planning' },
];

export const PREMIUM_BENEFIT_CATEGORIES = [
  {
    id: 'problems',
    title: 'Problems We Solve',
    subtitle: 'Premium is built around real struggles — not checkbox features',
    icon: 'heart',
    color: '#ff6b8a',
    items: PREMIUM_PROBLEMS_SOLVED.map((p, i) => ({
      icon: i % 2 === 0 ? 'checkmark-done' : 'flash',
      title: p.problem,
      description: p.solution,
      badge: i === 0 ? 'Why Premium' : undefined,
    })),
  },
  {
    id: 'ai_team',
    title: 'AI Wellness Team',
    subtitle: 'Replaces scattered apps — one coach for body and mind',
    icon: 'sparkles',
    color: '#FFD700',
    items: [
      {
        icon: 'chatbubbles',
        title: '100 AI messages every day',
        description: 'AI Trainer + AI Therapist (Eleos) — real-time motivation, form tips, and emotional support',
        badge: '10× free',
        freeLimit: '10/day',
        premiumLimit: '100/day',
      },
      {
        icon: 'compass',
        title: 'Future U life planning',
        description: 'Long-form Claude planning for goals, habits, and your next 90 days',
        badge: 'Popular',
        freeLimit: '2/day',
        premiumLimit: `${AI_GENERATION_LIMITS.PREMIUM.FUTURE_U}/day`,
      },
      {
        icon: 'fitness',
        title: '20 AI workouts daily',
        description: 'Personalized routines by goal, equipment, and time — never repeat the same plan',
        freeLimit: '1/day',
        premiumLimit: '20/day',
      },
      {
        icon: 'restaurant',
        title: '20 AI meals + 10 photo scans',
        description: 'Snap your plate — AI estimates macros and logs it for you',
        badge: 'Premium only',
        freeLimit: '1 meal + 1 photo preview',
        premiumLimit: '20 meals + 10 scans',
      },
      {
        icon: 'flower',
        title: '20 AI mental sessions daily',
        description: 'Custom meditation, breathing, and mindfulness built for how you feel right now',
        freeLimit: '1/day',
        premiumLimit: '20/day',
      },
    ],
  },
  {
    id: 'mind_body',
    title: 'Mind & Recovery',
    subtitle: 'Calm your nervous system, not just your feed',
    icon: 'leaf',
    color: '#8b5cf6',
    items: [
      {
        icon: 'headset',
        title: 'Guided audio on every session',
        description: 'Professional narration — free users get 1 preview session, Premium unlocks all',
        badge: '1 free preview',
        freeLimit: '1 preview',
        premiumLimit: 'All sessions',
      },
      {
        icon: 'document-text',
        title: 'Weekly Wellness Report',
        description: 'Personal digest — workouts, mental sessions, streak trends & insights every week',
        badge: 'Premium only',
        freeLimit: '—',
        premiumLimit: 'Every week',
      },
      {
        icon: 'shield-checkmark',
        title: 'Streak Shield',
        description: 'Miss one day without losing your streak — 1 forgiven gap per month',
        badge: 'Peace of mind',
        freeLimit: '—',
        premiumLimit: '1/month',
      },
      {
        icon: 'moon',
        title: 'Sleep & stress sessions on demand',
        description: 'Generate a session for anxiety, focus, or wind-down in seconds',
        freeLimit: '1/day',
        premiumLimit: '20/day',
      },
    ],
  },
  {
    id: 'train',
    title: 'Train Like a Pro',
    subtitle: `${PREMIUM_WORKOUT_COUNT}+ programs you cannot get on free`,
    icon: 'barbell',
    color: '#00ffff',
    items: [
      {
        icon: 'trophy',
        title: `${PREMIUM_WORKOUT_COUNT} expert workout programs`,
        description: 'Push/pull/legs splits, strength, hypertrophy, athletic & wellness — with coaching cues',
        badge: 'Exclusive',
        freeLimit: 'Basic starters',
        premiumLimit: 'Full library',
      },
      {
        icon: 'timer',
        title: 'Custom rest timers',
        description: 'Set rest between sets to match your training style — hypertrophy vs power',
        freeLimit: 'Default only',
        premiumLimit: 'Fully custom',
      },
    ],
  },
  {
    id: 'community',
    title: 'Community & Status',
    subtitle: 'Lead groups and stand out in the feed',
    icon: 'people',
    color: '#00ffff',
    items: [
      {
        icon: 'globe',
        title: 'Create public groups',
        description: 'Build a squad, run challenges, and grow your wellness community',
        freeLimit: 'Join only',
        premiumLimit: 'Create & lead',
      },
      {
        icon: 'star',
        title: 'Gold profile glow + badge',
        description: 'Premium members shine in community, league, and on your profile',
        freeLimit: '—',
        premiumLimit: 'Included',
      },
      {
        icon: 'diamond',
        title: 'Premium League Circuit',
        description: 'Exclusive monthly milestones + priority league badge alongside team challenges',
        badge: 'League exclusive',
        freeLimit: 'Team only',
        premiumLimit: 'Circuit + badge',
      },
    ],
  },
  {
    id: 'rewards',
    title: 'Earn More',
    subtitle: 'Premium pays for itself when you stay consistent',
    icon: 'trending-up',
    color: '#FFD700',
    items: [
      {
        icon: 'cash',
        title: 'Higher bond payout rates',
        description: 'Earn more Neuros on fitness bonds when you keep your streak',
        freeLimit: 'Standard rate',
        premiumLimit: 'Boosted rate',
      },
      {
        icon: 'clipboard',
        title: 'Custom nutrition targets',
        description: 'Set your own calories, protein, water, and macros — not one-size-fits-all',
        freeLimit: 'Fixed goals',
        premiumLimit: 'You control',
      },
    ],
  },
];

/** Compact rows for the Free vs Premium comparison table */
export const FREE_VS_PREMIUM_ROWS = [
  { feature: 'AI Trainer + Therapist', free: '10 msgs/day', premium: '100 msgs/day' },
  { feature: 'AI workouts, meals & mental', free: '1/day each', premium: '20/day each' },
  { feature: 'Photo meal scan (AI)', free: '1 preview', premium: '10/day' },
  { feature: 'Future U planning', free: '2/day', premium: `${AI_GENERATION_LIMITS.PREMIUM.FUTURE_U}/day` },
  { feature: 'Guided audio sessions', free: '—', premium: 'All sessions' },
  { feature: 'Expert workout library', free: '6 starters', premium: `${PREMIUM_WORKOUT_COUNT} programs` },
  { feature: 'Public groups & custom goals', free: '—', premium: 'Included' },
  { feature: 'Weekly Wellness Report', free: '—', premium: 'Included' },
  { feature: 'Streak Shield (1 miss/month)', free: '—', premium: 'Included' },
  { feature: 'Premium League Circuit', free: '—', premium: 'Exclusive' },
];

/** Top 3 bullets for Settings upgrade card */
export const PREMIUM_SETTINGS_HIGHLIGHTS = [
  'Daily Focus plan + Weekly Report with next steps',
  'Streak Shield + 100 AI messages/day',
  'Photo meal scan, guided audio & League Circuit',
];

/** Compare-to framing (not a medical claim — positioning only) */
export const PREMIUM_VALUE_COMPARISONS = [
  { label: 'One therapy session', cost: '~$150' },
  { label: 'One personal training session', cost: '~$80' },
  { label: 'BetterU Premium', cost: 'Weekly · Monthly · Yearly', highlight: true },
];

export function getPremiumBenefitByReason(reason) {
  const map = {
    ai_messages: PREMIUM_BENEFIT_CATEGORIES[0].items[0],
    future_u: PREMIUM_BENEFIT_CATEGORIES[0].items[1],
    ai_generation: PREMIUM_BENEFIT_CATEGORIES[0].items[2],
    guided_audio: PREMIUM_BENEFIT_CATEGORIES[1].items[0],
    public_groups: PREMIUM_BENEFIT_CATEGORIES[3].items[0],
    nutrition_goals: PREMIUM_BENEFIT_CATEGORIES[4].items[1],
  };
  return map[reason] || null;
}
