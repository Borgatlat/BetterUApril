"use client";

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert, Platform, SafeAreaView, Dimensions, Switch, Animated, TextInput, AppState, PanResponder } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { useSettings } from '../../context/SettingsContext';
import { useUnits } from '../../context/UnitsContext';
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
import { useBannerAd } from '../../context/BannerAdContext';
import { AIWorkoutGenerator } from '../../components/AIWorkoutGenerator';
import { WorkoutShareModal } from '../../components/WorkoutShareModal';
import MapView, { Polyline, Marker, getMapProvider } from '../../lib/MapView';
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
let Sharing = null;
try {
  Sharing = require('expo-sharing');
} catch (_) {
  Sharing = null;
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storePendingActivitySummary } from '../../utils/pendingActivitySummary';
import {
  loadPendingActiveWorkout,
  workoutHasProgress,
  formatPendingWorkoutElapsed,
  promptResumeOrStartNew,
} from '../../utils/pendingActiveWorkout';
import { getExerciseInfo } from '../../utils/exerciseLibrary';
import {
  injuredMusclesOptions,
  getAvoidTermsForInjuries,
  isExerciseSafeForInjuries,
  shouldSkipLegDayForInjuries,
} from '../../utils/injuryOptions';
import {
  isSplitRestDay,
  splitDayMatches,
  formatSplitDayLabel,
} from '../../utils/splitDayUtils';
import { getScheduledWorkoutForDate } from '../../utils/scheduledWorkoutHelpers';
import WorkoutWeekSchedule from '../../components/WorkoutWeekSchedule';
import { useScheduleRefresh } from '../../context/ScheduleRefreshContext';
import InjuryModal from '../components/injuryModal';
import WorkoutEquipmentModal from '../../components/WorkoutEquipmentModal';
import {
  ALL_USER_EQUIPMENT_IDS,
  workoutFitsUserEquipment,
} from '../../utils/workoutEquipment';
import ScheduledWorkoutModal from '../../components/ScheduledWorkoutModal';
import TrainingSplitModal from '../../components/TrainingSplitModal';
import RecoveryMap from '../../components/RecoveryMap';
import { PREMIUM_WORKOUTS } from '../../utils/workoutCatalog';
import {
  isPremiumCatalogWorkout,
  openWorkoutDetail,
  shouldUseWorkoutIdForDetail,
} from '../../utils/navigateToWorkoutDetail';
import { useBottomChromeInsets } from '../../context/BottomChromeContext';
import WorkoutLogs from './workout-logs';
// Live Activities - shows real-time stats on lock screen during cardio
import { 
  startCardioLiveActivity, 
  updateCardioLiveActivity, 
  endCardioLiveActivity, 
  dismissLiveActivity 
} from '../../utils/liveActivities';

// Background GPS — keeps tracking running when the screen is locked
// or the app is backgrounded. Without this, foreground-only
// `Location.watchPositionAsync` would silently pause updates the
// moment the user pockets their phone, which made distance + path
// data wildly inaccurate. The task is registered at module load
// inside `lib/runBackgroundLocation.js` (see TaskManager.defineTask
// at the top-level of that file).
import {
  startBackgroundRunTracking,
  stopBackgroundRunTracking,
  addLocationListener,
  removeLocationListener,
  getStoredLocationsAsync,
  clearStoredLocationsAsync,
} from '../../lib/runBackgroundLocation';

const { width, height } = Dimensions.get('window');
const mapProvider = getMapProvider();
const USER_EQUIPMENT_STORAGE_KEY = 'user_workout_equipment_ids';
const EQUIPMENT_FILTER_ENABLED_KEY = 'equipment_filter_enabled';

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
const RecommendedWorkoutCard = memo(function RecommendedWorkoutCard({ workout, isFavorite, onOpen, onFavorite, styles }) {
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
        onPress={() => onOpen(workout)}
      >
        <Text style={styles.startButtonText}>View Workout</Text>
      </TouchableOpacity>
    </View>
  );
});










const WorkoutScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' or 'run'
  const { setSuppressed: setBannerSuppressed } = useBannerAd();

  useEffect(() => {
    setBannerSuppressed(activeTab === 'run');
    return () => setBannerSuppressed(false);
  }, [activeTab, setBannerSuppressed]);
  const [showLogs, setShowLogs] = useState(false);
  const [userWorkouts, setUserWorkouts] = useState([]);

  const [showWorkoutGeneratorModal, setShowWorkoutGeneratorModal] = useState(false);
  // showActivityModal was removed when we replaced the activity
  // selection modal with the inline segmented switcher in the
  // run-tab header. Keeping the line as a tombstone so future
  // git-blame readers see it didn't simply disappear.
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWorkoutForShare, setSelectedWorkoutForShare] = useState(null);
  const [sharedWorkouts, setSharedWorkouts] = useState([]);
  const [pendingShares, setPendingShares] = useState([]);
  const { isPremium, userProfile } = useUser();
  const { requestAIConsent } = useAIConsent();
  const { settings } = useSettings();
  const { useImperial } = useUnits();
  const [todayScheduledWorkout, setTodayScheduledWorkout] = useState(null);
  const [showScheduledWorkoutModal, setShowScheduledWorkoutModal] = useState(false);
  const [selectedScheduledDate, setSelectedScheduledDate] = useState(null);
  const [selectedScheduledWorkout, setSelectedScheduledWorkout] = useState(null);
  const { refreshKey: scheduleRefreshKey, notifyScheduleUpdated } = useScheduleRefresh();
  const { scrollPaddingBottom, tabBarHeight, bannerHeight } = useBottomChromeInsets();
  // Run-tab stats sheet sits above tab bar + optional banner ad (non-premium).
  // Without bannerHeight the sheet's Start/Pause buttons sit under the ad.
  const runOverlayBottom = tabBarHeight + bannerHeight;
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
  const [showCustomSplitModal, setShowCustomSplitModal] = useState(false);
  const [showTrainingSplitModal, setShowTrainingSplitModal] = useState(false);
  const [customDaysForEdit, setCustomDaysForEdit] = useState([]); // length-7 array for Sun–Sat when editing custom split
  const [favoriteWorkoutsIds, setFavoriteWorkoutsIds] = useState([]);
  const [recoveryMapRefreshKey, setRecoveryMapRefreshKey] = useState(0);
  const [workoutUsage, setWorkoutUsage] = useState({ currentUsage: 0, limit: 1, remaining: 1 });
  const [pendingActiveWorkout, setPendingActiveWorkout] = useState(null);
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
  // Wall-clock refs for the run timer — the interval callback reads
  // these instead of state so we never restart the interval when
  // distance/GPS updates (which was causing skipped or frozen seconds).
  const startTimeRef = useRef(null);
  const totalPauseTimeRef = useRef(0);
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

  // ============================================================
  // Draggable bottom-sheet overlay state
  // ============================================================
  // The stats panel at the bottom of the run tab can be
  // dragged up/down to give the user more or less map real
  // estate. We use an `Animated.Value` (not a regular number)
  // so the height can animate smoothly with `Animated.timing`
  // and update in lockstep with `panResponder` drag gestures.
  const [overlayExpanded, setOverlayExpanded] = useState(true);
  const OVERLAY_COLLAPSED_HEIGHT = 180;
  const OVERLAY_EXPANDED_HEIGHT = 300;
  const overlayHeight = useRef(new Animated.Value(OVERLAY_EXPANDED_HEIGHT)).current;

  // Stable ref to the GPS batch handler. We need a stable
  // reference (not just `processLocationBatch` directly) so
  // that `removeLocationListener` later removes the SAME
  // function that `addLocationListener` registered. JS Sets
  // do identity-comparison, so passing a freshly-created
  // function each render would leak listeners.
  const locationListenerRef = useRef(null);

  // ============================================================
  // "Live value" refs for the GPS callback
  // ============================================================
  // The background-location callback is registered once at the
  // start of a run. Mirror values that can change into refs so
  // the long-lived listener always reads the latest setting.
  const activityTypeRef = useRef(activityType);
  const useImperialRef = useRef(useImperial);
  const startLocationRef = useRef(null);
  useEffect(() => { activityTypeRef.current = activityType; }, [activityType]);
  useEffect(() => { useImperialRef.current = useImperial; }, [useImperial]);
  useEffect(() => { startLocationRef.current = startLocation; }, [startLocation]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { totalPauseTimeRef.current = totalPauseTime; }, [totalPauseTime]);

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
  const avoidTerms = getAvoidTermsForInjuries(injuredIds);
  if (!avoidTerms.length) return exercises;
  return exercises.filter((ex) => isExerciseSafeForInjuries(ex, avoidTerms, getExerciseInfo));
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
  const getSplitBaseId = (splitId) => {
    if (!splitId || splitId === 'custom') return 'custom';
    return String(splitId).replace(/_\d+$/, '');
  };
  const SPLIT_SHORT_NAMES = {
    ppl: 'PPL',
    upper_lower_ppl: 'UL + PPL',
    upper_lower: 'Upper/Lower',
    full_body: 'Full Body',
    bro_split: 'Bro split',
    custom: 'Custom',
  };
  const SPLIT_FAMILY_DEFAULT_FREQ = {
    ppl: 4,
    upper_lower_ppl: 5,
    upper_lower: 3,
    full_body: 3,
    bro_split: 5,
  };
  const QUICK_SPLIT_BASE_IDS = ['ppl', 'upper_lower', 'full_body', 'custom'];
  const createFrequencySplitOption = (baseId, baseLabel, frequency, rotation) => {
    const short = SPLIT_SHORT_NAMES[baseId] || baseLabel;
    return {
      id: `${baseId}_${frequency}`,
      baseId,
      frequency,
      label: `${baseLabel} (${frequency}x/week)`,
      shortLabel: `${short} · ${frequency}×/wk`,
      chipLabel: short,
      days: buildWeeklySplitDays(frequency, rotation),
    };
  };
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
    {
      id: 'custom',
      baseId: 'custom',
      frequency: null,
      label: 'Custom week',
      shortLabel: 'Custom',
      chipLabel: 'Custom',
      days: [...DEFAULT_CUSTOM_DAYS],
    },
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
  // One chip per split family in the quick row (not four PPL frequency variants that looked identical).
  const { effectiveSplit, visibleSplitOptions, frequencyVariantsForSplit } = useMemo(() => {
    const effective =
      selectedSplit && typeof selectedSplit === 'object' && selectedSplit.days
        ? selectedSplit
        : findSplitById(selectedSplit?.id ?? selectedSplit) || SPLIT_OPTIONS[0];
    const effectiveBase = getSplitBaseId(effective.id);

    const quickOptions = QUICK_SPLIT_BASE_IDS.map((base) => {
      if (base === effectiveBase) return effective;
      const freq = SPLIT_FAMILY_DEFAULT_FREQ[base] || 3;
      return (
        SPLIT_OPTIONS.find((s) => s.id === `${base}_${freq}`) ||
        SPLIT_OPTIONS.find((s) => getSplitBaseId(s.id) === base)
      );
    }).filter(Boolean);

    const seenBases = new Set();
    const visible = [];
    for (const opt of quickOptions) {
      const b = getSplitBaseId(opt.id);
      if (!seenBases.has(b)) {
        visible.push(opt);
        seenBases.add(b);
      }
    }

    const frequencyVariants =
      effectiveBase === 'custom'
        ? []
        : SPLIT_OPTIONS.filter((o) => getSplitBaseId(o.id) === effectiveBase).sort(
            (a, b) => (a.frequency || 0) - (b.frequency || 0)
          );

    return {
      effectiveSplit: effective,
      visibleSplitOptions: visible,
      frequencyVariantsForSplit: frequencyVariants,
    };
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

  useEffect(() => {
    fetchTodayScheduledWorkout();
  }, [scheduleRefreshKey]);

  useFocusEffect(
    useCallback(() => {
      refreshWorkoutData();
      setRecoveryMapRefreshKey((k) => k + 1);
    }, [refreshWorkoutData])
  );

  const refreshPendingActiveWorkout = useCallback(async () => {
    const pending = await loadPendingActiveWorkout();
    if (pending?.workout && workoutHasProgress(pending.workout, pending.elapsedTime)) {
      setPendingActiveWorkout(pending);
    } else {
      setPendingActiveWorkout(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPendingActiveWorkout();
    }, [refreshPendingActiveWorkout])
  );

  const resumePendingWorkout = useCallback(() => {
    router.push({ pathname: '/active-workout', params: { resume: 'true' } });
  }, [router]);

  const startWorkoutWithPendingCheck = useCallback(
    (startNewWorkout) => {
      promptResumeOrStartNew({
        onResume: () => {
          resumePendingWorkout();
          refreshPendingActiveWorkout();
        },
        onStartNew: () => {
          setPendingActiveWorkout(null);
          startNewWorkout();
        },
      });
    },
    [resumePendingWorkout, refreshPendingActiveWorkout]
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

  // Deep link: Home recovery score → scroll to muscle recovery map
  useFocusEffect(
    useCallback(() => {
      const flag = Array.isArray(params.scrollToRecovery)
        ? params.scrollToRecovery[0]
        : params.scrollToRecovery;
      if (flag !== '1' && flag !== 'true') return;

      setActiveTab('workout');
      const timer = setTimeout(() => {
        workoutScrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }, [params.scrollToRecovery])
  );


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

  const openWorkoutPreview = useCallback((workout, options = {}) => {
    const exercises = Array.isArray(workout.exercises)
      ? workout.exercises
      : workout.workout_exercises || [];
    const filteredExercises = filterExercisesByInjury(exercises, injuredMuscleIds);
    const payload = {
      ...workout,
      exercises: filteredExercises,
      workout_exercises: filteredExercises,
    };
    const premiumTemplate = isPremiumCatalogWorkout(workout);

    openWorkoutDetail(router, payload, {
      startMode: 'custom',
      locked: premiumTemplate && !isPremium,
      includeWorkoutId: shouldUseWorkoutIdForDetail(workout),
      ...options,
    });
  }, [router, injuredMuscleIds, isPremium]);

  // Back-compat alias used by shared-workout flows on this screen.
  const startWorkout = openWorkoutPreview;

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

  /** Opens workout-detail (muscle map + exercise list) before active workout. */
  const handleOpenRecommended = useCallback(
    (workout) => {
      openWorkoutPreview(workout);
    },
    [openWorkoutPreview]
  );

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


  // The full premium workouts list now lives in `utils/workoutCatalog.js`
  // so it can be reused by the dedicated /premium-workouts screen. We
  // alias it here so all the existing filter/recommendation logic below
  // continues to work without renaming variables.
  const premiumWorkouts = PREMIUM_WORKOUTS;

  /**
   * Memoized "recommended for today" list and injury-skip flag.
   * useMemo recomputes only when deps change, so we avoid recalculating on every render
   * (e.g. when unrelated state like showShareModal changes). Heavy filter/sort runs only when needed.
   */
  const { reccomendedWorkouts, injuryBlockReason, isTodaySplitRest } = useMemo(() => {
    const split = selectedSplit && typeof selectedSplit === 'object' && selectedSplit.days
      ? selectedSplit
      : SPLIT_OPTIONS.find((s) => s.id === selectedSplit) || SPLIT_OPTIONS[0];
    const todaySplitDay = getSplitDayForDate(new Date(), split);
    if (isSplitRestDay(todaySplitDay)) {
      return { reccomendedWorkouts: [], injuryBlockReason: null, isTodaySplitRest: true };
    }

    if (shouldSkipLegDayForInjuries(todaySplitDay, injuredMuscleIds)) {
      return { reccomendedWorkouts: [], injuryBlockReason: 'leg_day', isTodaySplitRest: false };
    }

    const dayLower = todaySplitDay.toLowerCase();

    const filteredPremium = premiumWorkouts.filter(
      (w) => w.splitDay && splitDayMatches(w.splitDay, todaySplitDay)
    );
    const filteredUser = userWorkouts.filter((w) => {
      if (w.split_day) return splitDayMatches(w.split_day, todaySplitDay);
      const name = (w.workout_name || w.name || '').toLowerCase();
      if (dayLower === 'push') return name.includes('push');
      if (dayLower === 'pull') return name.includes('pull');
      if (dayLower === 'legs' || dayLower === 'lower') return name.includes('leg') || name.includes('lower');
      if (dayLower === 'upper') return name.includes('upper');
      if (dayLower === 'full body') return name.includes('full');
      if (dayLower === 'chest') return name.includes('chest');
      if (dayLower === 'back') return name.includes('back');
      if (dayLower === 'shoulders' || dayLower === 'shoulder') return name.includes('shoulder');
      if (dayLower === 'arms' || dayLower === 'arm') return name.includes('arm') || name.includes('bicep') || name.includes('tricep');
      return false;
    });

    const combined = [...filteredPremium, ...filteredUser];
    const withFilteredExercises = combined
      .map((w) => ({
        ...w,
        exercises: filterExercisesByInjury(Array.isArray(w.exercises) ? w.exercises : [], injuredMuscleIds),
      }))
      .filter((w) => (w.exercises?.length ?? 0) > 0);

    if (withFilteredExercises.length === 0 && injuredMuscleIds.length > 0) {
      return { reccomendedWorkouts: [], injuryBlockReason: 'injury', isTodaySplitRest: false };
    }

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
    if (equipmentFiltered.length === 0 && equipmentFilterEnabled) {
      return { reccomendedWorkouts: [], injuryBlockReason: 'equipment', isTodaySplitRest: false };
    }
    return {
      reccomendedWorkouts: equipmentFiltered,
      injuryBlockReason: null,
      isTodaySplitRest: false,
    };
  }, [selectedSplit, userWorkouts, injuredMuscleIds, favoriteWorkoutsIds, userProfile?.fitness_goal, equipmentFilterEnabled, userEquipmentIds]);

  const isCustomSplitSelected = getSplitBaseId(effectiveSplit?.id) === 'custom';

  /** Workouts to offer when scheduling a day on the calendar (custom = pick any). */
  const getScheduleContextForDate = useCallback(
    (date) => {
      const split =
        selectedSplit && typeof selectedSplit === 'object' && selectedSplit.days
          ? selectedSplit
          : SPLIT_OPTIONS.find((s) => s.id === (selectedSplit?.id ?? selectedSplit)) || SPLIT_OPTIONS[0];
      const splitDay = getSplitDayForDate(date, split);
      const isRest = isSplitRestDay(splitDay);

      if (isRest) {
        return {
          splitDay: 'Rest',
          isRest: true,
          isCustom: isCustomSplitSelected,
          suggested: [],
          templates: [],
        };
      }

      const suggestedPremium = premiumWorkouts.filter(
        (w) => w.splitDay && splitDayMatches(w.splitDay, splitDay)
      );
      const suggestedUser = userWorkouts.filter((w) => {
        if (w.split_day) return splitDayMatches(w.split_day, splitDay);
        const name = (w.workout_name || w.name || '').toLowerCase();
        const dayLower = String(splitDay).toLowerCase();
        if (dayLower === 'push') return name.includes('push');
        if (dayLower === 'pull') return name.includes('pull');
        if (dayLower === 'legs' || dayLower === 'lower') return name.includes('leg') || name.includes('lower');
        if (dayLower === 'upper') return name.includes('upper');
        if (dayLower === 'full body') return name.includes('full');
        if (dayLower === 'chest') return name.includes('chest');
        if (dayLower === 'back') return name.includes('back');
        if (dayLower === 'shoulders' || dayLower === 'shoulder') return name.includes('shoulder');
        if (dayLower === 'arms' || dayLower === 'arm') {
          return name.includes('arm') || name.includes('bicep') || name.includes('tricep');
        }
        return false;
      });

      const toSchedulable = (w, isTemplate = false) => ({
        id: w.id || (isTemplate ? `template-${w.name}` : w.id),
        workout_name: w.workout_name || w.name,
        name: w.workout_name || w.name,
        exercises: w.exercises || [],
        isTemplate,
        description: w.description,
      });

      const suggested = [
        ...suggestedPremium.map((w) => toSchedulable(w, true)),
        ...suggestedUser.map((w) => toSchedulable(w, false)),
      ];

      const allTemplates = premiumWorkouts.map((w) => toSchedulable(w, true));
      const allUser = userWorkouts.map((w) => toSchedulable(w, false));

      return {
        splitDay: formatSplitDayLabel(splitDay),
        isRest: false,
        isCustom: isCustomSplitSelected,
        suggested,
        templates: isCustomSplitSelected ? allTemplates : suggestedPremium.map((w) => toSchedulable(w, true)),
      };
    },
    [selectedSplit, userWorkouts, isCustomSplitSelected]
  );

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
            const customOpt = SPLIT_OPTIONS.find((s) => s.id === 'custom');
            setSelectedSplit({ ...(customOpt || { id: 'custom', chipLabel: 'Custom' }), days });
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

  const handleSaveEquipmentSettings = useCallback(async ({ equipmentIds, filterEnabled }) => {
    try {
      const ids =
        Array.isArray(equipmentIds) && equipmentIds.length > 0
          ? equipmentIds
          : [...ALL_USER_EQUIPMENT_IDS];
      await AsyncStorage.setItem(USER_EQUIPMENT_STORAGE_KEY, JSON.stringify(ids));
      await AsyncStorage.setItem(EQUIPMENT_FILTER_ENABLED_KEY, filterEnabled ? 'true' : 'false');
      setUserEquipmentIds(ids);
      setEquipmentFilterEnabled(filterEnabled);
      setShowEquipmentModal(false);
    } catch (e) {
      console.warn('Failed to save equipment settings:', e);
      Alert.alert('Could not save', 'Equipment settings failed to save. Please try again.');
    }
  }, []);

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
        setSelectedSplit({ ...opt, days });
      } catch (e) {
        setSelectedSplit({ ...opt, days: [...DEFAULT_CUSTOM_DAYS] });
      }
    } else {
      setSelectedSplit(opt);
    }
    try {
      await AsyncStorage.setItem(WORKOUT_SPLIT_STORAGE_KEY, opt.id);
    } catch (e) {
      console.warn('Failed to save workout split:', e);
    }
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

  // Run/Walk permissions + initial map region.
  // We now ALSO request background-location permission so
  // `lib/runBackgroundLocation.js` can keep recording while
  // the app is backgrounded. Background is `requested` second
  // because iOS only allows asking for "Always" after the user
  // has already granted "When In Use" — asking out of order
  // makes the OS silently deny the prompt.
  useEffect(() => {
    (async () => {
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Location permission required', 'Please enable location services to track your runs.');
        return;
      }
      // Best-effort background permission. We don't block the
      // user if they decline — runs will still work in the
      // foreground, they just won't track when the screen
      // locks. We log a warning so it's visible in dev tools.
      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          console.warn('Background location not granted; runs will pause when the app is backgrounded.');
        }
      } catch (e) {
        console.warn('Background location permission request failed:', e);
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

  // ============================================================
  // AppState foreground re-sync for background runs
  // ============================================================
  // While the app is backgrounded, the JS bridge is suspended.
  // The native background-location task still fires and writes
  // each batch of GPS points to AsyncStorage (see `lib/run
  // BackgroundLocation.js`). When the user reopens the app, JS
  // wakes up and we have a gap: the in-memory `locations` /
  // `distance` state hasn't seen those points yet.
  //
  // This effect listens for the AppState going back to "active"
  // and, if a run is currently recording, drains the persisted
  // queue into `processLocationBatch` (the same handler the
  // foreground listener uses). After draining, it clears
  // storage so the same points aren't replayed twice.
  //
  // The `lastValidLocation.current?.timestamp` filter keeps us
  // from re-processing points the foreground listener already
  // got just before the app was backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      if (!recording || paused) return;

      // Re-sync elapsed time first — clock kept ticking while we
      // were backgrounded but state didn't update.
      if (startTimeRef.current != null) {
        setElapsed(
          Math.max(0, Date.now() - startTimeRef.current - totalPauseTimeRef.current)
        );
      }

      try {
        const stored = await getStoredLocationsAsync();
        if (!stored.length) return;
        const lastTs = lastValidLocation.current?.timestamp;
        const newOnly = lastTs ? stored.filter((l) => l.timestamp > lastTs) : stored;
        if (newOnly.length && locationListenerRef.current) {
          locationListenerRef.current(newOnly);
        }
        await clearStoredLocationsAsync();
      } catch (e) {
        console.warn('Error merging background locations on foreground:', e);
      }
    });
    return () => sub.remove();
  }, [recording, paused, startTime, totalPauseTime]);

  // Run timer — one stable 1s interval while recording (not paused).
  // Pace math lives in a separate effect below so GPS distance
  // updates don't tear down and recreate this interval.
  useEffect(() => {
    const clearRunTimer = () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!recording || paused) {
      clearRunTimer();
      return clearRunTimer;
    }

    const tickElapsed = () => {
      const st = startTimeRef.current;
      if (st == null) return;
      setElapsed(Math.max(0, Date.now() - st - totalPauseTimeRef.current));
    };

    tickElapsed();

    timerRef.current = setInterval(tickElapsed, 1000);

    return clearRunTimer;
  }, [recording, paused]);

  // Pace / speed — updates when distance or elapsed changes; does not touch the timer.
  useEffect(() => {
    if (!recording || paused || distance <= 0 || elapsed <= 0) return;

    const currentElapsed = elapsed;

    if (activityType === 'bike') {
      const elapsedHours = currentElapsed / 1000 / 3600;
      if (useImperial) {
        setAveragePace((distance * 0.621371) / elapsedHours);
      } else {
        setAveragePace(distance / elapsedHours);
      }
      if (lastValidLocation.current?.speed != null) {
        setCurrentPace(
          lastValidLocation.current.speed * (useImperial ? 2.23694 : 3.6)
        );
      }
    } else {
      const elapsedMinutes = currentElapsed / 1000 / 60;
      if (useImperial) {
        setAveragePace(elapsedMinutes / (distance * 0.621371));
      } else {
        setAveragePace(elapsedMinutes / distance);
      }
      if (distance > 0.01) {
        const recentDistance = Math.min(distance, 0.1);
        const recentTime = Math.min(currentElapsed / 1000 / 60, 1);
        setCurrentPace(recentTime / recentDistance);
      }
    }
  }, [recording, paused, distance, elapsed, activityType, useImperial]);

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
    const R = 6371e3; // Earth's radius in meters (Haversine formula)
    const phi1 = point1.latitude * Math.PI / 180;
    const phi2 = point2.latitude * Math.PI / 180;
    const deltaPhi = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLambda = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    console.log('Distance Calculation:', {
      point1: { lat: point1.latitude.toFixed(6), lng: point1.longitude.toFixed(6) },
      point2: { lat: point2.latitude.toFixed(6), lng: point2.longitude.toFixed(6) },
      deltaLat: (deltaPhi * 180 / Math.PI).toFixed(6),
      deltaLng: (deltaLambda * 180 / Math.PI).toFixed(6),
      calculatedDistance: distance.toFixed(3),
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
    if (!distanceNeededToTravel || distanceNeededToTravel <= 0) {
      Alert.alert('Error', 'Please select a distance to sprint');
      return;
    }

    const now = Date.now();
    startTimeRef.current = now;
    totalPauseTimeRef.current = 0;
    setSprintMode(true);
    setRecording(true);
    setPaused(false);
    setActivityStarted(true);
    setStartTime(now);
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
    if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
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
      const now = Date.now();
      startTimeRef.current = now;
      totalPauseTimeRef.current = 0;
      setRecording(true);
      setPaused(false);
      setActivityStarted(true);
      setStartTime(now);
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

  const pauseActivity = async () => {
    if (paused) {
      // Unpausing — restart background updates and resume the
      // distance/path stream. We re-add the listener defensively
      // in case anything tore it down (it's safe — Sets dedupe).
      const pauseDuration = Date.now() - pauseTime;
      totalPauseTimeRef.current += pauseDuration;
      setTotalPauseTime(totalPauseTimeRef.current);
      setPaused(false);
      setPauseTime(0);
      await startLocationTracking(false);
    } else {
      // Pausing — stop the native background task so we don't
      // burn battery (and don't accumulate phantom distance from
      // the user moving between pause/resume, e.g. driving home).
      setPaused(true);
      setPauseTime(Date.now());
      try {
        await stopBackgroundRunTracking();
      } catch (e) {
        console.warn('Error stopping background run tracking on pause:', e);
      }
      if (locationWatcher.current) {
        // Sprint mode also uses watchPositionAsync; clean it up
        // too just in case (no-op for non-sprint runs).
        locationWatcher.current.remove();
        locationWatcher.current = null;
      }
    }
  };

  // ============================================================
  // processLocationBatch — the single GPS update handler
  // ============================================================
  // Runs for every batch of points the native task delivers
  // (one or many at a time). Updates distance, path, current
  // speed, and optionally auto-zooms the map.
  //
  // It reads `activityType`, `useImperial`, and `startLocation`
  // via REFs (`*Ref.current`) instead of closure variables so
  // the long-lived listener always sees the most recent values.
  //
  // Each batched point has shape:
  //   { latitude, longitude, timestamp, speed?, accuracy? }
  // (this is what `lib/runBackgroundLocation.js` normalises to.)
  const processLocationBatch = useCallback((batch) => {
    if (!batch?.length) return;

    for (const l of batch) {
      // Wrap into the same `{coords, timestamp}` shape that
      // `Location.watchPositionAsync` would have given us so we
      // can re-use the existing `isLocationValid` validator.
      const locationLike = {
        coords: {
          latitude: l.latitude,
          longitude: l.longitude,
          accuracy: l.accuracy ?? 50,
          speed: l.speed,
        },
        timestamp: l.timestamp,
      };
      if (!isLocationValid(locationLike)) continue;

      // Track best GPS accuracy achieved this run for diagnostics.
      if (l.accuracy != null && l.accuracy < bestAccuracyRef.current) {
        bestAccuracyRef.current = l.accuracy;
      }

      const newLocation = {
        latitude: l.latitude,
        longitude: l.longitude,
        timestamp: l.timestamp,
        speed: l.speed ?? null,
      };

      if (lastValidLocation.current) {
        // Already moving — accumulate distance from prev → new.
        const distanceIncrement = getDistance(lastValidLocation.current, newLocation);
        const latDiff = Math.abs(newLocation.latitude - lastValidLocation.current.latitude);
        const lngDiff = Math.abs(newLocation.longitude - lastValidLocation.current.longitude);
        const minCoordinateChange = 0.000001; // ~10cm in lat/lng

        if (latDiff > minCoordinateChange || lngDiff > minCoordinateChange) {
          // We use a ref for the running distance total (not the
          // `distance` state) because state updates batch and this
          // callback can fire many times per second. A ref gives
          // us race-free addition; we then mirror it into state.
          const newRawDistance = accumulatedDistanceRef.current + distanceIncrement;
          accumulatedDistanceRef.current = newRawDistance;
          setRawDistance(newRawDistance);
          setDistance(newRawDistance / 1000);

          locationsRef.current.push(newLocation);
          setLocations([...locationsRef.current]);
        } else {
          // Coordinate barely moved (GPS jitter) — still record
          // the point on the path so the polyline stays smooth,
          // but don't bump the distance counter.
          locationsRef.current.push(newLocation);
          setLocations([...locationsRef.current]);
        }

        lastValidLocation.current = newLocation;

        // Bike mode shows live speed instead of pace (m/s → kph or mph).
        if (activityTypeRef.current === 'bike' && newLocation.speed != null) {
          setCurrentPace(newLocation.speed * (useImperialRef.current ? 2.23694 : 3.6));
        }
      } else {
        // Very first valid GPS fix of the run — record the
        // start location so we can drop a "Start" marker on
        // the map. We only do this once per run (guarded by
        // `startLocationRef.current`).
        lastValidLocation.current = newLocation;
        if (!startLocationRef.current) {
          setStartLocation(newLocation);
          locationsRef.current.push(newLocation);
          setLocations([...locationsRef.current]);
        }
      }
    }
  }, []); // Empty deps: all dynamic values are read via refs.

  const startLocationTracking = async (isPaused = false) => {
    if (isPaused) return;

    try {
      // Wipe any stale persisted points from a previous session
      // so we don't accidentally replay them when we drain on
      // foreground (see the AppState effect above).
      await clearStoredLocationsAsync();

      // Register the SAME function reference we'll later
      // unregister. JS Sets do identity comparison, so passing
      // an inline `(b) => processLocationBatch(b)` arrow on
      // cleanup would silently fail to remove anything and
      // leak listeners across runs.
      if (locationListenerRef.current) {
        removeLocationListener(locationListenerRef.current);
      }
      locationListenerRef.current = processLocationBatch;
      addLocationListener(locationListenerRef.current);

      // Kick off the native background-aware task. This
      // delivers location updates while the app is in
      // BOTH foreground and background — no separate
      // `Location.watchPositionAsync` is needed for the
      // regular run flow. (Sprint mode still uses
      // `watchPositionAsync` for sub-meter accuracy.)
      await startBackgroundRunTracking({
        timeInterval: 1000,
        distanceInterval: 1,
        accuracy: Location.Accuracy.BestForNavigation,
      });
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const startSprintLocationTracking = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Location permission required');
      return;
    }

    if (!distanceNeededToTravel || distanceNeededToTravel <= 0) {
      Alert.alert('Error', 'Please select a distance to sprint');
      return;
    }
    

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
      
      // Tear down the native background task FIRST so no more
      // location batches arrive after we've started resetting
      // run state (avoids races where the listener fires with
      // stale data and adds bogus distance).
      try {
        await stopBackgroundRunTracking();
      } catch (e) {
        console.warn('Error stopping background run tracking on stop:', e);
      }
      if (locationListenerRef.current) {
        removeLocationListener(locationListenerRef.current);
        locationListenerRef.current = null;
      }
      // Clear any persisted points that arrived after the user
      // hit Stop but before we got here, so they don't leak into
      // the next run.
      try {
        await clearStoredLocationsAsync();
      } catch (e) {
        console.warn('Error clearing stored locations on stop:', e);
      }

      // Sprint mode uses watchPositionAsync — clean it up too.
      if (locationWatcher.current) {
        locationWatcher.current.remove();
        locationWatcher.current = null;
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

      // Navigate to activity summary — store GPS path in AsyncStorage instead of
      // the URL (large location arrays truncate and crash JSON.parse on summary).
      const displayDistance = useImperial ? distance * 0.621371 : distance;
      const endTime = Date.now();
      const resolvedStartTime = startTime ?? startTimeRef.current ?? endTime - elapsed;

      await storePendingActivitySummary({
        locations,
        distance: displayDistance,
        duration: elapsed / 1000,
        pace: averagePace,
        unit: useImperial ? 'miles' : 'km',
        activityType: wasSprintMode ? 'timed_distance' : activityType,
        startTime: resolvedStartTime,
        endTime,
        sprintDistance: wasSprintMode ? distanceNeededToTravel : null,
      });

      router.push({
        pathname: '/(modals)/activity-summary',
        params: { usePending: 'true' },
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
      startTimeRef.current = null;
      setTotalPauseTime(0);
      totalPauseTimeRef.current = 0;
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
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };


  const formatPace = (pace) => {
    if (pace <= 0) return '--:--';
    const minutes = Math.floor(pace);
    const seconds = Math.floor((pace % 1) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (useImperial) {
      return (meters * 0.000621371).toFixed(2);
    }
    return (meters / 1000).toFixed(2);
  };

  // ============================================================
  // Draggable bottom-sheet PanResponder
  // ============================================================
  // PanResponder is React Native's primitive for hooking into
  // raw touch gestures: a series of callbacks that fire on
  // grant (finger touched), move (finger dragged), release
  // (finger lifted). Each callback receives a `gestureState`
  // object whose `dy` is the cumulative vertical drag from the
  // touch-down point (negative = drag up, positive = drag down).
  //
  // We capture the gesture only when the user moves vertically
  // by more than 5px — small horizontal jiggles get ignored so
  // the underlying ScrollView still scrolls if they meant to.
  //
  // On move we update `overlayHeight` (an Animated.Value) live
  // so the sheet follows the finger; on release we snap to
  // either expanded or collapsed depending on whichever side
  // of the midpoint the height ended up on.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        // We use `__getValue()` (the underscored accessor) here
        // because `Animated.Value` doesn't expose `.value`
        // synchronously, but we need the current height to add
        // the new delta to it. Subtract `dy` because dragging UP
        // (negative dy) should INCREASE the height.
        const currentHeight = overlayHeight.__getValue();
        const newHeight = Math.max(
          OVERLAY_COLLAPSED_HEIGHT,
          Math.min(OVERLAY_EXPANDED_HEIGHT, currentHeight - gestureState.dy)
        );
        overlayHeight.setValue(newHeight);
      },
      onPanResponderRelease: () => {
        const currentHeight = overlayHeight.__getValue();
        const midpoint = (OVERLAY_COLLAPSED_HEIGHT + OVERLAY_EXPANDED_HEIGHT) / 2;
        const targetHeight =
          currentHeight > midpoint ? OVERLAY_EXPANDED_HEIGHT : OVERLAY_COLLAPSED_HEIGHT;
        const expanded = targetHeight === OVERLAY_EXPANDED_HEIGHT;
        // `useNativeDriver: false` because `height` is a layout
        // prop that the native side animates on the JS thread —
        // not on the dedicated UI thread. Trying to use the
        // native driver for height would silently fail.
        Animated.spring(overlayHeight, {
          toValue: targetHeight,
          tension: 60,
          friction: 10,
          useNativeDriver: false,
        }).start();
        setOverlayExpanded(expanded);
      },
    })
  ).current;

  // Tap-to-toggle the drag handle bar at the top of the sheet
  // — gives a discoverable, accessible alternative to the drag
  // gesture for users who don't realize they can swipe it.
  const toggleOverlay = () => {
    const next = !overlayExpanded;
    setOverlayExpanded(next);
    Animated.spring(overlayHeight, {
      toValue: next ? OVERLAY_EXPANDED_HEIGHT : OVERLAY_COLLAPSED_HEIGHT,
      tension: 60,
      friction: 10,
      useNativeDriver: false,
    }).start();
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
        <ScrollView
          ref={workoutScrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
        >
          {/* Recovery Map - muscle group recovery at top */}
          {userProfile?.id && (
            <View style={styles.recoveryMapWrap}>
              <RecoveryMap userId={userProfile.id} refreshKey={recoveryMapRefreshKey} />
            </View>
          )}
          <View style={[styles.header, userProfile?.id && styles.headerBelowRecovery]}>
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

        {pendingActiveWorkout ? (
          <View style={styles.resumeWorkoutBanner}>
            <View style={styles.resumeWorkoutBannerContent}>
              <Ionicons name="play-circle" size={28} color="#00ffff" />
              <View style={styles.resumeWorkoutBannerText}>
                <Text style={styles.resumeWorkoutBannerTitle}>Resume workout</Text>
                <Text style={styles.resumeWorkoutBannerSubtitle} numberOfLines={1}>
                  {pendingActiveWorkout.workout?.name || 'Workout'} ·{' '}
                  {formatPendingWorkoutElapsed(pendingActiveWorkout.elapsedTime)}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.resumeWorkoutButton} onPress={resumePendingWorkout}>
              <Text style={styles.resumeWorkoutButtonText}>Resume</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {/*
            Freeform Workout entry point.
            We reuse the existing /active-workout screen instead of creating a brand-new
            screen — a freeform workout IS an active workout that simply starts empty so
            the user adds exercises on the fly. Expo Router's object form lets us pass
            query params: `freeform: 'true'` is read inside active-workout.js.
            Note: params values must be strings (or arrays of strings) — that's why we
            send the literal 'true' rather than the boolean true.
          */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              startWorkoutWithPendingCheck(() =>
                router.push({ pathname: '/active-workout', params: { freeform: 'true' } })
              )
            }
          >
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

          {/* Workout schedule — below quick actions */}
          <View style={styles.scheduleSection}>
            <Text style={styles.scheduleSectionTitle}>Workout schedule</Text>
            {/*
              Helper subtitle so first-time users know that the calendar
              is interactive — tapping a day opens a sheet to assign or
              confirm what workout (or rest) is scheduled for it.
            */}
            <Text style={styles.scheduleSectionHint}>
              Tap a day to choose or confirm a workout.
            </Text>
            <WorkoutWeekSchedule
              accentColor="#00ffff"
              getSplitDayForDate={(date) => getSplitDayForDate(date, effectiveSplit)}
              scheduleContextForDate={getScheduleContextForDate}
            />

            {/*
              The "Today's Schedule" block (which used to live here
              just below the calendar) has been MOVED into the
              unified "Today's plan" section further down. That way
              we have a single source of truth for what the user is
              doing today — scheduled workout, scheduled rest, split
              rest, or recommendations — instead of two competing
              labels showing the same info.
            */}
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
                  <Text style={styles.startButtonText}>View Workout</Text>
                </TouchableOpacity>
              </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommended for today + training split button */}
        <View
          ref={recommendedSectionRef}
          style={styles.section}
          onLayout={(e) => { recommendedSectionYRef.current = e.nativeEvent.layout.y; }}
        >
          <TouchableOpacity
            style={styles.trainingSplitButton}
            onPress={() => setShowTrainingSplitModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.trainingSplitButtonIcon}>
              <Ionicons name="grid-outline" size={22} color="#00ffff" />
            </View>
            <View style={styles.trainingSplitButtonTextWrap}>
              <Text style={styles.trainingSplitButtonTitle}>Training split</Text>
              <Text style={styles.trainingSplitButtonValue} numberOfLines={1}>
                {effectiveSplit?.shortLabel || effectiveSplit?.chipLabel || 'Choose split'}
              </Text>
              <Text style={styles.trainingSplitButtonToday}>
                Today: {formatSplitDayLabel(getSplitDayForDate(new Date(), effectiveSplit))}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="rgba(0, 255, 255, 0.7)" />
          </TouchableOpacity>

          <Text style={styles.splitSubLabel}>Workout filters</Text>
          <View style={styles.splitFiltersRow}>
            <TouchableOpacity
              onPress={() => setShowEquipmentModal(true)}
              style={[styles.filterChipButton, equipmentFilterEnabled && styles.filterChipButtonActive]}
            >
              <Ionicons name="barbell-outline" size={18} color="#00ffff" />
              <Text style={styles.filterChipButtonText}>
                {equipmentFilterEnabled ? 'Equipment · on' : 'Equipment'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowInjuryModal(true)}
              style={[styles.filterChipButton, injuredMuscleIds.length > 0 && styles.filterChipButtonActive]}
            >
              <Ionicons name="body-outline" size={18} color="#00ffff" />
              <Text style={styles.filterChipButtonText}>
                {injuredMuscleIds.length > 0
                  ? `Injuries · ${injuredMuscleIds.length}`
                  : 'Injuries'}
              </Text>
            </TouchableOpacity>
          </View>
          {/*
            =====================================================
            UNIFIED "Today's plan" section
            =====================================================
            This is the single source of truth for "what is the user
            doing today?" It used to be split across two competing
            sections ("Today's Schedule" right under the calendar +
            "Today's plan" down here), which was confusing and
            redundant. Now everything lives here, with a clear
            priority order:

              1. User has a SCHEDULED workout (non-rest)        →
                 show the scheduled workout card with Start CTA.
                 Scheduled wins because the user explicitly
                 planned something for this date.

              2. User has a scheduled REST day, OR their training
                 split says today is rest                        →
                 show the compact rest-day card.

              3. There are recommended workouts for today        →
                 show "Recommended for today (Push)" + cards.

              4. Recommendations were filtered out by injuries
                 or equipment settings                           →
                 explain why with `injuryBlockReason`.

              5. None of the above (no plan, no rec, no filter)  →
                 hide the section entirely so we don't show an
                 empty "Today's plan" header with nothing under it.
          */}
          {(() => {
            // Compute these once at the top so the JSX below stays
            // readable. IIFE pattern: define helpers + return JSX
            // inline. (See the syntax explainer in chat for why.)
            const hasScheduledWorkout =
              todayScheduledWorkout && !todayScheduledWorkout.is_rest_day;
            const hasScheduledRest =
              todayScheduledWorkout && todayScheduledWorkout.is_rest_day;
            const isRestDay = hasScheduledRest || isTodaySplitRest;
            const hasRecommended = reccomendedWorkouts.length > 0;
            const hasInjuryMsg = !!injuryBlockReason;
            const showSection =
              hasScheduledWorkout || isRestDay || hasRecommended || hasInjuryMsg;

            if (!showSection) return null;

            const todaySplitLabel = formatSplitDayLabel(
              getSplitDayForDate(new Date(), effectiveSplit)
            );

            return (
              <>
                <Text style={[styles.sectionTitle, { marginBottom: 8, marginTop: 4 }]}>
                  Today's plan
                </Text>

                {hasScheduledWorkout ? (
                  // -------- 1. Scheduled (non-rest) workout --------
                  <View style={styles.scheduledWorkoutCard}>
                    <View style={styles.scheduledWorkoutTitleContainer}>
                      <Ionicons name="calendar" size={20} color="#00ffff" />
                      <Text style={styles.scheduledWorkoutTitle}>
                        {todayScheduledWorkout.workout_name}
                      </Text>
                    </View>
                    <View style={styles.exercises}>
                      <Text style={styles.exercisesTitle}>Exercises:</Text>
                      {todayScheduledWorkout.workout_exercises &&
                        todayScheduledWorkout.workout_exercises
                          .slice(0, 3)
                          .map((exercise, index) => (
                            <Text key={index} style={styles.exercisesList}>
                              • {typeof exercise === 'string' ? exercise : exercise.name}
                              {exercise.sets && exercise.reps && ` (${exercise.sets} x ${exercise.reps})`}
                            </Text>
                          ))}
                      {todayScheduledWorkout.workout_exercises &&
                        todayScheduledWorkout.workout_exercises.length > 3 && (
                          <Text style={styles.exercisesList}>
                            ... and {todayScheduledWorkout.workout_exercises.length - 3} more
                          </Text>
                        )}
                    </View>
                    <TouchableOpacity
                      style={styles.startScheduledButton}
                      onPress={() =>
                        openWorkoutPreview({
                          name: todayScheduledWorkout.workout_name,
                          workout_name: todayScheduledWorkout.workout_name,
                          exercises: todayScheduledWorkout.workout_exercises,
                          isScheduled: true,
                          scheduledWorkoutId: todayScheduledWorkout.id,
                        })
                      }
                    >
                      <Ionicons name="eye-outline" size={20} color="#000" />
                      <Text style={styles.startScheduledButtonText}>
                        View Scheduled Workout
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isRestDay ? (
                  // -------- 2. Rest day (scheduled OR split) --------
                  <View
                    style={[
                      styles.scheduledRestDayCard,
                      styles.scheduledRestDayCardCompact,
                    ]}
                  >
                    <Ionicons
                      name="bed-outline"
                      size={28}
                      color="#ffa500"
                      style={styles.restDayCompactIcon}
                    />
                    <View style={styles.restDayCompactTextWrap}>
                      <Text style={styles.restDayTitleCompact}>Rest day</Text>
                      <Text style={styles.restDayMessageCompact}>
                        {hasScheduledRest
                          ? 'Recovery scheduled. Rest, stretch lightly, or pick another day on the calendar.'
                          : 'Your split has recovery scheduled. Rest, stretch lightly, or tap the calendar to schedule an optional workout.'}
                      </Text>
                      {/* Show optional notes only when the user typed
                          something other than the default "Rest day"
                          string (which would just repeat the title). */}
                      {todayScheduledWorkout?.notes &&
                        todayScheduledWorkout.notes !== 'Rest day' && (
                          <Text style={styles.restDayCompactNotes}>
                            Notes: {todayScheduledWorkout.notes}
                          </Text>
                        )}
                      <TouchableOpacity
                        style={styles.restDayCompactCta}
                        onPress={() => {
                          setSelectedScheduledDate(new Date());
                          setSelectedScheduledWorkout(todayScheduledWorkout || null);
                          setShowScheduledWorkoutModal(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="calendar-outline" size={14} color="#ffa500" />
                        <Text style={styles.restDayCompactCtaText}>
                          Schedule something
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : hasRecommended ? (
                  // -------- 3. Recommended workouts for today --------
                  <>
                    <Text style={styles.todaysPlanSubtitle}>
                      Recommended for {todaySplitLabel}
                    </Text>
                    <View style={styles.workoutCardsContainer}>
                      {reccomendedWorkouts.map((workout, idx) => (
                        <RecommendedWorkoutCard
                          key={workout.id || workout.name || idx}
                          workout={workout}
                          isFavorite={favoriteWorkoutsIds.includes(
                            getFavoriteKey(workout)
                          )}
                          onOpen={handleOpenRecommended}
                          onFavorite={handleFavoriteWorkout}
                          styles={styles}
                        />
                      ))}
                    </View>
                  </>
                ) : (
                  // -------- 4. Injury / equipment block message --------
                  <Text style={styles.workoutDescription}>
                    {injuryBlockReason === 'leg_day' &&
                      'Lower/leg day is paused because of your injury settings. Rest or do light mobility.'}
                    {injuryBlockReason === 'injury' &&
                      'No workouts left after applying your injury filters. Tap Injuries to adjust, or pick a different training day.'}
                    {injuryBlockReason === 'equipment' &&
                      'No workouts match your equipment. Open Equipment, select more gear, or turn off "Filter recommendations."'}
                  </Text>
                )}
              </>
            );
          })()}
        </View>


        {/* ================================================================ */}
        {/* Workout Category Buttons — bottom of the workout screen           */}
        {/* ================================================================ */}
        {/* Three quick-access buttons that open dedicated category screens.  */}
        {/* These replace the old inline "Your Workouts" / "Workout Types" /  */}
        {/* "Premium Workouts" sections that used to live here — every       */}
        {/* workout listing now happens on its own screen so the main page   */}
        {/* stays clean and only shows the split-plan recommendations above. */}
        <View style={styles.workoutCategoryButtonsRow}>
          <TouchableOpacity
            style={styles.workoutCategoryButton}
            onPress={() => router.push('/your-workouts')}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark-outline" size={24} color="#00ffff" />
            <Text style={styles.workoutCategoryButtonText}>Your Workouts</Text>
            <Text style={styles.workoutCategoryButtonSubtext}>Custom builds</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.workoutCategoryButton}
            onPress={() => router.push('/more-workouts')}
            activeOpacity={0.85}
          >
            <Ionicons name="layers-outline" size={24} color="#00ffff" />
            <Text style={styles.workoutCategoryButtonText}>More Workouts</Text>
            <Text style={styles.workoutCategoryButtonSubtext}>Starter library</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.workoutCategoryButton}
            onPress={() => router.push('/premium-workouts')}
            activeOpacity={0.85}
          >
            <Ionicons name="star-outline" size={24} color="#ffd700" />
            <Text style={styles.workoutCategoryButtonText}>Premium</Text>
            <Text style={styles.workoutCategoryButtonSubtext}>Pro routines</Text>
          </TouchableOpacity>
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
          {/*
            ===================================================
            Run-tab header — segmented activity switcher
            ===================================================
            Replaces the older "Activity" settings button (which
            opened a full modal) with an inline segmented control:
            Run / Walk / Bike / Timed. One tap is all it takes to
            switch modes, and the active one is highlighted in
            cyan (or gold for the gamified Timed Distance).
            The list-icon on the right opens the run history.
          */}
          <View style={styles.runHeader}>
            <View style={styles.activitySwitcher}>
              {[
                { key: 'run', icon: 'fitness', label: 'Run' },
                { key: 'walk', icon: 'walk', label: 'Walk' },
                { key: 'bike', icon: 'bicycle', label: 'Bike' },
              ].map(({ key, icon, label }) => {
                const isActive = activityType === key && !sprintMode;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.activitySwitcherButton, isActive && styles.activitySwitcherButtonActive]}
                    onPress={() => {
                      setActivityType(key);
                      setSprintMode(false);
                    }}
                  >
                    <Ionicons name={icon} size={18} color={isActive ? '#000' : '#666'} />
                    <Text style={[styles.activitySwitcherText, isActive && styles.activitySwitcherTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.activitySwitcherButton,
                  (sprintMode || activityType === 'challenge') && styles.activitySwitcherButtonActiveChallenge,
                ]}
                onPress={() => {
                  setActivityType('challenge');
                  setShowSprintModal(true);
                }}
              >
                <Ionicons
                  name="flash"
                  size={18}
                  color={(sprintMode || activityType === 'challenge') ? '#000' : '#ffd700'}
                />
                <Text
                  style={[
                    styles.activitySwitcherText,
                    styles.activitySwitcherTextCompact,
                    (sprintMode || activityType === 'challenge') && styles.activitySwitcherTextActiveChallenge,
                  ]}
                >
                  Timed
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.runHeaderButtons}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.push('/run-log')}
                accessibilityLabel="Open run history"
              >
                <Ionicons name="list-outline" size={22} color="#00ffff" />
              </TouchableOpacity>
            </View>
          </View>

          <MapView
            ref={mapRef}
            style={styles.map}
            {...(mapProvider != null ? { provider: mapProvider } : {})}
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

          {/*
            ===================================================
            Draggable bottom-sheet stats overlay
            ===================================================
            Wrapped in `Animated.View` so its `height` can be
            tweened by the panResponder + spring. The `pan
            Handlers` spread plumbs raw touch events into our
            PanResponder instance defined above.

            The drag handle bar at the top is also tap-able as
            a fallback for users who don't realize they can
            swipe — calls `toggleOverlay()` to snap between
            collapsed and expanded.
          */}
          <Animated.View
            style={[
              styles.overlay,
              overlayExpanded ? styles.overlayExpanded : styles.overlayCollapsed,
              { height: overlayHeight, bottom: runOverlayBottom },
            ]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              style={[styles.dragHandle, !overlayExpanded && styles.dragHandleCollapsed]}
              onPress={toggleOverlay}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={overlayExpanded ? 'Collapse stats panel' : 'Expand stats panel'}
            >
              <View style={styles.dragHandleBar} />
            </TouchableOpacity>

            <View
              style={[
                styles.statsContainer,
                !overlayExpanded && styles.statsContainerCollapsed,
              ]}
            >
              <View style={styles.statBox}>
                <Text
                  style={[
                    styles.statLabel,
                    !overlayExpanded && styles.statLabelCollapsed,
                  ]}
                >
                  {sprintMode ? 'Progress' : 'Distance'}
                </Text>
                {sprintMode ? (
                  <View style={styles.sprintProgressContainer}>
                    <Animated.View
                      style={[
                        styles.finishLine,
                        {
                          opacity: finishLineOpacity,
                          transform: [{
                            scale: finishLineOpacity.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.8, 1],
                            }),
                          }],
                        },
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
                    <View style={styles.progressBarContainer}>
                      <Animated.View
                        style={[
                          styles.progressBarFill,
                          {
                            width: sprintProgressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>
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
                              }),
                            }],
                          },
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
                  <>
                    <Text
                      style={[
                        styles.statValue,
                        !overlayExpanded && styles.statValueCollapsed,
                      ]}
                    >
                      {useImperial
                        ? (distance * 0.621371).toFixed(2)
                        : distance.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.statUnit,
                        !overlayExpanded && styles.statUnitCollapsed,
                      ]}
                    >
                      {useImperial ? 'mi' : 'km'}
                    </Text>
                  </>
                )}
              </View>

              {overlayExpanded && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>
                      {activityType === 'bike' ? 'Speed' : 'Avg Pace'}
                    </Text>
                    <Text style={styles.statValue}>
                      {activityType === 'bike'
                        ? currentPace > 0
                          ? currentPace.toFixed(1)
                          : '--'
                        : averagePace > 0
                          ? formatPace(averagePace)
                          : '--:--'}
                    </Text>
                    <Text style={styles.statUnit}>
                      {activityType === 'bike'
                        ? useImperial
                          ? 'mph'
                          : 'kph'
                        : `/${useImperial ? 'mi' : 'km'}`}
                    </Text>
                  </View>
                </>
              )}

              {overlayExpanded && <View style={styles.statDivider} />}

              <View style={styles.statBox}>
                <Text
                  style={[
                    styles.statLabel,
                    !overlayExpanded && styles.statLabelCollapsed,
                  ]}
                >
                  Time
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    !overlayExpanded && styles.statValueCollapsed,
                  ]}
                >
                  {formatRunTime(elapsed)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.actionButtonContainer,
                overlayExpanded && styles.actionButtonContainerExpanded,
              ]}
            >
              {recording && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.runButton,
                      paused ? styles.resumeRunButton : styles.pauseRunButton,
                      !overlayExpanded && styles.runButtonCollapsed,
                    ]}
                    onPress={pauseActivity}
                  >
                    <Ionicons
                      name={paused ? 'play' : 'pause'}
                      size={overlayExpanded ? 22 : 18}
                      color="#fff"
                    />
                    <Text
                      style={[
                        styles.runButtonText,
                        !overlayExpanded && styles.runButtonTextCollapsed,
                      ]}
                    >
                      {paused ? 'Resume' : 'Pause'}
                    </Text>
                  </TouchableOpacity>
                  {!paused && (
                    <TouchableOpacity
                      style={[
                        styles.stopRunButton,
                        !overlayExpanded && styles.stopRunButtonCollapsed,
                      ]}
                      onPress={stopActivity}
                    >
                      <Ionicons
                        name="stop"
                        size={overlayExpanded ? 22 : 18}
                        color="#fff"
                      />
                      <Text
                        style={[
                          styles.runButtonText,
                          !overlayExpanded && styles.runButtonTextCollapsed,
                        ]}
                      >
                        End
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {!recording && (
                <TouchableOpacity
                  style={[
                    styles.startRunButton,
                    !overlayExpanded && styles.startRunButtonCollapsed,
                  ]}
                  onPress={startActivity}
                >
                  <Ionicons
                    name="play"
                    size={overlayExpanded ? 28 : 22}
                    color="#000"
                  />
                  <Text
                    style={[
                      styles.startRunButtonText,
                      !overlayExpanded && styles.startRunButtonTextCollapsed,
                    ]}
                  >
                    Start {activityType.charAt(0).toUpperCase() + activityType.slice(1)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
          
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

      {/*
        The standalone "Activity Selection Modal" used to live
        here. It was replaced by the inline segmented switcher
        in the run-tab header (Run / Walk / Bike / Timed), which
        is faster and more discoverable. The modal's only entry
        point — a "Choose Activity" button — was removed at the
        same time, so this whole block was dead code.
      */}

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

      <WorkoutEquipmentModal
        visible={showEquipmentModal}
        onClose={() => setShowEquipmentModal(false)}
        initialEquipmentIds={userEquipmentIds}
        initialFilterEnabled={equipmentFilterEnabled}
        onSave={handleSaveEquipmentSettings}
      />

      <InjuryModal
        visible={showInjuryModal}
        onClose={() => setShowInjuryModal(false)}
        options={injuredMusclesOptions}
        initialSelectedIds={injuredMuscleIds}
        onSave={async (ids) => {
          try {
            await AsyncStorage.setItem('injuredMuscles', JSON.stringify(ids));
            setInjuredMuscleIds(Array.isArray(ids) ? ids : []);
          } catch (e) {
            console.warn('Failed to save injuries:', e);
            Alert.alert('Could not save', 'Injury settings failed to save. Please try again.');
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
        scheduleContext={
          selectedScheduledDate ? getScheduleContextForDate(selectedScheduledDate) : null
        }
        onWorkoutUpdated={() => {
          notifyScheduleUpdated();
          fetchTodayScheduledWorkout();
        }}
      />

      <TrainingSplitModal
        visible={showTrainingSplitModal}
        onClose={() => setShowTrainingSplitModal(false)}
        effectiveSplit={effectiveSplit}
        visibleSplitOptions={visibleSplitOptions}
        frequencyVariantsForSplit={frequencyVariantsForSplit}
        allSplitOptions={SPLIT_OPTIONS}
        selectedSplit={selectedSplit}
        onSelectSplit={handleSelectSplitFromModal}
        todaySplitLabel={formatSplitDayLabel(getSplitDayForDate(new Date(), effectiveSplit))}
        onEditCustomWeek={() => {
          setShowTrainingSplitModal(false);
          const current =
            selectedSplit?.days && selectedSplit.days.length === 7
              ? selectedSplit.days
              : DEFAULT_CUSTOM_DAYS;
          const toDisplay = (d) => {
            const s = (typeof d === 'string' ? d.trim() : String(d)) || 'rest';
            const match = SPLIT_DAY_OPTIONS.find((o) => o.toLowerCase() === s.toLowerCase());
            return match || (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
          };
          setCustomDaysForEdit(current.map(toDisplay));
          setShowCustomSplitModal(true);
        }}
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
      
      {activeTab !== 'run' && <FloatingAITrainer />}
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
  recoveryMapWrap: {
    paddingTop: 8,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerBelowRecovery: {
    paddingTop: 10,
    paddingBottom: 8,
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
  injuryButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    borderColor: 'rgba(0, 255, 255, 0.45)',
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
  trainingSplitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
  },
  trainingSplitButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trainingSplitButtonTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  trainingSplitButtonTitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  trainingSplitButtonValue: {
    color: '#00ffff',
    fontSize: 17,
    fontWeight: '700',
  },
  trainingSplitButtonToday: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    marginTop: 4,
  },
  splitSubLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  splitChipScroll: {
    marginBottom: 14,
  },
  splitChipScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  splitTypeChip: {
    marginRight: 0,
  },
  frequencyChip: {
    minWidth: 48,
    alignItems: 'center',
  },
  splitFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  filterChipButton: {
    flex: 1,
    minWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
  },
  filterChipButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.14)',
    borderColor: 'rgba(0, 255, 255, 0.55)',
  },
  filterChipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffff',
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
  },
  periodButtonTextActive: {
    color: '#00ffff',
  },
  moreSplitsButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleSection: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  scheduleSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 20,
    marginBottom: 6,
  },
  // Hint shown right under the "Workout schedule" title so users know
  // the calendar tiles below are tappable. Subtle muted color pairs
  // with the cyan accent without competing with the section title.
  scheduleSectionHint: {
    fontSize: 12,
    color: '#888',
    marginHorizontal: 20,
    marginBottom: 12,
    fontStyle: 'italic',
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
  todayStripRest: {
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
    borderColor: 'rgba(255, 165, 0, 0.45)',
  },
  todayStripLabelRest: {
    color: 'rgba(255, 165, 0, 0.75)',
  },
  todayStripSplitRest: {
    color: '#ffa500',
  },
  todayStripRestBadge: {
    color: '#ffa500',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  splitRestSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffa500',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  splitRestScheduleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.4)',
  },
  splitRestScheduleLinkText: {
    color: '#ffa500',
    fontSize: 14,
    fontWeight: '600',
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
  resumeWorkoutBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resumeWorkoutBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeWorkoutBannerText: {
    flex: 1,
  },
  resumeWorkoutBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resumeWorkoutBannerSubtitle: {
    color: '#9aa0a6',
    fontSize: 13,
    marginTop: 2,
  },
  resumeWorkoutButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resumeWorkoutButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
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
  // ----------------------------------------------------------------
  // Workout Category Buttons (bottom of the workout screen)
  // ----------------------------------------------------------------
  // The row container uses flexDirection: 'row' so the three buttons
  // sit side-by-side. `gap` adds spacing BETWEEN children without
  // adding margin to the outer ones (cleaner than margin tricks).
  // `paddingHorizontal: 20` aligns the row with the rest of the page
  // sections that also use 20-pixel padding.
  workoutCategoryButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 30,
    gap: 10,
  },
  // Each button takes 1/3 of the available width because we set
  // `flex: 1` on three siblings inside a row container. The cyan
  // border + translucent fill matches the existing actionButton style
  // used elsewhere on this screen.
  workoutCategoryButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  workoutCategoryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  workoutCategoryButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
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
  runOverlay: {
    bottom: Platform.OS === 'ios' ? 24 : 16,
  },
  overlay: {
    position: 'absolute',
    // `bottom` is set inline via `runOverlayBottom` (tab bar + ad banner).
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  overlayExpanded: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  overlayCollapsed: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  statsContainerCollapsed: {
    marginBottom: 12,
    paddingVertical: 4,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#999',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statLabelCollapsed: {
    fontSize: 9,
    marginBottom: 3,
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  statValueCollapsed: {
    fontSize: 20,
    marginBottom: 1,
  },
  statUnit: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  statUnitCollapsed: {
    fontSize: 10,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  actionButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 0,
  },
  actionButtonContainerExpanded: {
    marginBottom: 0,
    paddingBottom: 0,
  },
  startRunButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  startRunButtonCollapsed: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 160,
  },
  startRunButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  startRunButtonTextCollapsed: {
    fontSize: 15,
    marginLeft: 8,
  },
  runButton: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    minWidth: 120,
  },
  runButtonCollapsed: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 20,
    minWidth: 90,
  },
  runButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  runButtonTextCollapsed: {
    fontSize: 13,
    marginLeft: 6,
  },
  pauseRunButton: {
    backgroundColor: '#2196f3',
    shadowColor: '#2196f3',
  },
  resumeRunButton: {
    backgroundColor: '#ff9800',
    shadowColor: '#ff9800',
  },
  stopRunButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    minWidth: 100,
  },
  stopRunButtonCollapsed: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 20,
    minWidth: 80,
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
  // ============================================================
  // Segmented activity switcher (Run / Walk / Bike / Timed)
  // ============================================================
  // Sits in the run-tab header. `flex: 1` on the container
  // makes the four pills share width equally, and `minWidth: 0`
  // on each button stops them from refusing to shrink when the
  // labels would otherwise overflow on narrow screens.
  activitySwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  activitySwitcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  activitySwitcherButtonActive: {
    backgroundColor: '#00ffff',
  },
  activitySwitcherText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  activitySwitcherTextCompact: {
    fontSize: 11,
  },
  activitySwitcherTextActive: {
    color: '#000',
  },
  activitySwitcherButtonActiveChallenge: {
    backgroundColor: '#ffd700',
  },
  activitySwitcherTextActiveChallenge: {
    color: '#000',
  },
  // Round, faintly-glowing icon button for "Open run history"
  // sitting at the right edge of the header. Uses a subtle
  // cyan tint to match the rest of the run-tab chrome without
  // competing with the brighter activity switcher next to it.
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  // ============================================================
  // Draggable overlay drag-handle bar
  // ============================================================
  // The little horizontal pill at the very top of the bottom
  // sheet. We give it generous vertical padding so the touch
  // target is comfortable (the visible bar itself is only 4px
  // tall — way too small to reliably hit). The bar's own
  // background is a translucent white so it reads as an
  // affordance over both light and dark map tiles.
  dragHandle: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  dragHandleCollapsed: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
  },
  // -----------------------------------------------------------------
  // Compact variant of the rest-day card.
  // Used under the "Today's plan" header where the original vertical
  // stack (icon → title → 2-line message → CTA) ate too much vertical
  // space. We switch to a HORIZONTAL row:
  //   [icon] | [title]
  //          | [message]
  //          | [Schedule CTA]
  // The icon sits centered vertically next to the text column, and
  // padding shrinks from 24 → 12. End result is roughly half the
  // height of the original full-size card.
  // -----------------------------------------------------------------
  scheduledRestDayCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 4,
    gap: 12,
  },
  // Icon column: just the bed-outline glyph. We use marginRight via
  // the parent's `gap` so no margin needed here. `alignSelf: 'center'`
  // keeps the icon vertically centered against the text column even
  // when the message wraps to two lines.
  restDayCompactIcon: {
    alignSelf: 'center',
  },
  // Text column. flex: 1 makes it grow to fill the remaining width
  // beside the icon. Without it, the column would shrink to fit its
  // content and leave a big empty gap on the right of the card.
  restDayCompactTextWrap: {
    flex: 1,
  },
  restDayTitleCompact: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffa500',
    marginBottom: 2,
  },
  restDayMessageCompact: {
    fontSize: 12,
    color: '#bbb',
    lineHeight: 16,
    marginBottom: 6,
  },
  // Inline "Schedule something" CTA that sits BELOW the message in
  // the compact card's text column. Small horizontal pill with an
  // icon + label, kept tight so it fits cleanly on one line.
  restDayCompactCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.35)',
  },
  restDayCompactCtaText: {
    color: '#ffa500',
    fontSize: 12,
    fontWeight: '600',
  },
  // Optional notes line inside the compact rest-day card. Subtle
  // muted text so it visually sits below the message but above the
  // CTA — only renders when the user actually typed a note for the
  // scheduled rest day. `fontStyle: 'italic'` is the cheapest way
  // to make it read as an annotation rather than primary copy.
  restDayCompactNotes: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  // Subtitle that appears under the unified "Today's plan" header
  // when we're rendering the recommended-workouts variant. We dim
  // it slightly and make it smaller than `sectionTitle` so it
  // reads as a sub-header for the cards that follow rather than a
  // brand-new section. The matching colour cue (cyan-tinted white)
  // ties it back to the section's overall theme.
  todaysPlanSubtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    marginTop: 2,
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