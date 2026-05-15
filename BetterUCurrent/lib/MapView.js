/**
 * Native (iOS/Android) export for maps.
 * Re-exports react-native-maps. When building for web, Metro/Expo resolves MapView.web.js
 * instead, so the native-only module is never loaded in the web bundle.
 */
// Default export is the MapView component; named exports are Polyline, Marker, PROVIDER_GOOGLE
export { default, Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
