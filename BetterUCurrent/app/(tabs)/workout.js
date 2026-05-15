"use client";

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert, Platform, SafeAreaView, Dimensions, Switch, Animated, TextInput } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { useSettings } from '../../context/SettingsContext';
import { generateWorkout } from '../../utils/aiUtils';
import { useAIConsent } from '../../context/AIConsentContext';
import {
  checkAIGenerationLimit,
  incrementAIGenerationUsage,
  getAIGenerationUsageInfo,
  FEATURE_TYPES,
} from '../../utils/aiGenerationLimits';
import { getEngagementLevel } from '../../utils/engagementService';
import { FloatingAITrainer } from '../../components/FloatingAITrainer';
import { AIWorkoutGenerator } from '../../components/AIWorkoutGenerator';
import { WorkoutShareModal } from '../../components/WorkoutShareModal';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from '../../lib/MapView';
import * as Location from 'expo-location';
// Optional HealthKit for indoor/treadmill timed distance (step-based). Only used on iOS when "Indoor" is on.
let queryStatisticsForQuantity;
try {
  const healthKit = require('@kingstinct/react-native-healthkit');
  queryStatisticsForQuantity = healthKit.queryStatisticsForQuantity;
} catch (_) {
  queryStatisticsForQuantity = null;
}
// Optional Pedometer (expo-sensors) for Android indoor/treadmill mode.
let Pedometer;
try {
  const sensors = require('expo-sensors');
  Pedometer = sensors.Pedometer;
} catch (_) {
  Pedometer = null;
}
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExerciseInfo } from '../../utils/exerciseLibrary';
import { INJURY_AVOID_TERMS, injuredMusclesOptions } from '../../utils/injuryOptions';
import { getScheduledWorkoutForDate } from '../../utils/scheduledWorkoutHelpers';
import MonthlyWorkoutCalendar from '../../components/MonthlyWorkoutCalendar';
import InjuryModal from '../components/injuryModal';
import {
  ALL_USER_EQUIPMENT_IDS,
  USER_EQUIPMENT_OPTIONS,
  workoutFitsUserEquipment,
} from '../../utils/workoutEquipment';
import ScheduledWorkoutModal from '../../components/ScheduledWorkoutModal';
import AllSplitsModal from '../(modals)/allSplitsModal';
import RecoveryMap from '../../components/RecoveryMap';
import WorkoutLogs from './workout-logs';
// Live Activities - shows real-time stats on lock screen during cardio
import { 
  startCardioLiveActivity, 
  updateCardioLiveActivity, 
  endCardioLiveActivity, 
  dismissLiveActivity 
} from '../../utils/liveActivities';

const { width, height } = Dimensions.get('window');

/** Stable key for a workout (used for favorites). Defined outside component so it's not recreated each render. */
const getFavoriteKey = (workout) => (workout?.id ?? workout?.workout_name ?? workout?.name ?? '').toString();

