/**
 * Maps real user struggles → one clear action (and optional Premium unlock).
 * Used by Daily Focus, Weekly Report, and contextual upgrade prompts.
 */

import { getUserContext, getUserState } from '../utils/userStateMachine';
import { getStreakShieldStatus } from './premiumPerks';
import { getWeeklyWellnessReport } from '../utils/weeklyWellnessReport';

/**
 * @typedef {Object} WellnessAction
 * @property {string} id
 * @property {string} problem - What the user is feeling / facing
 * @property {string} solution - What will help
 * @property {string} cta - Button label
 * @property {string} route - expo-router path
 * @property {Object} [params]
 * @property {string} [icon]
 * @property {string} [premiumUnlock] - What Premium adds for this problem
 */

const ACTIONS = {
  save_streak: {
    id: 'save_streak',
    problem: 'Your streak ends tonight unless you log something',
    solution: 'A 5-minute mental reset or quick workout saves it',
    cta: 'Save my streak',
    route: '/(tabs)/mental',
    icon: 'flame',
  },
  easy_restart: {
    id: 'easy_restart',
    problem: 'You stepped away — that is normal',
    solution: 'One small win today rebuilds momentum without guilt',
    cta: '5-minute easy reset',
    route: '/(tabs)/mental',
    icon: 'leaf',
  },
  mental_gap: {
    id: 'mental_gap',
    problem: 'Your mind needs care too — zero mental sessions lately',
    solution: 'Guided breathing calms stress in minutes, not hours',
    cta: 'Start breathing',
    route: '/(tabs)/mental',
    icon: 'flower',
  },
  plan_life: {
    id: 'plan_life',
    problem: 'Feeling stuck on goals or habits?',
    solution: 'Future U helps you map the next 90 days with AI',
    cta: 'Open Future U',
    route: '/Futureuai',
    icon: 'compass',
  },
  log_food: {
    id: 'log_food',
    problem: 'Nutrition tracking feels like homework',
    solution: 'Snap your plate — AI logs calories and macros for you',
    cta: 'Try meal scan',
    route: '/(tabs)/nutrition',
    icon: 'camera',
  },
  ai_support: {
    id: 'ai_support',
    problem: 'You need someone to talk to right now',
    solution: 'AI Therapist (Eleos) is there for stress, anxiety, and motivation',
    cta: 'Talk to Eleos',
    route: null,
    icon: 'chatbubbles',
  },
  keep_momentum: {
    id: 'keep_momentum',
    problem: 'You are on track — nice work',
    solution: 'Stack one more win today while energy is high',
    cta: 'Log a session',
    route: '/(tabs)/workout',
    icon: 'trending-up',
  },
};

/**
 * Build prioritized problems from live user context.
 * @param {string} userId
 * @param {{ isPremium?: boolean, messageCount?: number, maxMessages?: number }} opts
 */
export async function getUserWellnessFocus(userId, opts = {}) {
  if (!userId) return null;

  const { isPremium = false, messageCount = 0, maxMessages = 10 } = opts;
  const [ctx, shield, weekly] = await Promise.all([
    getUserContext(userId),
    isPremium ? getStreakShieldStatus(userId) : Promise.resolve(null),
    isPremium ? getWeeklyWellnessReport(userId) : Promise.resolve(null),
  ]);

  const state = getUserState(ctx);
  const problems = [];
  const actionPlan = [];

  if (state === 'atRisk' && !ctx?.streakStatus?.hasActivityToday) {
    const a = { ...ACTIONS.save_streak };
    if (shield?.shieldAvailable) {
      a.solution += ' · Streak Shield can forgive 1 missed day this month';
    } else if (!isPremium) {
      a.premiumUnlock = 'Premium: Streak Shield forgives 1 missed day/month';
    }
    problems.push(a);
  }

  if (state === 'offTrack_recent' || state === 'offTrack_long') {
    problems.push({
      ...ACTIONS.easy_restart,
      problem:
        state === 'offTrack_long'
          ? 'It has been a while — welcome back, no judgment'
          : ACTIONS.easy_restart.problem,
      premiumUnlock: isPremium
        ? 'Premium Recovery Plan: 3 personalized steps below'
        : 'Premium: personalized weekly report + streak shield',
    });
  }

  const mentalMonth = ctx?.progress?.mentalThisMonth ?? 0;
  const totalMonth = ctx?.progress?.totalThisMonth ?? 0;
  if (mentalMonth === 0 && totalMonth < 4) {
    problems.push({
      ...ACTIONS.mental_gap,
      premiumUnlock: 'Premium: guided audio + 20 AI mental sessions/day',
    });
  }

  const messagesLeft = Math.max(0, maxMessages - messageCount);
  if (!isPremium && messagesLeft <= 2 && messageCount > 0) {
    problems.push({
      ...ACTIONS.ai_support,
      problem: `Only ${messagesLeft} AI message${messagesLeft === 1 ? '' : 's'} left today`,
      solution: 'Premium unlocks 100 messages/day across Trainer + Therapist',
      cta: 'Get more AI support',
      route: '/purchase-subscription',
      icon: 'chatbubbles',
      premiumUnlock: '10× more daily AI messages',
    });
  }

  if (!isPremium && totalMonth >= 3 && mentalMonth === 0) {
    problems.push({
      ...ACTIONS.log_food,
      premiumUnlock: 'Try 1 free meal photo scan — Premium: 10/day',
    });
  }

  if (problems.length === 0) {
    problems.push({ ...ACTIONS.keep_momentum });
  }

  const primary = problems[0];

  if (isPremium && weekly) {
    actionPlan.push(...buildPremiumActionPlan(weekly, ctx, state));
  } else if (isPremium) {
    actionPlan.push(
      { step: 1, text: primary.solution, route: primary.route, params: primary.params },
      { step: 2, text: 'Check your Weekly Wellness Report above', route: null },
      { step: 3, text: 'Join Premium League Circuit in Community → League', route: '/(tabs)/community', params: { tab: 'league' } },
    );
  } else {
    actionPlan.push({ step: 1, text: primary.solution, route: primary.route, params: primary.params });
    if (primary.premiumUnlock) {
      actionPlan.push({
        step: 2,
        text: primary.premiumUnlock,
        route: '/purchase-subscription',
        isPremiumCta: true,
      });
    }
  }

  return {
    state,
    primaryProblem: primary,
    allProblems: problems,
    actionPlan,
    weeklySnapshot: weekly,
  };
}

