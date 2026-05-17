/**
 * Single source of truth for the Daily Examen category row (Mental + Spiritual).
 * category-exercises expects params: title, exercises (JSON string), color.
 */

export const DAILY_EXAMEN_CATEGORY = {
  id: "examen",
  title: "Daily Examen",
  icon: "search",
  color: "#FFB74D",
  description: "A 3-minute reflection on your day",
  exercises: [
    {
      id: "daily-examen",
      title: "Daily Examen",
      duration: 3,
      session_type: "examen",
      type: "examen",
      description:
        "Examination of conscience: find what went wrong, what went right, and how to improve—in 3 minutes.",
      steps: JSON.stringify([
        "Gratitude — What are you grateful for today? Recall one or two moments or people.",
        "Light — Pause and invite clarity. Ask to see your day honestly and without harsh judgment.",
        "Review — Look back at your day. What drew you toward your best self? What pulled you away?",
        "Sorrow — Where did you fall short? Acknowledge it with kindness, not self-criticism.",
        "Hope — What one thing will you do differently tomorrow? Set a gentle intention.",
      ]),
    },
  ],
};

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
