/**
 * Subscription product IDs and helpers.
 *
 * Weekly ($4.99/wk in App Store) is the primary plan. You must create
 * `betteru_premium_weekly` in App Store Connect + RevenueCat (WEEKLY package).
 */

export const SUBSCRIPTION_PRODUCT_IDS = {
  WEEKLY: 'betteru_premium_weekly',
  MONTHLY: 'betteru_premium_monthly',
  YEARLY: 'betteru_premium_yearly',
};

/** ISO 8601 period codes from StoreKit / RevenueCat */
export const SUBSCRIPTION_PERIODS = {
  WEEKLY: 'P1W',
  MONTHLY: 'P1M',
  YEARLY: 'P1Y',
};

export function isWeeklyPackage(pkg) {
  if (!pkg) return false;
  const id = pkg.product?.identifier || pkg.identifier || '';
  return (
    pkg.packageType === 'WEEKLY' ||
    pkg.product?.subscriptionPeriod === SUBSCRIPTION_PERIODS.WEEKLY ||
    id.includes('weekly')
  );
}

export function isMonthlyPackage(pkg) {
  if (!pkg) return false;
  const id = pkg.product?.identifier || pkg.identifier || '';
  return (
    pkg.packageType === 'MONTHLY' ||
    pkg.product?.subscriptionPeriod === SUBSCRIPTION_PERIODS.MONTHLY ||
    (id.includes('monthly') && !id.includes('weekly'))
  );
}

export function isYearlyPackage(pkg) {
  if (!pkg) return false;
  const id = pkg.product?.identifier || pkg.identifier || '';
  return (
    pkg.packageType === 'ANNUAL' ||
    pkg.product?.subscriptionPeriod === SUBSCRIPTION_PERIODS.YEARLY ||
    id.includes('yearly') ||
    id.includes('annual')
  );
}

/** Human label: week | month | year */
export function getPackagePeriodLabel(pkg) {
  if (isWeeklyPackage(pkg)) return 'week';
  if (isYearlyPackage(pkg)) return 'year';
  return 'month';
}

/** Short label for plan cards */
export function getPackagePlanTitle(pkg) {
  if (isWeeklyPackage(pkg)) return 'Weekly';
  if (isYearlyPackage(pkg)) return 'Yearly';
  if (isMonthlyPackage(pkg)) return 'Monthly';
  return pkg?.product?.title || 'Premium';
}

/** Fallback list price when StoreKit has not loaded yet */
export function getFallbackPriceString(pkg) {
  if (isWeeklyPackage(pkg)) return '$4.99';
  if (isYearlyPackage(pkg)) return '$59.99';
  return '$5.99';
}

/**
 * Days to add when RevenueCat does not return an expiration date.
 * Weekly = 7 days (not 30).
 */
export function getSubscriptionDurationDays(productId) {
  const id = String(productId || '').toLowerCase();
  if (id.includes('weekly') || id.includes('week')) return 7;
  if (id.includes('yearly') || id.includes('annual')) return 365;
  return 30;
}

/** Prefer weekly → yearly → monthly for paywall display */
export function sortPackagesForDisplay(packages = []) {
  const rank = (pkg) => {
    if (isWeeklyPackage(pkg)) return 0;
    if (isYearlyPackage(pkg)) return 1;
    if (isMonthlyPackage(pkg)) return 2;
    return 3;
  };
  return [...packages].sort((a, b) => rank(a) - rank(b));
}

/** Default selection: weekly if configured in RevenueCat, else monthly, else first */
export function getPreferredDefaultPackage(packages = []) {
  const sorted = sortPackagesForDisplay(packages);
  return (
    sorted.find(isWeeklyPackage) ||
    sorted.find(isMonthlyPackage) ||
    sorted[0] ||
    null
  );
}

/**
 * Pick the best active subscription from RevenueCat maps.
 * Priority: weekly > yearly > monthly (matches primary SKU).
 */
export function pickActiveSubscriptionProduct(subscriptionsByProduct = {}) {
  const weekly = subscriptionsByProduct[SUBSCRIPTION_PRODUCT_IDS.WEEKLY];
  const yearly = subscriptionsByProduct[SUBSCRIPTION_PRODUCT_IDS.YEARLY];
  const monthly = subscriptionsByProduct[SUBSCRIPTION_PRODUCT_IDS.MONTHLY];
  const sub = weekly || yearly || monthly;
  if (sub?.isActive) return sub;
  const firstActive = Object.values(subscriptionsByProduct).find((s) => s?.isActive);
  return firstActive || null;
}
