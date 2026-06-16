/**
 * Subscription product IDs and helpers.
 * Prices come from StoreKit via RevenueCat — do not hardcode dollar amounts here.
 */

export const SUBSCRIPTION_PRODUCT_IDS = {
  WEEKLY: 'betteru_premium_weekly',
  MONTHLY: 'betteru_premium_monthly',
  YEARLY: 'betteru_premium_yearly',
};

/** Display / renewal priority when multiple plans are active */
export const SUBSCRIPTION_PRODUCT_PRIORITY = [
  SUBSCRIPTION_PRODUCT_IDS.WEEKLY,
  SUBSCRIPTION_PRODUCT_IDS.YEARLY,
  SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
];

/** ISO 8601 period codes from StoreKit / RevenueCat */
export const SUBSCRIPTION_PERIODS = {
  WEEKLY: 'P1W',
  MONTHLY: 'P1M',
  YEARLY: 'P1Y',
};

export function getPackageProductId(pkg) {
  return pkg?.product?.identifier || pkg?.identifier || '';
}

export function isKnownSubscriptionProduct(productId) {
  if (!productId) return false;
  return Object.values(SUBSCRIPTION_PRODUCT_IDS).includes(String(productId));
}

/** Package is one we sell (by product id or StoreKit period/type) */
export function isKnownSubscriptionPackage(pkg) {
  if (!pkg) return false;
  if (isKnownSubscriptionProduct(getPackageProductId(pkg))) return true;
  return isWeeklyPackage(pkg) || isMonthlyPackage(pkg) || isYearlyPackage(pkg);
}

/** Product ids from our catalog that are not yet in the package list */
export function getMissingSubscriptionProductIds(packages = []) {
  const present = new Set(
    packages.map((pkg) => getPackageProductId(pkg)).filter(Boolean)
  );
  return Object.values(SUBSCRIPTION_PRODUCT_IDS).filter((id) => !present.has(id));
}

export function isWeeklyPackage(pkg) {
  if (!pkg) return false;
  const id = getPackageProductId(pkg);
  if (id === SUBSCRIPTION_PRODUCT_IDS.WEEKLY) return true;
  return (
    pkg.packageType === 'WEEKLY' ||
    pkg.product?.subscriptionPeriod === SUBSCRIPTION_PERIODS.WEEKLY ||
    id.includes('weekly')
  );
}

export function isMonthlyPackage(pkg) {
  if (!pkg) return false;
  const id = getPackageProductId(pkg);
  if (id === SUBSCRIPTION_PRODUCT_IDS.MONTHLY) return true;
  return (
    pkg.packageType === 'MONTHLY' ||
    pkg.product?.subscriptionPeriod === SUBSCRIPTION_PERIODS.MONTHLY ||
    (id.includes('monthly') && !id.includes('weekly'))
  );
}

