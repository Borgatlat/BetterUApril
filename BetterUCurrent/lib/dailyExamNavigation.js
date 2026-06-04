/**
 * Single source of truth for the Daily Examen category row (Mental + Spiritual).
 * category-exercises expects params: title, exercises (JSON string), color.
 */

export const DAILY_EXAMEN_CATEGORY = {
  id: "examen",
  title: "Daily Examen",
  icon: "search",
  color: "#FFB74D",
  description: "St. Ignatius’s prayerful review of your day with Christ (~3 min)",
  exercises: [
    {
      id: "daily-examen",
      title: "Daily Examen",
      duration: 3,
      session_type: "examen",
      type: "examen",
      description:
        "The Ignatian Examen: notice where God was with you today, receive mercy, and choose how to live tomorrow.",
      steps: JSON.stringify([
        "Presence — Become still. God is here. Take a slow breath and ask the Holy Spirit to guide this prayer.",
        "Gratitude — Thank God for two gifts from today: people, moments, strength, beauty, or grace you received.",
        "Review — Walk through your day with Christ. Where did you love well? Where did fear, pride, or distraction pull you away?",
        "Contrition — Name one way you fell short—not to shame yourself, but to bring it to Jesus and ask His mercy.",
        "Resolution — With the Spirit’s help, choose one small step for tomorrow: prayer, kindness, honesty, courage, or reconciliation.",
      ]),
    },
  ],
};

/** True for the shared Daily Examen session (school + mental wellness). */
export function isDailyExamenSession(session) {
  return session?.id === "daily-examen" || session?.session_type === "examen";
}

/**
 * Route params for expo-router `push` to category-exercises (same shape as mental.js).
 * @returns {{ title: string; exercises: string; color: string }}
 */
export function dailyExamenCategoryExerciseParams() {
  return {
    title: DAILY_EXAMEN_CATEGORY.title,
    exercises: JSON.stringify(DAILY_EXAMEN_CATEGORY.exercises),
    color: DAILY_EXAMEN_CATEGORY.color,
  };
}
