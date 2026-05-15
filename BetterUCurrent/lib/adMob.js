import { Platform } from 'react-native';
import Constants from 'expo-constants';
// This library wraps Google's native Mobile Ads SDK (native iOS is pulled in via CocoaPods through Expo autolinking).
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';

// Module-level flag so we only initialize once per app process (similar idea to a Swift `static var didStart`).
let didInitializeAdMob = false;

/**
 * Reads AdMob ad unit IDs from app config `extra` first, then falls back to env vars.
 * This keeps IDs configurable per build profile without hard-coding production values.
 */
const getConfiguredBannerUnitId = () => {
  // `Constants.expoConfig` comes from app.config.js at build time; `?.` avoids errors if it is missing (e.g. some web builds).
  const extra = Constants.expoConfig?.extra ?? {};
  const admobConfig = extra.admob ?? {};
  const iosUnitId =
    admobConfig.iosBannerAdUnitId || process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID;
  const androidUnitId =
    admobConfig.androidBannerAdUnitId || process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID;

  // Same idea as choosing iOS vs Android code paths in native land (`#if os(iOS)`).
  return Platform.OS === 'ios' ? iosUnitId : androidUnitId;
};

export const getBannerAdUnitId = () => getConfiguredBannerUnitId();

/**
 * Initializes the Mobile Ads SDK (React Native equivalent of `MobileAds.shared.start()` in Swift).
 * Call this early; after it resolves, banner views may prefetch/load ads.
 */
export const initializeAdMob = async () => {
  if (didInitializeAdMob || Platform.OS === 'web') return;

  try {
    // Apply global request flags *before* the SDK starts serving ads (important for EEA consent / child-directed policies).
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    // `initialize()` boots the native SDK; `await` waits until setup finishes (or times out internally).
    await mobileAds().initialize();
    didInitializeAdMob = true;
  } catch (error) {
    // Optional chaining: if `error` is not an object with `message`, we still log something sensible.
    console.warn('[AdMob] Initialization failed:', error?.message || error);
  }
};