function buildPremiumActionPlan(weekly, ctx, state) {
  const plan = [];
  const { thisWeek } = weekly;

  if (thisWeek.mental === 0) {
    plan.push({
      step: plan.length + 1,
      text: 'Add 1 mental session this week — stress compounds without it',
      route: '/(tabs)/mental',
    });
  }
  if (thisWeek.workouts === 0) {
    plan.push({
      step: plan.length + 1,
      text: 'Move your body once — even 15 minutes counts',
      route: '/(tabs)/workout',
    });
  }
  if (state === 'atRisk') {
    plan.push({
      step: plan.length + 1,
      text: 'Log any activity before midnight to protect your streak',
      route: '/(tabs)/mental',
    });
  }
  if (thisWeek.total > 0 && thisWeek.mental < thisWeek.workouts) {
    plan.push({
      step: plan.length + 1,
      text: 'Balance training with recovery — try guided audio tonight',
      route: '/(tabs)/mental',
    });
  }
  if (plan.length === 0) {
    plan.push({
      step: 1,
      text: weekly.insight,
      route: '/(tabs)/workout',
    });
    plan.push({
      step: 2,
      text: 'Set a 90-day direction in Future U',
      route: '/Futureuai',
    });
  }
  return plan.slice(0, 3);
}

/**
 * Weekly report enrichment: gaps, wins, and concrete next steps.
 */
export function enrichWeeklyReport(report, ctx) {
  if (!report) return null;

  const problems = [];
  const wins = [];
  const actionPlan = [];

  if (report.thisWeek.mental === 0) {
    problems.push('No mental sessions — stress may be building unnoticed');
    actionPlan.push({
      text: 'Schedule one 5-min breathing session',
      route: '/(tabs)/mental',
    });
  }
  if (report.thisWeek.workouts === 0 && report.thisWeek.runs === 0) {
    problems.push('No movement logged — energy and mood often follow activity');
    actionPlan.push({
      text: 'Try a 20-min starter workout',
      route: '/(tabs)/workout',
    });
  }
  if (report.deltaTotal < 0) {
    problems.push(`Activity dipped ${Math.abs(report.deltaTotal)} sessions vs last week`);
    actionPlan.push({
      text: 'Pick one easy win tomorrow — consistency beats intensity',
      route: '/(tabs)/mental',
    });
  }

  if (report.thisWeek.mental >= 3) {
    wins.push(`${report.thisWeek.mental} mental sessions — your nervous system got care`);
  }
  if (report.thisWeek.workouts >= 2) {
    wins.push(`${report.thisWeek.workouts} workouts — strength is stacking`);
  }
  if (report.streak >= 7) {
    wins.push(`${report.streak}-day streak — habit is forming`);
  }
  if (report.deltaTotal > 0) {
    wins.push(`+${report.deltaTotal} more sessions than last week`);
  }
  if (wins.length === 0 && report.thisWeek.total > 0) {
    wins.push(`${report.thisWeek.total} sessions logged — you showed up`);
  }

  if (actionPlan.length === 0) {
    actionPlan.push({
      text: 'Maintain rhythm — add one session in your weakest area',
      route: report.thisWeek.mental <= report.thisWeek.workouts ? '/(tabs)/mental' : '/(tabs)/workout',
    });
  }

  return {
    ...report,
    problems,
    wins,
    actionPlan: actionPlan.slice(0, 3),
  };
}
