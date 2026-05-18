/**
 * Native (iOS/Android) export for maps.
 * Re-exports react-native-maps. When building for web, Metro/Expo resolves MapView.web.js
 * instead, so the native-only module is never loaded in the web bundle.
 */
import { Platform } from 'react-native';
import Maps, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Pick a map provider that won't crash when Google Maps isn't configured.
 * iOS: Apple Maps (omit provider). Android: Google only when an API key is present.
 */
export function getMapProvider() {
  if (Platform.OS === 'ios') {
    return undefined;
  }
  const hasGoogleKey = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  );
  return hasGoogleKey ? PROVIDER_GOOGLE : undefined;
}

export default Maps;
export { Polyline, Marker, PROVIDER_GOOGLE };