export function isYearlyPackage(pkg) {
  if (!pkg) return false;
  const id = getPackageProductId(pkg);
  if (id === SUBSCRIPTION_PRODUCT_IDS.YEARLY) return true;
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

/** StoreKit price string when loaded; null if product not fetched yet */
export function getPackagePriceString(pkg) {
  return pkg?.product?.priceString ?? null;
}

/**
 * Days to add when RevenueCat does not return an expiration date.
 */
export function getSubscriptionDurationDays(productId) {
  const id = String(productId || '').toLowerCase();
  if (id === SUBSCRIPTION_PRODUCT_IDS.WEEKLY || id.includes('weekly') || id.includes('week')) {
    return 7;
  }
  if (
    id === SUBSCRIPTION_PRODUCT_IDS.YEARLY ||
    id.includes('yearly') ||
    id.includes('annual')
  ) {
    return 365;
  }
  return 30;
}

/** Weekly → yearly → monthly for paywall display */
export function sortPackagesForDisplay(packages = []) {
  const rank = (pkg) => {
    if (isWeeklyPackage(pkg)) return 0;
    if (isYearlyPackage(pkg)) return 1;
    if (isMonthlyPackage(pkg)) return 2;
    return 3;
  };
  return [...packages].sort((a, b) => rank(a) - rank(b));
}

/** Keep only App Store products we sell (weekly, monthly, yearly) */
export function filterKnownSubscriptionPackages(packages = []) {
  return packages.filter(isKnownSubscriptionPackage);
}

/**
 * Wrap a StoreProduct fetched outside an offering so the paywall can render + purchase it.
 * RevenueCat purchasePackage() only works for packages in an offering; standalone uses purchaseStoreProduct().
 */
export function createStandaloneSubscriptionPackage(product) {
  if (!product?.identifier) return null;
  const id = product.identifier;
  let packageType = 'CUSTOM';
  if (id === SUBSCRIPTION_PRODUCT_IDS.WEEKLY || id.includes('weekly')) {
    packageType = 'WEEKLY';
  } else if (id === SUBSCRIPTION_PRODUCT_IDS.YEARLY || id.includes('yearly') || id.includes('annual')) {
    packageType = 'ANNUAL';
  } else if (id === SUBSCRIPTION_PRODUCT_IDS.MONTHLY || id.includes('monthly')) {
    packageType = 'MONTHLY';
  }

  return {
    identifier: `standalone_${id}`,
    packageType,
    product,
    isStandaloneProduct: true,
  };
}

/** Dedupe by product id; prefer real offering packages over standalone wrappers */
export function dedupeSubscriptionPackages(packages = []) {
  const byProductId = new Map();
  for (const pkg of packages) {
    const productId = getPackageProductId(pkg);
    if (!productId) continue;
    const existing = byProductId.get(productId);
    if (!existing || (existing.isStandaloneProduct && !pkg.isStandaloneProduct)) {
      byProductId.set(productId, pkg);
    }
  }
  return [...byProductId.values()];
}

/** Default selection: weekly if in offering, else monthly, else first */
export function getPreferredDefaultPackage(packages = []) {
  const sorted = sortPackagesForDisplay(filterKnownSubscriptionPackages(packages));
  return (
    sorted.find(isWeeklyPackage) ||
    sorted.find(isMonthlyPackage) ||
    sorted.find(isYearlyPackage) ||
    sorted[0] ||
    null
  );
}

/**
 * Pick the best active subscription from RevenueCat maps.
 */
export function pickActiveSubscriptionProduct(subscriptionsByProduct = {}) {
  for (const id of SUBSCRIPTION_PRODUCT_PRIORITY) {
    const sub = subscriptionsByProduct[id];
    if (sub?.isActive) return sub;
  }
  const firstActive = Object.values(subscriptionsByProduct).find((s) => s?.isActive);
  return firstActive || null;
}

/** Build paywall subtitle from loaded packages (no hardcoded prices) */
export function buildSubscriptionPlansSubtitle(packages = []) {
  const known = sortPackagesForDisplay(filterKnownSubscriptionPackages(packages));
  if (!known.length) return 'Select the subscription that works best for you';

  const labels = known.map((pkg) => {
    const title = getPackagePlanTitle(pkg);
    const price = getPackagePriceString(pkg);
    const period = getPackagePeriodLabel(pkg);
    return price ? `${title} (${price}/${period})` : title;
  });

  return `${labels.join(' · ')}. Cancel anytime in Settings.`;
}

/** Price line for CTA / disclosure from a StoreProduct */
export function getDisplayPriceFromProduct(product, pkg) {
  const periodLabel = pkg ? getPackagePeriodLabel(pkg) : 'month';
  const standardPrice = product?.priceString ?? null;
  const discount = product?.discounts?.[0];

  if (discount?.priceString && standardPrice) {
    const discountPeriod = (discount.periodUnit || '').toLowerCase();
    const discountPeriodLabel =
      discountPeriod === 'year'
        ? 'year'
        : discountPeriod === 'week'
          ? 'week'
          : discountPeriod === 'month'
            ? 'month'
            : periodLabel;
    return {
      originalPrice: standardPrice,
      displayPrice: discount.priceString,
      periodLabel: discountPeriodLabel,
      isPromo: true,
      thenPriceString: standardPrice,
      thenPeriodLabel: periodLabel,
    };
  }

  return {
    originalPrice: standardPrice,
    displayPrice: standardPrice,
    periodLabel,
    isPromo: false,
  };
}
