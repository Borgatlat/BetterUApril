import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * True only in the Expo Go sandbox — NOT TestFlight, App Store, or EAS production builds.
 * We check both signals because Expo SDK versions differ slightly.
 */
export function isExpoGo() {
  if (Constants.appOwnership === 'expo') return true;
  if (Constants.executionEnvironment === 'storeClient') return true;
  return false;
}

/** Installed native binary (TestFlight / App Store / local release), excluding Expo Go and web. */
export function isNativeStoreOrDevClientBuild() {
  if (Platform.OS === 'web') return false;
  return !isExpoGo();
}

/**
 * User-facing copy when a native-only feature (IAP, WebRTC, etc.) is unavailable.
 */
export function nativeFeatureUnavailableMessage(featureLabel) {
  if (isExpoGo()) {
    return (
      `${featureLabel} is not available in Expo Go. Install the BetterU app from TestFlight or the App Store to use this feature.`
    );
  }
  return `${featureLabel} is not available in this version of the app. Try updating from the App Store, or contact support if the problem continues.`;
}
