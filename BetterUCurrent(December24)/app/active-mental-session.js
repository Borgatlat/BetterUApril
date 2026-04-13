"use client";

import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';
import { supabase } from '../lib/supabase';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import PremiumFeature from './components/PremiumFeature';
import { useUser } from '../context/UserContext';
// Live Activities - shows session progress on lock screen
import { 
  startMentalLiveActivity, 
  updateMentalLiveActivity, 
  endMentalLiveActivity, 
  dismissLiveActivity 
} from '../utils/liveActivities';

const ActiveMentalSession = () => {
  const router = useRouter();
  const { incrementStat } = useTracking();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [timeLeft, setTimeLeft] = useState(params.duration * 60);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const currentStepIndexRef = useRef(0);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const soundRef = useRef(null);
  const { isPremium } = useUser();
  
  // Track actual time spent in session
  const sessionStartTime = useRef(null); // Timestamp when user started the session
  const totalPausedTime = useRef(0); // Total time paused in milliseconds
  const pauseStartTime = useRef(null); // Timestamp when user paused
  
  // Live Activity for mental session - shows time remaining on lock screen
  const [mentalLiveActivityId, setMentalLiveActivityId] = useState(null);

  const session = useMemo(() => ({
    id: params.id,
    title: params.title,
    duration: parseInt(params.duration),
    description: params.description,
    steps: (() => {
      try {
        const parsed = JSON.parse(params.steps);
        console.log('Parsed steps:', parsed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error('Error parsing steps:', error);
        console.log('Raw steps param:', params.steps);
        return [];
      }
    })(),
    session_type: params.type
  }), [params.id, params.title, params.duration, params.description, params.steps, params.type]);

  console.log('Session object:', session);

  // Map session.id to audio file
  const getAudioFile = () => {
    // Custom sessions (UUID format) have no audio files
    if (session.id && session.id.length > 20) {
      return null;
    }
    
    // Built-in sessions with audio files
    if (session.id === 'box-breathing') {
      return require('../assets/audio/box_breathing.mp3');
    } else if (session.id === '478-breathing') {
      return require('../assets/audio/478_breathing.mp3');
    } else if (session.id === 'body_scan' || session.id === 'body-scan') {
      return require('../assets/audio/body_scan_meditation.mp3');
    } else if (
      session.id === 'mindful_awareness' ||
      session.id === 'mindful-awareness' ||
      session.id === 'mindful-meditation'
    ) {
      return require('../assets/audio/mindful_awareness_meditation.mp3');
    } else if (
      session.id === 'progressive_relaxation' ||
      session.id === 'progressive-relaxation'
    ) {
      return require('../assets/audio/progressive_relaxation_meditation.mp3');
    } else if (
      session.id === 'visualization' ||
      session.id === 'peaceful_place' ||
      session.id === 'peaceful-place'
    ) {
      return require('../assets/audio/peaceful_place_meditation.mp3');
    }
    
    // All other sessions (including custom ones) have no audio
    return null;
  };

  // Load audio when session starts or session.id changes
  useEffect(() => {
    let isMounted = true;
    const loadAudio = async () => {
      try {
        // Unload any existing sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }
        // Only load audio for premium users
        if (!isPremium) {
          soundRef.current = null;
          if (isMounted) {
            setSound(null);
            setIsPlaying(false);
          }
          return;
        }
        const audioFile = getAudioFile();
        console.log('Audio file for session', session.id, audioFile ? 'FOUND' : 'NOT FOUND');
        if (audioFile) {
          // Configure audio session for iOS builds
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
          });
          
          const { sound: audioSound } = await Audio.Sound.createAsync(
            audioFile,
            { 
              shouldPlay: false, 
              volume: volume,
              progressUpdateIntervalMillis: 1000,
              positionMillis: 0,
              isLooping: false,
            }
          );
          
          // Set up audio status updates
          audioSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              console.log('Audio status:', status.positionMillis, status.durationMillis);
            }
          });
          
          await audioSound.setRateAsync(0.80, true);
          soundRef.current = audioSound;
          if (isMounted) {
            setSound(audioSound);
            setIsPlaying(false);
          }
        } else {
          soundRef.current = null;
          if (isMounted) {
            setSound(null);
            setIsPlaying(false);
          }
        }
      } catch (error) {
        console.error('Error loading audio:', error);
        console.error('Audio error details:', {
          sessionId: session.id,
          audioFile: getAudioFile(),
          isPremium: isPremium,
          errorMessage: error.message,
          errorCode: error.code
        });
        Alert.alert('Error', `Failed to load audio: ${error.message}`);
      }
    };
    loadAudio();
    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, isPremium]);

  // Play audio when session is activated
  useEffect(() => {
    if (!sound) {
      console.log('No sound loaded, skipping play/pause');
      return;
    }
    if (isActive && !isPlaying) {
      sound.playAsync();
      sound.setRateAsync(0.80, true);
      setIsPlaying(true);
    } else if (!isActive && isPlaying) {
      sound.pauseAsync();
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sound]);

  // Handle volume change
  const handleVolumeChange = async (value) => {
    setVolume(value);
    if (sound) {
      await sound.setVolumeAsync(value);
    }
  };

  // Handle mute toggle
  const toggleMute = async () => {
    if (sound) {
      if (isMuted) {
        await sound.setVolumeAsync(volume);
      } else {
        await sound.setVolumeAsync(0);
      }
      setIsMuted(!isMuted);
    }
  };

  // Track pause/resume separately to avoid useEffect dependency issues
  const previousIsActive = useRef(false);
  
  useEffect(() => {
    // Track when session starts (first time user presses play)
    if (isActive && !previousIsActive.current && !sessionStartTime.current) {
      sessionStartTime.current = Date.now();
      pauseStartTime.current = null;
      console.log('[Timer] Session started at:', sessionStartTime.current);
    }
    
    // Track pause/resume times
    if (!isActive && previousIsActive.current && sessionStartTime.current && !pauseStartTime.current) {
      // Just paused - record pause start time
      pauseStartTime.current = Date.now();
      console.log('[Timer] Session paused at:', pauseStartTime.current);
    } else if (isActive && !previousIsActive.current && pauseStartTime.current) {
      // Just resumed - add paused time to total
      const pausedDuration = Date.now() - pauseStartTime.current;
      totalPausedTime.current += pausedDuration;
      console.log('[Timer] Session resumed. Paused for:', pausedDuration, 'ms. Total paused:', totalPausedTime.current);
      pauseStartTime.current = null;
    }
    
    previousIsActive.current = isActive;
  }, [isActive]);
  
  useEffect(() => {
    let interval = null;
    console.log('Timer useEffect - isActive:', isActive, 'timeLeft:', timeLeft, 'session.duration:', session.duration);
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          const newTime = time - 1;
          console.log('Timer tick - newTime:', newTime);
          // Update progress animation
          Animated.timing(progressAnimation, {
            toValue: 1 - (newTime / (session.duration * 60)),
            duration: 1000,
            useNativeDriver: true
          }).start();
          return newTime;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      handleFinishSession();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // Start Live Activity when session becomes active
  useEffect(() => {
    const initLiveActivity = async () => {
      if (isActive && !mentalLiveActivityId) {
        // Start Live Activity on lock screen
        const currentStep = session.steps?.[currentStepIndex]?.title || 
                           session.steps?.[currentStepIndex]?.instruction || 
                           'Focus on your breath';
        
        const liveId = await startMentalLiveActivity({
          sessionType: session.session_type || 'meditation',
          sessionName: session.title,
          duration: timeLeft,
          currentStep: currentStep,
        });
        if (liveId) setMentalLiveActivityId(liveId);
      }
    };
    
    initLiveActivity();
    
    // Cleanup on unmount
    return () => {
      if (mentalLiveActivityId) {
        dismissLiveActivity(mentalLiveActivityId);
      }
    };
  }, [isActive]);

  // Update Live Activity as time ticks
  useEffect(() => {
    if (!mentalLiveActivityId || !isActive) return;
    
    const currentStep = session.steps?.[currentStepIndex]?.title || 
                       session.steps?.[currentStepIndex]?.instruction || 
                       'Focus on your breath';
    
    updateMentalLiveActivity(mentalLiveActivityId, {
      sessionType: session.session_type || 'meditation',
      sessionName: session.title,
      timeRemaining: timeLeft,
      totalDuration: session.duration * 60,
      currentStep: currentStep,
      isPaused: false,
    });
  }, [mentalLiveActivityId, isActive, timeLeft, currentStepIndex]);

  // Update ref when currentStepIndex changes
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // Function to transition to a specific step with animation
  const transitionToStep = (newIndex) => {
    if (newIndex < 0 || newIndex >= session.steps.length) return;
    if (newIndex === currentStepIndex) return; // Don't animate if same step
    
    // Fade out current step
    Animated.timing(fadeAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      // Update step index
      setCurrentStepIndex(newIndex);
      // Fade in new step
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    });
  };

  // Navigate to next step
  const goToNextStep = () => {
    const nextIndex = (currentStepIndex + 1) % session.steps.length;
    transitionToStep(nextIndex);
  };

  // Navigate to previous step
  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex === 0 
      ? session.steps.length - 1 
      : currentStepIndex - 1;
    transitionToStep(prevIndex);
  };

  // Rotate through steps automatically (only when active).
  // Daily Examen (St. Ignatius): 3 min total, 5 steps → 36 sec per step. Other sessions: 10 sec per step.
  const stepIntervalMs = (session.id === 'daily-examen' || session.session_type === 'examen')
    ? 36000
    : 10000;

  useEffect(() => {
    let stepInterval = null;
    console.log('Step rotation useEffect - isActive:', isActive, 'steps length:', session.steps?.length);
    
    if (isActive && session.steps && session.steps.length > 1) {
      console.log('Starting step rotation interval');
      stepInterval = setInterval(() => {
        const currentIndex = currentStepIndexRef.current;
        const nextIndex = (currentIndex + 1) % session.steps.length;
        console.log('Step rotation tick - current index:', currentIndex, 'next:', nextIndex);
        transitionToStep(nextIndex);
      }, stepIntervalMs);
    }
    return () => {
      if (stepInterval) {
        console.log('Clearing step rotation interval');
        clearInterval(stepInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, session.steps, stepIntervalMs]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate actual time spent in session
  // This function calculates the real time the user spent actively in the session
  // It accounts for pauses and early finishes
  const calculateActualDuration = () => {
    if (!sessionStartTime.current) {
      // Session never started (user never pressed play)
      // Return 0 - user should start the session to record time
      console.log('[Duration] Session never started - no start time recorded');
      return 0;
    }
    
    const now = Date.now();
    
    // If currently paused, use pause start time as end time
    // Otherwise use current time
    const endTime = pauseStartTime.current || now;
    
    // Calculate total elapsed time (from start to end) in milliseconds
    const totalElapsed = endTime - sessionStartTime.current;
    
    // Subtract total paused time to get actual active time
    const actualElapsed = totalElapsed - totalPausedTime.current;
    
    // Convert milliseconds to seconds first, then to minutes
    const actualSeconds = Math.floor(actualElapsed / 1000);
    const actualMinutes = Math.floor(actualSeconds / 60);
    
    console.log('[Duration] Calculation:', {
      startTime: sessionStartTime.current,
      endTime: endTime,
      totalElapsed: totalElapsed,
      totalPausedTime: totalPausedTime.current,
      actualElapsed: actualElapsed,
      actualSeconds: actualSeconds,
      actualMinutes: actualMinutes
    });
    
    // Return actual minutes - round up if 30+ seconds in the current minute
    // For example: 20 seconds = 0 minutes (rounds to 1), 90 seconds = 1 minute (rounds to 2)
    if (actualSeconds >= 30) {
      // Round up if 30+ seconds in the partial minute
      const roundedMinutes = actualMinutes + (actualSeconds % 60 >= 30 ? 1 : 0);
      console.log('[Duration] Final rounded minutes:', roundedMinutes, '(from', actualSeconds, 'seconds)');
      return Math.max(1, roundedMinutes);
    }
    
    // If less than 30 seconds but more than 0, still count as 1 minute (minimum)
    if (actualSeconds > 0) {
      console.log('[Duration] Less than 30 seconds, returning 1 minute minimum');
      return 1;
    }
    
    // Exactly 0 seconds - shouldn't happen if session started, but return 0
    console.log('[Duration] 0 seconds - session may not have been active');
    return 0;
  };

  // Save and go to summary
  const handleFinishSession = async () => {
    if (!user) {
      console.error('No user found');
      return;
    }

      setIsActive(false);

      // Calculate actual time spent in seconds first (most precise)
      let actualSeconds = 0;
      if (sessionStartTime.current) {
        const now = Date.now();
        const endTime = pauseStartTime.current || now;
        const totalElapsed = endTime - sessionStartTime.current;
        const actualElapsed = totalElapsed - totalPausedTime.current;
        actualSeconds = Math.floor(actualElapsed / 1000);
      }
      
      // Convert to minutes for database storage
      const actualDurationMinutes = Math.floor(actualSeconds / 60);
      const plannedDurationMinutes = session.duration;
      
      // For display: use actual seconds if available, otherwise use planned duration
      // For database: use actual minutes (rounded down), minimum 1 if they started
      const finalDurationMinutes = sessionStartTime.current 
        ? Math.max(1, actualDurationMinutes) // At least 1 minute if they started (for database)
        : plannedDurationMinutes; // Only use planned if they never started
      
      console.log('[Session Complete] ⏱️ Duration calculation:', {
        plannedDuration: plannedDurationMinutes,
        actualSeconds: actualSeconds,
        actualDurationMinutes: actualDurationMinutes,
        finalDurationMinutes: finalDurationMinutes,
        startTime: sessionStartTime.current ? new Date(sessionStartTime.current).toISOString() : 'NOT SET',
        totalPausedTime: totalPausedTime.current,
        sessionStarted: !!sessionStartTime.current
      });

      // End Live Activity with completion message
      if (mentalLiveActivityId) {
        await endMentalLiveActivity(mentalLiveActivityId, {
          sessionType: session.session_type || 'meditation',
          sessionName: session.title,
          duration: actualSeconds || (finalDurationMinutes * 60), // Use actual seconds if available
        });
        setMentalLiveActivityId(null);
      }

      // Navigate to summary with actual duration (both minutes and seconds)
      router.push({
        pathname: '/mental-session-summary',
        params: {
          sessionType: session.session_type || 'meditation',
          duration: finalDurationMinutes.toString(), // Pass duration in minutes (for database storage)
          durationSeconds: actualSeconds.toString(), // Pass actual seconds for precise display
          plannedDuration: plannedDurationMinutes.toString(), // Keep planned duration for reference
          sessionName: session.title,
          sessionDescription: session.description,
        },
      });
  };

  // Replay audio from the beginning
  const replayAudio = async () => {
    if (sound) {
      try {
        await sound.setPositionAsync(0);
        await sound.setRateAsync(0.80, true);
        await sound.playAsync();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error replaying audio:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => {
            if (isActive) {
              Alert.alert(
                'End Session',
                'Are you sure you want to end this session early?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'End Session', style: 'destructive', onPress: () => {
                    // Dismiss Live Activity if exiting early
                    if (mentalLiveActivityId) {
                      dismissLiveActivity(mentalLiveActivityId);
                    }
                    router.back();
                  }}
                ]
              );
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{session.title}</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Timer Circle */}
      <View style={styles.timerContainer}>
        <View style={styles.timerCircle}>
          <Animated.View 
            style={[
              styles.progressCircle,
              {
                transform: [{
                  rotateZ: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}
          />
          <View style={styles.timerContent}>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              {/* Timer play/pause button: free users can use timer, only premium gets audio */}
            <TouchableOpacity
              style={[styles.timerButton, isActive && styles.timerButtonActive]}
                onPress={() => {
                  const wasActive = isActive;
                  const willBeActive = !isActive;
                  console.log('[Timer] Button pressed - changing isActive from', wasActive, 'to', willBeActive);
                  
                  // Track start time when user first presses play
                  // This is the PRIMARY way we track session start - more reliable than useEffect
                  if (!wasActive && willBeActive && !sessionStartTime.current) {
                    sessionStartTime.current = Date.now();
                    totalPausedTime.current = 0; // Reset paused time
                    pauseStartTime.current = null;
                    console.log('[Timer] ✅ Session STARTED at:', new Date(sessionStartTime.current).toISOString());
                  }
                  
                  // Track pause/resume
                  if (wasActive && !willBeActive && sessionStartTime.current) {
                    // Pausing - record pause start time
                    pauseStartTime.current = Date.now();
                    console.log('[Timer] ⏸️ Session PAUSED at:', new Date(pauseStartTime.current).toISOString());
                  } else if (!wasActive && willBeActive && pauseStartTime.current) {
                    // Resuming - add paused duration to total
                    const pausedDuration = Date.now() - pauseStartTime.current;
                    totalPausedTime.current += pausedDuration;
                    console.log('[Timer] ▶️ Session RESUMED. Was paused for:', pausedDuration, 'ms. Total paused:', totalPausedTime.current, 'ms');
                    pauseStartTime.current = null;
                  }
                  
                  setIsActive(willBeActive);
                  if (isPremium && sound) {
                    if (willBeActive) {
                      sound.playAsync();
                    } else {
                      sound.pauseAsync();
                    }
                  }
                }}
                disabled={false}
            >
              <Ionicons 
                name={isActive ? "pause" : "play"} 
                size={30} 
                color={isActive ? "#000" : "#00ffff"} 
              />
            </TouchableOpacity>
          </View>
        </View>
          {/* Red upgrade message for free users */}
          {!isPremium && (
            <Text style={{ color: '#ff4444', textAlign: 'center', marginTop: 10, fontWeight: 'bold' }}>
              Upgrade to Premium to access guided audio for this session.
            </Text>
          )}
      </View>

        {/* Audio Controls: only for premium users */}
        {isPremium && sound && (
          <PremiumFeature isPremium={isPremium} onPress={() => {}}>
            <View style={styles.audioControls}>
              <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
                <Ionicons 
                  name={isMuted ? "volume-mute" : "volume-high"} 
                  size={24} 
                  color="#00ffff" 
                />
              </TouchableOpacity>
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                value={isMuted ? 0 : volume}
                onValueChange={handleVolumeChange}
                minimumTrackTintColor="#00ffff"
                maximumTrackTintColor="rgba(0, 255, 255, 0.3)"
                thumbTintColor="#00ffff"
              />
              <TouchableOpacity onPress={replayAudio} style={styles.muteButton}>
                <Ionicons name="refresh" size={24} color="#00ffff" />
              </TouchableOpacity>
            </View>
          </PremiumFeature>
        )}

      {/* Current Step with Navigation */}
      <View style={styles.stepWrapper}>
        {/* Navigation Buttons Above Steps */}
        <View style={styles.stepNavButtonsContainer}>
          <TouchableOpacity 
            style={styles.stepNavButton}
            onPress={goToPreviousStep}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#00ffff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.stepNavButton}
            onPress={goToNextStep}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={28} color="#00ffff" />
          </TouchableOpacity>
        </View>

        <Animated.View 
          style={[
            styles.stepContainer, 
            { 
              opacity: fadeAnimation,
              transform: [{
                translateY: fadeAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <Text style={styles.stepNumber}>Step {currentStepIndex + 1}/{session.steps.length}</Text>
          <Text style={styles.stepText}>
            {typeof session.steps[currentStepIndex] === 'string' 
              ? session.steps[currentStepIndex]
              : session.steps[currentStepIndex]?.instruction || session.steps[currentStepIndex]?.title || 'Focus on your breath'}
          </Text>
        </Animated.View>
      </View>

      {/* Description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionText}>{session.description}</Text>
      </View>
      </ScrollView>

      {/* Finish Button */}
      <View style={styles.finishButtonContainer}>
      <TouchableOpacity
          style={styles.finishButton}
        onPress={handleFinishSession}
      >
        <Text style={styles.finishButtonText}>Finish Session</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  closeButton: {
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 15,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  timerCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  progressCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 5,
    borderColor: '#00ffff',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
    transform: [{ rotate: '-90deg' }],
  },
  timerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  timerText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  timerButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  timerButtonActive: {
    backgroundColor: '#00ffff',
  },
  stepWrapper: {
    marginTop: 40,
    marginHorizontal: 20,
  },
  stepNavButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  stepNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stepContainer: {
    padding: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  stepNumber: {
    fontSize: 18,
    color: '#00ffff',
    marginBottom: 12,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '500',
  },
  descriptionContainer: {
    padding: 25,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  descriptionText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  finishButtonContainer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  finishButton: {
    backgroundColor: '#00ffff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  muteButton: {
    padding: 10,
    marginRight: 10,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
  },
});

export default ActiveMentalSession; 