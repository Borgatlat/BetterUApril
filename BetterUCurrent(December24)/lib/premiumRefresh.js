/**
 * Lightweight notifier so code outside React (e.g. lib/purchases.js) can trigger
 * a premium status refresh in UserContext without importing context or React.
 * UserContext registers its checkSubscriptionStatus here; after IAP/subscription
 * updates we call triggerPremiumRefresh() so the UI updates immediately.
 */

let refreshCallback = null;

/** Register the function to call when premium status should be rechecked (e.g. after purchase). */
export function setPremiumRefreshCallback(fn) {
  refreshCallback = fn;
}

/** Call this after updating subscription/premium in the backend so the app UI updates. */
export function triggerPremiumRefresh() {
  if (typeof refreshCallback === 'function') {
    refreshCallback();
  }
}
