import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Prevents initializing AdMob in Expo Go and on web — the native TurboModule is not bundled there. */
export function isNativeMobileAdsSupported() {
  if (Platform.OS === 'web') return false;
  // Expo Go reports `appOwnership === 'expo'`; standalone / dev-client builds report `standalone` / null-ish.
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

// Module-level flag so we only initialize once per app process.
let didInitializeAdMob = false;

/**
 * Reads AdMob ad unit IDs from app config `extra` first, then falls back to env vars.
 */
const getConfiguredBannerUnitId = () => {
  const extra = Constants.expoConfig?.extra ?? {};
  const admobConfig = extra.admob ?? {};
  const iosUnitId =
    admobConfig.iosBannerAdUnitId || process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID;
  const androidUnitId =
    admobConfig.androidBannerAdUnitId || process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID;

  return Platform.OS === 'ios' ? iosUnitId : androidUnitId;
};

export const getBannerAdUnitId = () => getConfiguredBannerUnitId();

/**
 * Initializes Mobile Ads SDK. Skips Expo Go (no RNGoogleMobileAdsModule).
 * Deferred `require(...)` avoids loading the TurboModule until we know we're not in Expo Go.
 */
export const initializeAdMob = async () => {
  if (didInitializeAdMob || Platform.OS === 'web' || !isNativeMobileAdsSupported()) return;

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
};
