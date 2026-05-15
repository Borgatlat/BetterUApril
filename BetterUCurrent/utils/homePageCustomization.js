/**
 * Single source of truth for home page customization defaults and storage key.
 * The modal (changeYourHomePage) and the home tab both import this so toggles
 * always match what the home screen actually reads.
 */
export const HOME_PAGE_CUSTOMIZATION_KEY = 'homePageCustomization';

export const HOME_PAGE_CUSTOMIZATION_DEFAULTS = {
  showQuote: true,
  showStreaks: true,
  showDailyNutrition: true,
  showAIServices: true,
  showFutureU: true,
  showAnalyticsCard: true,
  showFoodScanner: true,
  showSleepTracker: true,
  showViewPlans: true,
  homeBackgroundColor: '#000000',
  homeAccentColor: '#00ffff',
};

/** Turns #RRGGBB (or #RGB) into rgba(...) so we can add transparency to the user’s accent on buttons and borders. */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(0,255,255,${alpha})`;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) {
    return `rgba(0,255,255,${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Drops keys we no longer support (older app versions may still have them in storage). */
export function sanitizeHomePageCustomization(prefs) {
  const allowed = new Set(Object.keys(HOME_PAGE_CUSTOMIZATION_DEFAULTS));
  const picked = {};
  for (const [k, v] of Object.entries(prefs || {})) {
    if (allowed.has(k)) picked[k] = v;
  }
  return { ...HOME_PAGE_CUSTOMIZATION_DEFAULTS, ...picked };
}