/** Format goalType for display (e.g. muscle_growth -> "Muscle Growth"). */
const formatGoalType = (goalType) => {
  if (!goalType) return '';
  return String(goalType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Memoized card for the "Recommended for today" list.
 * React.memo skips re-rendering when props are the same by reference, so when the parent
 * re-renders (e.g. from unrelated state), only cards whose workout or isFavorite changed re-render.
 */
const RecommendedWorkoutCard = memo(function RecommendedWorkoutCard({ workout, isFavorite, onStart, onFavorite, styles }) {
  return (
    <View style={styles.workoutCard}>
      <View style={styles.workoutHeader}>
        <Text style={styles.workoutTitle}>{workout.workout_name || workout.name}</Text>
        {/* Favorite to the left of rep range with 24px margin so the star is clearly next to the rep info */}
        <View style={styles.favoriteAndRepRow}>
          <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={() => onFavorite(workout)}>
            {isFavorite ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
          </TouchableOpacity>
          <View style={styles.repRange}>
            <Text style={styles.repRangeText}>{workout.repRange || ''}</Text>
          </View>
        </View>
      </View>
      {workout.goalType ? (
        <View style={styles.goalTypeBadge}>
          <Text style={styles.goalTypeBadgeText}>{formatGoalType(workout.goalType)}</Text>
        </View>
      ) : null}
      {workout.description ? <Text style={styles.workoutDescription}>{workout.description}</Text> : null}
      <View style={styles.exercises}>
        <Text style={styles.exercisesTitle}>Exercises:</Text>
        {Array.isArray(workout.exercises) && workout.exercises.slice(0, 4).map((ex, i) => (
          <Text key={i} style={styles.exercisesList}>• {typeof ex === 'string' ? ex : ex.name}</Text>
        ))}
        {Array.isArray(workout.exercises) && workout.exercises.length > 4 ? <Text style={styles.exercisesList}>+{workout.exercises.length - 4} more</Text> : null}
      </View>
      <TouchableOpacity
        style={styles.startButton}
        onPress={() => onStart(workout)}
      >
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>
    </View>
  );
});










const WorkoutScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' or 'run'
  const [showLogs, setShowLogs] = useState(false);
  const [userWorkouts, setUserWorkouts] = useState([]);
  const [showWorkoutGeneratorModal, setShowWorkoutGeneratorModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWorkoutForShare, setSelectedWorkoutForShare] = useState(null);
  const [sharedWorkouts, setSharedWorkouts] = useState([]);
  const [pendingShares, setPendingShares] = useState([]);
  const { isPremium, userProfile } = useUser();
  const { requestAIConsent } = useAIConsent();
  const { settings } = useSettings();
  const [todayScheduledWorkout, setTodayScheduledWorkout] = useState(null);
  const [showScheduledWorkoutModal, setShowScheduledWorkoutModal] = useState(false);
  const [selectedScheduledDate, setSelectedScheduledDate] = useState(null);
  const [selectedScheduledWorkout, setSelectedScheduledWorkout] = useState(null);
  const calendarRef = useRef(null);
  const [sprintCompleted, setSprintCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(null);
  // Animation type: 'confetti' | 'pulsingRing' | 'starBurst' | 'gradientWave' | 'flipCard' | 'particleTrail' | 'finishBanner'
  const [celebrationAnimationType, setCelebrationAnimationType] = useState('finishBanner');
  const [previousWorkoutData, setPreviousWorkoutData] = useState(null);
  const [progressiveOverloadSuggestions, setProgressiveOverloadSuggestions] = useState({});
  const [selectedSplit, setSelectedSplit] = useState(null); // SPLIT_OPTIONS id or object; null = use first option
  const [injuredMuscleIds, setInjuredMuscleIds] = useState([]); // e.g. ['ACL'] - loaded from AsyncStorage for injury-based exercise filter
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  /** Equipment the user has access to; used when equipmentFilterEnabled to hide recommended workouts they cannot complete. */
  const [userEquipmentIds, setUserEquipmentIds] = useState(ALL_USER_EQUIPMENT_IDS);
  const [equipmentFilterEnabled, setEquipmentFilterEnabled] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [draftEquipmentIds, setDraftEquipmentIds] = useState([]);
  const [showCustomSplitModal, setShowCustomSplitModal] = useState(false);
  const [showAllSplitsModal, setShowAllSplitsModal] = useState(false);
  const [customDaysForEdit, setCustomDaysForEdit] = useState([]); // length-7 array for Sun–Sat when editing custom split
  const [favoriteWorkoutsIds, setFavoriteWorkoutsIds] = useState([]);
  const [recoveryMapRefreshKey, setRecoveryMapRefreshKey] = useState(0);
  const [workoutUsage, setWorkoutUsage] = useState({ currentUsage: 0, limit: 1, remaining: 1 });
  // daySkippedBecauseOfInjury and reccomendedWorkouts are now derived via useMemo below (no separate state)
 // Countdown timer state (3, 2, 1, null)
  
  // Animation refs for celebration
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const finishLineOpacity = useRef(new Animated.Value(0)).current;
  const recommendedSectionRef = useRef(null);
  const workoutScrollViewRef = useRef(null);
  const recommendedSectionYRef = useRef(0);

  // Run/Walk state variables
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [locations, setLocations] = useState([]);
  const [lastLocation, setLastLocation] = useState(null);
  const [distance, setDistance] = useState(0);
  const [rawDistance, setRawDistance] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [averagePace, setAveragePace] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [startLocation, setStartLocation] = useState(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activityStarted, setActivityStarted] = useState(false);
  const [autoZoom, setAutoZoom] = useState(false);
  const [useMiles, setUseMiles] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [pauseTime, setPauseTime] = useState(0);
  const [totalPauseTime, setTotalPauseTime] = useState(0);
  const [activityType, setActivityType] = useState('run'); // 'run', 'walk', 'bike', or 'challenge'
  
  // Sprint Maxout state variables
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [sprintMode, setSprintMode] = useState(false);
  const [distanceNeededToTravel, setDistanceNeededToTravel] = useState(0); // in meters
  const [selectedSprintDistance, setSelectedSprintDistance] = useState(null);
  const [customDistance, setCustomDistance] = useState('');
  const [customDistanceUnit, setCustomDistanceUnit] = useState('m'); // 'm' or 'mi'
  // Indoor/Treadmill mode uses step count (HealthKit on iOS) instead of GPS — works in buildings
  const [sprintIndoorMode, setSprintIndoorMode] = useState(false);
  
  const locationWatcher = useRef(null);
  const stepPollingRef = useRef(null);       // interval ID for step-based distance updates (indoor mode)
  const sprintStartTimeRef = useRef(null);  // session start time for step query range
  const pedometerSubRef = useRef(null);     // Pedometer subscription (Android indoor mode)
  const indoorStartStepsRef = useRef(null); // step count when sprint started (Android: baseline for delta)
  const mapRef = useRef(null);
  const timerRef = useRef(null);
  const locationsRef = useRef([]);
  const lastValidLocation = useRef(null);
  const bestAccuracyRef = useRef(1000); // Track best GPS accuracy achieved
  const accumulatedDistanceRef = useRef(0); // Track accumulated distance to avoid race conditions
  const recentDistanceRef = useRef([]);
  const countdownAnim = useRef(new Animated.Value(1)).current; // Animation for countdown number scaling
  
  // Live Activity for cardio - shows distance/pace/time on lock screen
  const [cardioLiveActivityId, setCardioLiveActivityId] = useState(null);
  
  // Animated progress bar for sprint tracking
  const sprintProgressAnim = useRef(new Animated.Value(0)).current;

  /**
   * Fetches previous workout data to provide progressive overload suggestions
   * This compares the current workout with previous workouts to encourage progression
   * @param {string} workoutName - The name of the workout to fetch history for
   */
  const fetchPreviousWorkoutData = async (workoutName) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workoutName) {
        console.log('No user found or no workout name provided');
        return;
      }

      // Fetch the last 3 times this workout was completed to show progression trends
      const { data, error } = await supabase
        .from('user_workout_logs')
        .select('exercises, completed_at, workout_name')
        .eq('user_id', user.id)
        .eq('workout_name', workoutName)
        .order('completed_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching previous workout:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const lastWorkout = data[0];
        setPreviousWorkoutData(lastWorkout);

        // Generate progressive overload suggestions for each exercise
        // This creates a map of exercise names to their previous performance
        const suggestions = {};
        
        // Note: This function will be used in active-workout.js where workout data is available
        // For now, we store the last workout data to be used later
        console.log('Previous workout data loaded:', lastWorkout);
        setProgressiveOverloadSuggestions({ lastWorkout });
      }
    } catch (error) {
      console.error('Error fetching previous workout data:', error);
    }
  };

  /**
   * Gets progressive overload message based on current vs previous performance
   * @param {number} exerciseIndex - Index of the exercise in the workout
   * @param {string} currentWeight - Current weight being used
   * @param {string} currentReps - Current reps being performed
   * @param {number} currentVolume - Current number of sets
   * @returns {Object|null} - Message object with type and text, or null if no suggestion
   */
  const getProgressiveOverloadMessage = (exerciseIndex, currentWeight, currentReps, currentVolume) => {
    const suggestion = progressiveOverloadSuggestions[exerciseIndex];
    if (!suggestion) return null;

    const weight = parseFloat(currentWeight) || 0;
    const reps = parseInt(currentReps) || 0;
    const volume = parseInt(currentVolume) || 0;

    // Check if user matched or exceeded previous performance
    if (weight > suggestion.lastWeight) {
      return {
        icon: 'trending-up',
        type: 'success',
        message: `🔥 New weight PR! (+${(weight - suggestion.lastWeight).toFixed(1)} lbs)`
      };
    } else if (weight === suggestion.lastWeight && reps > suggestion.lastReps) {
      return {
        icon: 'trending-up',
        type: 'success',
        message: `💪 More reps! (+${reps - suggestion.lastReps} reps)`
      };
    } else if (weight === suggestion.lastWeight && reps === suggestion.lastReps && volume > suggestion.lastVolume) {
      return {
        icon: 'trending-up',
        type: 'success',
        message: `🔥 New volume PR! (+${volume - suggestion.lastVolume} sets)`
      };
    } else if (weight === suggestion.lastWeight && reps === suggestion.lastReps) {
      return {
        icon: 'bulb',
        type: 'suggestion',
        message: `💡 Same as last time. Try ${suggestion.suggestedWeight} lbs or ${suggestion.suggestedReps} reps!`
      };
    }
    
    return null;
  };

/**
 * Filters out exercises that target an injured area (e.g. ACL → no leg exercises).
 * @param {Array<string|object>} exercises - Array of exercise names (strings) or objects with name and optional targetMuscles
 * @param {string[]} injuredIds - Array of injury option ids (e.g. ['ACL'])
 * @returns {Array} Filtered exercises (only those safe for the selected injuries)
 */
const filterExercisesByInjury = (exercises, injuredIds) => {
  if (!Array.isArray(exercises)) return [];
  if (!injuredIds?.length) return exercises;
  const avoidTerms = [...new Set(injuredIds.flatMap((id) => INJURY_AVOID_TERMS[id] || []))];
  if (!avoidTerms.length) return exercises;
  return exercises.filter((ex) => {
    const name = typeof ex === 'string' ? ex : (ex?.name ?? '');
    const targetMuscles =
      typeof ex === 'object' && ex?.targetMuscles
        ? ex.targetMuscles
        : (getExerciseInfo(name)?.targetMuscles ?? '');
    const textToCheck = `${(targetMuscles || '').toLowerCase()} ${name.toLowerCase()}`;
    const isExcluded = avoidTerms.some((term) => textToCheck.includes(term));
    return !isExcluded;
  });
};

  // Default 7-day week: Sun=0 .. Sat=6. Custom split is loaded from AsyncStorage.
  const DEFAULT_CUSTOM_DAYS = ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest'];
  /**
   * Builds a 7-day week from a split rotation + requested weekly frequency.
   * The spacing uses fractional steps so 2-4 training days spread naturally across the week.
   */
  const buildWeeklySplitDays = (frequency, rotation) => {
    const safeFrequency = Math.min(7, Math.max(1, Number(frequency) || 1));
    const template = Array(7).fill('rest');
    const step = 7 / safeFrequency;
    for (let i = 0; i < safeFrequency; i += 1) {
      const dayIndex = Math.min(6, Math.floor(i * step));
      template[dayIndex] = rotation[i % rotation.length];
    }
    return template;
  };
  const createFrequencySplitOption = (baseId, baseLabel, frequency, rotation) => ({
    id: `${baseId}_${frequency}`,
    label: `${baseLabel} (${frequency}x/week)`,
    days: buildWeeklySplitDays(frequency, rotation),
  });
  const SPLIT_OPTIONS = [
    createFrequencySplitOption('ppl', 'Push/Pull/Legs (PPL)', 3, ['push', 'pull', 'legs']),
    createFrequencySplitOption('ppl', 'Push/Pull/Legs (PPL)', 4, ['push', 'pull', 'legs']),
    createFrequencySplitOption('ppl', 'Push/Pull/Legs (PPL)', 5, ['push', 'pull', 'legs']),
    createFrequencySplitOption('ppl', 'Push/Pull/Legs (PPL)', 6, ['push', 'pull', 'legs']),
    createFrequencySplitOption('upper_lower_ppl', 'Upper/Lower/PPL', 3, ['Upper', 'Lower', 'push', 'pull', 'legs']),
    createFrequencySplitOption('upper_lower_ppl', 'Upper/Lower/PPL', 4, ['Upper', 'Lower', 'push', 'pull', 'legs']),
    createFrequencySplitOption('upper_lower_ppl', 'Upper/Lower/PPL', 5, ['Upper', 'Lower', 'push', 'pull', 'legs']),
    createFrequencySplitOption('upper_lower', 'Upper/Lower', 2, ['Upper', 'Lower']),
    createFrequencySplitOption('upper_lower', 'Upper/Lower', 3, ['Upper', 'Lower']),
    createFrequencySplitOption('upper_lower', 'Upper/Lower', 4, ['Upper', 'Lower']),
    createFrequencySplitOption('full_body', 'Full Body', 2, ['Full Body']),
    createFrequencySplitOption('full_body', 'Full Body', 3, ['Full Body']),
    createFrequencySplitOption('full_body', 'Full Body', 4, ['Full Body']),
    createFrequencySplitOption('bro_split', 'Bro Split', 3, ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']),
    createFrequencySplitOption('bro_split', 'Bro Split', 4, ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']),
    createFrequencySplitOption('bro_split', 'Bro Split', 5, ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']),
    { id: 'custom', label: 'Custom', days: [...DEFAULT_CUSTOM_DAYS] },
  ];
  // Keep previously saved split ids compatible after adding frequency variants.
  const LEGACY_SPLIT_ID_MAP = {
    ppl: 'ppl_6',
    upper_lower_ppl: 'upper_lower_ppl_5',
    upper_lower: 'upper_lower_4',
    full_body: 'full_body_3',
    bro_split: 'bro_split_5',
  };
  const findSplitById = (rawId) => {
    const resolvedId = LEGACY_SPLIT_ID_MAP[rawId] || rawId;
    return SPLIT_OPTIONS.find((s) => s.id === resolvedId);
  };
  // Options for the custom split editor (each weekday can be one of these)
  const SPLIT_DAY_OPTIONS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Chest', 'Back', 'Shoulders', 'Arms', 'Rest'];
  const VISIBLE_SPLITS_COUNT = 4; // number of split chips shown in the row before "More splits"

  // Build row so the SELECTED split is always first; the rest fill the row and the displaced one goes into "More splits".
  const { effectiveSplit, visibleSplitOptions } = useMemo(() => {
    const effective = selectedSplit && typeof selectedSplit === 'object' && selectedSplit.days
      ? selectedSplit
      : findSplitById(selectedSplit?.id ?? selectedSplit) || SPLIT_OPTIONS[0];
    const others = SPLIT_OPTIONS.filter((o) => o.id !== effective.id).slice(0, VISIBLE_SPLITS_COUNT - 1);
    return { effectiveSplit: effective, visibleSplitOptions: [effective, ...others] };
  }, [selectedSplit]);

  // Exercise suggestions per split day (used when user picks a split; you can expand these lists)
  const EXERCISES_BY_SPLIT_DAY = {
    push: [
      'Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Tricep Pushdown', 'Lateral Raise',
      'Dips', 'Dumbbell Flyes', 'Close-Grip Bench Press', 'Skull Crushers', 'Push-Ups', 'Cable Crossover',
    ],
    pull: [
      'Pull-Ups', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl',
      'Deadlift', 'T-Bar Row', 'Seated Cable Row', 'Chin-Ups', 'Hammer Curl', 'Preacher Curl', 'Shrugs',
    ],
    legs: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'],
    Upper: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Pull-Ups', 'Bicep Curl'],
    Lower: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Lunge'],
    FullBody : ['Squat', 'Bench Press', 'Row', 'Overhead Press', 'Deadlift'],
    'Full Body': ['Squat', 'Bench Press', 'Row', 'Overhead Press', 'Deadlift'],
    Chest : ['Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Close-Grip Bench Press', 'Tricep Pushdown', 'Skull Crushers'],
    Back: ['Pull-Ups', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl', 'Deadlift', 'T-Bar Row', 'Seated Cable Row', 'Chin-Ups', 'Hammer Curl', 'Preacher Curl', 'Shrugs'],
    Arms: ['Bicep Curl', 'Tricep Pushdown', 'Hammer Curl', 'Preacher Curl', 'Shrugs'],
    Shoulders: ['Shoulder Press', 'Lateral Raise', 'Overhead Press', 'Dumbbell Shoulder Press', 'Front Raise', 'Rear Delt Fly', 'Arnold Press', 'Bent Over Lateral Raise', 'Cable Lateral Raise', 'Upright Row', 'Push Press', 'Face Pull', 'Rear Delt Machine', 'Cable Shoulder Fly', 'Handstand Push-Up', 'Pike Push-Up'],
    Legs: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'],
  };

  // Returns the split day label for a date (e.g. 'Push', 'Rest'). Supports weeks with <7 days by padding with 'rest'.
  const getSplitDayForDate = (date, split) => {
    const dayOfWeek = date.getDay();
    const days = split?.days;
    if (!days || !days.length) return null;
    const padded = days.length >= 7 ? days : [...days, ...Array(7 - days.length).fill('rest')].slice(0, 7);
    const value = padded[dayOfWeek] ?? 'rest';
    return typeof value === 'string' ? value.trim() : value;
  };

  const recommendationsBasedOffSplitDay = (splitDay) => {
    if (!splitDay) {
      setReccomendedExcercises([]);
      return;
    }
    const key = splitDay.toLowerCase() === 'lower' ? 'Lower' : splitDay;
    const list = EXERCISES_BY_SPLIT_DAY[key] || EXERCISES_BY_SPLIT_DAY[splitDay] || [];
    setReccomendedExcercises(Array.isArray(list) ? list : []);
    
    }


  const fetchUserWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single();
      console.log('Profile fetch result (workouts):', profile, profileError);
      let profileId;
      if (profile && profile.id) {
        profileId = profile.id;
      } else {
        console.log('No profile found for user', user.id, '- using user.id as profileId fallback');
        profileId = user.id;
      }
      console.log('Fetching user workouts for profileId:', profileId);
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.log('Fetched userWorkouts:', data);
      setUserWorkouts(data || []);
    } catch (error) {
      console.error('Error fetching user workouts:', error);
    }
  };

  const fetchSharedWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const profileId = profile?.id || user.id;

      // Fetch pending shares
      const { data: shares, error: sharesError } = await supabase
        .from('workout_shares')
        .select(`
          *,
          profiles!workout_shares_sender_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('recipient_id', profileId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (sharesError) throw sharesError;

      // Transform shares to include workout data
      const sharesWithWorkouts = (shares || []).map(share => ({
        ...share,
        workouts: {
          id: share.workout_id,
          workout_name: share.workout_name,
          exercises: share.workout_exercises,
          created_at: share.created_at
        }
      }));

      // Fetch accepted shared workouts
      const { data: workouts, error: workoutsError } = await supabase
        .from('shared_workouts')
        .select(`
          *,
          profiles!shared_workouts_original_sender_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('recipient_id', profileId)
        .eq('is_active', true)
        .order('shared_at', { ascending: false });

      if (workoutsError) throw workoutsError;

      setPendingShares(sharesWithWorkouts || []);
      setSharedWorkouts(workouts || []);
    } catch (error) {
      console.error('Error fetching shared workouts:', error);
    }
  };

  const fetchTodayScheduledWorkout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get today's scheduled workout
      const today = new Date();
      const { data, error } = await getScheduledWorkoutForDate(user.id, today);

      if (error) {
        console.error('Error fetching today\'s scheduled workout:', error);
        return;
      }

      setTodayScheduledWorkout(data);
    } catch (error) {
      console.error('Error fetching today\'s scheduled workout:', error);
    }
  };

  /**
   * Single entry point for refreshing all workout-related data.
   * Use this on screen focus and after any mutation (create, share, accept, delete)
   * so we never duplicate or forget a fetch. Reduces redundant useEffects.
   */
  const refreshWorkoutData = useCallback(() => {
    fetchUserWorkouts();
    fetchSharedWorkouts();
    fetchTodayScheduledWorkout();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshWorkoutData();
      setRecoveryMapRefreshKey((k) => k + 1);
    }, [refreshWorkoutData])
  );

  const fetchWorkoutUsage = useCallback(async () => {
    if (isPremium !== undefined) {
      const usageInfo = await getAIGenerationUsageInfo(FEATURE_TYPES.WORKOUT, isPremium);
      setWorkoutUsage(usageInfo);
    }
  }, [isPremium]);

  useEffect(() => {
    if (showWorkoutGeneratorModal) {
      fetchWorkoutUsage();
    }
  }, [showWorkoutGeneratorModal, fetchWorkoutUsage]);

  // Deep link: Home "Run" shortcut sends params.tab === 'run'
  useEffect(() => {
    const t = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (t === 'run') {
      setActiveTab('run');
    }
  }, [params.tab]);


  const handleDeleteWorkout = async (workoutId) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
              if (error) throw error;
              setUserWorkouts(userWorkouts.filter(w => w.id !== workoutId));
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete workout.');
            }
          }
        }
      ]
    );
  };

  const startWorkout = (workout) => {
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    const filteredExercises = filterExercisesByInjury(exercises, injuredMuscleIds);
    router.push({
      pathname: '/active-workout',
      params: {
        custom: 'true',
        workout: JSON.stringify({ ...workout, exercises: filteredExercises }),
      },
    });
  };

  const handleGenerateWorkout = async () => {
    if (workoutUsage.currentUsage >= workoutUsage.limit) {
      if (isPremium) {
        Alert.alert(
          'Daily Limit Reached',
          "You're out of generations for the day. Your limit will reset tomorrow."
        );
      } else {
        Alert.alert(
          'Daily Limit Reached',
          "You're out of generations for the day. Upgrade to Premium for 20 generations per day!",
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/purchase-subscription') },
          ]
        );
      }
      return;
    }
    setShowWorkoutGeneratorModal(true);
  };

  const handleWorkoutGenerated = async (prompt, preferences) => {
    try {
      const limitCheck = await checkAIGenerationLimit(FEATURE_TYPES.WORKOUT, isPremium);

      if (!limitCheck.canGenerate) {
        Alert.alert(
          'Daily Limit Reached',
          `You've reached your daily limit of ${limitCheck.limit} AI workout generation${limitCheck.limit === 1 ? '' : 's'}. ${isPremium ? 'Your limit will reset tomorrow.' : 'Upgrade to Premium for 20 generations per day!'}`,
          isPremium
            ? [{ text: 'OK' }]
            : [
                { text: 'OK', style: 'cancel' },
                { text: 'Upgrade', onPress: () => router.push('/purchase-subscription') },
              ]
        );
        return;
      }

      Alert.alert(
        'Generating Workout',
        'Please wait while we create your personalized workout...',
        [{ text: 'OK' }]
      );

      // Get user profile data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to generate workouts');
        return;
      }

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error getting profile:', profileError);
        Alert.alert('Error', 'Failed to get user profile');
        return;
      }

      // Get engagement so we can suggest shorter/easier workouts when user has been inconsistent
      const engagement = await getEngagementLevel(user.id).catch(() => ({ level: 'high', reasons: [] }));

      const allowed = await requestAIConsent();
      if (!allowed) return;

      // Generate the workout
      const result = await generateWorkout({
        training_level: profile?.training_level || 'beginner',
        fitness_goal: profile?.fitness_goal || 'general fitness',
        age: profile?.age,
        weight: profile?.weight,
        height: profile?.height,
        gender: profile?.gender,
        bio: profile?.bio || '',
        custom_prompt: prompt,
        engagementContext: engagement
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to generate workout');
        return;
      }

      // Save the generated workout
      const { error: saveError } = await supabase
        .from('workouts')
        .insert({
          profile_id: user.id,
          workout_name: result.workout.name,
          exercises: result.workout.exercises,
          created_at: new Date().toISOString()
        });

      if (saveError) {
        console.error('Error saving workout:', saveError);
        Alert.alert('Error', 'Failed to save workout');
        return;
      }

      // Increment usage only after successful generate + save.
      await incrementAIGenerationUsage(FEATURE_TYPES.WORKOUT);
      await fetchWorkoutUsage();

      // Refresh the workouts list (single source for all workout data)
      refreshWorkoutData();

      const updatedLimit = await checkAIGenerationLimit(FEATURE_TYPES.WORKOUT, isPremium);
      const remainingText =
        updatedLimit.remaining > 0
          ? ` You have ${updatedLimit.remaining} generation${updatedLimit.remaining === 1 ? '' : 's'} remaining today.`
          : '';

      Alert.alert(
        'Success',
        `Your personalized workout has been generated!${remainingText}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error generating workout:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  /**
   * Handles sharing a workout with friends
   * Opens the share modal with the selected workout
   * @param {Object} workout - The workout to share
   */
  const handleShareWorkout = (workout) => {
    setSelectedWorkoutForShare(workout);
    setShowShareModal(true);
  };

  /**
   * Toggle a workout as favorite. Persists to AsyncStorage so favorites survive app restarts.
   * useCallback keeps the same function reference so memoized RecommendedWorkoutCard doesn't re-render unnecessarily.
   */
  const handleFavoriteWorkout = useCallback(async (workout) => {
    const key = getFavoriteKey(workout);
    if (!key) return;
    setFavoriteWorkoutsIds((prev) => {
      const next = prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key];
      AsyncStorage.setItem('favoriteWorkoutIds', JSON.stringify(next)).catch((e) => console.warn('Failed to save favorites', e));
      return next;
    });
  }, []);

  /** Stable callback for starting a recommended workout so RecommendedWorkoutCard (memo) can skip re-renders. */
  const handleStartRecommended = useCallback((workout) => {
    startWorkout({ name: workout.workout_name || workout.name, workout_name: workout.workout_name || workout.name, exercises: workout.exercises });
  }, [router, injuredMuscleIds]);

  /**
   * Handles successful workout sharing
   * Refreshes the workouts list and closes the modal
   */
  const handleShareSuccess = () => {
    refreshWorkoutData();
    setShowShareModal(false);
    setSelectedWorkoutForShare(null);
  };

  /**
   * Handles starting a shared workout
   * Navigates to the active workout screen with the shared workout data
   * @param {Object} sharedWorkout - The shared workout to start
   */
  const handleStartSharedWorkout = (sharedWorkout) => {
    // Convert shared workout to the format expected by startWorkout
    const workoutData = {
      id: sharedWorkout.id,
      name: sharedWorkout.workout_name,
      workout_name: sharedWorkout.workout_name,
      exercises: sharedWorkout.exercises,
      isShared: true,
      originalSender: sharedWorkout.original_sender
    };
    
    startWorkout(workoutData);
  };

  /**
   * Handles accepting or declining a workout share
   * @param {string} shareId - The ID of the share to respond to
   * @param {string} action - 'accept' or 'decline'
   */
  const handleShareResponse = async (shareId, action) => {
    try {
      const { error: updateError } = await supabase
        .from('workout_shares')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', shareId);

      if (updateError) throw updateError;

      if (action === 'accept') {
        // Get the share data to create a shared workout
        const share = pendingShares.find(s => s.id === shareId);
        if (share) {
          const { error: insertError } = await supabase
            .from('shared_workouts')
            .insert({
              original_workout_id: share.workout_id,
              original_sender_id: share.sender_id,
              recipient_id: share.recipient_id,
              workout_name: share.workout_name,
              exercises: share.workout_exercises
            });

          if (insertError) throw insertError;
        }
      }

      // Refresh the shared workouts (use single refresh so UI stays in sync)
      refreshWorkoutData();
    } catch (error) {
      console.error('Error handling share response:', error);
      Alert.alert('Error', 'Failed to respond to workout share');
    }
  };

  /**
   * Handles deleting a shared workout
   * @param {string} workoutId - The ID of the shared workout to delete
   */
  const handleDeleteSharedWorkout = async (workoutId) => {
    Alert.alert(
      'Delete Shared Workout',
      'Are you sure you want to remove this shared workout from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('shared_workouts')
                .update({ is_active: false })
                .eq('id', workoutId);

              if (error) throw error;

              // Refresh the shared workouts
              refreshWorkoutData();
            } catch (error) {
              console.error('Error deleting shared workout:', error);
              Alert.alert('Error', 'Failed to delete shared workout');
            }
          }
        }
      ]
    );
  };


  const premiumWorkouts = [
    // Push day workouts (chest, shoulders, triceps)
    { splitDay: 'push', goalType: 'strength', name: 'Push Day Strength', description: 'Heavy compound push for chest, shoulders and triceps', repRange: '6-10 reps', duration: '55 min', intensity: 'High', exercises: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Dips', 'Tricep Pushdown', 'Lateral Raise'], howTo: 'Lead with compound moves, then finish with isolation. Rest 2–3 min on heavy sets.' },
    { splitDay: 'push', goalType: 'muscle_growth', name: 'Chest & Triceps Focus', description: 'Chest and tricep emphasis with pump finishers', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Close-Grip Bench Press', 'Tricep Pushdown', 'Skull Crushers'], howTo: 'Control the eccentric and squeeze at the top of each rep for maximum pump.' },
    { splitDay: 'push', goalType: 'muscle_growth', name: 'Push-Pull-Legs Pro', description: 'Advanced PPL push day for muscle growth', repRange: '8-12 reps', duration: '60 min', intensity: 'Pro', exercises: ['Incline Barbell Press', 'Arnold Press', 'Lateral Raise', 'Tricep Pushdown', 'Dips'], howTo: 'Focus on compound movements to maximize muscle engagement and growth.' },
    // Push – bodyweight & dumbbell (minimal equipment)
    { splitDay: 'push', goalType: 'muscle_growth', name: 'Push Day Bodyweight & Dumbbell', description: 'No barbell needed. Chest, shoulders and triceps with push-ups and dumbbells.', repRange: '8-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Push-Up', 'Pike Push-Up', 'Dumbbell Press', 'Lateral Raise', 'Tricep Extension', 'Diamond Push-Up'], howTo: 'Use a bench or floor for push-ups and pike push-ups; one set of dumbbells covers the rest.' },
    { splitDay: 'push', goalType: 'strength', name: 'At-Home Push', description: 'Push day with only bodyweight and dumbbells', repRange: '10-15 reps', duration: '35 min', intensity: 'Medium', exercises: ['Push-Up', 'Dumbbell Shoulder Press', 'Dumbbell Flyes', 'Tricep Extension', 'Lateral Raise'], howTo: 'Focus on control and full range of motion; add weight as you get stronger.' },
    // Pull day workouts (back, biceps, rear delts)
    { splitDay: 'pull', goalType: 'strength', name: 'Pull Day Power', description: 'Heavy back and biceps for strength and size', repRange: '6-10 reps', duration: '55 min', intensity: 'High', exercises: ['Deadlift', 'Barbell Row', 'Pull-Ups', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'], howTo: 'Prioritize deadlift and rows; keep core braced and avoid using momentum.' },
    { splitDay: 'pull', goalType: 'muscle_growth', name: 'Back & Biceps Builder', description: 'Hypertrophy-focused pull with multiple angles', repRange: '8-12 reps', duration: '50 min', intensity: 'Medium', exercises: ['Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Face Pull', 'Bicep Curl', 'Hammer Curl'], howTo: 'Squeeze the back and biceps at the top of each pull; control the negative.' },
    { splitDay: 'pull', goalType: 'muscle_growth', name: 'Pull Day Classic', description: 'Classic pull routine with rows and curls', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Pull-Ups', 'T-Bar Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl', 'Preacher Curl'], howTo: 'Focus on full range of motion and mind–muscle connection on every set.' },
    // Pull – bodyweight & dumbbell
    { splitDay: 'pull', goalType: 'muscle_growth', name: 'Pull Day No Barbell', description: 'Back and biceps using dumbbells and bodyweight only', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Bent Over Row', 'Dumbbell Row', 'Pull-Up', 'Bicep Curl', 'Hammer Curl', 'Rear Delt Fly'], howTo: 'Use a single dumbbell or two for rows and curls; pull-ups can be done with a bar or bands.' },
    { splitDay: 'pull', goalType: 'strength', name: 'Back & Biceps Dumbbell Only', description: 'Full pull day with just dumbbells', repRange: '8-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Bent Over Row', 'Single-Arm Row', 'Rear Delt Fly', 'Bicep Curl', 'Hammer Curl'], howTo: 'Brace your core on rows; squeeze shoulder blades at the top of each row.' },
    // Legs – bodyweight & dumbbell
    { splitDay: 'legs', goalType: 'muscle_growth', name: 'Leg Day Bodyweight & Dumbbell', description: 'Legs and glutes with minimal equipment', repRange: '10-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Goblet Squat', 'Lunges', 'Romanian Deadlift', 'Calf Raise', 'Bulgarian Split Squat', 'Glute Bridge'], howTo: 'Hold one dumbbell for goblet squats and RDL; bodyweight for lunges and bridges.' },
    { splitDay: 'legs', goalType: 'wellness', name: 'At-Home Legs', description: 'Lower body with squats, lunges and one dumbbell', repRange: '12-15 reps', duration: '35 min', intensity: 'Medium', exercises: ['Squat', 'Lunges', 'Glute Bridge', 'Romanian Deadlift', 'Calf Raise'], howTo: 'No rack needed; use dumbbells for RDL and goblet-style squats if you have them.' },
    { splitDay: 'Lower', goalType: 'strength', name: 'Leg Day Home', description: 'Full leg day with bodyweight and dumbbells only', repRange: '8-12 reps', duration: '50 min', intensity: 'High', exercises: ['Goblet Squat', 'Lunges', 'Bulgarian Split Squat', 'Romanian Deadlift', 'Calf Raise', 'Glute Bridge'], howTo: 'Progressive overload by adding dumbbell weight or slowing the tempo.' },
    // Upper – bodyweight & dumbbell
    { splitDay: 'Upper', goalType: 'strength', name: 'Upper Body Power', description: 'Build upper body strength and power', repRange: '6-10 reps', duration: '55 min', intensity: 'High', exercises: ['Pull-Ups', 'Dips', 'Push-Ups', 'Dumbbell Press', 'Tricep Extensions'], howTo: 'Focus on explosive movements and proper form to build upper body power.' },
    { splitDay: 'Upper', goalType: 'muscle_growth', name: 'Upper Body Minimal Equipment', description: 'Chest, back, shoulders and arms with push-ups and dumbbells', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Push-Up', 'Bent Over Row', 'Pike Push-Up', 'Bicep Curl', 'Tricep Extension'], howTo: 'Alternate push and pull; use a table or bar for rows if needed.' },
    { splitDay: 'Upper', goalType: 'muscle_growth', name: 'Upper Body Dumbbell Only', description: 'Complete upper body with only dumbbells', repRange: '8-12 reps', duration: '50 min', intensity: 'Medium', exercises: ['Dumbbell Press', 'Bent Over Row', 'Shoulder Press', 'Lateral Raise', 'Bicep Curl', 'Tricep Extension'], howTo: 'One pair of dumbbells can cover every exercise; adjust weight per movement.' },
    // Full body – bodyweight & dumbbell
    { splitDay: 'Full Body', goalType: 'wellness', name: 'Full Body Bodyweight', description: 'No equipment. Push, pull, legs and core with bodyweight only.', repRange: '12-15 reps', duration: '35 min', intensity: 'Medium', exercises: ['Push-Up', 'Squat', 'Lunges', 'Plank', 'Mountain Climber', 'Burpee'], howTo: 'Great for travel or home; do circuits or straight sets with short rest.' },
    { splitDay: 'Full Body', goalType: 'strength', name: 'Full Body Dumbbell', description: 'One set of dumbbells for a full-body workout', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Goblet Squat', 'Dumbbell Press', 'Bent Over Row', 'Romanian Deadlift', 'Shoulder Press', 'Bicep Curl'], howTo: 'Compound moves first; finish with curls and tricep work if time allows.' },
    { splitDay: 'Full Body', goalType: 'muscle_growth', name: 'Full Body Home', description: 'Mix of bodyweight and dumbbell for home or small gym', repRange: '10-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Push-Up', 'Bent Over Row', 'Goblet Squat', 'Lunges', 'Plank', 'Jumping Jack'], howTo: 'Minimal space and equipment; focus on form and breathing.' },
    // Full body, upper, lower (existing + more)
    { splitDay: 'Full Body', goalType: 'athleticism', name: 'Athlete Power Circuit', description: 'Explosive full-body circuit for athletes', repRange: '8-10 reps', duration: '50 min', intensity: 'Elite', exercises: ['Power Cleans', 'Push Press', 'Box Jumps', 'Chin-Ups', "Farmer's Walk"], howTo: 'Focus on explosive movements and maintain proper form throughout the circuit.' },
    { splitDay: 'Lower', goalType: 'wellness', name: 'Glute & Core Sculpt', description: 'Targeted glute and core workout for strength and shape', repRange: '12-15 reps', duration: '40 min', intensity: 'High', exercises: ['Hip Thrusts', 'Cable Kickbacks', 'Plank Variations', 'Bulgarian Split Squats', 'Hanging Leg Raises'], howTo: 'Engage your core and glutes with each movement for maximum effectiveness.' },
    { splitDay: 'Full Body', goalType: 'athleticism', name: 'Ultimate Conditioning', description: 'High-intensity conditioning for max calorie burn', repRange: '30s work', duration: '35 min', intensity: 'Extreme', exercises: ['Battle Ropes', 'Sled Push', 'Burpee Pull-Ups', 'Rowing Sprints', 'Medicine Ball Slams'], howTo: 'Push yourself to the limit with short, intense bursts of activity.' },
    { splitDay: 'Full Body', goalType: 'strength', name: 'Elite Strength Builder', description: 'Build raw strength with heavy compound lifts', repRange: '5-8 reps', duration: '70 min', intensity: 'Elite', exercises: ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press', 'Barbell Row'], howTo: 'Use heavy weights and focus on form to build maximum strength.' },
    { splitDay: 'Full Body', goalType: 'wellness', name: 'High-Intensity Interval Training', description: 'Burn fat and improve cardiovascular health', repRange: '20s work, 10s rest', duration: '30 min', intensity: 'High', exercises: ['Mountain Climbers', 'Jump Squats', 'High Knees', 'Burpees', 'Plank Jacks'], howTo: 'Alternate between high-intensity exercises and short rest periods for maximum calorie burn.' },
    { splitDay: 'Full Body', goalType: 'wellness', name: 'Flexibility and Mobility', description: 'Improve flexibility and joint mobility', repRange: '30-60s holds', duration: '45 min', intensity: 'Low', exercises: ['Dynamic Stretching', 'Foam Rolling', 'Yoga Poses', 'Joint Mobility', 'Static Stretching'], howTo: 'Focus on deep breathing and gradual stretching to improve flexibility.' },
    { splitDay: 'Full Body', goalType: 'wellness', name: 'Core Crusher', description: 'Strengthen your core with targeted exercises', repRange: '15-20 reps', duration: '40 min', intensity: 'Medium', exercises: ['Plank Variations', 'Russian Twists', 'Leg Raises', 'Cable Crunches', 'Bicycle Crunches'], howTo: 'Engage your core throughout each exercise for maximum effectiveness.' },
    { splitDay: 'Lower', goalType: 'muscle_growth', name: 'Lower Body Strength', description: 'Strengthen your lower body with heavy lifts', repRange: '8-12 reps', duration: '60 min', intensity: 'High', exercises: ['Squats', 'Lunges', 'Leg Press', 'Calf Raises', 'Romanian Deadlifts'], howTo: 'Use heavy weights and focus on form to build lower body strength.' },
    { splitDay: 'Lower', goalType: 'wellness', name: 'Lower Body Bodyweight', description: 'Legs and glutes with no equipment', repRange: '15-20 reps', duration: '35 min', intensity: 'Medium', exercises: ['Squat', 'Lunges', 'Glute Bridge', 'Calf Raise', 'Step-Up', 'Wall Sit'], howTo: 'Use bodyweight and tempo (slow negatives) to increase difficulty.' },
    // Bro split – Chest, Back, Shoulders, Arms, Legs
    { splitDay: 'Chest', goalType: 'muscle_growth', name: 'Chest Bodyweight & Dumbbell', description: 'Chest and triceps with push-ups and dumbbells only', repRange: '8-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Push-Up', 'Incline Push-Up', 'Dumbbell Press', 'Dumbbell Flyes', 'Tricep Extension'], howTo: 'Wide push-ups for chest; close grip or diamond for triceps emphasis.' },
    { splitDay: 'Back', goalType: 'strength', name: 'Back Dumbbell Only', description: 'Back and biceps with dumbbells and optional pull-up bar', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Bent Over Row', 'Single-Arm Row', 'Rear Delt Fly', 'Bicep Curl', 'Pull-Up'], howTo: 'Keep back flat on rows; squeeze at the top of each rep.' },
    { splitDay: 'Shoulders', goalType: 'muscle_growth', name: 'Shoulders Bodyweight & Dumbbell', description: 'Delt focus with pike push-ups and dumbbells', repRange: '10-12 reps', duration: '35 min', intensity: 'Medium', exercises: ['Pike Push-Up', 'Shoulder Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly'], howTo: 'Pike push-ups target shoulders; add dumbbells for isolation.' },
    { splitDay: 'Arms', goalType: 'muscle_growth', name: 'Arms Dumbbell Only', description: 'Biceps and triceps with dumbbells only', repRange: '10-12 reps', duration: '30 min', intensity: 'Medium', exercises: ['Bicep Curl', 'Hammer Curl', 'Tricep Extension', 'Overhead Tricep Extension', 'Lateral Raise'], howTo: 'Control the negative and squeeze at the top of each curl and extension.' },
    { splitDay: 'Arms', goalType: 'strength', name: 'Arms Bodyweight & Dumbbell', description: 'Arms with push-ups, dips and dumbbell curls', repRange: '8-12 reps', duration: '35 min', intensity: 'Medium', exercises: ['Diamond Push-Up', 'Tricep Extension', 'Bicep Curl', 'Hammer Curl', 'Close-Grip Push-Up'], howTo: 'Diamond and close-grip push-ups hit triceps; finish with curls.' },
  ];

  const LOWER_BODY_INJURY_IDS = ['ACL', 'Knee', 'Hip', 'Hamstring', 'Groin', 'Calf'];

  /**
   * Memoized "recommended for today" list and injury-skip flag.
   * useMemo recomputes only when deps change, so we avoid recalculating on every render
   * (e.g. when unrelated state like showShareModal changes). Heavy filter/sort runs only when needed.
   */
  const { reccomendedWorkouts, daySkippedBecauseOfInjury } = useMemo(() => {
    const split = selectedSplit && typeof selectedSplit === 'object' && selectedSplit.days
      ? selectedSplit
      : SPLIT_OPTIONS.find((s) => s.id === selectedSplit) || SPLIT_OPTIONS[0];
    const todaySplitDay = getSplitDayForDate(new Date(), split);
    if (!todaySplitDay || todaySplitDay === 'rest') {
      return { reccomendedWorkouts: [], daySkippedBecauseOfInjury: false };
    }

    const dayLower = todaySplitDay.toLowerCase();
    const isLowerOrLegsDay = dayLower === 'lower' || dayLower === 'legs';
    const hasLowerBodyInjury = injuredMuscleIds.some((id) => LOWER_BODY_INJURY_IDS.includes(id));
    if (isLowerOrLegsDay && hasLowerBodyInjury) {
      return { reccomendedWorkouts: [], daySkippedBecauseOfInjury: true };
    }

    const filteredPremium = premiumWorkouts.filter((w) => {
      if (!w.splitDay) return false;
      const wDay = w.splitDay.toLowerCase();
      if (wDay === dayLower) return true;
      if ((dayLower === 'lower' && wDay === 'legs') || (dayLower === 'legs' && wDay === 'lower')) return true;
      return false;
    });
    const filteredUser = userWorkouts.filter((w) => {
      if (w.split_day) return w.split_day.toLowerCase() === dayLower;
      const name = (w.workout_name || w.name || '').toLowerCase();
      return dayLower === 'push' ? name.includes('push') : dayLower === 'pull' ? name.includes('pull') : dayLower === 'legs' ? name.includes('leg') : dayLower === 'upper' ? name.includes('upper') : dayLower === 'lower' ? name.includes('lower') : dayLower === 'full body' ? name.includes('full') : false;
    });

    const combined = [...filteredPremium, ...filteredUser];
    const withFilteredExercises = combined.map((w) => ({
      ...w,
      exercises: filterExercisesByInjury(Array.isArray(w.exercises) ? w.exercises : [], injuredMuscleIds),
    }));

    const userGoal = userProfile?.fitness_goal || null;
    const getKey = (w) => (w.id ?? w.workout_name ?? w.name ?? '').toString();
    const matchesGoal = (w) => userGoal && w.goalType === userGoal;

    const sorted = [...withFilteredExercises].sort((a, b) => {
      const aMatches = matchesGoal(a);
      const bMatches = matchesGoal(b);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      const aIdx = favoriteWorkoutsIds.indexOf(getKey(a));
      const bIdx = favoriteWorkoutsIds.indexOf(getKey(b));
      const aFav = aIdx !== -1;
      const bFav = bIdx !== -1;
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      if (aFav && bFav) return aIdx - bIdx;
      return 0;
    });
    // When the equipment filter is on, drop workouts that need gear the user did not select (see utils/workoutEquipment.js).
    const equipmentFiltered = equipmentFilterEnabled
      ? sorted.filter((w) => workoutFitsUserEquipment(w, userEquipmentIds, true))
      : sorted;
    return { reccomendedWorkouts: equipmentFiltered, daySkippedBecauseOfInjury: false };
  }, [selectedSplit, userWorkouts, injuredMuscleIds, favoriteWorkoutsIds, userProfile?.fitness_goal, equipmentFilterEnabled, userEquipmentIds]);

  // Load saved training split from AsyncStorage so selection persists. Custom split loads its 7-day schedule from a separate key.
  const WORKOUT_SPLIT_STORAGE_KEY = 'workout_split_id';
  const WORKOUT_SPLIT_CUSTOM_DAYS_KEY = 'workout_split_custom_days';
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedId = await AsyncStorage.getItem(WORKOUT_SPLIT_STORAGE_KEY);
        if (!isMounted) return;
        if (savedId) {
          const found = findSplitById(savedId);
          if (found?.id === 'custom') {
            const raw = await AsyncStorage.getItem(WORKOUT_SPLIT_CUSTOM_DAYS_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            const days = Array.isArray(parsed) && parsed.length === 7 ? parsed : DEFAULT_CUSTOM_DAYS;
            setSelectedSplit({ id: 'custom', label: 'Custom', days });
          } else {
            setSelectedSplit(found || SPLIT_OPTIONS[0]);
          }
        }
      } catch (e) {
        console.warn('Failed to load saved workout split:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Sync temporary checklist every time equipment modal opens.
  useEffect(() => {
    if (showEquipmentModal) {
      setDraftEquipmentIds(Array.isArray(userEquipmentIds) ? [...userEquipmentIds] : []);
    }
  }, [showEquipmentModal, userEquipmentIds]);

  const toggleDraftEquipment = (id) => {
    setDraftEquipmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const scrollToRecommended = useCallback(() => {
    workoutScrollViewRef.current?.scrollTo({
      y: Math.max(0, recommendedSectionYRef.current - 20),
      animated: true,
    });
  }, []);

  const handleSelectSplitFromModal = useCallback(async (opt) => {
    if (opt.id === 'custom') {
      try {
        const raw = await AsyncStorage.getItem(WORKOUT_SPLIT_CUSTOM_DAYS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const days = Array.isArray(parsed) && parsed.length === 7 ? parsed : [...DEFAULT_CUSTOM_DAYS];
        setSelectedSplit({ id: 'custom', label: 'Custom', days });
      } catch (e) {
        setSelectedSplit({ id: 'custom', label: 'Custom', days: [...DEFAULT_CUSTOM_DAYS] });
      }
    } else {
      setSelectedSplit(opt);
    }
    try {
      await AsyncStorage.setItem(WORKOUT_SPLIT_STORAGE_KEY, opt.id);
    } catch (e) {
      console.warn('Failed to save workout split:', e);
    }
    setShowAllSplitsModal(false);
  }, []);

  // Load saved injured muscles (for filtering out exercises that target injured areas)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('injuredMuscles');
        if (!isMounted) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          setInjuredMuscleIds(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        console.warn('Failed to load injured muscles:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const USER_EQUIPMENT_STORAGE_KEY = 'user_workout_equipment_ids';
  const EQUIPMENT_FILTER_ENABLED_KEY = 'equipment_filter_enabled';

  // Restore equipment checklist + whether filtering is on (persists across app restarts).
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const rawIds = await AsyncStorage.getItem(USER_EQUIPMENT_STORAGE_KEY);
        const rawFilter = await AsyncStorage.getItem(EQUIPMENT_FILTER_ENABLED_KEY);
        if (!isMounted) return;
        if (rawIds) {
          const parsed = JSON.parse(rawIds);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUserEquipmentIds(parsed);
          }
        }
        if (rawFilter === 'true') setEquipmentFilterEnabled(true);
      } catch (e) {
        console.warn('Failed to load equipment filter settings:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Load saved favorite workout IDs (so favorites persist and recommended list can sort by them)
  const FAVORITE_WORKOUT_IDS_KEY = 'favoriteWorkoutIds';
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITE_WORKOUT_IDS_KEY);
        if (!isMounted) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          setFavoriteWorkoutsIds(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        console.warn('Failed to load favorite workouts:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Run/Walk functions
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission required', 'Please enable location services to track your runs.');
        return;
      }
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
    return () => {
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (recording && !paused) {
      if (!timerRef.current) {
        const startTimeStamp = startTime || Date.now();
        setStartTime(startTimeStamp);
      }
     
      timerRef.current = setInterval(() => {
        const currentElapsed = Math.max(0, Date.now() - startTime - totalPauseTime);
        setElapsed(currentElapsed);
        
        if (distance > 0 && currentElapsed > 0) {
          if (activityType === 'bike') {
            // For biking, calculate speed in km/h or mph
            const elapsedHours = currentElapsed / 1000 / 3600;
            if (useMiles) {
              // Convert distance to miles for mph calculation
              const distanceInMiles = distance * 0.621371;
              const speed = distanceInMiles / elapsedHours; // mph
              setAveragePace(speed);
            } else {
              // Use distance in km for km/h calculation
              const speed = distance / elapsedHours; // km/h
              setAveragePace(speed);
            }
            
            // For current speed, use the latest GPS speed if available
            if (lastValidLocation.current && lastValidLocation.current.speed) {
              const currentSpeed = lastValidLocation.current.speed * (useMiles ? 0.621371 : 3.6); // Convert m/s to mph or km/h
              setCurrentPace(currentSpeed);
            }
          } else {
            // For running/walking, calculate pace in min/km or min/mile
            const elapsedMinutes = currentElapsed / 1000 / 60;
            if (useMiles) {
              // Convert distance to miles for min/mile calculation
              const distanceInMiles = distance * 0.621371;
              const avgPace = elapsedMinutes / distanceInMiles;
              setAveragePace(avgPace);
            } else {
              // Use distance in km for min/km calculation
              const avgPace = elapsedMinutes / distance;
              setAveragePace(avgPace);
            }
            
            // For current pace, calculate based on recent movement
            if (distance > 0.01) { // Only calculate if we've moved at least 10m
              const recentDistance = Math.min(distance, 0.1); // Use last 100m for current pace
              const recentTime = Math.min(currentElapsed / 1000 / 60, 1); // Use last minute or less
              const currentPaceValue = recentTime / recentDistance;
              setCurrentPace(currentPaceValue);
            }
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording, paused, startTime, totalPauseTime, distance, activityType]);

  // Update Live Activity when cardio stats change
  // This keeps the lock screen updated with real-time distance, pace, and time
  useEffect(() => {
    if (!cardioLiveActivityId || !recording) return;
    
    // Estimate calories (rough: ~60 cal/km for running, ~40 for walking, ~30 for biking)
    const calPerKm = activityType === 'run' ? 60 : activityType === 'walk' ? 40 : 30;
    const estimatedCals = (distance || 0) * calPerKm;
    
    updateCardioLiveActivity(cardioLiveActivityId, {
      activityType: activityType,
      distance: rawDistance, // in meters
      pace: averagePace,
      elapsedTime: Math.floor(elapsed / 1000), // convert ms to seconds
      calories: estimatedCals,
      isPaused: paused,
    });
  }, [cardioLiveActivityId, recording, distance, rawDistance, averagePace, elapsed, paused, activityType]);

  // Update progress bar animation when sprint distance changes
  useEffect(() => {
    if (sprintMode && distanceNeededToTravel > 0) {
      const progress = Math.min((distance * 1000) / distanceNeededToTravel, 1);
      Animated.timing(sprintProgressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false, // width animation requires layout
      }).start();
    } else {
      // Reset progress when not in sprint mode
      Animated.timing(sprintProgressAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [distance, sprintMode, distanceNeededToTravel]);

// Optimized Confetti Particle Component - Using fewer animations and better performance
const ConfettiParticle = ({ delay, color, startX, startY }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 150; // Reduced range for better performance
    
    // Simplified animation - removed rotation for better performance
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height + 100,
        duration: 2500 + Math.random() * 500,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: randomX,
        duration: 2500 + Math.random() * 500,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        delay: delay + 1500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: 8,
        height: 8,
        backgroundColor: color,
        borderRadius: 4,
        transform: [
          { translateY },
          { translateX },
        ],
        opacity,
      }}
    />
  );
};

// Optimized Confetti Component - Reduced particle count
const Confetti = ({ visible }) => {
  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#eb4d4b', '#6c5ce7'];
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (visible) {
      // Generate particles once when visible becomes true
      const newParticles = [];
      for (let i = 0; i < 30; i++) { // Reduced from 50 to 30 for better performance
        newParticles.push({
          id: i,
          delay: Math.random() * 300, // Reduced delay range
          color: colors[Math.floor(Math.random() * colors.length)],
          startX: Math.random() * width,
          startY: -10,
        });
      }
      setParticles(newParticles);
    } else {
      setParticles([]); // Clear particles when hidden
    }
  }, [visible]);

  if (!visible || particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          delay={particle.delay}
          color={particle.color}
          startX={particle.startX}
          startY={particle.startY}
        />
      ))}
    </View>
  );
};

// ===========================================
// ALTERNATIVE ANIMATION OPTIONS (5 Options)
// ===========================================

// ANIMATION OPTION 1: Pulsing Ring Animation
const PulsingRingAnimation = ({ visible }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset and start animations
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      opacity.setValue(1);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(ring2, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(ring3, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const ring1Scale = ring1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 3],
  });
  const ring2Scale = ring2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 3],
  });
  const ring3Scale = ring3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 3],
  });

  return (
    <View style={styles.pulsingRingContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.pulsingRing,
          {
            transform: [{ scale: ring1Scale }],
            opacity: ring1.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0.8, 0],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.pulsingRing,
          {
            transform: [{ scale: ring2Scale }],
            opacity: ring2.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0.8, 0],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.pulsingRing,
          {
            transform: [{ scale: ring3Scale }],
            opacity: ring3.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0.8, 0],
            }),
          },
        ]}
      />
    </View>
  );
};

// ANIMATION OPTION 2: Star Burst Animation
const StarBurstAnimation = ({ visible }) => {
  const stars = useRef([]);
  const [starPositions, setStarPositions] = useState([]);

  useEffect(() => {
    if (visible) {
      const newStars = [];
      for (let i = 0; i < 12; i++) {
        const angle = (i * 360) / 12;
        const radius = 120;
        const x = width / 2 + radius * Math.cos((angle * Math.PI) / 180);
        const y = height / 2 + radius * Math.sin((angle * Math.PI) / 180);
        newStars.push({
          id: i,
          angle,
          startX: width / 2,
          startY: height / 2,
          endX: x,
          endY: y,
        });
        stars.current[i] = {
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(1),
        };
      }
      setStarPositions(newStars);

      // Animate stars
      Animated.parallel(
        newStars.map((star, index) =>
          Animated.parallel([
            Animated.timing(stars.current[index].translateX, {
              toValue: star.endX - star.startX,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(stars.current[index].translateY, {
              toValue: star.endY - star.startY,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(stars.current[index].opacity, {
              toValue: 0,
              duration: 400,
              delay: 400,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    } else {
      // Reset animations
      stars.current.forEach((star) => {
        star.translateX.setValue(0);
        star.translateY.setValue(0);
        star.opacity.setValue(1);
      });
    }
  }, [visible]);

  if (!visible || starPositions.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {starPositions.map((star, index) => (
        <Animated.View
          key={star.id}
          style={{
            position: 'absolute',
            left: star.startX,
            top: star.startY,
            width: 20,
            height: 20,
            transform: [
              { translateX: stars.current[index]?.translateX || 0 },
              { translateY: stars.current[index]?.translateY || 0 },
            ],
            opacity: stars.current[index]?.opacity || 1,
          }}
        >
          <Ionicons name="star" size={20} color="#ffd700" />
        </Animated.View>
      ))}
    </View>
  );
};

// ANIMATION OPTION 3: Gradient Wave Animation
const GradientWaveAnimation = ({ visible }) => {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.parallel([
            Animated.timing(wave1, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(wave2, {
              toValue: 1,
              duration: 2000,
              delay: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    } else {
      scale.setValue(0);
      opacity.setValue(0);
      wave1.setValue(0);
      wave2.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const wave1TranslateY = wave1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const wave2TranslateY = wave2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  return (
    <View style={styles.gradientWaveContainer} pointerEvents="none">
      <Animated.View
        style={{
          transform: [{ scale }, { translateY: wave1TranslateY }],
          opacity: opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.6],
          }),
        }}
      >
        <LinearGradient
          colors={['#00ffff', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.waveGradient}
        />
      </Animated.View>
      <Animated.View
        style={{
          transform: [{ scale }, { translateY: wave2TranslateY }],
          opacity: opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.4],
          }),
        }}
      >
        <LinearGradient
          colors={['#ffd700', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.waveGradient}
        />
      </Animated.View>
    </View>
  );
};

// ANIMATION OPTION 4: 3D Flip Card Animation
const FlipCardAnimation = ({ visible, children }) => {
  const flipValue = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(flipValue, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(flipValue, {
            toValue: 0,
            duration: 600,
            delay: 2000,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      scale.setValue(0);
      flipValue.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const rotateY = flipValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { rotateY }],
        perspective: 1000,
      }}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
};

// ANIMATION OPTION 5: Particle Trail Animation (optimized)
const ParticleTrailAnimation = ({ visible }) => {
  const [particles, setParticles] = useState([]);
  const particleAnims = useRef([]);

  useEffect(() => {
    if (visible) {
      const newParticles = [];
      const centerX = width / 2;
      const centerY = height / 2;

      // Create particles in a burst pattern
      for (let i = 0; i < 20; i++) {
        const angle = (i * 360) / 20;
        const distance = 100;
        const endX = centerX + distance * Math.cos((angle * Math.PI) / 180);
        const endY = centerY + distance * Math.sin((angle * Math.PI) / 180);

        newParticles.push({
          id: i,
          startX: centerX,
          startY: centerY,
          endX,
          endY,
        });

        particleAnims.current[i] = {
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(1),
          scale: new Animated.Value(1),
        };
      }

      setParticles(newParticles);

      // Animate particles
      Animated.parallel(
        newParticles.map((particle, index) =>
          Animated.parallel([
            Animated.timing(particleAnims.current[index].translateX, {
              toValue: particle.endX - particle.startX,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(particleAnims.current[index].translateY, {
              toValue: particle.endY - particle.startY,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(particleAnims.current[index].opacity, {
              toValue: 0,
              duration: 600,
              delay: 400,
              useNativeDriver: true,
            }),
            Animated.timing(particleAnims.current[index].scale, {
              toValue: 0.3,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    } else {
      setParticles([]);
      particleAnims.current.forEach((anim) => {
        anim.translateX.setValue(0);
        anim.translateY.setValue(0);
        anim.opacity.setValue(1);
        anim.scale.setValue(1);
      });
    }
  }, [visible]);

  if (!visible || particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.View
          key={particle.id}
          style={{
            position: 'absolute',
            left: particle.startX - 5,
            top: particle.startY - 5,
            width: 10,
            height: 10,
            backgroundColor: '#ffd700',
            borderRadius: 5,
            transform: [
              { translateX: particleAnims.current[index]?.translateX || 0 },
              { translateY: particleAnims.current[index]?.translateY || 0 },
              { scale: particleAnims.current[index]?.scale || 1 },
            ],
            opacity: particleAnims.current[index]?.opacity || 1,
          }}
        />
      ))}
    </View>
  );
};








// ANIMATION OPTION 6: Finish Line Banner Animation
// Unfurls from center with celebration text - perfect for sprint/timed distance completion
const FinishLineBannerAnimation = ({ visible }) => {
  const bannerScale = useRef(new Animated.Value(0)).current;
  const bannerRotate = useRef(new Animated.Value(-90)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const sparkles = useRef([]).current;
  const [sparklePositions, setSparklePositions] = useState([]);

  useEffect(() => {
    if (visible) {
      // Create sparkles around banner for extra celebration effect
      // These sparkles radiate outward from the center
      const newSparkles = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i * 360) / 16; // Evenly distribute 16 sparkles in a circle
        const distance = 80; // Distance from center
        const x = width / 2 + distance * Math.cos((angle * Math.PI) / 180);
        const y = height / 2 + distance * Math.sin((angle * Math.PI) / 180);
        
        newSparkles.push({
          id: i,
          startX: width / 2,
          startY: height / 2,
          endX: x,
          endY: y,
        });
        
        // Initialize animation values for each sparkle
        sparkles[i] = {
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(1),
          scale: new Animated.Value(0),
        };
      }
      setSparklePositions(newSparkles);

      // Banner animation sequence - creates a dramatic unfurling effect
      Animated.sequence([
        // Step 1: Unfurl banner (scale and rotate simultaneously)
        Animated.parallel([
          // Scale from 0 to 1 with spring physics for bounce effect
          Animated.spring(bannerScale, {
            toValue: 1,
            tension: 80, // Higher tension = faster/snappier animation
            friction: 8, // Lower friction = more bouncy
            useNativeDriver: true, // Use native driver for better performance
          }),
          // Rotate from -90deg (vertical/hidden) to 0deg (horizontal/visible)
          Animated.timing(bannerRotate, {
            toValue: 0,
            duration: 500, // Half second for smooth rotation
            useNativeDriver: true,
          }),
        ]),
        // Step 2: Fade in text after banner is visible
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300, // Quick fade in
          useNativeDriver: true,
        }),
      ]).start();

      // Sparkles animation - creates burst effect around banner
      Animated.parallel(
        newSparkles.map((sparkle, index) =>
          Animated.parallel([
            // Scale up sparkle
            Animated.timing(sparkles[index].scale, {
              toValue: 1,
              duration: 200,
              delay: index * 30, // Stagger each sparkle slightly
              useNativeDriver: true,
            }),
            // Move sparkle outward
            Animated.timing(sparkles[index].translateX, {
              toValue: sparkle.endX - sparkle.startX,
              duration: 400,
              delay: index * 30 + 200, // Start after scale animation
              useNativeDriver: true,
            }),
            Animated.timing(sparkles[index].translateY, {
              toValue: sparkle.endY - sparkle.startY,
              duration: 400,
              delay: index * 30 + 200,
              useNativeDriver: true,
            }),
            // Fade out sparkle
            Animated.timing(sparkles[index].opacity, {
              toValue: 0,
              duration: 300,
              delay: index * 30 + 600, // Fade after movement
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    } else {
      // Reset all animations when hidden
      bannerScale.setValue(0);
      bannerRotate.setValue(-90);
      textOpacity.setValue(0);
      sparkles.forEach(sparkle => {
        if (sparkle) {
          sparkle.translateX.setValue(0);
          sparkle.translateY.setValue(0);
          sparkle.opacity.setValue(1);
          sparkle.scale.setValue(0);
        }
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" justifyContent="center" alignItems="center">
      {/* Sparkles that burst outward from center */}
      {sparklePositions.map((sparkle, index) => (
        <Animated.View
          key={sparkle.id}
          style={{
            position: 'absolute',
            left: sparkle.startX - 5, // Center the sparkle icon
            top: sparkle.startY - 5,
            width: 10,
            height: 10,
            transform: [
              { translateX: sparkles[index]?.translateX || 0 }, // Move horizontally
              { translateY: sparkles[index]?.translateY || 0 }, // Move vertically
              { scale: sparkles[index]?.scale || 0 }, // Scale from 0 to 1
            ],
            opacity: sparkles[index]?.opacity || 0,
          }}
        >
          <Ionicons name="sparkles" size={10} color="#ffd700" />
        </Animated.View>
      ))}

      {/* Main banner that unfurls */}
      <Animated.View
        style={{
          transform: [
            { scale: bannerScale }, // Scale animation for size
            { 
              // Rotate animation for unfurling effect
              rotate: bannerRotate.interpolate({
                inputRange: [-90, 0],
                outputRange: ['-90deg', '0deg'], // Rotate from vertical to horizontal
              })
            },
          ],
        }}
      >
        {/* Gradient background for banner - gold to orange gradient */}
        <LinearGradient
          colors={['#ffd700', '#ffaa00', '#ff6b35']} // Gold -> Orange -> Red-orange
          style={{
            width: 250,
            height: 80,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#ffd700', // Golden glow shadow
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.8, // Strong shadow for depth
            shadowRadius: 12, // Blur radius for glow effect
            elevation: 12, // Android shadow
          }}
        >
          {/* Text that fades in after banner unfurls */}
          <Animated.View style={{ opacity: textOpacity }}>
            <Text style={{
              color: '#000', // Black text on gold background
              fontSize: 32,
              fontWeight: 'bold',
              textShadowColor: 'rgba(255, 255, 255, 0.5)', // White text shadow for readability
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}>
              ⚡ COMPLETE! ⚡
            </Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

  // Debug useEffect to monitor distance state changes
  useEffect(() => {
    console.log('Distance State Changed:', {
      distance: distance.toFixed(4),//4 is the amount of 
      rawDistance: rawDistance.toFixed(1),
      timestamp: new Date().toLocaleTimeString()
    });
  }, [distance, rawDistance]);

  const getDistance = (point1, point2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Debug logging for distance calculation
    console.log('Distance Calculation:', {
      point1: { lat: point1.latitude.toFixed(6), lng: point1.longitude.toFixed(6) },
      point2: { lat: point2.latitude.toFixed(6), lng: point2.longitude.toFixed(6) },
      deltaLat: (Δφ * 180 / Math.PI).toFixed(6),
      deltaLng: (Δλ * 180 / Math.PI).toFixed(6),
      calculatedDistance: distance.toFixed(3)
    });
    
    return distance;
  };

  // GPS is considered valid if accuracy is within 50m. (Indoors, accuracy often 20–100m+ so we use
  // "Indoor / Treadmill" mode with step count instead.) If you change 50 to a smaller number (e.g. 20),
  // outdoor tracking becomes stricter and may drop more points; if you use a larger number (e.g. 100),
  // you may get noisier distance when GPS is poor.
  const isLocationValid = (location) => {
    return location &&
           location.coords &&
           location.coords.latitude &&
           location.coords.longitude &&
           location.coords.accuracy <= 50; // 50 meters: balance between accuracy and usability outdoors
  };

// Countdown timer function - shows 3-2-1 before starting sprint
const startSprintWithCountdown = () => {
  // Validate distance is selected
  if (!distanceNeededToTravel || distanceNeededToTravel <= 0) {
    Alert.alert('Error', 'Please select a target distance');
    return;
  }

  // Close modal and start countdown
  setShowSprintModal(false);
  setCountdown(3);
  
  // Initialize animation
  countdownAnim.setValue(1);
  
  // Countdown interval - updates every second
  const countdownInterval = setInterval(() => {
    setCountdown(prev => {
      // When countdown reaches 1 or less, start the sprint
      if (prev <= 1) {
        clearInterval(countdownInterval);
        // Start the actual sprint
        startSprintMaxOut();
        return null; // Hide countdown overlay
      }
      
      // Haptic feedback for each countdown number (3, 2)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Animate countdown number - scale down then back up for bounce effect
      countdownAnim.setValue(0.5);
      Animated.spring(countdownAnim, {
        toValue: 1,
        tension: 100, // Controls spring stiffness
        friction: 8, // Controls damping
        useNativeDriver: true, // Use native driver for better performance
      }).start();
      
      // Decrement countdown
      return prev - 1;
    });
  }, 1000); // Update every 1000ms (1 second)
};

// Sprint Maxout functions
const startSprintMaxOut = async () => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1065',message:'startSprintMaxOut called',data:{distanceNeededToTravel,hasDistance:!!distanceNeededToTravel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!distanceNeededToTravel || distanceNeededToTravel <= 0) {
      Alert.alert('Error', 'Please select a distance to sprint');
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1072',message:'Resetting sprint state',data:{sprintCompleted,previousSprintMode:sprintMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    setSprintMode(true);
    setRecording(true);
    setPaused(false);
    setActivityStarted(true);
    setStartTime(Date.now());
    setTotalPauseTime(0);
    setPauseTime(0);
    setElapsed(0);
    setDistance(0);
    setRawDistance(0);
    setAveragePace(0);
    setCurrentPace(0);
    setLocations([]);
    setStartLocation(null);
    setSprintCompleted(false);
    locationsRef.current = [];
    lastValidLocation.current = null;
    bestAccuracyRef.current = 1000;
    accumulatedDistanceRef.current = 0;
    setShowSprintModal(false);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1092',message:'Calling startSprintLocationTracking',data:{distanceNeededToTravel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    sprintStartTimeRef.current = Date.now();
    const useIndoorSteps = sprintIndoorMode && (
      (Platform.OS === 'ios' && queryStatisticsForQuantity) ||
      (Platform.OS === 'android' && Pedometer)
    );
    if (useIndoorSteps) {
      await startSprintStepTracking();
      // If indoor tracking didn't start (e.g. permission denied), fall back to GPS
      if (stepPollingRef.current == null && pedometerSubRef.current == null) {
        await startSprintLocationTracking();
      }
    } else {
      await startSprintLocationTracking();
    }
    
    // Haptic feedback when sprint actually starts (after countdown)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Note: Alert removed since countdown already provides visual feedback
  } catch (error) {
    console.error('Error starting sprint:', error);
    Alert.alert('Error', 'Failed to start sprint. Please try again.');
    setSprintMode(false);
  }
};

const checkSprintCompletion = () => {
  // Check if sprint distance has been reached (convert km to meters for comparison)
  const distanceInMeters = distance * 1000;
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1105',message:'checkSprintCompletion called',data:{distance,distanceInMeters,distanceNeededToTravel,sprintMode,sprintCompleted,willComplete:distanceInMeters >= distanceNeededToTravel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (sprintMode && distanceInMeters >= distanceNeededToTravel && !sprintCompleted) {
    // Trigger completion animations
    setSprintCompleted(true);
    setShowConfetti(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Animate finish line and celebration
    Animated.parallel([
      Animated.timing(finishLineOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(celebrationScale, {
          toValue: 1.1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const completionTime = elapsed / 1000;
    const speed = distanceNeededToTravel / completionTime;
    
    // Delay alert to show animation first
    // We use setTimeout to delay the alert so the confetti animation is visible first
    setTimeout(() => {
      Alert.alert(
        'Timed Distance Completed! 🎉',
        `Distance: ${distanceNeededToTravel.toFixed(0)}m\nTime: ${formatRunTime(elapsed)}\nAverage Speed: ${(speed * 3.6).toFixed(2)} km/h`,
        [
          {
            text: 'Share',
            onPress: () => {
              // Call the share function when user taps Share button
              shareSprintResults();
            },
            style: 'default'
          },
          {
            text: 'View Summary',
            onPress: () => {
              stopActivity();
            },
            style: 'default'
          }
        ],
        { cancelable: true } // Allow user to dismiss by tapping outside
      );
    }, 800);
    
    // Auto-stop after celebration
    setTimeout(() => {
      setShowConfetti(false);
      stopActivity();
    }, 3500);
  }
};

// Check sprint completion whenever distance updates
useEffect(() => {
  if (sprintMode && recording && !paused) {
    checkSprintCompletion();
  }
}, [distance, sprintMode, recording, paused]);

// Share sprint results function - allows users to share their sprint completion stats
// This is an async function because it uses 'await' to check if sharing is available and to share
const shareSprintResults = async () => {
  try {
    // Calculate the speed in km/h for the share message
    // elapsed is in milliseconds, so we divide by 1000 to get seconds, then calculate speed
    const completionTime = elapsed / 1000;
    const speed = (distanceNeededToTravel / completionTime) * 3.6; // Convert m/s to km/h
    
    // Create the share message with challenge stats
    const message = `🏃 Just completed a ${distanceNeededToTravel.toFixed(0)}m timed distance in ${formatRunTime(elapsed)}! 
Average speed: ${speed.toFixed(2)} km/h`;
    
    // Check if sharing is available on the device before attempting to share
    // This prevents errors on devices that don't support sharing
    if (await Sharing.isAvailableAsync()) {
      // Share the message - this opens the native share dialog
      await Sharing.shareAsync({ message });
    } else {
      // If sharing isn't available, show an alert to the user
      Alert.alert('Sharing not available', 'Sharing is not available on this device.');
    }
  } catch (error) {
    // Handle any errors that occur during sharing (e.g., user cancels share dialog)
    console.error('Error sharing sprint results:', error);
    // Don't show an error to the user unless it's a critical error
    // Most sharing errors are just user cancellation, which is fine
  }
};

const startActivity = async () => {
    try {
      setRecording(true);
      setPaused(false);
      setActivityStarted(true);
      setStartTime(Date.now());
      setTotalPauseTime(0);
      setPauseTime(0);
      setElapsed(0);
      setDistance(0);
      setRawDistance(0);
      setAveragePace(0);
      setCurrentPace(0);
      setLocations([]);
      setStartLocation(null);
      locationsRef.current = [];
      lastValidLocation.current = null;
      bestAccuracyRef.current = 1000; // Reset best accuracy for new run
      accumulatedDistanceRef.current = 0; // Reset accumulated distance ref
      
      await startLocationTracking();
      
      // Start Live Activity on lock screen (shows distance, pace, time)
      const liveId = await startCardioLiveActivity({
        activityType: activityType,
        distance: 0,
        pace: 0,
        elapsedTime: 0,
        calories: 0,
      });
      if (liveId) setCardioLiveActivityId(liveId);
    } catch (error) {
      console.error('Error starting run:', error);
      Alert.alert('Error', 'Failed to start tracking. Please try again.');
    }
  };

  const pauseActivity = () => {
    if (paused) {
      // Unpausing - calculate pause duration and add to total pause time
      const pauseDuration = Date.now() - pauseTime;
      setTotalPauseTime(prev => prev + pauseDuration);
      setPaused(false);
      setPauseTime(0);
      startLocationTracking(false);
    } else {
      // Pausing - record the pause start time
      setPaused(true);
      setPauseTime(Date.now());
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    }
  };

  const startLocationTracking = async (isPaused = false) => {
    if (isPaused) return;

    try {
      locationWatcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Increased to 1000ms for more stable GPS updates
          distanceInterval: 1, // Increased to 1 meter for more stable tracking
        },
        (location) => {
          if (!isLocationValid(location)) return;

          // Track best GPS accuracy achieved
          if (location.coords.accuracy < bestAccuracyRef.current) {
            bestAccuracyRef.current = location.coords.accuracy;
            console.log('New best GPS accuracy achieved:', bestAccuracyRef.current.toFixed(1));
          }
          
          // Log GPS accuracy for debugging
          console.log('GPS Location Received:', {
            accuracy: location.coords.accuracy,
            bestAccuracy: bestAccuracyRef.current.toFixed(1),
            latitude: location.coords.latitude.toFixed(6),
            longitude: location.coords.longitude.toFixed(6),
            timestamp: new Date(location.timestamp).toLocaleTimeString(),
            speed: location.coords.speed || 'N/A',
            heading: location.coords.heading || 'N/A'
          });

          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
            speed: location.coords.speed || null, // Store speed for current speed calculation
          };

          if (lastValidLocation.current) {
            const distanceIncrement = getDistance(lastValidLocation.current, newLocation);
            
            // Check if GPS coordinates actually changed significantly
            const latDiff = Math.abs(newLocation.latitude - lastValidLocation.current.latitude);
            const lngDiff = Math.abs(newLocation.longitude - lastValidLocation.current.longitude);
            const minCoordinateChange = 0.000001; // About 10cm in latitude/longitude for more sensitive tracking
            
            // Debug logging for distance tracking
            console.log('GPS Update:', {
              distanceIncrement: distanceIncrement.toFixed(3),
              currentRawDistance: rawDistance.toFixed(3),
              newRawDistance: (rawDistance + distanceIncrement).toFixed(3),
              currentDistanceKm: distance.toFixed(4),
              accuracy: location.coords.accuracy,
              lastLat: lastValidLocation.current.latitude.toFixed(6),
              newLat: newLocation.latitude.toFixed(6),
              lastLng: lastValidLocation.current.longitude.toFixed(6),
              newLng: newLocation.longitude.toFixed(6),
              latDiff: latDiff.toFixed(8),
              lngDiff: lngDiff.toFixed(8),
              significantChange: (latDiff > minCoordinateChange || lngDiff > minCoordinateChange)
            });
            
            // Update distance if there's a significant GPS change (remove overly strict accuracy check)
            if (latDiff > minCoordinateChange || lngDiff > minCoordinateChange) {
              // Use ref to avoid race conditions with state updates
              const newRawDistance = accumulatedDistanceRef.current + distanceIncrement;
              accumulatedDistanceRef.current = newRawDistance;
              
              setRawDistance(newRawDistance);
              
              // Simply convert to kilometers and accumulate with previous distance
              const newDistanceKm = newRawDistance / 1000;
              setDistance(newDistanceKm);
              
              // Always add the location to the path for map visualization
              locationsRef.current.push(newLocation);
              setLocations([...locationsRef.current]);
              
              // Force UI update by triggering a re-render
              setLocations(prev => [...prev]);
              
              // Additional debug logging
              console.log('Distance Update:', {
                increment: distanceIncrement.toFixed(3),
                oldRaw: rawDistance.toFixed(3),
                newRaw: newRawDistance.toFixed(3),
                oldDistance: (distance || 0).toFixed(4),
                newDistance: newDistanceKm.toFixed(4),
                totalAccumulated: newDistanceKm.toFixed(4),
                accuracy: location.coords.accuracy
              });
            } else {
              console.log('GPS coordinates too similar, skipping distance update', {
                latDiff: latDiff.toFixed(8),
                lngDiff: lngDiff.toFixed(8),
                accuracy: location.coords.accuracy,
                minCoordinateChange
              });
              
              // Still add location to path even if distance isn't updated
              locationsRef.current.push(newLocation);
              setLocations([...locationsRef.current]);
            }
            
            lastValidLocation.current = newLocation;
            
            // Only auto-zoom if the toggle is ON
            if (autoZoom && mapRef.current) {
              console.log('Auto-zoom enabled, animating to region. autoZoom state:', autoZoom);
              mapRef.current.animateToRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
            } else {
              console.log('Auto-zoom disabled or no map ref. autoZoom state:', autoZoom, 'mapRef exists:', !!mapRef.current);
            }
          } else {
            lastValidLocation.current = newLocation;
            // Only set start location ONCE at the very beginning
            if (!startLocation) {
              setStartLocation(newLocation);
              // Add initial location to path
              locationsRef.current.push(newLocation);
              setLocations([...locationsRef.current]);
              console.log('Initial start location set:', {
                lat: newLocation.latitude.toFixed(6),
                lng: newLocation.longitude.toFixed(6)
              });
            }
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const startSprintLocationTracking = async () => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1397',message:'startSprintLocationTracking entry',data:{distanceNeededToTravel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const { status } = await Location.requestForegroundPermissionsAsync();
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1399',message:'Location permission status',data:{status,granted:status==='granted'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (status !== 'granted') {
      Alert.alert('Error', 'Location permission required');
      return;
    }

    if (!distanceNeededToTravel || distanceNeededToTravel <= 0) {
      Alert.alert('Error', 'Please select a distance to sprint');
      return;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1413',message:'Starting location watcher',data:{distanceNeededToTravel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // Reset recent distances for new sprint
    recentDistanceRef.current = [];

    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 100,
        distanceInterval: 0.5,
        mayShowUserSettingsDialog: true,
      },
      (location) => {
        // Relaxed to 25m so marginal GPS (e.g. near buildings) still counts. Indoors use "Indoor / Treadmill" mode.
        if (!location || !location.coords || !location.coords.latitude || !location.coords.longitude || location.coords.accuracy > 25) {
          console.log("Sprint GPS: Rejected for low accuracy:", location?.coords?.accuracy);
          return;
        }

        if (location.coords.accuracy < bestAccuracyRef.current) {
          bestAccuracyRef.current = location.coords.accuracy;
          console.log('New best GPS accuracy achieved:', bestAccuracyRef.current.toFixed(1));
        }

        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
          speed: location.coords.speed || null,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading || null,
        };

        if (lastValidLocation.current) {
          const distanceIncrement = getDistance(lastValidLocation.current, newLocation);
          const latDiff = Math.abs(newLocation.latitude - lastValidLocation.current.latitude);
          const lngDiff = Math.abs(newLocation.longitude - lastValidLocation.current.longitude);
          const minCoordinateChange = 0.0000005; // About 5cm for sprint tracking

          const timeDiff = (newLocation.timestamp - lastValidLocation.current.timestamp) / 1000;
          const calculatedSpeed = distanceIncrement / timeDiff;

          // Apply moving average filter for smooth tracking
          recentDistanceRef.current.push(distanceIncrement);
          if (recentDistanceRef.current.length > 5) {
            recentDistanceRef.current.shift(); // Remove the first element to keep array size constant
          }

          // Calculate smoothed increment
          const smoothedIncrement = recentDistanceRef.current.reduce((a, b) => a + b, 0) / recentDistanceRef.current.length;

          // Filter out unrealistic speeds (more than 15 m/s = 54 km/h)
          if (calculatedSpeed > 15) {
            console.log("Sprint GPS: Rejected for unrealistic speed:", calculatedSpeed.toFixed(2), "m/s");
            return;
          }

          // Accuracy weighting: better GPS fixes count more. weight = 1/(1 + accuracy/20) so 10m → ~0.67, 25m → ~0.44
          const accuracyWeight = 1 / (1 + (location.coords.accuracy || 25) / 20);
          // Optional: cap spike if device reports speed and computed increment is way above speed*time
          const speedCap = (location.coords.speed != null && location.coords.speed > 0 && location.coords.speed < 15)
            ? location.coords.speed * timeDiff * 1.5
            : Infinity;
          const weightedIncrement = Math.min(smoothedIncrement * accuracyWeight, speedCap);

          // Track changes if coordinates changed significantly
          if (latDiff > minCoordinateChange || lngDiff > minCoordinateChange) {
            const newRawDistance = accumulatedDistanceRef.current + weightedIncrement;
            accumulatedDistanceRef.current = newRawDistance;
            
            setRawDistance(newRawDistance);
            // Convert to kilometers for distance state (used for display)
            const newDistanceKm = newRawDistance / 1000;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:1472',message:'Distance updated in sprint mode',data:{newRawDistance,newDistanceKm,distanceNeededToTravel,sprintMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            setDistance(newDistanceKm);

            // Add to path
            locationsRef.current.push(newLocation);
            setLocations([...locationsRef.current]);
          }

          lastValidLocation.current = newLocation;
        } else {
          // First location - set as start
          lastValidLocation.current = newLocation;
          if (!startLocation) {
            setStartLocation(newLocation);
            locationsRef.current.push(newLocation);
            setLocations([...locationsRef.current]);
          }
        }
      }
    );
  } catch (error) {
    console.error('Error starting sprint location tracking:', error);
    Alert.alert('Error', 'Failed to start GPS tracking. Please ensure location services are enabled.');
  }
};

// Default stride when settings not loaded (meters). User can set in Settings → Workout Preferences.
const DEFAULT_STRIDE_METERS = 0.75;

/**
 * Starts timed distance using step count: HealthKit on iOS, Pedometer (expo-sensors) on Android.
 * Uses the user's stride length from Settings for more accurate indoor/treadmill distance.
 */
const startSprintStepTracking = async () => {
  const strideM = settings?.indoor_stride_length_meters ?? DEFAULT_STRIDE_METERS;

  if (Platform.OS === 'ios' && queryStatisticsForQuantity) {
    const startTimeMs = sprintStartTimeRef.current || Date.now();
    const pollIntervalMs = 1000; // 1s for smoother updates

    const pollSteps = async () => {
      try {
        const now = new Date();
        const startDate = new Date(startTimeMs);
        const result = await queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierStepCount',
          ['cumulativeSum'],
          { filter: { date: { startDate, endDate: now } } }
        );
        const steps = result?.sumQuantity?.quantity ?? result?.sumQuantity?.value ?? 0;
        const rawMeters = steps * strideM;
        accumulatedDistanceRef.current = rawMeters;
        setRawDistance(rawMeters);
        setDistance(rawMeters / 1000);
      } catch (e) {
        console.warn('Indoor step query failed:', e);
      }
    };
    await pollSteps();
    stepPollingRef.current = setInterval(pollSteps, pollIntervalMs);
    return;
  }

  if (Platform.OS === 'android' && Pedometer) {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        Alert.alert('Not available', 'Step counter is not available on this device.');
        return;
      }
      const { status } = await Pedometer.requestPermissionsAsync?.() ?? {};
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow step count access for indoor distance.');
        return;
      }
      indoorStartStepsRef.current = null;
      pedometerSubRef.current = Pedometer.watchStepCount((result) => {
        const steps = result?.steps ?? 0;
        if (indoorStartStepsRef.current === null) indoorStartStepsRef.current = steps;
        const delta = Math.max(0, steps - indoorStartStepsRef.current);
        const rawMeters = delta * strideM;
        accumulatedDistanceRef.current = rawMeters;
        setRawDistance(rawMeters);
        setDistance(rawMeters / 1000);
      });
    } catch (e) {
      console.warn('Android pedometer failed:', e);
      Alert.alert('Error', 'Could not start step tracking. Try GPS mode instead.');
    }
  }
};

  const stopActivity = async () => {
    try {
      const wasSprintMode = sprintMode;
      setRecording(false);
      setPaused(false);
      setActivityStarted(false);  
      setSprintMode(false);
      setSprintCompleted(false); // Reset completion state
      setShowConfetti(false); // Hide confetti
      setCountdown(null); // Reset countdown timer
      
      // Reset animations
      celebrationScale.setValue(0);
      finishLineOpacity.setValue(0);
      
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
      if (stepPollingRef.current != null) {
        clearInterval(stepPollingRef.current);
        stepPollingRef.current = null;
      }
      if (pedometerSubRef.current != null) {
        pedometerSubRef.current.remove();
        pedometerSubRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // End Live Activity with final stats
      const calPerKm = activityType === 'run' ? 60 : activityType === 'walk' ? 40 : 30;
      const finalCals = (distance || 0) * calPerKm;
      
      if (cardioLiveActivityId) {
        await endCardioLiveActivity(cardioLiveActivityId, {
          activityType: wasSprintMode ? 'timed_distance' : activityType,
          distance: rawDistance,
          duration: elapsed / 1000,
          averagePace: averagePace,
          calories: finalCals,
        });
        setCardioLiveActivityId(null);
      }

      // Navigate to activity summary (handles run, walk, bike, and timed distance)
      // Convert distance to the correct unit for display
      const displayDistance = useMiles ? distance * 0.621371 : distance;
      
      router.push({
        pathname: '/(modals)/activity-summary',
        params: {
          locations: JSON.stringify(locations),
          distance: displayDistance,
          duration: elapsed / 1000,
          pace: averagePace,
          unit: useMiles ? 'miles' : 'km',
          activityType: wasSprintMode ? 'timed_distance' : activityType,
          startTime: startTime,
          endTime: Date.now(),
          sprintDistance: wasSprintMode ? distanceNeededToTravel : null
        }
      });
      
      // Reset state
      setDistance(0);
      setRawDistance(0);
      setElapsed(0);
      setAveragePace(0);
      setCurrentPace(0);
      setLocations([]);
      setStartLocation(null);
      setStartTime(null);
      setTotalPauseTime(0);
      setPauseTime(0);
      setDistanceNeededToTravel(0);
      setSelectedSprintDistance(null);
      setCustomDistance('');
      locationsRef.current = [];
      lastValidLocation.current = null;
      bestAccuracyRef.current = 1000;
      accumulatedDistanceRef.current = 0;
    } catch (error) {
      console.error('Error stopping run:', error);
      Alert.alert('Error', 'Failed to complete activity. Please try again.');
    }
  };

  const formatRunTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const totalDistance = distanceNeededToTravel || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60; // %60 gives the remaining seconds after removing full hours
    const hundrethsSeconds = Math.floor(ms % 1000) / 10;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
   
    else if (totalDistance <= 400) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundrethsSeconds.toString().padStart(2, '0')}`;
    }
    else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };


  const formatPace = (pace) => {
    if (pace <= 0) return '--:--';
    const minutes = Math.floor(pace);
    const seconds = Math.floor((pace % 1) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (useMiles) {
      return (meters * 0.000621371).toFixed(2);
    }
    return (meters / 1000).toFixed(2);
  };

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'workout' && styles.activeTabButton]}
          onPress={() => setActiveTab('workout')}
        >
          <Ionicons 
            name={activeTab === 'workout' ? 'barbell' : 'barbell-outline'} 
            size={20} 
            color={activeTab === 'workout' ? '#00ffff' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'workout' && styles.activeTabText]}>
            Workouts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'run' && styles.activeTabButton]}
          onPress={() => setActiveTab('run')}
        >
          <Ionicons 
            name={activeTab === 'run' ? 'walk' : 'walk-outline'} 
            size={20} 
            color={activeTab === 'run' ? '#00ffff' : '#666'} 
          />
                                        <Text style={[styles.tabText, activeTab === 'run' && styles.activeTabText]}>
                                Run/Walk/Bike
                              </Text>
        </TouchableOpacity>
      </View>

      {/* Workout Tab Content */}
      {activeTab === 'workout' && (
        <ScrollView ref={workoutScrollViewRef} style={styles.scrollView}>
          {/* Recovery Map - muscle group recovery at top */}
          {userProfile?.id && (
            <View style={{ marginBottom: 12 }}>
              <RecoveryMap userId={userProfile.id} refreshKey={recoveryMapRefreshKey} />
            </View>
          )}
          <View style={styles.header}>
            <View style={styles.sectionHeader}>
            <Text style={styles.title}>Workouts</Text>
              <TouchableOpacity 
                style={styles.createWorkoutButton}
                onPress={() => setShowLogs(true)}
              >
                <Ionicons name="time-outline" size={20} color="#00ffff" style={{marginRight: 6}} />
                <Text style={styles.createWorkoutButtonText}>View Logs</Text>
              </TouchableOpacity>
          </View>
        </View>

          {/* Monthly Workout Calendar */}
          {/* #region agent log */}
          {(() => {
            fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workout.js:2424',message:'Rendering MonthlyWorkoutCalendar',data:{hasComponent:!!MonthlyWorkoutCalendar,hasRef:!!calendarRef},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            return null;
          })()}
          {/* #endregion */}
          <MonthlyWorkoutCalendar
            ref={calendarRef}
            selectedSplit={selectedSplit && selectedSplit.days ? selectedSplit : SPLIT_OPTIONS.find((s) => s.id === (selectedSplit?.id ?? selectedSplit)) || SPLIT_OPTIONS[0]}
            getSplitDayForDate={getSplitDayForDate}
            onDayPress={(date, existingWorkout) => {
              setSelectedScheduledDate(date);
              setSelectedScheduledWorkout(existingWorkout);
              setShowScheduledWorkoutModal(true);
            }}
          />

          {/* Scheduled Workout or Rest Day for Today */}
          {todayScheduledWorkout && (
            <View style={styles.scheduledWorkoutSection}>
              {todayScheduledWorkout.is_rest_day ? (
                // Rest Day Display
                <>
                  <Text style={styles.scheduledRestDayHeader}>TODAY'S SCHEDULE</Text>
                  <View style={styles.scheduledRestDayCard}>
                    <View style={styles.restDayIconContainer}>
                      <Ionicons name="bed-outline" size={48} color="#ffa500" />
                    </View>
                    <Text style={styles.restDayTitle}>Rest Day</Text>
                    <Text style={styles.restDayMessage}>
                      Recovery is an essential part of training. Take time to rest and let your muscles rebuild.
                    </Text>
                    {todayScheduledWorkout.notes && todayScheduledWorkout.notes !== 'Rest day' && (
                      <View style={styles.restDayNotesBox}>
                        <Text style={styles.restDayNotesText}>{todayScheduledWorkout.notes}</Text>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                // Workout Display
                <>
                  <Text style={styles.scheduledWorkoutHeader}>SCHEDULED WORKOUT</Text>
                  <View style={styles.scheduledWorkoutCard}>
                    <View style={styles.scheduledWorkoutHeader}>
                      <View style={styles.scheduledWorkoutTitleContainer}>
                        <Ionicons name="calendar" size={20} color="#00ffff" />
                        <Text style={styles.scheduledWorkoutTitle}>
                          {todayScheduledWorkout.workout_name}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.exercises}>
                      <Text style={styles.exercisesTitle}>Exercises:</Text>
                      {todayScheduledWorkout.workout_exercises && 
                        todayScheduledWorkout.workout_exercises.slice(0, 3).map((exercise, index) => (
                          <Text key={index} style={styles.exercisesList}>
                            • {typeof exercise === 'string' ? exercise : exercise.name}
                            {exercise.sets && exercise.reps && ` (${exercise.sets} x ${exercise.reps})`}
                          </Text>
                        ))
                      }
                      {todayScheduledWorkout.workout_exercises && 
                        todayScheduledWorkout.workout_exercises.length > 3 && (
                          <Text style={styles.exercisesList}>
                            ... and {todayScheduledWorkout.workout_exercises.length - 3} more
                          </Text>
                        )
                      }
                    </View>
                    <TouchableOpacity
                      style={styles.startScheduledButton}
                      onPress={() => startWorkout({
                        id: todayScheduledWorkout.id,
                        name: todayScheduledWorkout.workout_name,
                        workout_name: todayScheduledWorkout.workout_name,
                        exercises: todayScheduledWorkout.workout_exercises,
                        isScheduled: true
                      })}
                    >
                      <Ionicons name="play" size={20} color="#000" />
                      <Text style={styles.startScheduledButtonText}>Start Scheduled Workout</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Compact today strip: split + recommended count, tap to scroll to full list */}
          <TouchableOpacity
            style={styles.todayStrip}
            onPress={scrollToRecommended}
            activeOpacity={0.8}
          >
            <View style={styles.todayStripLeft}>
              <Text style={styles.todayStripLabel}>Today</Text>
              <Text style={styles.todayStripSplit}>
                {getSplitDayForDate(
                  new Date(),
                  selectedSplit && selectedSplit.days
                    ? selectedSplit
                    : SPLIT_OPTIONS.find((s) => s.id === (selectedSplit?.id ?? selectedSplit)) || SPLIT_OPTIONS[0]
                ) ?? '—'}
              </Text>
            </View>
            <View style={styles.todayStripRight}>
              <Text style={styles.todayStripCount}>
                {reccomendedWorkouts.length > 0
                  ? `${reccomendedWorkouts.length} recommended`
                  : 'No recommended'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(0, 255, 255, 0.8)" />
            </View>
          </TouchableOpacity>

          {/* Main Workout Content */}
            <View style={{marginHorizontal: 20, marginTop: 10, marginBottom: 0}}>
              <TouchableOpacity 
                style={styles.trainingPlansButton}
                onPress={() => router.push('/pr')}
              >
                <Ionicons name="trophy-outline" size={20} color="#00ffff" style={{marginRight: 6}} />
                <Text style={styles.trainingPlansButtonText}>View Personal Records</Text>
              </TouchableOpacity>
            </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/freeform-workout')}>
            <View style={styles.actionButtonContent}>
              <Ionicons name="fitness-outline" size={26} color="#00ffff" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonTitle}>Freeform Workout</Text>
                <Text style={styles.actionButtonDescription}>Build your workout as you go</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/create-workout')}>
            <View style={styles.actionButtonContent}>
              <Ionicons name="add-circle-outline" size={26} color="#00ffff" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonTitle}>Create Workout</Text>
                <Text style={styles.actionButtonDescription}>Plan your workout beforehand</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#666" />
          </TouchableOpacity>

          <View style={styles.actionButtonWrapper}>
            <TouchableOpacity style={styles.actionButton} onPress={handleGenerateWorkout}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="sparkles-outline" size={26} color="#00ffff" />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonTitle}>Generate Workout</Text>
                  <Text style={styles.actionButtonDescription}>AI creates a workout for you</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#666" />
              <View style={styles.actionButtonUsageBadge}>
                <Text style={styles.actionButtonUsageBadgeText}>
                  {workoutUsage.currentUsage}/{workoutUsage.limit}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending Workout Shares */}
        {pendingShares.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Workout Invites</Text>
            <View style={styles.workoutCardsContainer}>
              {pendingShares.map((share) => (
              <View key={share.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutTitleContainer}>
                    <Text style={styles.workoutTitle}>{share.workouts?.workout_name || 'Unknown Workout'}</Text>
                    <Text style={styles.workoutDescription}>
                      Shared by {share.profiles?.username || share.profiles?.full_name || 'Unknown User'}
                    </Text>
                  </View>
                  <View style={styles.workoutHeaderRight}>
                    <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout(share.workouts || {}); }}>
                      {favoriteWorkoutsIds.includes(getFavoriteKey(share.workouts || {})) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                    </TouchableOpacity>
                    <Text style={styles.repRangeText}>
                      {Array.isArray(share.workouts?.exercises) ? share.workouts.exercises.length : 0} exercises
                    </Text>
                  </View>
                </View>
                {share.message && (
                  <Text style={styles.shareMessage}>"{share.message}"</Text>
                )}
                <View style={styles.exercises}>
                  <Text style={styles.exercisesTitle}>Exercises:</Text>
                  {Array.isArray(share.workouts?.exercises) && share.workouts.exercises.slice(0, 3).map((ex, idx) => {
                    if (typeof ex === 'string') {
                      return <Text key={idx} style={styles.exercisesList}>• {ex}</Text>;
                    } else if (typeof ex === 'object' && ex !== null) {
                      return <Text key={idx} style={styles.exercisesList}>• {ex.name} ({ex.sets || 3} x {ex.reps || 10})</Text>;
                    } else {
                      return null;
                    }
                  })}
                  {Array.isArray(share.workouts?.exercises) && share.workouts.exercises.length > 3 && (
                    <Text style={styles.exercisesList}>... and {share.workouts.exercises.length - 3} more</Text>
                  )}
                </View>
                <View style={styles.shareActions}>
                  <TouchableOpacity 
                    style={[styles.shareActionButton, styles.acceptButton]}
                    onPress={() => handleShareResponse(share.id, 'accept')}
                  >
                    <Ionicons name="checkmark" size={16} color="#000" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.shareActionButton, styles.declineButton]}
                    onPress={() => handleShareResponse(share.id, 'decline')}
                  >
                    <Ionicons name="close" size={16} color="#000" />
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
              ))}
            </View>
          </View>
        )}

        {/* Shared Workouts */}
        {sharedWorkouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared With Me</Text>
            <View style={styles.workoutCardsContainer}>
              {sharedWorkouts.map((workout) => (
              <View key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutTitleContainer}>
                    <Text style={styles.workoutTitle}>{workout.workout_name}</Text>
                    <Text style={styles.workoutDescription}>
                      Shared by {workout.profiles?.username || workout.profiles?.full_name || 'Unknown User'}
                    </Text>
                  </View>
                  <View style={styles.workoutHeaderRight}>
                    <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout(workout); }}>
                      {favoriteWorkoutsIds.includes(getFavoriteKey(workout)) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                    </TouchableOpacity>
                    <Text style={styles.repRangeText}>
                      {Array.isArray(workout.exercises) ? workout.exercises.length : 0} exercises
                    </Text>
                    <TouchableOpacity 
                      onPress={() => handleDeleteSharedWorkout(workout.id)}
                      style={styles.shareButton}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.exercises}>
                  <Text style={styles.exercisesTitle}>Exercises:</Text>
                  {Array.isArray(workout.exercises) && workout.exercises.map((ex, idx) => {
                    if (typeof ex === 'string') {
                      return <Text key={idx} style={styles.exercisesList}>• {ex}</Text>;
                    } else if (typeof ex === 'object' && ex !== null) {
                      return <Text key={idx} style={styles.exercisesList}>• {ex.name} ({ex.sets || 3} x {ex.reps || 10})</Text>;
                    } else {
                      return null;
                    }
                  })}
                </View>
                <TouchableOpacity 
                  style={styles.startButton}
                  onPress={() => handleStartSharedWorkout(workout)}
                >
                  <Text style={styles.startButtonText}>Start Workout</Text>
                </TouchableOpacity>
              </View>
              ))}
            </View>
          </View>
        )}

        {/* Split selector + Recommended for today */}
        <View
          ref={recommendedSectionRef}
          style={styles.section}
          onLayout={(e) => { recommendedSectionYRef.current = e.nativeEvent.layout.y; }}
        >
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Training split</Text>
            <View style={styles.splitHeaderActions}>
              <TouchableOpacity
                onPress={() => setShowEquipmentModal(true)}
                style={styles.injuryButton}
              >
                <Ionicons name="barbell-outline" size={18} color="#00ffff" />
                <Text style={styles.injuryButtonText}>
                  {equipmentFilterEnabled ? 'Equipment (on)' : 'Equipment'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowInjuryModal(true)}
                style={styles.injuryButton}
              >
                <Ionicons name="body-outline" size={18} color="#00ffff" />
                <Text style={styles.injuryButtonText}>
                  {injuredMuscleIds.length > 0 ? `Injuries (${injuredMuscleIds.length})` : 'Injuries'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {visibleSplitOptions.map((opt) => {
              const isSelected = effectiveSplit.id === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={async () => {
                    if (opt.id === 'custom') {
                      try {
                        const raw = await AsyncStorage.getItem(WORKOUT_SPLIT_CUSTOM_DAYS_KEY);
                        const parsed = raw ? JSON.parse(raw) : null;
                        const days = Array.isArray(parsed) && parsed.length === 7 ? parsed : [...DEFAULT_CUSTOM_DAYS];
                        setSelectedSplit({ id: 'custom', label: 'Custom', days });
                      } catch (e) {
                        setSelectedSplit({ id: 'custom', label: 'Custom', days: [...DEFAULT_CUSTOM_DAYS] });
                      }
                    } else {
                      setSelectedSplit(opt);
                    }
                    try {
                      await AsyncStorage.setItem(WORKOUT_SPLIT_STORAGE_KEY, opt.id);
                    } catch (e) {
                      console.warn('Failed to save workout split:', e);
                    }
                  }}
                  style={[styles.periodButton, isSelected && styles.periodButtonActive, { marginRight: 8 }]}
                >
                  <Text style={[styles.periodButtonText, isSelected && styles.periodButtonTextActive]} numberOfLines={1}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
            {SPLIT_OPTIONS.length > VISIBLE_SPLITS_COUNT && (
              <TouchableOpacity
                style={[styles.periodButton, { marginRight: 8 }]}
                onPress={() => setShowAllSplitsModal(true)}
              >
                <Text style={styles.moreSplitsButtonText}>More splits</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {selectedSplit?.id === 'custom' && (
            <TouchableOpacity
              style={styles.customSplitEditButton}
              onPress={() => {
                const current = selectedSplit?.days && selectedSplit.days.length === 7 ? selectedSplit.days : DEFAULT_CUSTOM_DAYS;
                const toDisplay = (d) => {
                  const s = (typeof d === 'string' ? d.trim() : String(d)) || 'rest';
                  const match = SPLIT_DAY_OPTIONS.find((o) => o.toLowerCase() === s.toLowerCase());
                  return match || (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
                };
                setCustomDaysForEdit(current.map(toDisplay));
                setShowCustomSplitModal(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color="#00ffff" />
              <Text style={styles.customSplitEditButtonText}>Edit week</Text>
            </TouchableOpacity>
          )}
          {reccomendedWorkouts.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                Recommended for today ({getSplitDayForDate(new Date(), effectiveSplit)})
              </Text>
              <View style={styles.workoutCardsContainer}>
                {reccomendedWorkouts.map((workout, idx) => (
                  <RecommendedWorkoutCard
                    key={workout.id || workout.name || idx}
                    workout={workout}
                    isFavorite={favoriteWorkoutsIds.includes(getFavoriteKey(workout))}
                    onStart={handleStartRecommended}
                    onFavorite={handleFavoriteWorkout}
                    styles={styles}
                  />
                ))}
              </View>
            </>
          ) : daySkippedBecauseOfInjury ? (
            <>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                Recommended for today ({getSplitDayForDate(new Date(), effectiveSplit)})
              </Text>
              <Text style={styles.workoutDescription}>
                Lower/leg day skipped because of your injuries. Rest or do light mobility.
              </Text>
            </>
          ) : equipmentFilterEnabled &&
            (() => {
              const splitForToday = getSplitDayForDate(
                new Date(),
                effectiveSplit
              );
              return splitForToday && String(splitForToday).toLowerCase() !== 'rest';
            })() ? (
            <>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                Recommended for today ({getSplitDayForDate(new Date(), effectiveSplit)})
              </Text>
              <Text style={styles.workoutDescription}>
                No workouts match your equipment filter. Open Equipment to select more gear, or turn the filter off to see every option.
              </Text>
            </>
          ) : null}
        </View>

        {/* User's Custom Workouts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Workouts</Text>
          </View>
          {userWorkouts.length === 0 ? (
            <Text style={styles.emptyText}>No custom workouts yet.</Text>
          ) : (
            userWorkouts.map((workout) => (
              <View key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutTitleContainer}>
                    <Text style={styles.workoutTitle} numberOfLines={2}>{workout.workout_name || workout.name}</Text>
                  </View>
                  <View style={styles.workoutHeaderRight}>
                    <TouchableOpacity onPress={() => handleFavoriteWorkout(workout)} style={styles.favoriteButtonLeftOfRep}>
                      {favoriteWorkoutsIds.includes(getFavoriteKey(workout)) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                    </TouchableOpacity>
                    <Text style={styles.repRangeText}>{Array.isArray(workout.exercises) ? workout.exercises.length : 0} exercises</Text>
                    <View style={styles.workoutActions}>
                      <TouchableOpacity 
                        onPress={() => handleShareWorkout(workout)}
                        style={styles.shareButton}
                      >
                        <Ionicons name="share-outline" size={18} color="#00ffff" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteWorkout(workout.id)}>
                        <Ionicons name="trash-outline" size={20} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <Text style={styles.workoutDescription}>Custom workout</Text>
                <View style={styles.exercises}>
                  <Text style={styles.exercisesTitle}>Exercises:</Text>
                  {Array.isArray(workout.exercises) && workout.exercises.map((ex, idx) => {
                    if (typeof ex === 'string') {
                      return <Text key={idx} style={styles.exercisesList}>• {ex}</Text>;
                    } else if (typeof ex === 'object' && ex !== null) {
                      return <Text key={idx} style={styles.exercisesList}>• {ex.name} ({ex.sets || 3} x {ex.reps || 10})</Text>;
                    } else {
                      return null;
                    }
                  })}
                </View>
                <TouchableOpacity 
                  style={styles.startButton}
                  onPress={() => startWorkout({
                    ...workout,
                    name: workout.workout_name || workout.name,
                  })}
                >
                  <Text style={styles.startButtonText}>Start Workout</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Workout Types */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workout Types</Text>
            <TouchableOpacity 
              style={styles.createWorkoutButton}
              onPress={() => router.push('/training-plans')}
            >
              <Text style={styles.createWorkoutButtonText}>Training Plans</Text>
            </TouchableOpacity>
          </View>
          
          {/* Full Body Workout */}
          <TouchableOpacity 
            style={styles.workoutCard}
            onPress={() => router.push('/active-workout')}
          >
            <View>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>Full Body Workout</Text>
                <View style={styles.favoriteAndRepRow}>
                  <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout({ name: 'Full Body Workout' }); }}>
                    {favoriteWorkoutsIds.includes(getFavoriteKey({ name: 'Full Body Workout' })) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                  </TouchableOpacity>
                  <View style={styles.repRange}>
                    <Text style={styles.repRangeText}>8-12 reps</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workoutDescription}>
                Complete full body workout targeting all major muscle groups
              </Text>
              <View style={styles.workoutMeta}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.metaText}>60 min</Text>
                <Ionicons name="flame-outline" size={20} color="#666" />
                <Text style={styles.metaText}>High Intensity</Text>
              </View>
              <View style={styles.exercises}>
                <Text style={styles.exercisesTitle}>Exercises:</Text>
                <Text style={styles.exercisesList}>• Squats</Text>
                <Text style={styles.exercisesList}>• Bench Press</Text>
                <Text style={styles.exercisesList}>• Deadlifts</Text>
                <Text style={styles.exercisesList}>• Pull-ups</Text>
                <Text style={styles.exercisesList}>• Shoulder Press</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push({
                pathname: '/active-workout',
                params: { type: 'Full Body Workout' }
              })}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Upper Body Power */}
          <TouchableOpacity 
            style={styles.workoutCard}
            onPress={() => router.push('/active-workout')}
          >
            <View>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>Upper Body Power</Text>
                <View style={styles.favoriteAndRepRow}>
                  <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout({ name: 'Upper Body Power' }); }}>
                    {favoriteWorkoutsIds.includes(getFavoriteKey({ name: 'Upper Body Power' })) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                  </TouchableOpacity>
                  <View style={styles.repRange}>
                    <Text style={styles.repRangeText}>4-6 reps</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workoutDescription}>
                Heavy upper body focused workout for strength gains
              </Text>
              <View style={styles.workoutMeta}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.metaText}>45 min</Text>
                <Ionicons name="flame-outline" size={20} color="#666" />
                <Text style={styles.metaText}>High Intensity</Text>
              </View>
              <View style={styles.exercises}>
                <Text style={styles.exercisesTitle}>Exercises:</Text>
                <Text style={styles.exercisesList}>• Bench Press</Text>
                <Text style={styles.exercisesList}>• Weighted Pull-ups</Text>
                <Text style={styles.exercisesList}>• Military Press</Text>
                <Text style={styles.exercisesList}>• Barbell Rows</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push({
                pathname: '/active-workout',
                params: { type: 'Upper Body Power' }
              })}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Lower Body Power */}
          <TouchableOpacity 
            style={styles.workoutCard}
            onPress={() => router.push('/active-workout')}
          >
            <View>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>Lower Body Power</Text>
                <View style={styles.favoriteAndRepRow}>
                  <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout({ name: 'Lower Body Power' }); }}>
                    {favoriteWorkoutsIds.includes(getFavoriteKey({ name: 'Lower Body Power' })) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                  </TouchableOpacity>
                  <View style={styles.repRange}>
                    <Text style={styles.repRangeText}>4-6 reps</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workoutDescription}>
                Heavy lower body focused workout for strength gains
              </Text>
              <View style={styles.workoutMeta}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.metaText}>45 min</Text>
                <Ionicons name="flame-outline" size={20} color="#666" />
                <Text style={styles.metaText}>High Intensity</Text>
              </View>
              <View style={styles.exercises}>
                <Text style={styles.exercisesTitle}>Exercises:</Text>
                <Text style={styles.exercisesList}>• Back Squats</Text>
                <Text style={styles.exercisesList}>• Romanian Deadlifts</Text>
                <Text style={styles.exercisesList}>• Front Squats</Text>
                <Text style={styles.exercisesList}>• Leg Press</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push({
                pathname: '/active-workout',
                params: { type: 'Lower Body Power' }
              })}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* HIIT Cardio */}
          <TouchableOpacity 
            style={styles.workoutCard}
            onPress={() => router.push('/active-workout')}
          >
            <View>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>HIIT Cardio</Text>
                <View style={styles.favoriteAndRepRow}>
                  <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout({ name: 'HIIT Cardio' }); }}>
                    {favoriteWorkoutsIds.includes(getFavoriteKey({ name: 'HIIT Cardio' })) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                  </TouchableOpacity>
                  <View style={styles.repRange}>
                    <Text style={styles.repRangeText}>30s work/30s rest</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workoutDescription}>
                High-intensity interval training for maximum calorie burn
              </Text>
              <View style={styles.workoutMeta}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.metaText}>30 min</Text>
                <Ionicons name="flame-outline" size={20} color="#666" />
                <Text style={styles.metaText}>Very High Intensity</Text>
              </View>
              <View style={styles.exercises}>
                <Text style={styles.exercisesTitle}>Exercises:</Text>
                <Text style={styles.exercisesList}>• Burpees</Text>
                <Text style={styles.exercisesList}>• Mountain Climbers</Text>
                <Text style={styles.exercisesList}>• Jump Squats</Text>
                <Text style={styles.exercisesList}>• High Knees</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push({
                pathname: '/active-workout',
                params: { type: 'HIIT Cardio' }
              })}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Core & Abs */}
          <TouchableOpacity 
            style={styles.workoutCard}
            onPress={() => router.push('/active-workout')}
          >
            <View>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>Core & Abs</Text>
                <View style={styles.favoriteAndRepRow}>
                  <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout({ name: 'Core & Abs' }); }}>
                    {favoriteWorkoutsIds.includes(getFavoriteKey({ name: 'Core & Abs' })) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                  </TouchableOpacity>
                  <View style={styles.repRange}>
                    <Text style={styles.repRangeText}>15-20 reps</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workoutDescription}>
                Focused core workout for strength and definition
              </Text>
              <View style={styles.workoutMeta}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.metaText}>30 min</Text>
                <Ionicons name="flame-outline" size={20} color="#666" />
                <Text style={styles.metaText}>Medium Intensity</Text>
              </View>
              <View style={styles.exercises}>
                <Text style={styles.exercisesTitle}>Exercises:</Text>
                <Text style={styles.exercisesList}>• Planks</Text>
                <Text style={styles.exercisesList}>• Russian Twists</Text>
                <Text style={styles.exercisesList}>• Leg Raises</Text>
                <Text style={styles.exercisesList}>• Cable Crunches</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push({
                pathname: '/active-workout',
                params: { type: 'Core & Abs' }
              })}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Mobility & Recovery */}
          <TouchableOpacity 
            style={styles.workoutCard}
            onPress={() => router.push('/active-workout')}
          >
            <View>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>Mobility & Recovery</Text>
                <View style={styles.favoriteAndRepRow}>
                  <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout({ name: 'Mobility & Recovery' }); }}>
                    {favoriteWorkoutsIds.includes(getFavoriteKey({ name: 'Mobility & Recovery' })) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                  </TouchableOpacity>
                  <View style={styles.repRange}>
                    <Text style={styles.repRangeText}>30-60s holds</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workoutDescription}>
                Stretching and mobility work for better flexibility and recovery
              </Text>
              <View style={styles.workoutMeta}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.metaText}>40 min</Text>
                <Ionicons name="flame-outline" size={20} color="#666" />
                <Text style={styles.metaText}>Low Intensity</Text>
              </View>
              <View style={styles.exercises}>
                <Text style={styles.exercisesTitle}>Exercises:</Text>
                <Text style={styles.exercisesList}>• Dynamic Stretching</Text>
                <Text style={styles.exercisesList}>• Foam Rolling</Text>
                <Text style={styles.exercisesList}>• Yoga Poses</Text>
                <Text style={styles.exercisesList}>• Joint Mobility</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push({
                pathname: '/active-workout',
                params: { type: 'Mobility & Recovery' }
              })}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Premium Workouts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Workouts</Text>
          {isPremium ? (
            <>
              <Text style={{ color: '#00ffff', fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>Premium</Text>
              {premiumWorkouts.map((workout, idx) => (
                <TouchableOpacity
                  key={workout.name}
                  style={styles.workoutCard}
                  onPress={() => startWorkout(workout)}
                >
                  <View>
                    <View style={styles.workoutHeader}>
                      <Text style={styles.workoutTitle}>{workout.name}</Text>
                      <View style={styles.favoriteAndRepRow}>
                        <TouchableOpacity style={styles.favoriteButtonLeftOfRep} onPress={(e) => { e?.stopPropagation?.(); handleFavoriteWorkout(workout); }}>
                          {favoriteWorkoutsIds.includes(getFavoriteKey(workout)) ? <Ionicons name="star" size={18} color="#00ffff" /> : <Ionicons name="star-outline" size={18} color="#00ffff" />}
                        </TouchableOpacity>
                        <View style={styles.repRange}>
                          <Text style={styles.repRangeText}>{workout.repRange}</Text>
                        </View>
                      </View>
                    </View>
                    {workout.goalType ? (
                      <View style={styles.goalTypeBadge}>
                        <Text style={styles.goalTypeBadgeText}>{formatGoalType(workout.goalType)}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.workoutDescription}>{workout.description}</Text>
                    <View style={styles.workoutMeta}>
                      <Ionicons name="time-outline" size={20} color="#666" />
                      <Text style={styles.metaText}>{workout.duration}</Text>
                      <Ionicons name="flame-outline" size={20} color="#666" />
                      <Text style={styles.metaText}>{workout.intensity}</Text>
                    </View>
                    <View style={styles.exercises}>
                      <Text style={styles.exercisesTitle}>Exercises:</Text>
                      {workout.exercises.map((ex, i) => (
                        <Text key={i} style={styles.exercisesList}>• {ex}</Text>
                      ))}
                    </View>
                    {workout.howTo && (
                      <View style={styles.howToSection}>
                        <Text style={styles.howToTitle}>How to:</Text>
                        <Text style={styles.howToText}>{workout.howTo}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.startButton} onPress={() => startWorkout(workout)}>
                    <Text style={styles.startButtonText}>Start Workout</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              {premiumWorkouts.map((workout, idx) => (
                <View key={workout.name} style={[styles.workoutCard, { opacity: 0.6 }]}> 
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutTitle}>{workout.name}</Text>
                    <Ionicons name="lock-closed" size={22} color="#ff4444" style={{ marginLeft: 8 }} />
                  </View>
                  {workout.goalType ? (
                    <View style={styles.goalTypeBadge}>
                      <Text style={styles.goalTypeBadgeText}>{formatGoalType(workout.goalType)}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.workoutDescription}>{workout.description}</Text>
                  <View style={styles.workoutMeta}>
                    <Ionicons name="time-outline" size={20} color="#666" />
                    <Text style={styles.metaText}>{workout.duration}</Text>
                    <Ionicons name="flame-outline" size={20} color="#666" />
                    <Text style={styles.metaText}>{workout.intensity}</Text>
                  </View>
                  <View style={styles.exercises}>
                    <Text style={styles.exercisesTitle}>Exercises:</Text>
                    {workout.exercises.map((ex, i) => (
                      <Text key={i} style={styles.exercisesList}>• {ex}</Text>
                    ))}
                  </View>
                  {workout.howTo && (
                    <View style={styles.howToSection}>
                      <Text style={styles.howToTitle}>How to:</Text>
                      <Text style={styles.howToText}>{workout.howTo}</Text>
                    </View>
                  )}
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                    <Text style={{ color: '#ff4444', fontWeight: 'bold', fontSize: 14 }}>Upgrade to Premium to start these workouts</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Workout Logs Modal - Now a separate component */}
        <WorkoutLogs 
          visible={showLogs} 
          onClose={() => setShowLogs(false)} 
        />

        {/* Workout Share Modal */}
        <WorkoutShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          workout={selectedWorkoutForShare}
          onShareSuccess={handleShareSuccess}
        />
      </ScrollView>
      )}

      {/* Run/Walk Tab Content */}
      {activeTab === 'run' && (
        <SafeAreaView style={styles.container}>
          <View style={styles.runHeader}>
            <View style={styles.activityDisplay}>
              <Ionicons 
                name={sprintMode ? "flash" : activityType === 'run' ? "fitness" : activityType === 'walk' ? "walk" : "bicycle"} 
                size={20} 
                color={sprintMode ? "#ffd700" : "#00ffff"} 
              />
              <Text style={styles.activityDisplayText}>
                {sprintMode ? 'Timed Distance' : activityType === 'run' ? 'Running' : activityType === 'walk' ? 'Walking' : activityType === 'bike' ? 'Cycling' : 'Timed Distance'}
              </Text>
            </View>
            <View style={styles.runHeaderButtons}>
              <TouchableOpacity 
                style={styles.chooseActivityButton}
                onPress={() => setShowActivityModal(true)}
              >
                <Ionicons name="settings-outline" size={20} color="#00ffff" />
                <Text style={styles.chooseActivityButtonText}>Activity</Text>
              </TouchableOpacity>
            </View>
          </View>

          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={region}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            showsTraffic={false}
            showsBuildings={true}
            showsIndoors={true}
            showsIndoorLevelPicker={false}
            showsPointsOfInterest={true}
          >
            {locations.length > 1 && (
              <Polyline
                coordinates={locations}
                strokeColor="#00ffff"
                strokeWidth={4}
                lineDashPattern={[1]}
                zIndex={1}
                lineCap="round"
                lineJoin="round"
                geodesic={true}
              />
            )}
            {startLocation && (
              <Marker coordinate={startLocation} title="Start">
                <View style={styles.startMarker} />
              </Marker>
            )}
            {locations.length > 1 && startLocation && (
              <Marker coordinate={locations[locations.length - 1]} title="Current Position">
                <View style={styles.currentMarker} />
              </Marker>
            )}
          </MapView>

          <View style={styles.overlay}>
            <View style={styles.controlsContainer}>
              <View style={styles.unitToggle}>
                <Text style={styles.unitText}>KM</Text>
                <Switch
                  value={useMiles}
                  onValueChange={setUseMiles}
                  trackColor={{ false: '#767577', true: '#00ffff' }}
                  thumbColor={useMiles ? '#00ffff' : '#f4f3f4'}
                />
                <Text style={styles.unitText}>MI</Text>
              </View>
              <View style={styles.autoZoomToggle}>
                <Text style={styles.unitText}>Auto Zoom</Text>
                <Switch
                  value={autoZoom}
                  onValueChange={setAutoZoom}
                  trackColor={{ false: '#767577', true: '#00ffff' }}
                  thumbColor={autoZoom ? '#00ffff' : '#f4f3f4'}
                />
              </View>
              <TouchableOpacity 
                style={styles.runLogButton}
                onPress={() => router.push('/run-log')}
              >
                <Ionicons name="list-outline" size={20} color="#00ffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  {sprintMode ? 'Progress' : 'Distance'}
                </Text>
                {sprintMode ? (
                  <View style={styles.sprintProgressContainer}>
                    {/* Finish Line */}
                    <Animated.View
                      style={[
                        styles.finishLine,
                        {
                          opacity: finishLineOpacity,
                          transform: [{
                            scale: finishLineOpacity.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.8, 1],
                            })
                          }]
                        }
                      ]}
                    >
                      <View style={styles.finishLineFlag} />
                      <Text style={styles.finishLineText}>FINISH</Text>
                      <View style={styles.finishLineFlag} />
                    </Animated.View>

                    <Text style={styles.statValue}>
                      {((distance * 1000) / distanceNeededToTravel * 100).toFixed(1)}%
                    </Text>
                    <Text style={styles.sprintProgressText}>
                      {(distance * 1000).toFixed(0)} / {distanceNeededToTravel.toFixed(0)} m
                    </Text>
                    {/* Animated Progress Bar */}
                    <View style={styles.progressBarContainer}>
                      <Animated.View 
                        style={[
                          styles.progressBarFill,
                          {
                            width: sprintProgressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          }
                        ]}
                      />
                    </View>

                    {/* Celebration Message - Enhanced with better animation */}
                    {sprintCompleted && (
                      <Animated.View
                        style={[
                          styles.celebrationContainer,
                          {
                            opacity: celebrationScale.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [0, 0.8, 1],
                            }),
                            transform: [{
                              scale: celebrationScale.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 1],
                              })
                            }]
                          }
                        ]}
                      >
                        <LinearGradient
                          colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.15)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.celebrationGradient}
                        >
                          <Text style={styles.celebrationText}>🎉 COMPLETE! 🎉</Text>
                          <Text style={styles.celebrationSubtext}>You crushed it!</Text>
                        </LinearGradient>
                      </Animated.View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.statValue}>
                    {useMiles ? (distance * 0.621371).toFixed(2) : distance.toFixed(2)} {useMiles ? 'mi' : 'km'}
                  </Text>
                )}
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  {activityType === 'bike' ? 'Speed' : 'Avg Pace'}
                </Text>
                <Text style={styles.statValue}>
                  {activityType === 'bike' ? 
                    (currentPace > 0 ? `${(currentPace * (useMiles ? 0.621371 : 1)).toFixed(1)} ${useMiles ? 'mph' : 'kph'}` : '--') :
                    (averagePace > 0 ? `${formatPace(averagePace)} /${useMiles ? 'mi' : 'km'}` : '--:--')
                  }
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Time</Text>
                <Text style={styles.statValue}>
                  {formatRunTime(elapsed)}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtonsContainer}>
              {recording && (
                <TouchableOpacity
                  style={[styles.runButton, paused ? styles.resumeRunButton : styles.pauseRunButton]}
                  onPress={pauseActivity}
                >
                  <Ionicons name={paused ? "play" : "pause"} size={20} color="#fff" />
                  <Text style={styles.runButtonText}>{paused ? "Resume" : "Pause"}</Text>
                </TouchableOpacity>
              )}
              
              {recording && !paused && (
                <TouchableOpacity
                  style={styles.stopRunButton}
                  onPress={stopActivity}
                >
                  <Ionicons name="stop" size={20} color="#fff" />
                  <Text style={styles.runButtonText}>End {activityType.charAt(0).toUpperCase() + activityType.slice(1)}</Text>
                </TouchableOpacity>
              )}
              
              {!recording && (
                <TouchableOpacity
                  style={styles.startRunButton}
                  onPress={startActivity}
                >
                  <Ionicons name="play" size={24} color="#fff" />
                  <Text style={styles.startRunButtonText}>Start {activityType.charAt(0).toUpperCase() + activityType.slice(1)}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Countdown Overlay - Shows 3-2-1 before sprint starts */}
          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Animated.View 
                style={[
                  styles.countdownContainer,
                  {
                    transform: [{ scale: countdownAnim }], // Scale animation for bounce effect
                    opacity: countdownAnim, // Fade in/out with scale
                  }
                ]}
              >
                <Text style={styles.countdownNumber}>{countdown}</Text>
                {/* Show "GO!" when countdown reaches 1 */}
                {countdown === 1 && (
                  <Text style={styles.countdownGo}>GO!</Text>
                )}
              </Animated.View>
            </View>
          )}
        </SafeAreaView>
      )}
      
      {/* AI Workout Generator Modal */}
      <Modal
        visible={showWorkoutGeneratorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWorkoutGeneratorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AIWorkoutGenerator
              isInModal={true}
              onClose={() => setShowWorkoutGeneratorModal(false)}
              onWorkoutGenerated={handleWorkoutGenerated}
              usageInfo={workoutUsage}
              isPremium={isPremium}
            />
          </View>
        </View>
      </Modal>

      {/* Activity Selection Modal */}
      <Modal
        visible={showActivityModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.activityModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Activity Type</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowActivityModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.activityOptions}>
              <TouchableOpacity 
                style={[styles.activityOption, activityType === 'run' && styles.activeActivityOption]}
                onPress={() => {
                  setActivityType('run');
                  setShowActivityModal(false);
                }}
              >
                <Ionicons 
                  name="walk" 
                  size={32} 
                  color={activityType === 'run' ? '#000' : '#00ffff'} 
                />
                <Text style={[styles.activityOptionText, activityType === 'run' && styles.activeActivityOptionText]}>
                  Run
                </Text>
                <Text style={styles.activityOptionDescription}>
                  Track your running sessions with GPS
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.activityOption, activityType === 'walk' && styles.activeActivityOption]}
                onPress={() => {
                  setActivityType('walk');
                  setShowActivityModal(false);
                }}
              >
                <Ionicons 
                  name="footsteps" 
                  size={32} 
                  color={activityType === 'walk' ? '#000' : '#00ffff'} 
                />
                <Text style={[styles.activityOptionText, activityType === 'walk' && styles.activeActivityOptionText]}>
                  Walk
                </Text>
                <Text style={styles.activityOptionDescription}>
                  Track your walking sessions with GPS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.activityOption, activityType === 'bike' && styles.activeActivityOption]}
                onPress={() => {
                  setActivityType('bike');
                  setShowActivityModal(false);
                }}
              >
                <Ionicons 
                  name="bicycle" 
                  size={32} 
                  color={activityType === 'bike' ? '#000' : '#00ffff'} 
                />
                <Text style={[styles.activityOptionText, activityType === 'bike' && styles.activeActivityOptionText]}>
                  Bike
                </Text>
                <Text style={styles.activityOptionDescription}>
                  Track your cycling sessions with GPS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.activityOption, (activityType === 'challenge' || sprintMode) && styles.activeActivityOptionChallenge]}
                onPress={() => {
                  setActivityType('challenge');
                  setShowActivityModal(false);
                  setShowSprintModal(true);
                }}
              >
                <Ionicons 
                  name="flash" 
                  size={32} 
                  color={(activityType === 'challenge' || sprintMode) ? '#000' : '#ffd700'} 
                />
                <Text style={[styles.activityOptionText, (activityType === 'challenge' || sprintMode) && styles.activeActivityOptionTextChallenge]}>
                  Timed Distance
                </Text>
                <Text style={styles.activityOptionDescription}>
                  Set a target distance and race against time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sprint Maxout Modal */}
      <Modal
        visible={showSprintModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSprintModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sprintModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <LinearGradient
                  colors={['#ffd700', '#ffaa00']}
                  style={styles.sprintModalTitleIcon}
                >
                  <Ionicons name="flash" size={24} color="#000" />
                </LinearGradient>
                <Text style={styles.modalTitle}>Timed Distance</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowSprintModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sprintModalScrollView} showsVerticalScrollIndicator={false}>
              <Text style={styles.sprintModalSubtitle}>
                Choose a target distance. Race against time to complete it as fast as possible.
              </Text>

              {/* Preset Distances */}
              <View style={styles.sprintSection}>
                <Text style={styles.sprintSectionTitle}>Preset Distances</Text>
                <View style={styles.sprintDistanceGrid}>
                  {[
                    { label: '40m', value: 40 },
                    { label: '100m', value: 100 },
                    { label: '200m', value: 200 },
                    { label: '400m', value: 400 },
                    { label: '800m', value: 800 },
                    { label: '1 Mile', value: 1609.34 },
                    { label: '1.5 Miles', value: 2414.01 },
                    { label: '2 Miles', value: 3218.68 },
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      style={[
                        styles.sprintDistanceButton,
                        selectedSprintDistance === preset.value && styles.sprintDistanceButtonActive
                      ]}
                      onPress={() => {
                        setSelectedSprintDistance(preset.value);
                        setCustomDistance('');
                        setDistanceNeededToTravel(preset.value);
                      }}
                    >
                      <Text style={[
                        styles.sprintDistanceButtonText,
                        selectedSprintDistance === preset.value && styles.sprintDistanceButtonTextActive
                      ]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Distance */}
              <View style={styles.sprintSection}>
                <Text style={styles.sprintSectionTitle}>Custom Distance (meters)</Text>
                <View style={styles.customDistanceContainer}>
                  <TextInput
                    style={styles.customDistanceInput}
                    placeholder="Enter distance in meters"
                    placeholderTextColor="#666"
                    value={customDistance}
                    onChangeText={(text) => {
                      setCustomDistance(text);
                      setSelectedSprintDistance(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                {customDistance && (
                  <TouchableOpacity
                    style={styles.applyCustomButton}
                    onPress={() => {
                      const distanceValue = parseFloat(customDistance);
                      if (distanceValue && distanceValue > 0) {
                        setDistanceNeededToTravel(distanceValue);
                        setSelectedSprintDistance(null);
                      } else {
                        Alert.alert('Error', 'Please enter a valid distance');
                      }
                    }}
                  >
                    <Text style={styles.applyCustomButtonText}>Apply Custom Distance</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Indoor / Treadmill: step-based distance. iOS = HealthKit, Android = device pedometer. Stride in Settings. */}
              {((Platform.OS === 'ios' && queryStatisticsForQuantity != null) || (Platform.OS === 'android' && Pedometer != null)) && (
                <View style={styles.sprintSection}>
                  <View style={styles.indoorModeRow}>
                    <Text style={styles.sprintSectionTitle}>Indoor / Treadmill</Text>
                    <Switch
                      value={sprintIndoorMode} 
                      onValueChange={setSprintIndoorMode}
                      trackColor={{ false: '#333', true: '#ffd700' }}
                      thumbColor={sprintIndoorMode ? '#000' : '#888'}
                    />
                  </View>
                  <Text style={styles.indoorModeHint}>
                    Use step count for distance (no GPS). Set your stride in Settings → Workout Preferences for accuracy.
                  </Text>
                </View>
              )}

            </ScrollView>

            {/* Start Sprint Button */}
            <TouchableOpacity
              style={[
                styles.startSprintButton,
                (!distanceNeededToTravel || distanceNeededToTravel <= 0) && styles.startSprintButtonDisabled
              ]}
              onPress={startSprintWithCountdown}
              disabled={!distanceNeededToTravel || distanceNeededToTravel <= 0}
            >
              <LinearGradient
                colors={['#ffd700', '#ffaa00']}
                style={styles.startSprintButtonGradient}
              >
                <Ionicons name="flash" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.startSprintButtonText}>
                  Start Sprint {distanceNeededToTravel > 0 && `(${distanceNeededToTravel.toFixed(0)}m)`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confetti Animation */}
      {/* Celebration Animations - Switch between different types */}
      {celebrationAnimationType === 'confetti' && (
        <Confetti visible={showConfetti} />
      )}
      {celebrationAnimationType === 'pulsingRing' && (
        <PulsingRingAnimation visible={showConfetti} />
      )}
      {celebrationAnimationType === 'starBurst' && (
        <StarBurstAnimation visible={showConfetti} />
      )}
      {celebrationAnimationType === 'gradientWave' && (
        <GradientWaveAnimation visible={showConfetti} />
      )}
      {celebrationAnimationType === 'particleTrail' && (
        <ParticleTrailAnimation visible={showConfetti} />
      )}
      {celebrationAnimationType === 'finishBanner' && (
        <FinishLineBannerAnimation visible={showConfetti} />
      )}

      {/* Equipment picker modal (inline to guarantee it renders from this screen state) */}
      <Modal
        visible={showEquipmentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEquipmentModal(false)}
      >
        <View style={styles.customSplitModalOverlay}>
          <View style={styles.customSplitModalContent}>
            <Text style={styles.customSplitModalTitle}>Available equipment</Text>
            <Text style={styles.customSplitModalSubtitle}>
              Select the equipment you have. We filter recommended workouts based on this.
            </Text>

            <ScrollView style={styles.customSplitModalScroll} showsVerticalScrollIndicator={false}>
              {USER_EQUIPMENT_OPTIONS.map((opt) => {
                const selected = draftEquipmentIds.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => toggleDraftEquipment(opt.id)}
                    style={[
                      styles.customSplitOptionChip,
                      { marginBottom: 10, justifyContent: 'flex-start' },
                      selected && styles.customSplitOptionChipSelected,
                    ]}
                  >
                    <Ionicons
                      name={selected ? 'checkbox-outline' : 'square-outline'}
                      size={18}
                      color={selected ? '#000' : '#00ffff'}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.customSplitOptionText, selected && styles.customSplitOptionTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.customSplitModalActions}>
              <TouchableOpacity style={styles.customSplitCancelButton} onPress={() => setShowEquipmentModal(false)}>
                <Text style={styles.customSplitCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customSplitSaveButton}
                onPress={async () => {
                  try {
                    await AsyncStorage.setItem(USER_EQUIPMENT_STORAGE_KEY, JSON.stringify(draftEquipmentIds));
                    await AsyncStorage.setItem(EQUIPMENT_FILTER_ENABLED_KEY, 'true');
                    setUserEquipmentIds(draftEquipmentIds);
                    setEquipmentFilterEnabled(true);
                    setShowEquipmentModal(false);
                  } catch (e) {
                    console.warn('Failed to save equipment settings:', e);
                  }
                }}
              >
                <Text style={styles.customSplitSaveButtonText}>Save equipment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scheduled Workout Modal */}
      <InjuryModal
        visible={showInjuryModal}
        onClose={() => setShowInjuryModal(false)}
        options={injuredMusclesOptions}
        initialSelectedIds={injuredMuscleIds}
        onSave={async (ids) => {
          try {
            await AsyncStorage.setItem('injuredMuscles', JSON.stringify(ids));
            setInjuredMuscleIds(ids);
            setShowInjuryModal(false);
          } catch (e) {
            console.warn('Failed to save injuries:', e);
          }
        }}
      />

      <ScheduledWorkoutModal
        visible={showScheduledWorkoutModal}
        onClose={() => {
          setShowScheduledWorkoutModal(false);
          setSelectedScheduledDate(null);
          setSelectedScheduledWorkout(null);
        }}
        selectedDate={selectedScheduledDate}
        existingWorkout={selectedScheduledWorkout}
        onWorkoutUpdated={() => {
          // Refresh the calendar and today's scheduled workout
          if (calendarRef.current && calendarRef.current.refresh) {
            calendarRef.current.refresh();
          }
          fetchTodayScheduledWorkout();
        }}
      />

      <AllSplitsModal
        visible={showAllSplitsModal}
        onClose={() => setShowAllSplitsModal(false)}
        options={SPLIT_OPTIONS}
        selectedSplit={selectedSplit}
        onSelect={handleSelectSplitFromModal}
      />

      {/* Custom split: edit which day of the week is Push, Pull, Legs, Rest, etc. */}
      <Modal
        visible={showCustomSplitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomSplitModal(false)}
      >
        <View style={styles.customSplitModalOverlay}>
          <View style={styles.customSplitModalContent}>
            <Text style={styles.customSplitModalTitle}>Customize your week</Text>
            <Text style={styles.customSplitModalSubtitle}>Set each day (Sun–Sat) to a training focus or Rest</Text>
            <ScrollView style={styles.customSplitModalScroll} showsVerticalScrollIndicator={false}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => {
                const current = (customDaysForEdit.length === 7 ? customDaysForEdit : DEFAULT_CUSTOM_DAYS.map((d) => (d && d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()) || 'Rest'))[index] || 'Rest';
                return (
                  <View key={dayName} style={styles.customSplitRow}>
                    <Text style={styles.customSplitDayLabel}>{dayName}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customSplitOptionsWrap}>
                      {SPLIT_DAY_OPTIONS.map((opt) => {
                        const isSelected = (current && current.toLowerCase() === opt.toLowerCase()) || (!current && opt === 'Rest');
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.customSplitOptionChip, isSelected && styles.customSplitOptionChipSelected]}
                            onPress={() => {
                              setCustomDaysForEdit((prev) => {
                                const base = prev.length === 7 ? prev : DEFAULT_CUSTOM_DAYS.map((d) => (d && d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()) || 'Rest');
                                const next = [...base];
                                next[index] = opt;
                                return next;
                              });
                            }}
                          >
                            <Text style={[styles.customSplitOptionText, isSelected && styles.customSplitOptionTextSelected]}>{opt}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.customSplitModalActions}>
              <TouchableOpacity style={styles.customSplitCancelButton} onPress={() => setShowCustomSplitModal(false)}>
                <Text style={styles.customSplitCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customSplitSaveButton}
                onPress={async () => {
                  const toSave = customDaysForEdit.length === 7 ? customDaysForEdit : DEFAULT_CUSTOM_DAYS.map((d) => (d && d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()) || 'Rest');
                  try {
                    await AsyncStorage.setItem(WORKOUT_SPLIT_CUSTOM_DAYS_KEY, JSON.stringify(toSave));
                    setSelectedSplit({ id: 'custom', label: 'Custom', days: [...toSave] });
                    setShowCustomSplitModal(false);
                  } catch (e) {
                    console.warn('Failed to save custom split:', e);
                  }
                }}
              >
                <Text style={styles.customSplitSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <FloatingAITrainer />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionSplit: {
    marginBottom: 10,
    flex: 1, 
    justifyContent: "center",
    marginTop: 10,

  }, 
  splitButton: {
    backgroundColor: '#0000ff',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 15,
  },
  splitText: {
    fontSize: 16,
    color: '#000fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  trainingPlansButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00ffff',
  },
  trainingPlansButtonText: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    paddingBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  injuryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.5)',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
  },
  injuryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffff',
  },
  splitHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '62%',
  },
  workoutCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  workoutTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  workoutHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  repRange: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  repRangeText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  goalTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  goalTypeBadgeText: {
    color: '#00ffff',
    fontSize: 11,
    fontWeight: '600',
  },
  workoutDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  metaText: {
    color: '#666',
    fontSize: 14,
    marginRight: 15,
  },
  exercises: {
    marginBottom: 15,
  },
  exercisesTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 5,
  },
  exercisesList: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  startButton: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createWorkoutButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00ffff',
  },
  createWorkoutButtonText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  periodButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.25)',
    borderColor: '#00ffff',
  },
  periodButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 140,
  },
  periodButtonTextActive: {
    color: '#00ffff',
  },
  moreSplitsButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
  },
  todayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  todayStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayStripLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  todayStripSplit: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  todayStripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayStripCount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  customSplitEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    gap: 6,
    marginBottom: 12,
  },
  customSplitEditButtonText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  customSplitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  customSplitModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  customSplitModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  customSplitModalSubtitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  customSplitModalScroll: {
    maxHeight: 360,
  },
  customSplitRow: {
    marginBottom: 14,
  },
  customSplitDayLabel: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  customSplitOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customSplitOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  customSplitOptionChipSelected: {
    backgroundColor: 'rgba(0, 255, 255, 0.25)',
    borderColor: '#00ffff',
  },
  customSplitOptionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  customSplitOptionTextSelected: {
    color: '#00ffff',
    fontWeight: '600',
  },
  customSplitModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  customSplitCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  customSplitCancelButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  customSplitSaveButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#00ffff',
  },
  customSplitSaveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'column',
    padding: 20,
    gap: 12,
  },
  actionButtonWrapper: {
    position: 'relative',
  },
  actionButton: {
    width: '100%',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#00ffff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionButtonTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  actionButtonTitle: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonDescription: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 2,
  },
  actionButtonUsageBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00ffff',
    minWidth: 50,
    alignItems: 'center',
  },
  actionButtonUsageBadgeText: {
    color: '#00ffff',
    fontSize: 11,
    fontWeight: '700',
  },
  howToSection: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 10,
  },
  howToTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 5,
  },
  howToText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'transparent',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    width: '95%',
    maxWidth: 500,
    height: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  // Tab Navigation Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  activeTabButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  tabText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#00ffff',
  },
  // Run/Walk Styles
  runHeader: {
    padding: 20,
    paddingTop: 20,
    backgroundColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  activityDisplayText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activityTypeToggle: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTypeButton: {
    backgroundColor: '#00ffff',
  },
  typeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTypeButtonText: {
    color: '#000',
  },
  map: {
    width: width,
    height: height,
  },
  overlay: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 80 : 70,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoZoomToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runLogButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  unitText: {
    color: '#fff',
    fontSize: 14,
    marginHorizontal: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 5,
  },
  statValue: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  startRunButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  startRunButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  runButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  runButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pauseRunButton: {
    backgroundColor: '#2196f3',
  },
  resumeRunButton: {
    backgroundColor: '#ff9800',
  },
  stopRunButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  startMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00ff00',
    borderWidth: 2,
    borderColor: '#fff',
  },
  currentMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff0000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Activity Selection Styles
  chooseActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  chooseActivityButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activityModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activityOptions: {
    gap: 16,
    marginTop: 20,
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeActivityOption: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  activeActivityOptionChallenge: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  activityOptionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    flex: 1,
  },
  activeActivityOptionText: {
    color: '#000',
  },
  activeActivityOptionTextChallenge: {
    color: '#000',
  },
  activityOptionDescription: {
    color: '#666',
    fontSize: 14,
    marginLeft: 16,
    flex: 1,
  },
  // Workout Sharing Styles
  workoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  /** Row that places favorite button to the left of rep range with 24px gap */
  favoriteAndRepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  /** 24px margin to the right so there's space between the star and the rep range text */
  favoriteButtonLeftOfRep: {
    padding: 4,
    marginRight: 24,
  },
  favoriteButton: {
    padding: 4,
  },
  shareButton: {
    padding: 4,
  },
  shareMessage: {
    fontSize: 14,
    color: '#00ffff',
    fontStyle: 'italic',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 8,
  },
  shareActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  shareActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#00ff00',
  },
  declineButton: {
    backgroundColor: '#ff4444',
  },
  acceptButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  workoutCardsContainer: {
    marginTop: 20,
  },
  // Sprint Maxout Styles
  runHeaderButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  sprintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  sprintButtonText: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  sprintProgressContainer: {
    alignItems: 'center',
    width: '100%',
  },
  sprintProgressText: {
    color: '#ffd700',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '600',
  },
  finishLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffd700',
    borderStyle: 'dashed',
  },
  finishLineFlag: {
    width: 20,
    height: 20,
    backgroundColor: '#ffd700',
    marginHorizontal: 8,
    borderRadius: 2,
  },
  finishLineText: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  celebrationContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
    overflow: 'hidden',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  celebrationGradient: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  celebrationText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffd700',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: 4,
  },
  celebrationSubtext: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // New Animation Styles
  pulsingRingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulsingRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#ffd700',
  },
  gradientWaveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveGradient: {
    position: 'absolute',
    width: width,
    height: height / 2,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffd700',
    borderRadius: 4,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  sprintModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  sprintModalTitleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sprintModalScrollView: {
    maxHeight: 400,
  },
  sprintModalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  sprintSection: {
    marginBottom: 24,
  },
  sprintSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  indoorModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  indoorModeHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  sprintDistanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sprintDistanceButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 80,
    alignItems: 'center',
  },
  sprintDistanceButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#ffd700',
  },
  sprintDistanceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sprintDistanceButtonTextActive: {
    color: '#ffd700',
  },
  customDistanceContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  customDistanceInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  applyCustomButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd700',
    alignItems: 'center',
  },
  applyCustomButtonText: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '600',
  },
  startSprintButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startSprintButtonDisabled: {
    opacity: 0.5,
  },
  startSprintButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  startSprintButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Countdown Timer Styles
  countdownOverlay: {
    position: 'absolute', // Position absolutely to cover entire screen
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Dark semi-transparent background
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
    zIndex: 1000, // Ensure it appears above all other elements
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 120, // Large number for visibility
    fontWeight: 'bold',
    color: '#ffd700', // Gold color matching sprint theme
    textShadowColor: 'rgba(255, 215, 0, 0.8)', // Glowing text shadow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20, // Blur radius for glow effect
  },
  countdownGo: {
    fontSize: 80, // Slightly smaller than countdown number
    fontWeight: 'bold',
    color: '#00ff00', // Green color for "GO!"
    marginTop: 20, // Space between number and "GO!"
    textShadowColor: 'rgba(0, 255, 0, 0.8)', // Green glowing shadow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20, // Blur radius for glow effect
  },
  // Scheduled Workout Styles
  scheduledWorkoutSection: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  scheduledWorkoutHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ffff',
    letterSpacing: 1,
    marginBottom: 10,
  },
  scheduledWorkoutCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1.5,
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduledWorkoutTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scheduledWorkoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  startScheduledButton: {
    backgroundColor: '#00ffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  startScheduledButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Rest Day Styles for Workout Screen
  scheduledRestDayHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffa500',
    letterSpacing: 1,
    marginBottom: 10,
  },
  scheduledRestDayCard: {
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#ffa500',
    shadowColor: '#ffa500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  restDayIconContainer: {
    marginBottom: 12,
  },
  restDayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffa500',
    marginBottom: 12,
  },
  restDayMessage: {
    fontSize: 15,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 22,
  },
  restDayNotesBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 165, 0, 0.2)',
    width: '100%',
  },
  restDayNotesText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default WorkoutScreen;