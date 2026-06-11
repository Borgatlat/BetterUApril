/** Anchor ids — must match `TutorialAnchor` wrappers on the Home screen. */
export const HOME_TUTORIAL_ANCHORS = {
  HEADER: 'header',
  RECOVERY: 'recovery',
  SCHEDULE: 'schedule',
  AI: 'ai',
  COMMUNITY: 'community',
};

/**
 * Tutorial flow for B2C Home (workout tab excluded from copy).
 * Steps with `anchorKey` use live measurement; `type: 'tabs'` uses the tab bar height.
 */
export const HOME_TUTORIAL_STEPS = [
  {
    anchorKey: HOME_TUTORIAL_ANCHORS.HEADER,
    title: 'Welcome to BetterU',
    tooltip: 'Your home base — check notifications, open your profile, and see what’s next today.',
  },
  {
    anchorKey: HOME_TUTORIAL_ANCHORS.RECOVERY,
    title: 'Recovery score',
    tooltip: 'See how ready your body is. Tap the card for a breakdown or suggestions for today.',
  },
  {
    anchorKey: HOME_TUTORIAL_ANCHORS.SCHEDULE,
    title: 'Plan your week',
    tooltip: 'Use the calendar and today’s schedule to plan workouts, meals, and wellness tasks.',
  },
  {
    anchorKey: HOME_TUTORIAL_ANCHORS.AI,
    title: 'AI assistants',
    tooltip: 'Atlas helps with fitness, Eleos with mental wellness, and Future U with goals and planning.',
  },
  {
    anchorKey: HOME_TUTORIAL_ANCHORS.COMMUNITY,
    title: 'Community',
    tooltip: 'Add friends and set up accountability partners to stay motivated together.',
  },
  {
    type: 'tabs',
    title: 'Navigate the app',
    tooltip: 'Use the tabs below: Home, Workout, Nutrition, Mental, and Community. League lives inside Community.',
  },
];
