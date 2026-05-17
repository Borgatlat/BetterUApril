import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { nativeFeatureUnavailableMessage } from './runtimeEnvironment';

/**
 * Ensures WebRTC globals (RTCPeerConnection, etc.) are registered for React Native.
 * Must run before Room.connect() or livekit-client throws "WebRTC isn't detected, have you called registerGlobals?"
 * That error really means: RTCPeerConnection is missing on global — usually Expo Go or an app binary built without native WebRTC.
 */
let _globalsRegistered = false;

/** livekit-client treats the app as "supported" only if RTCPeerConnection exists and has addTransceiver or addTrack. */
function isNativeWebRTCReady() {
  const PC = global.RTCPeerConnection;
  if (typeof PC !== 'function') return false;
  const proto = PC.prototype;
  return 'addTransceiver' in proto || 'addTrack' in proto;
}

function ensureWebRTCGlobals() {
  if (Platform.OS === 'web') return;
  if (_globalsRegistered && isNativeWebRTCReady()) return;

  try {
    // registerGlobals() patches global.navigator.mediaDevices and assigns global.RTCPeerConnection from @livekit/react-native-webrtc
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
  } catch (e) {
    console.warn('[LiveKit] registerGlobals failed:', e?.message);
  }

  if (!isNativeWebRTCReady()) {
    throw new Error(nativeFeatureUnavailableMessage('Voice therapy'));
  }
  _globalsRegistered = true;
}

// Conditionally import LiveKit - will fail gracefully if native modules aren't available
let Room, RoomEvent, RemoteParticipant, LocalParticipant, Track;
try {
  const livekit = require('livekit-client');
  Room = livekit.Room;
  RoomEvent = livekit.RoomEvent;
  RemoteParticipant = livekit.RemoteParticipant;
  LocalParticipant = livekit.LocalParticipant;
  Track = livekit.Track;
} catch (error) {
  console.log('LiveKit native modules not available - voice therapy will use demo mode');
  // Create mock classes for demo mode
  Room = class {};
  RoomEvent = {};
  RemoteParticipant = class {};
  LocalParticipant = class {};
  Track = { Source: { Microphone: 'microphone' } };
}

// Get LiveKit configuration from environment
const getLiveKitConfig = () => {
  const url = Constants.expoConfig?.extra?.livekitUrl || 
              process.env.EXPO_PUBLIC_LIVEKIT_URL || 
              '';
  
  return {
    url: url,
  };
};

/**
 * Generate a unique room name for the user's therapy session
 */
export const generateRoomName = (userId) => {
  return `therapy-${userId}-${Date.now()}`;
};

/**
 * Get LiveKit server URL
 */
export const getLiveKitUrl = () => {
  const config = getLiveKitConfig();
  return config.url;
};

/**
 * Request a LiveKit access token from Supabase Edge Function
 */
export const getLiveKitToken = async (roomName, participantName, userId) => {
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const requestBody = {
      roomName,
      participantName: participantName || `user-${userId}`,
      userId: userId || session.user.id,
    };

    const { data, error } = await supabase.functions.invoke('generate-livekit-token', {
      body: requestBody,
    });

    if (error) {
      const statusCode = error.context?.status || error.status || 'unknown';

      if (statusCode === 404) {
        throw new Error(
          'Voice therapy is temporarily unavailable. Please try again later or contact support.'
        );
      }
      if (statusCode === 401) {
        throw new Error('Authentication failed. Please log out and log back in.');
      }
      if (statusCode === 500) {
        const errorDetails = error.context?.error || error.context?.message || error.message || 'Server error';
        throw new Error(`Voice therapy service error: ${errorDetails}`);
      }
      const errorDetails = error.context?.error || error.context?.message || error.message || 'Failed to generate token';
      throw new Error(`Voice therapy error (${statusCode}): ${errorDetails}`);
    }

    if (!data?.token) {
      throw new Error('Invalid response from token generation service');
    }

    return data.token;
  } catch (error) {
    console.error('Error getting LiveKit token:', error);
    throw error;
  }
};

/**
 * Connect to a LiveKit room
 */
export const connectToRoom = async (roomName, token, options = {}) => {
  // Ensure native WebRTC globals are registered before connect (fixes "WebRTC isn't detected" on native)
  ensureWebRTCGlobals();

  const room = new Room(options);
  const url = getLiveKitUrl();
  
  if (!url) {
    throw new Error('LiveKit URL not configured');
  }

  try {
    await room.connect(url, token);
    return room;
  } catch (error) {
    console.error('Error connecting to room:', error);
    throw error;
  }
};

/**
 * Setup audio for the room
 */
export const setupAudio = async (room, enableMic = true, enableSpeaker = true) => {
  try {
    // Enable microphone
    if (enableMic) {
      await room.localParticipant.setMicrophoneEnabled(true);
    }

    // Enable speaker (audio output)
    if (enableSpeaker) {
      await room.localParticipant.setCameraEnabled(false); // We only need audio
    }

    return true;
  } catch (error) {
    console.error('Error setting up audio:', error);
    throw error;
  }
};

/**
 * Cleanup room connection
 */
export const disconnectFromRoom = async (room) => {
  if (room) {
    try {
      room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
    } catch (error) {
      console.error('Error disconnecting from room:', error);
    }
  }
};

/**
 * Check if participant is speaking
 */
export const isParticipantSpeaking = (participant) => {
  return participant.isSpeaking;
};

/**
 * Get audio level for visualization
 */
export const getAudioLevel = (participant) => {
  try {
    if (participant instanceof LocalParticipant) {
      const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
      return audioTrack?.track?.audioLevel || 0;
    } else if (participant instanceof RemoteParticipant) {
      const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
      return audioTrack?.track?.audioLevel || 0;
    }
  } catch (error) {
    console.log('Error getting audio level:', error);
  }
  return 0;
};

