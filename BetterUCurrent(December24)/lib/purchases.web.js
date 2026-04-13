/**
 * Web stub for react-native-purchases (RevenueCat).
 * Native uses lib/purchases.js instead.
 */

export const isRevenueCatReady = () => false;

export const initializePurchases = async () => {};

export const getOfferings = async () => null;

export const purchasePackage = async () => ({
  success: false,
  error: 'In-app purchases are not available on web',
});

export const restorePurchases = async () => ({
  success: false,
  error: 'In-app purchases are not available on web',
});

export const presentPaywall = async () => false;

export const presentPremiumPaywall = async () => false;

export const presentPaywallIfNeeded = async () => false;
