/**
 * Startup helpers: cap how long any single async step can block the UI.
 * Uses Promise.race — the slow work may still finish in the background.
 */

export function withStartupTimeout(promise, ms, label = 'task') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    }),
  ]);
}

/** Runs fn; on timeout or error returns `fallback` and logs a warning. */
export async function runStartupStep(fn, ms, label, fallback = null) {
  try {
    return await withStartupTimeout(fn(), ms, label);
  } catch (err) {
    if (__DEV__) {
      console.warn(`[startup] ${label}:`, err?.message || err);
    }
    return fallback;
  }
}
