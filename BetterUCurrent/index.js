// Register LiveKit WebRTC globals so livekit-client can use native WebRTC (RTCPeerConnection, etc.).
// Required before any Room.connect() on native (iOS/Android). On web we skip because the browser
// provides WebRTC. Try/catch so the app still loads if the native module isn't linked (e.g. Expo Go).
import { Platform } from 'react-native';
import { isExpoGo } from './lib/runtimeEnvironment';

function registerLiveKitGlobals() {
  try {
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
  } catch (e) {
    if (Platform.OS !== 'web' && isExpoGo()) {
      console.warn('[LiveKit] registerGlobals failed in Expo Go (expected):', e?.message);
    } else if (Platform.OS !== 'web') {
      console.warn('[LiveKit] registerGlobals failed:', e?.message);
    }
    return;
  }
  if (Platform.OS !== 'web' && typeof global.RTCPeerConnection !== 'function' && isExpoGo()) {
    console.warn('[LiveKit] RTCPeerConnection missing in Expo Go (expected).');
  }
}

// Run immediately so globals are set before any screen or LiveKit code loads.
if (Platform.OS !== 'web') {
  registerLiveKitGlobals();
}

import 'expo-router/entry'; 