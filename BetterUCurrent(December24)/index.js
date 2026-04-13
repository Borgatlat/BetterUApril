// Register LiveKit WebRTC globals so livekit-client can use native WebRTC (RTCPeerConnection, etc.).
// Required before any Room.connect() on native (iOS/Android). On web we skip because the browser
// provides WebRTC. Try/catch so the app still loads if the native module isn't linked (e.g. Expo Go).
import { Platform } from 'react-native';

function registerLiveKitGlobals() {
  try {
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
  } catch (e) {
    if (Platform.OS !== 'web') {
      console.warn(
        "[LiveKit] registerGlobals failed. Voice therapy will not work until you use a dev build with native WebRTC.",
        e?.message
      );
      console.warn(
        "Fix: not Expo Go — run npx expo prebuild --clean, then npx expo run:android (or on Mac: cd ios && pod install && npx expo run:ios)."
      );
    }
    return;
  }
  // Verify globals actually exist (registerGlobals can appear to run but WebRTC native module may be missing, e.g. Expo Go).
  if (Platform.OS !== 'web' && typeof global.RTCPeerConnection !== 'function') {
    console.warn(
      "[LiveKit] RTCPeerConnection is still missing after registerGlobals. Use a development build, not Expo Go."
    );
  }
}

// Run immediately so globals are set before any screen or LiveKit code loads.
if (Platform.OS !== 'web') {
  registerLiveKitGlobals();
}

import 'expo-router/entry'; 