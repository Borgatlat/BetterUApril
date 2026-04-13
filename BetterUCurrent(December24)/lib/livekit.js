import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
    throw new Error(
      'Voice therapy needs WebRTC in your app binary. Expo Go cannot load native WebRTC.\n\n' +
        'Use a development build: npx expo prebuild --clean, then npx expo run:android (Windows/Android) ' +
        'or on a Mac: cd ios && pod install && npx expo run:ios. Rebuild after installing LiveKit packages.'
    );
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
    // #region agent log
    console.log('🔍 [DEBUG] getLiveKitToken called with:', { roomName, participantName, userId });
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:52',message:'getLiveKitToken called',data:{roomName,participantName,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    // #region agent log
    console.log('🔍 [DEBUG] Session check:', { hasSession: !!session, userId: session?.user?.id });
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:60',message:'Session check',data:{hasSession:!!session,userId:session?.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!session) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:58',message:'Auth error - no session',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw new Error('User not authenticated');
    }

    const requestBody = {
      roomName,
      participantName: participantName || `user-${userId}`,
      userId: userId || session.user.id,
    };
    
    // #region agent log
    console.log('🔍 [DEBUG] Invoking edge function with request body:', JSON.stringify(requestBody, null, 2));
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:76',message:'Invoking edge function',data:{requestBody,edgeFunction:'generate-livekit-token'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    const { data, error } = await supabase.functions.invoke('generate-livekit-token', {
      body: requestBody,
    });

    // #region agent log
    console.log('🔍 [DEBUG] Edge function response:', { hasData: !!data, hasError: !!error, error: error ? JSON.stringify(error, null, 2) : null, data: data ? JSON.stringify(data, null, 2) : null });
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:85',message:'Edge function response',data:{hasData:!!data,hasError:!!error,errorMessage:error?.message,errorName:error?.name,errorStatus:error?.status,errorContext:error?.context,errorDetails:JSON.stringify(error),dataKeys:data?Object.keys(data):null,dataContent:data?JSON.stringify(data):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion

    if (error) {
      // #region agent log
      console.error('❌ [DEBUG] Edge function error details:', {
        message: error.message,
        name: error.name,
        status: error.status,
        statusText: error.statusText,
        context: error.context,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      });
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:93',message:'Error from edge function',data:{errorMessage:error.message,errorName:error.name,errorStatus:error.status,errorStatusText:error.statusText,errorContext:error.context,fullError:JSON.stringify(error,Object.getOwnPropertyNames(error),2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
      
      // Extract status code from error context (Supabase wraps the HTTP response)
      const statusCode = error.context?.status || error.status || 'unknown';
      
      // Provide user-friendly error messages based on status code
      if (statusCode === 404) {
        throw new Error('Voice therapy service not available. Please ensure the edge function "generate-livekit-token" is deployed to your Supabase project. Run: supabase functions deploy generate-livekit-token');
      } else if (statusCode === 401) {
        throw new Error('Authentication failed. Please log out and log back in.');
      } else if (statusCode === 500) {
        const errorDetails = error.context?.error || error.context?.message || error.message || 'Server error';
        throw new Error(`Voice therapy service error: ${errorDetails}`);
      } else {
        // Try to extract more details from error context
        const errorDetails = error.context?.error || error.context?.message || error.message || 'Failed to generate token';
        throw new Error(`Edge Function error (${statusCode}): ${errorDetails}`);
      }
    }

    if (!data || !data.token) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:78',message:'Invalid response - no token',data:{hasData:!!data,dataContent:data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      throw new Error('Invalid response from token generation service');
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:82',message:'Token received successfully',data:{hasToken:!!data.token,tokenLength:data.token?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return data.token;
  } catch (error) {
    // #region agent log
    console.error('❌ [DEBUG] Exception in getLiveKitToken:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    });
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'livekit.js:112',message:'Exception caught',data:{errorMessage:error.message,errorStack:error.stack,errorName:error.name,fullError:JSON.stringify(error,Object.getOwnPropertyNames(error),2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion
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

