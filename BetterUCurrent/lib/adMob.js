import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Default banner units from app.config.js — used when expo extra/env are missing in native Xcode builds. */
const DEFAULT_BANNER_UNITS = {
  ios: 'ca-app-pub-9221552597487164/1003410305',
  android: 'ca-app-pub-3940256099942544/6300978111',
};

/** Prevents initializing AdMob in Expo Go and on web — the native TurboModule is not bundled there. */
export function isNativeMobileAdsSupported() {
  if (Platform.OS === 'web') return false;
  // Expo Go reports `appOwnership === 'expo'`; standalone / dev-client builds report `standalone` / null-ish.
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

let didInitializeAdMob = false;
let initPromise = null;

/**
 * Reads AdMob ad unit IDs from app config `extra` first, then falls back to env vars.
 */
const getConfiguredBannerUnitId = () => {
  const extra = Constants.expoConfig?.extra ?? {};
  const admobConfig = extra.admob ?? {};
  const iosUnitId =
    admobConfig.iosBannerAdUnitId ||
    process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID ||
    DEFAULT_BANNER_UNITS.ios;
  const androidUnitId =
    admobConfig.androidBannerAdUnitId ||
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID ||
    DEFAULT_BANNER_UNITS.android;

  return Platform.OS === 'ios' ? iosUnitId : androidUnitId;
};

export const getBannerAdUnitId = () => getConfiguredBannerUnitId();

export function isAdMobInitialized() {
  return didInitializeAdMob;
}

/** True when dev builds or EXPO_PUBLIC_USE_ADMOB_TEST_ADS=1 — always use Google sample units. */
export function shouldUseAdMobTestUnits() {
  return __DEV__ || process.env.EXPO_PUBLIC_USE_ADMOB_TEST_ADS === 'true';
}

/**
 * Picks a test or production unit ID that matches adaptive footer banners.
 * Using TestIds.BANNER with ANCHORED_ADAPTIVE_BANNER often fails to load (size mismatch).
 */
export function resolveBannerAdUnitId(TestIds) {
  if (shouldUseAdMobTestUnits()) {
    return TestIds?.ADAPTIVE_BANNER || TestIds?.BANNER || getConfiguredBannerUnitId();
  }
  return getConfiguredBannerUnitId();
}

/**
 * Resolves when initializeAdMob has finished (success or failure) so banners do not race the SDK.
 */
export function whenAdMobReady() {
  if (!isNativeMobileAdsSupported()) return Promise.resolve(false);
  if (didInitializeAdMob) return Promise.resolve(true);
  if (!initPromise) {
    initPromise = initializeAdMob().then(() => didInitializeAdMob);
  }
  return initPromise;
}

/**
 * Initializes Mobile Ads SDK. Skips Expo Go (no RNGoogleMobileAdsModule).
 * Deferred `require(...)` avoids loading the TurboModule until we know we're not in Expo Go.
 */
export const initializeAdMob = async () => {
  if (didInitializeAdMob || Platform.OS === 'web' || !isNativeMobileAdsSupported()) {
    return didInitializeAdMob;
  }

  try {
    const gma = require('react-native-google-mobile-ads');
    const mobileAds = gma.default;
    const { MaxAdContentRating } = gma;

    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    didInitializeAdMob = true;
  } catch (error) {
    console.warn('[AdMob] Initialization failed:', error?.message || error);
  }

  return didInitializeAdMob;
};
