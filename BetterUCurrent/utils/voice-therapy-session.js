import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  FlatList,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
// Conditionally import LiveKit
let Room, RoomEvent, RemoteParticipant, Track;
try {
  const livekit = require('livekit-client');
  Room = livekit.Room;
  RoomEvent = livekit.RoomEvent;
  RemoteParticipant = livekit.RemoteParticipant;
  Track = livekit.Track;
} catch (error) {
  console.log('LiveKit not available - using demo mode');
  Room = class {};
  RoomEvent = {};
  RemoteParticipant = class {};
  Track = { Source: { Microphone: 'microphone' } };
}
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import {
  getLiveKitToken,
  connectToRoom,
  setupAudio,
  disconnectFromRoom,
  generateRoomName,
  getAudioLevel,
} from '../lib/livekit';
import { Haptics } from 'expo-haptics';
import Constants from 'expo-constants';

// Check if we're in Expo Go (which doesn't support LiveKit native modules)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

const VoiceTherapySession = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { userProfile } = useUser();
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'voice-therapy-session.js:49',message:'VoiceTherapySession component initialized',data:{hasUser:!!user,hasUserProfile:!!userProfile,isExpoGo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, []);
  // #endregion
  const [room, setRoom] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(isExpoGo);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [error, setError] = useState(null);
  const [therapistParticipant, setTherapistParticipant] = useState(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isTherapistSpeaking, setIsTherapistSpeaking] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [messages, setMessages] = useState([]); // Store chat messages
  const [currentUserText, setCurrentUserText] = useState(''); // Current user speech being transcribed
  const [currentTherapistText, setCurrentTherapistText] = useState(''); // Current therapist speech being transcribed
  const sessionStartTime = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const audioLevelAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current; // For ripple effect
  const iconScale = useRef(new Animated.Value(1)).current; // For start screen icon animation
  const chatListRef = useRef(null); // Reference for scrolling chat

  // Pulse animation for speaking indicator
  // This creates a pulsing effect on the audio icons when someone is speaking
  // The animation scales the icons from 1.0 to 1.2 (20% larger) and back in a loop
  // This provides visual feedback that audio is being detected (listening) or played (speaking)
  useEffect(() => {
    if (isUserSpeaking || isTherapistSpeaking) {
      // Start a continuous loop animation when someone is speaking
      // Animated.loop repeats the sequence indefinitely
      // Animated.sequence runs animations one after another
      Animated.loop(
        Animated.sequence([
          // Scale up to 1.2 (20% larger) over 800ms
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true, // Uses native driver for better performance
          }),
          // Scale back down to 1.0 (normal size) over 800ms
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 500,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      // Reset animation to normal size when no one is speaking
      pulseAnim.setValue(1);
    }
  }, [isUserSpeaking, isTherapistSpeaking]);

  // Session timer
  useEffect(() => {
    if (isConnected && sessionStartTime.current) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime.current) / 1000);
        setSessionDuration(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Track when speaking starts/stops to capture messages
  // This helps identify when to save transcribed text as a message
  // When someone stops speaking, their accumulated text is saved as a message
  useEffect(() => {
    // When user stops speaking, save their text as a message
    if (!isUserSpeaking && currentUserText.trim()) {
      addMessage(currentUserText, 'user');
      setCurrentUserText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserSpeaking, currentUserText]);

  useEffect(() => {
    // When therapist stops speaking, save their text as a message
    if (!isTherapistSpeaking && currentTherapistText.trim()) {
      addMessage(currentTherapistText, 'therapist');
      setCurrentTherapistText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTherapistSpeaking, currentTherapistText]);

  // Helper function to update text from speech-to-text
  // This should be called when you receive transcribed text from:
  // - LiveKit data tracks
  // - Speech-to-text services
  // - Real-time transcription APIs
  const updateTranscribedText = (text, sender) => {
    if (sender === 'user') {
      setCurrentUserText(prev => prev + ' ' + text);
    } else if (sender === 'therapist') {
      setCurrentTherapistText(prev => prev + ' ' + text);
    }
  };

  // Connect to LiveKit room
  // This function establishes a connection to LiveKit for voice therapy
  // Connection flow:
  // 1. Generate unique room name: therapy-{userId}-{timestamp}
  // 2. Request access token from Supabase Edge Function (generate-livekit-token)
  // 3. Connect to LiveKit room using the token
  // 4. Setup audio (microphone and speaker)
  // 5. Wait for Python agent to auto-join the room
  // 6. The agent identity should include: "Alex-1a47", "agent", "Eleos", or "therapist"
  // 7. Monitor speaking status and update UI indicators
  const connectToSession = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'voice-therapy-session.js:175',message:'connectToSession called',data:{hasUser:!!user,userId:user?.id,hasUserProfile:!!userProfile},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!user) {
      Alert.alert('Error', 'Please log in to start a voice therapy session');
      return;
    }

    // Expo Go ("storeClient") does not ship the native WebRTC binary — LiveKit cannot work there.
    if (isExpoGo) {
      Alert.alert(
        'Development build required',
        'Voice therapy uses native WebRTC, which is not included in Expo Go. Install the app with npx expo run:android or npx expo run:ios (or an EAS development build), then try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Generate room name
      const roomName = generateRoomName(user.id);
      const participantName = userProfile?.full_name || userProfile?.username || `user-${user.id}`;

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'voice-therapy-session.js:192',message:'About to call getLiveKitToken',data:{roomName,participantName,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Get access token
      const token = await getLiveKitToken(roomName, participantName, user.id);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'voice-therapy-session.js:196',message:'getLiveKitToken succeeded',data:{hasToken:!!token,tokenLength:token?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Connect to room
      const newRoom = await connectToRoom(roomName, token, {
        adaptiveStream: true,
        dynacast: true,
      });

      // Setup audio
      await setupAudio(newRoom, isMicEnabled, isSpeakerEnabled);

      // Setup event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log('Connected to room');
        setIsConnected(true);
        setIsConnecting(false);
        sessionStartTime.current = Date.now();
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
          console.log('Haptics not available');
        }
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from room');
        setIsConnected(false);
        setRoom(null);
        setTherapistParticipant(null);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity);
        // Check if this is the therapist agent (can be remote participant)
        // The Python agent should have an identity that includes one of these identifiers
        if (participant instanceof RemoteParticipant) {
          const identity = participant.identity.toLowerCase();
          // Check for various agent identifier patterns
          // The agent identity should match: Alex-1a47, agent, eleos, or therapist
          if (identity.includes('alex-1a47') || 
              identity.includes('agent') ||
              identity.includes('eleos') ||
              identity.includes('therapist')) {
            console.log('Therapist agent detected:', participant.identity);
            setTherapistParticipant(participant);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              console.log('Haptics not available');
            }
          }
        }
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('Participant disconnected:', participant.identity);
        if (participant === therapistParticipant) {
          setTherapistParticipant(null);
        }
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('Track subscribed:', track.kind, participant.identity);
        if (track.kind === 'audio' && participant instanceof RemoteParticipant) {
          // Audio tracks are automatically handled by LiveKit
          // No need to manually attach for React Native
        }
        
        // Listen for data tracks (transcribed text messages)
        // The agent can send transcribed text via data tracks
        // This receives real-time transcription from the LiveKit agent
        if (track.kind === 'data' && track instanceof Track) {
          track.on('data', (data) => {
            try {
              const messageData = JSON.parse(data);
              if (messageData.text && messageData.sender) {
                // If it's a complete message, add it directly
                if (messageData.complete) {
                  addMessage(messageData.text, messageData.sender);
                } else {
                  // If it's partial text (streaming), update the current text
                  updateTranscribedText(messageData.text, messageData.sender);
                }
              }
            } catch (e) {
              // If not JSON, treat as plain text
              if (typeof data === 'string' && data.trim()) {
                const sender = participant instanceof RemoteParticipant ? 'therapist' : 'user';
                // Try to determine if it's complete or partial
                // For now, treat as partial and update transcribed text
                updateTranscribedText(data, sender);
              }
            }
          });
        }
      });

      // Monitor speaking status
      // This interval checks every 100ms to detect when someone is speaking
      // It updates the visual indicators (pulsing icons) based on audio activity
      const checkSpeakingStatus = setInterval(() => {
        if (newRoom.localParticipant) {
          // Check if the user (local participant) is currently speaking
          setIsUserSpeaking(newRoom.localParticipant.isSpeaking);
          // Get audio level for potential visualization (currently not displayed but available)
          const audioLevel = getAudioLevel(newRoom.localParticipant);
          audioLevelAnim.setValue(audioLevel);
        }

        // Check all remote participants for therapist speaking status
        // The agent should be identified by its identity containing agent identifiers
        newRoom.remoteParticipants.forEach((participant) => {
          const identity = participant.identity.toLowerCase();
          if (identity.includes('alex-1a47') || 
              identity.includes('agent') ||
              identity.includes('eleos') ||
              identity.includes('therapist')) {
            // Update therapist speaking status - this triggers the pulsing animation
            setIsTherapistSpeaking(participant.isSpeaking);
          }
        });
      }, 100);

      setRoom(newRoom);

      // Cleanup interval on disconnect
      newRoom.on(RoomEvent.Disconnected, () => {
        clearInterval(checkSpeakingStatus);
      });
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'voice-therapy-session.js:322',message:'Error in connectToSession',data:{errorMessage:err?.message,errorName:err?.name,errorStack:err?.stack?.substring(0,500),errorStatus:err?.status,errorStatusText:err?.statusText,errorContext:err?.context,fullError:JSON.stringify(err,Object.getOwnPropertyNames(err),2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
      console.error('Error connecting to session:', err);
      setError(err.message || 'Failed to connect to therapy session');
      setIsConnecting(false);
      Alert.alert('Connection Error', err.message || 'Failed to connect. Please try again.');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (e) {
        console.log('Haptics not available');
      }
    }
  };

  // Disconnect from session
  const disconnectFromSession = async () => {
    try {
      if (room) {
        await disconnectFromRoom(room);
        setRoom(null);
        setIsConnected(false);
        setTherapistParticipant(null);
        sessionStartTime.current = null;
        setSessionDuration(0);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {
          console.log('Haptics not available');
        }
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  // Toggle microphone
  const toggleMicrophone = async () => {
    if (!room) return;

    try {
      const newState = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(newState);
      setIsMicEnabled(newState);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.log('Haptics not available');
      }
    } catch (err) {
      console.error('Error toggling microphone:', err);
      Alert.alert('Error', 'Failed to toggle microphone');
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add a message to the chat
  // This function stores messages from both the user and therapist
  // Messages are displayed in chronological order in the chat UI
  const addMessage = (text, sender) => {
    if (!text || !text.trim()) return; // Don't add empty messages
    
    const newMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      sender: sender, // 'user' or 'therapist'
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Auto-scroll to bottom when new message is added
    setTimeout(() => {
      chatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Get the latest text from either speaker
  // This is useful for displaying what's currently being said
  // Returns the most recent text from the active speaker
  const getCurrentText = () => {
    if (isTherapistSpeaking && currentTherapistText) {
      return { text: currentTherapistText, sender: 'therapist' };
    } else if (isUserSpeaking && currentUserText) {
      return { text: currentUserText, sender: 'user' };
    }
    return null;
  };

  // Render a chat message in the FlatList
  // This displays messages from both user and therapist in a chat format
  // User messages appear on the right, therapist messages on the left
  const renderMessage = ({ item }) => (
    <View style={[
      styles.chatMessage,
      item.sender === 'user' ? styles.userChatMessage : styles.therapistChatMessage
    ]}>
      {item.sender === 'therapist' && (
        <View style={styles.chatAvatarContainer}>
          <LinearGradient
            colors={['#8b5cf6', '#a855f7']}
            style={styles.chatAvatar}
          >
            <Ionicons name="headset" size={16} color="#fff" />
          </LinearGradient>
        </View>
      )}
      <View style={[
        styles.chatMessageContent,
        item.sender === 'user' ? styles.userChatMessageContent : styles.therapistChatMessageContent
      ]}>
        <Text style={[
          styles.chatMessageText,
          item.sender === 'user' ? styles.userChatMessageText : styles.therapistChatMessageText
        ]}>
          {item.text}
        </Text>
      </View>
      {item.sender === 'user' && (
        <View style={styles.chatAvatarContainer}>
          <LinearGradient
            colors={['rgba(0, 255, 255, 0.3)', 'rgba(0, 255, 255, 0.1)']}
            style={styles.chatAvatar}
          >
            <Ionicons name="person" size={16} color="#00ffff" />
          </LinearGradient>
        </View>
      )}
    </View>
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        disconnectFromSession();
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#1a1a1a']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {
                console.log('Haptics not available');
              }
              if (isConnected) {
                Alert.alert(
                  'End Session',
                  'Are you sure you want to end the therapy session?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'End Session',
                      style: 'destructive',
                      onPress: async () => {
                        await disconnectFromSession();
                        router.back();
                      },
                    },
                  ]
                );
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Voice Therapy</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {!isConnected && !isConnecting && (
            <View style={styles.startSection}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  { transform: [{ scale: iconScale }] }
                ]}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#a855f7']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="mic" size={64} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.title}>Eleos Voice Therapy</Text>
              <Text style={styles.subtitle}>
                Connect with Eleos for a real-time voice therapy session. Speak naturally and receive
                empathetic support and guidance.
              </Text>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.startButton}
                onPress={connectToSession}
                disabled={isConnecting}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#a855f7']}
                  style={styles.startButtonGradient}
                >
                  <Ionicons name="play" size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.startButtonText}>Start Session</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {isConnecting && (
            <View style={styles.connectingSection}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient
                  colors={['#8b5cf6', '#a855f7']}
                  style={styles.connectingIcon}
                >
                  <Ionicons name="headset" size={48} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 20 }} />
              <Text style={styles.connectingText}>Connecting to Eleos...</Text>
              <Text style={styles.connectingSubtext}>Please wait a moment</Text>
            </View>
          )}

          {isConnected && (
            <ScrollView 
              style={styles.sessionScrollView}
              contentContainerStyle={styles.sessionScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sessionSection}>
                {/* Therapist Avatar/Indicator */}
                <View style={styles.therapistContainer}>
                  <Animated.View
                    style={[
                      {
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  >
                    {/* Ripple effect rings */}
                    {isTherapistSpeaking && (
                      <>
                        <Animated.View
                          style={[
                            styles.rippleRing,
                            {
                              opacity: rippleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.6, 0],
                              }),
                              transform: [
                                {
                                  scale: rippleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 2],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                        <Animated.View
                          style={[
                            styles.rippleRing,
                            {
                              opacity: rippleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.4, 0],
                              }),
                              transform: [
                                {
                                  scale: rippleAnim.interpolate({
                                    inputRange: [0, 0.5, 1],
                                    outputRange: [1, 1.5, 2],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </>
                    )}
                    <LinearGradient
                      colors={
                        isTherapistSpeaking
                          ? ['#8b5cf6', '#a855f7']
                          : ['rgba(139, 92, 246, 0.3)', 'rgba(168, 85, 247, 0.3)']
                      }
                      style={styles.therapistAvatar}
                    >
                      <Ionicons name="headset" size={48} color="#fff" />
                    </LinearGradient>
                  </Animated.View>
                  {isTherapistSpeaking && (
                    <View style={styles.speakingIndicator}>
                      <Text style={styles.speakingText}>Eleos is speaking...</Text>
                    </View>
                  )}
                </View>

              {/* User Speaking Indicator */}
              {isUserSpeaking && (
                <Animated.View
                  style={[
                    styles.userSpeakingContainer,
                    {
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(0, 255, 255, 0.3)', 'rgba(0, 255, 255, 0.1)']}
                    style={styles.userSpeakingIndicator}
                  >
                    <Ionicons name="mic" size={24} color="#00ffff" />
                    <Text style={styles.userSpeakingText}>You're speaking</Text>
                  </LinearGradient>
                </Animated.View>
              )}

              {/* Session Info Card */}
              <View style={styles.sessionInfoCard}>
                <Text style={styles.sessionDuration}>{formatTime(sessionDuration)}</Text>
                <View style={styles.statusContainer}>
                  <View style={[
                    styles.statusDot,
                    therapistParticipant ? styles.statusDotConnected : styles.statusDotWaiting
                  ]} />
                  <Text style={styles.sessionStatus}>
                    {therapistParticipant ? 'Connected to Eleos' : 'Waiting for Eleos...'}
                  </Text>
                </View>
                {!therapistParticipant && isConnected && (
                  <Text style={styles.statusHint}>
                    The AI therapist will join automatically. This may take a few moments.
                  </Text>
                )}
              </View>

              {/* Chat Messages */}
              <BlurView intensity={40} tint="dark" style={styles.chatContainer}>
                <Text style={styles.chatTitle}>Conversation</Text>
                <FlatList
                  ref={chatListRef}
                  data={messages}
                  renderItem={renderMessage}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.chatList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyChatContainer}>
                      <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                      <Text style={styles.emptyChatTitle}>No messages yet</Text>
                      <Text style={styles.emptyChatText}>
                        Your conversation with Eleos will appear here as you speak
                      </Text>
                    </View>
                  }
                />
                {/* Show current speaking text if available */}
                {getCurrentText() && (
                  <View style={[
                    styles.chatMessage,
                    getCurrentText().sender === 'user' ? styles.userChatMessage : styles.therapistChatMessage,
                    styles.currentSpeakingMessage
                  ]}>
                    {getCurrentText().sender === 'therapist' && (
                      <View style={styles.chatAvatarContainer}>
                        <LinearGradient
                          colors={['#8b5cf6', '#a855f7']}
                          style={styles.chatAvatar}
                        >
                          <Ionicons name="headset" size={16} color="#fff" />
                        </LinearGradient>
                      </View>
                    )}
                    <View style={[
                      styles.chatMessageContent,
                      getCurrentText().sender === 'user' ? styles.userChatMessageContent : styles.therapistChatMessageContent
                    ]}>
                      <Text style={[
                        styles.chatMessageText,
                        getCurrentText().sender === 'user' ? styles.userChatMessageText : styles.therapistChatMessageText
                      ]}>
                        {getCurrentText().text}
                      </Text>
                    </View>
                    {getCurrentText().sender === 'user' && (
                      <View style={styles.chatAvatarContainer}>
                        <LinearGradient
                          colors={['rgba(0, 255, 255, 0.3)', 'rgba(0, 255, 255, 0.1)']}
                          style={styles.chatAvatar}
                        >
                          <Ionicons name="person" size={16} color="#00ffff" />
                        </LinearGradient>
                      </View>
                    )}
                  </View>
                )}
              </BlurView>

              {/* Controls */}
              <View style={styles.controls}>
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    !isMicEnabled && styles.controlButtonDisabled,
                  ]}
                  onPress={toggleMicrophone}
                >
                  <LinearGradient
                    colors={
                      isMicEnabled
                        ? ['rgba(0, 255, 255, 0.2)', 'rgba(0, 255, 255, 0.1)']
                        : ['rgba(255, 0, 0, 0.2)', 'rgba(255, 0, 0, 0.1)']
                    }
                    style={styles.controlButtonGradient}
                  >
                    <Ionicons
                      name={isMicEnabled ? 'mic' : 'mic-off'}
                      size={28}
                      color={isMicEnabled ? '#00ffff' : '#ff4444'}
                    />
                  </LinearGradient>
                  <Text style={styles.controlButtonText}>
                    {isMicEnabled ? 'Mic On' : 'Mic Off'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.endButton}
                  onPress={async () => {
                    Alert.alert(
                      'End Session',
                      'Are you sure you want to end the therapy session?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'End Session',
                          style: 'destructive',
                          onPress: async () => {
                            await disconnectFromSession();
                            router.back();
                          },
                        },
                      ]
                    );
                  }}
                >
                  <LinearGradient
                    colors={['#ff4444', '#cc0000']}
                    style={styles.endButtonGradient}
                  >
                    <Ionicons name="stop" size={24} color="#fff" />
                    <Text style={styles.endButtonText}>End Session</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              </View>
            </ScrollView>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  startSection: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 30,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#ff4444',
    textAlign: 'center',
  },
  startButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 300,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  connectingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  connectingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  connectingSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  sessionScrollView: {
    flex: 1,
    width: '100%',
  },
  sessionScrollContent: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  sessionSection: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
  },
  therapistContainer: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
    width: 150,
    height: 150,
    justifyContent: 'center',
  },
  therapistAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  speakingIndicator: {
    marginTop: 12,
  },
  speakingText: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '600',
  },
  userSpeakingContainer: {
    marginBottom: 20,
  },
  userSpeakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  userSpeakingText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sessionInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  rippleRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    top: 0,
    left: 0,
    alignSelf: 'center',
  },
  connectingIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  sessionDuration: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotConnected: {
    backgroundColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusDotWaiting: {
    backgroundColor: '#ffaa00',
    shadowColor: '#ffaa00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  sessionStatus: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  statusHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  controls: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  controlButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    

  },
  controlButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  endButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 8,
  },
  endButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatContainer: {
    width: '100%',
    maxHeight: 250,
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatList: {
    paddingBottom: 10,
    maxHeight: 200,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  chatMessage: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userChatMessage: {
    justifyContent: 'flex-end',
  },
  therapistChatMessage: {
    justifyContent: 'flex-start',
  },
  chatAvatarContainer: {
    marginHorizontal: 8,
  },
  chatAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatMessageContent: {
    maxWidth: '75%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userChatMessageContent: {
    backgroundColor: 'rgba(0, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.4)',
  },
  therapistChatMessageContent: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  chatMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userChatMessageText: {
    color: '#00ffff',
  },
  therapistChatMessageText: {
    color: '#fff',
  },
  currentSpeakingMessage: {
    opacity: 0.7,
  },
  emptyChatContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyChatTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyChatText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceTherapySession;

