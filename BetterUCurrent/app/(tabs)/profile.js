"use client";


import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, TextInput, Alert, Linking, Modal, ScrollView, Platform, Switch, Dimensions, ImageBackground } from 'react-native';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUnits } from '../../context/UnitsContext';
import { useTracking } from '../../context/TrackingContext';
import { supabase } from '../../lib/supabase';
import PremiumFeature from '../components/PremiumFeature';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { PremiumAvatar } from '../components/PremiumAvatar';
import SpotifyConnectButton from '../components/SpotifyConnectButton';
import { Share } from 'react-native';
import { useSettings } from '../../context/SettingsContext';
import BadgeDisplay from '../../components/BadgeDisplay';
import BadgeModal from '../../components/BadgeModal';
import BadgeCollection from '../../components/BadgeCollection';
import TrophyCase from '../../components/TrophyCase';
import VerifiedBadge from '../components/VerifiedBadge';
import { normalizeImageUrl } from '../../utils/imageUrlHelpers';
import { getUserBonds } from '../../lib/bonds';
import { useBottomChromeInsets } from '../../context/BottomChromeContext';
// HealthKit imports - using imperative API to avoid subscription bugs
let useHealthkitAuthorization, getMostRecentQuantitySample, queryStatisticsForQuantity, queryWorkoutSamples, saveWorkoutSample, queryQuantitySamples, HKQuantityTypeIdentifier;
try {
  const healthKit = require('@kingstinct/react-native-healthkit');
  useHealthkitAuthorization = healthKit.useHealthkitAuthorization;
  getMostRecentQuantitySample = healthKit.getMostRecentQuantitySample;
  queryStatisticsForQuantity = healthKit.queryStatisticsForQuantity;
  queryWorkoutSamples = healthKit.queryWorkoutSamples;
  saveWorkoutSample = healthKit.saveWorkoutSample;
  queryQuantitySamples = healthKit.queryQuantitySamples;
  HKQuantityTypeIdentifier = healthKit.HKQuantityTypeIdentifier;
  console.log('HealthKit library loaded successfully');
} catch (error) {
  console.log('HealthKit library not available:', error);
  useHealthkitAuthorization = () => ['notDetermined', () => {}];
  getMostRecentQuantitySample = async () => null;
  queryStatisticsForQuantity = async () => null;
  queryWorkoutSamples = async () => [];
  saveWorkoutSample = async () => null;
  queryQuantitySamples = async () => [];
  HKQuantityTypeIdentifier = {};
}


const PROFILE_SCROLL_EXTRA_BOTTOM = 40;

const ProfileScreen = () => {
  const { userProfile, isLoading, updateProfile } = useUser();
  const { scrollPaddingBottom } = useBottomChromeInsets();
  const {
    convertWeight,
    convertHeight,
    getWeightUnit,
    getHeightUnit,
    useImperial,
    toggleUnits,
    convertWeightBack,
    convertHeightBack
  } = useUnits();
  const { calories, water, updateGoal } = useTracking();
  const { settings, updateSettings } = useSettings();
  const router = useRouter();
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const { user, signOut } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [spotifyStatusMessage, setSpotifyStatusMessage] = useState('');
  const [spotifyTopTracks, setSpotifyTopTracks] = useState([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [musicModalVisible, setMusicModalVisible] = useState(false);
  const [spotifyConnectedMessage, setSpotifyConnectedMessage] = useState('');
  const [healthKitModalVisible, setHealthKitModalVisible] = useState(false);
  const [displayedBadge, setDisplayedBadge] = useState(null);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showBadgeCollection, setShowBadgeCollection] = useState(false);
  const [healthKitRequested, setHealthKitRequested] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [themeCosts, setThemeCosts] = useState({}); // Store theme costs from database
  const [themeCostsLoading, setThemeCostsLoading] = useState(true);
  
  // Custom background state (only for display, upload is in store)
  const [activeCustomBackground, setActiveCustomBackground] = useState(null);
  // Background upload cost is hardcoded to 10,000 Neuros
  const backgroundUploadCost = 10000;
  
  // Rotating themes state
  const [rotatingThemes, setRotatingThemes] = useState([]);
  const [currentRotationId, setCurrentRotationId] = useState(null);
  const [currentRotatingTheme, setCurrentRotatingTheme] = useState(null); // Store details of active rotating theme
  
  // Forfeited bonds state (for portfolio overview adjustment)
  const [forfeitedBondsTotal, setForfeitedBondsTotal] = useState(0);
  
  // Profile theme options - background colors (costs are fetched from database)
  const PROFILE_THEMES = {
    // Free themes
    default: {
      name: 'Default',
      backgroundColor: '#1a1a1a', // Lightened from #000000
      gradientColors: ['#1a1a1a', '#2a2a2a'], // Lightened from #000000, #0a0a0a
      cost: 0,
      unlocked: true,
    },
    light_blue: {
      name: 'Ocean Blue',
      backgroundColor: '#2a4f7f', // Lightened from #1e3a5f
      gradientColors: ['#2a4f7f', '#1a2f4f'], // Lightened from #1e3a5f, #0d1b2a
      cost: 0,
      unlocked: true,
    },
    pink: {
      name: 'Sunset Pink',
      backgroundColor: '#6a295a', // Lightened from #4a1942
      gradientColors: ['#6a295a', '#4a2942'], // Lightened from #4a1942, #2d132c
      cost: 0,
      unlocked: true,
    },
    green: {
      name: 'Forest Green',
      backgroundColor: '#2a5a3a', // Lightened from #1a3a2a
      gradientColors: ['#2a5a3a', '#1a3f2a'], // Lightened from #1a3a2a, #0d1f15
      cost: 0,
      unlocked: true,
    },
    // 1 Referral (3 Neuros) - Starter Themes
    midnight_blue: {
      name: 'Midnight Blue',
      backgroundColor: '#1a2640', // Lightened from #0a1628
      gradientColors: ['#1a2640', '#0f1a28'], // Lightened from #0a1628, #050a14
      cost: 1,
      unlocked: false,
    },
    charcoal: {
      name: 'Charcoal',
      backgroundColor: '#2a2a2a', // Lightened from #1a1a1a
      gradientColors: ['#2a2a2a', '#1f1f1f'], // Lightened from #1a1a1a, #0f0f0f
      cost: 1,
      unlocked: false,
    },
    // 3 Referrals (9 Neuros) - Bronze Tier
    crimson_night: {
      name: 'Crimson Night',
      backgroundColor: '#4d1a1a', // Lightened from #2d0a0a
      gradientColors: ['#4d1a1a', '#2a0f0f'], // Lightened from #2d0a0a, #1a0505
      cost: 5,
      unlocked: false,
    },
    royal_purple: {
      name: 'Royal Purple',
      backgroundColor: '#2a1a4e', // Lightened from #1a0a2e
      gradientColors: ['#2a1a4e', '#1a0f2a'], // Lightened from #1a0a2e, #0f051a
      cost: 5,
      unlocked: false,
    },
    emerald_dark: {
      name: 'Emerald Dark',
      backgroundColor: '#1a3f2a', // Lightened from #0a1f1a
      gradientColors: ['#1a3f2a', '#0f2f1a'], // Lightened from #0a1f1a, #050f0d
      cost: 5,
      unlocked: false,
    },
    // 5 Referrals (15 Neuros) - Silver Tier
    golden_hour: {
      name: 'Golden Hour',
      backgroundColor: '#4a3f1a', // Lightened from #2a1f0a
      gradientColors: ['#4a3f1a', '#2a2f0f'], // Lightened from #2a1f0a, #1a1206
      cost: 10,
      unlocked: false,
    },
    aurora: {
      name: 'Aurora',
      backgroundColor: '#1a2a4a', // Lightened from #0a1a2a
      gradientColors: ['#1a2a4a', '#0f1a2a'], // Lightened from #0a1a2a, #050d15
      cost: 10,
      unlocked: false,
    },
    volcanic: {
      name: 'Volcanic',
      backgroundColor: '#3f1a1a', // Lightened from #1f0a0a
      gradientColors: ['#3f1a1a', '#2a0f0f'], // Lightened from #1f0a0a, #120505
      cost: 10,
      unlocked: false,
    },
    // 10 Referrals (30 Neuros) - Gold Tier
    platinum: {
      name: 'Platinum',
      backgroundColor: '#2a2a3f', // Lightened from #1a1a1f
      gradientColors: ['#2a2a3f', '#1f1f2a'], // Lightened from #1a1a1f, #0f0f12
      cost: 15,
      unlocked: false,
    },
    neon_cyber: {
      name: 'Neon Cyber',
      backgroundColor: '#1f1a2a', // Lightened from #0f0a1a
      gradientColors: ['#1f1a2a', '#0f0f1a'], // Lightened from #0f0a1a, #08050d
      cost: 15,
      unlocked: false,
    },
    obsidian: {
      name: 'Obsidian',
      backgroundColor: '#151515', // Lightened from #050505
      gradientColors: ['#151515', '#0a0a0a'], // Lightened from #050505, #000000
      cost: 15,
      unlocked: false,
    },
  };
  
  // Apple Health workouts state (for importing to feed)
  const [appleWorkouts, setAppleWorkouts] = useState([]);
  const [visibleWorkoutsCount, setVisibleWorkoutsCount] = useState(10); // Pagination for Apple Health imports
  const [loadingAppleWorkouts, setLoadingAppleWorkouts] = useState(false);
  const [uploadingWorkout, setUploadingWorkout] = useState(null); // Track which workout is being uploaded
  
  // BetterU workouts state (for exporting TO Apple Health)
  const [betterUWorkouts, setBetterUWorkouts] = useState([]);
  const [loadingBetterUWorkouts, setLoadingBetterUWorkouts] = useState(false);
  const [exportingWorkout, setExportingWorkout] = useState(null); // Track which workout is being exported
  
  // HealthKit Authorization - always call hooks (React rule)
  // Hooks are always called, but return safe defaults if library not available
  // Temporarily disabled for TestFlight
  const [authorizationStatus, requestAuthorization] = useHealthkitAuthorization({
    toRead: [],
    toWrite: [],
  });
  // const [authorizationStatus, requestAuthorization] = useHealthkitAuthorization({
  //   toRead: Platform.OS === 'ios' ? [
  //     'HKQuantityTypeIdentifierStepCount',
  //     'HKQuantityTypeIdentifierActiveEnergyBurned',
  //     'HKQuantityTypeIdentifierHeartRate',
  //     'HKQuantityTypeIdentifierBodyMass',
  //     'HKQuantityTypeIdentifierHeight',
  //     'HKQuantityTypeIdentifierAppleExerciseTime',
  //     'HKQuantityTypeIdentifierDistanceWalkingRunning', // Distance for runs/walks
  //     'HKQuantityTypeIdentifierDistanceCycling', // Distance for cycling
  //     'HKWorkoutTypeIdentifier', // Access to workout activities (runs, walks, strength, etc.)
  //   ] : [],
  //   toWrite: Platform.OS === 'ios' ? [
  //     'HKWorkoutTypeIdentifier', // Write workouts TO Apple Health
  //     'HKQuantityTypeIdentifierActiveEnergyBurned', // Write calories
  //     'HKQuantityTypeIdentifierDistanceWalkingRunning', // Write distance for runs/walks
  //     'HKQuantityTypeIdentifierDistanceCycling', // Write distance for cycling
  //   ] : [],
  // });

  // Debug: log HealthKit status to see what we're getting
  // useEffect(() => {
  //   console.log('HealthKit authorization status:', authorizationStatus);
  // }, [authorizationStatus]);

  // Load profile theme from userProfile when it changes
  useEffect(() => {
    if (userProfile?.profile_theme) {
      setSelectedTheme(userProfile.profile_theme);
    }
  }, [userProfile?.profile_theme]);

  // Fetch forfeited bonds (for portfolio/other use; balance display uses neuros_balance only)
  useEffect(() => {
    const fetchForfeitedBonds = async () => {
      if (!user?.id) {
        setForfeitedBondsTotal(0);
        return;
      }

      try {
        const result = await getUserBonds(user.id, 'forfeited');
        if (result.success && result.bonds) {
          const total = result.bonds.reduce((sum, bond) => sum + (bond.bond_amount || 0), 0);
          setForfeitedBondsTotal(total);
        } else {
          setForfeitedBondsTotal(0);
        }
      } catch (error) {
        console.error('Error fetching forfeited bonds:', error);
        setForfeitedBondsTotal(0);
      }
    };

    fetchForfeitedBonds();
  }, [user?.id]);

  // Refetch neuros_balance when Profile tab is focused so it always shows the true amount (no flash)
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('neuros_balance')
            .eq('id', user.id)
            .single();
          if (!cancelled && !error && data != null) {
            updateProfile({ neuros_balance: data.neuros_balance });
          }
        } catch (e) {
          if (!cancelled) console.warn('Profile: failed to refetch neuros_balance', e);
        }
      })();
      return () => { cancelled = true; };
    }, [user?.id, updateProfile])
  );

  // Fetch purchased rotating themes for display in theme modal
  useEffect(() => {
    const fetchPurchasedRotatingThemes = async () => {
      if (!user?.id || !userProfile?.purchased_themes) return;
      
      try {
        // Get current rotation
        const { data: rotationData } = await supabase
          .rpc('get_current_rotation');
        
        if (!rotationData) return;
        
        // Fetch all purchased rotating themes from theme_bank
        const purchasedThemeKeys = userProfile.purchased_themes || [];
        if (purchasedThemeKeys.length === 0) return;
        
        const { data: themesData, error } = await supabase
          .from('theme_bank')
          .select('id, name, theme_key, image_url, background_color, gradient_colors, description, rarity')
          .in('theme_key', purchasedThemeKeys)
          .eq('is_active', true)
          .eq('is_rotating', true);
        
        if (error) {
          console.error('Error fetching purchased rotating themes:', error);
          return;
        }
        
        // Format as slots for display (similar to store structure)
        // Use theme_bank.rarity as source of truth (always up to date)
        const formattedThemes = (themesData || []).map((theme, index) => ({
          id: `purchased-${theme.id}`,
          slot_number: index + 1,
          theme_id: theme.id,
          theme: theme,
          slot_rarity: theme.rarity || 'common', // Use rarity from theme_bank (always current)
          neuros_cost: 0, // Already purchased
        }));
        
        setRotatingThemes(formattedThemes);
      } catch (error) {
        console.error('Error in fetchPurchasedRotatingThemes:', error);
      }
    };
    
    fetchPurchasedRotatingThemes();
  }, [user?.id, userProfile?.purchased_themes]);

  // Check if HealthKit is authorized - handle both string and object status
  // The status could be 'sharingAuthorized' or an object with status property
  const isHealthKitAuthorized = 
    authorizationStatus === 'sharingAuthorized' || 
    authorizationStatus?.status === 'sharingAuthorized' ||
    healthKitRequested; // If we've requested, assume it worked

  // HealthKit data state - fetched imperatively to avoid subscription bugs
  const [healthData, setHealthData] = useState({
    steps: null,      // Daily total
    calories: null,   // Daily total
    exercise: null,   // Daily total  
    heartRate: null,  // Most recent sample (heart rate doesn't sum)
  });

  // Fetch HealthKit data using imperative API (no buggy subscriptions)
  useEffect(() => {
    const fetchHealthData = async () => {
      if (Platform.OS !== 'ios' || !isHealthKitAuthorized) return;
      
      try {
        // Get today's date range (midnight to now)
        // We set todayStart to midnight (00:00:00) to get all data from the start of today
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0); // Set to midnight today
        
        // The queryStatisticsForQuantity function expects an options object with filter:
        // queryStatisticsForQuantity(identifier, statistics, options)
        // options = { filter: { date: { startDate, endDate } }, unit }
        // This ensures we only get today's data, not all-time totals
        const todayOptions = {
          filter: {
            date: {
              startDate: todayStart,  // Start date: midnight today
              endDate: now  // End date: current time
            }
          }
        };
        
        const [stepsResult, caloriesResult, exerciseResult, heartRate] = await Promise.all([
          // Steps: sum all step samples from today (midnight to now)
          // This uses 'cumulativeSum' to add up all step samples within the date range
          queryStatisticsForQuantity?.(
            'HKQuantityTypeIdentifierStepCount',
            ['cumulativeSum'],  // Sum all samples in the date range
            todayOptions  // Options object with date filter for today only
          ).catch(e => { console.log('Steps query error:', e); return null; }),
          
          // Calories: sum all active energy burned from today
          // Active energy = calories burned during exercise/activity (not resting)
          queryStatisticsForQuantity?.(
            'HKQuantityTypeIdentifierActiveEnergyBurned',
            ['cumulativeSum'],
            todayOptions  // Options object with date filter for today only
          ).catch(e => { console.log('Calories query error:', e); return null; }),
          
          // Exercise: sum all exercise time from today
          // This is Apple's "Exercise Time" which tracks minutes of activity
          queryStatisticsForQuantity?.(
            'HKQuantityTypeIdentifierAppleExerciseTime',
            ['cumulativeSum'],
            todayOptions  // Options object with date filter for today only
          ).catch(e => { console.log('Exercise query error:', e); return null; }),
          
          // Heart rate: just get most recent (doesn't make sense to sum)
          // Heart rate is a single measurement, not a cumulative value
          getMostRecentQuantitySample?.('HKQuantityTypeIdentifierHeartRate')
            .catch(e => { console.log('Heart rate error:', e); return null; }),
        ]);
        
        console.log('HealthKit daily totals:', { stepsResult, caloriesResult, exerciseResult, heartRate });
        
        setHealthData({
          // sumQuantity contains the daily total
          steps: stepsResult?.sumQuantity || null,
          calories: caloriesResult?.sumQuantity || null,
          exercise: exerciseResult?.sumQuantity || null,
          heartRate: heartRate,
        });
      } catch (error) {
        console.log('Error fetching HealthKit data:', error);
      }
    };

    fetchHealthData();
  }, [isHealthKitAuthorized, healthKitModalVisible]);

  // ==================================================
  // APPLE HEALTH WORKOUTS - Fetch recent workouts
  // ==================================================
  const fetchAppleWorkouts = async () => {
    if (Platform.OS !== 'ios' || !queryWorkoutSamples) return;
    
    setLoadingAppleWorkouts(true);
    try {
      // Fetch all workouts from Apple Health
      // The queryWorkoutSamples function requires an options object with a limit
      // Use -1 to fetch all workouts (no limit)
      console.log('Fetching Apple Health workouts...');
      
      // Get workouts from the last 90 days to keep the list manageable
      // You can adjust this date range or remove it to get all workouts
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      // The function requires a limit: -1, 0, or any non-positive number = fetch all
      // We also add an optional date filter to get workouts from the last 90 days
      const workoutOptions = {
        limit: -1, // -1 means fetch all workouts (no limit)
        filter: {
          date: {
            startDate: ninetyDaysAgo, // Start date: 90 days ago
            endDate: new Date() // End date: now
          }
        },
        ascending: false // Most recent first
      };
      
      let allWorkouts;
      try {
        allWorkouts = await queryWorkoutSamples(workoutOptions);
      } catch (e) {
        console.log('queryWorkoutSamples() failed with date filter, trying without date filter:', e.message);
        // If date filter fails, try without it (some versions might not support it)
        allWorkouts = await queryWorkoutSamples({
          limit: -1, // Fetch all workouts
          ascending: false
        });
      }
      
      console.log('Raw workouts from HealthKit:', allWorkouts?.length || 0);
      
      // Debug: log first workout to see its structure
      if (allWorkouts?.length > 0) {
        console.log('=== APPLE HEALTH WORKOUT STRUCTURE ===');
        console.log('Keys available:', Object.keys(allWorkouts[0]));
        console.log('totalEnergyBurned:', allWorkouts[0].totalEnergyBurned);
        console.log('totalDistance:', allWorkouts[0].totalDistance);
        console.log('metadata:', allWorkouts[0].metadata);
        console.log('Full first workout:', JSON.stringify(allWorkouts[0], null, 2));
      }
      
      // Convert HybridObject proxies to plain JS objects (proxies lose properties in React state)
      // Extract all data we need NOW before storing in state
      const workouts = (allWorkouts || []).map(w => ({
        // Core identifiers
        uuid: w.uuid,
        id: w.id,
        
        // Activity type
        workoutActivityType: w.workoutActivityType,
        
        // Dates
        startDate: w.startDate || w.start || w.startTime,
        endDate: w.endDate || w.end || w.endTime,
        
        // Duration (extract the number from the object)
        duration: w.duration?.quantity || w.duration,
        
        // Distance (extract from HybridObject - this is the key fix!)
        totalDistance: w.totalDistance ? {
          quantity: w.totalDistance.quantity || w.totalDistance.value || (typeof w.totalDistance === 'number' ? w.totalDistance : 0),
          unit: w.totalDistance.unit || 'm'
        } : null,
        
        // Calories
        totalEnergyBurned: w.totalEnergyBurned ? {
          quantity: w.totalEnergyBurned.quantity || w.totalEnergyBurned.value || (typeof w.totalEnergyBurned === 'number' ? w.totalEnergyBurned : 0),
          unit: w.totalEnergyBurned.unit || 'kcal'
        } : null,
        
        // Metadata (for heart rate, METs, etc.)
        metadata: w.metadata ? { ...w.metadata } : null,
        
        // Keep reference to original for GPS routes (if needed)
        _originalWorkout: w,
      }));
      
      console.log('Converted workouts to plain objects:', workouts.length);
      if (workouts.length > 0) {
        console.log('First workout distance after conversion:', workouts[0].totalDistance);
      }
      
      // Sort by date - most recent first
      const sortedWorkouts = workouts.sort((a, b) => {
        const getDate = (w) => {
          const dateStr = w.startDate || w.endDate;
          return dateStr ? new Date(dateStr).getTime() : 0;
        };
        return getDate(b) - getDate(a); // Descending (newest first)
      });
      
      console.log('Sorted workouts count:', sortedWorkouts.length);
      if (sortedWorkouts.length > 0) {
        console.log('Most recent workout:', {
          type: sortedWorkouts[0].workoutActivityType,
          date: sortedWorkouts[0].startDate,
          distance: sortedWorkouts[0].totalDistance
        });
      }
      
      setAppleWorkouts(sortedWorkouts);
      setVisibleWorkoutsCount(10); // Reset pagination when fetching new workouts
    } catch (error) {
      console.log('Error fetching Apple workouts:', error);
      setAppleWorkouts([]);
      setVisibleWorkoutsCount(10);
    } finally {
      setLoadingAppleWorkouts(false);
    }
  };

  // Fetch workouts when modal opens and user is authorized
  // Temporarily disabled for TestFlight
  // useEffect(() => {
  //   if (healthKitModalVisible && isHealthKitAuthorized) {
  //     fetchAppleWorkouts();
  //     fetchBetterUWorkouts(); // Also auto-load BetterU workouts for export
  //   }
  // }, [healthKitModalVisible, isHealthKitAuthorized]);

  // ==================================================
  // UPLOAD WORKOUT TO FEED - Runs go to runs table, others to workout_sessions
  // ==================================================
  const uploadAppleWorkoutToFeed = async (workout) => {
    if (!user?.id || !workout) return;
    
    setUploadingWorkout(workout.uuid || workout.id);
    try {
      // Determine workout type from Apple's workoutActivityType
      // HealthKit can return this as a number OR a string like 'HKWorkoutActivityTypeRunning'
      const rawActivityType = workout.workoutActivityType;
      
      // Convert string types to our internal format, or use number directly
      let activityType = rawActivityType;
      if (typeof rawActivityType === 'string') {
        // Map HKWorkoutActivityType strings to simple identifiers
        const typeMap = {
          'HKWorkoutActivityTypeRunning': 'running',
          'HKWorkoutActivityTypeWalking': 'walking',
          'HKWorkoutActivityTypeCycling': 'cycling',
          'HKWorkoutActivityTypeTraditionalStrengthTraining': 'strength',
          'HKWorkoutActivityTypeFunctionalStrengthTraining': 'strength',
          'HKWorkoutActivityTypeElliptical': 'elliptical',
          'HKWorkoutActivityTypeSwimming': 'swimming',
          'HKWorkoutActivityTypeRowing': 'rowing',
          'HKWorkoutActivityTypeHiking': 'hiking',
          'HKWorkoutActivityTypePilates': 'pilates',
          'HKWorkoutActivityTypeYoga': 'yoga',
        };
        activityType = typeMap[rawActivityType] || rawActivityType.toLowerCase().replace('hkworkoutactivitytype', '');
      }
      
      // Check if it's a cardio activity (running, walking, cycling, etc.)
      // These should go to the 'runs' table regardless of distance
      const cardioTypes = [37, 52, 13, 16, 24, 46, 57, 'running', 'walking', 'cycling', 'elliptical', 'swimming', 'rowing', 'hiking'];
      const isCardio = cardioTypes.includes(activityType);
      
      console.log('Uploading workout:', { 
        rawActivityType, 
        activityType, 
        isCardio, 
        distance: workout.totalDistance?.quantity,
        willGoToRunsTable: isCardio // Cardio always goes to runs table
      });
      
      // Extract workout data - duration from HealthKit
      // HealthKit duration is in SECONDS
      let durationSeconds = 0;
      
      // First try to calculate from start/end times (most reliable)
      const start = workout.startDate || workout.start || workout.startTime;
      const end = workout.endDate || workout.end || workout.endTime;
      if (start && end) {
        durationSeconds = (new Date(end) - new Date(start)) / 1000;
      }
      
      // Fallback to duration property if available
      if (durationSeconds <= 0 && typeof workout.duration === 'number') {
        durationSeconds = workout.duration;
      }
      
      console.log('Duration calculation:', {
        start,
        end,
        calculatedSeconds: durationSeconds,
        rawDuration: workout.duration,
        durationMinutes: Math.floor(durationSeconds / 60)
      });
      
      // Handle different property names from HealthKit
      const startRaw = workout.startDate || workout.start || workout.startTime;
      const endRaw = workout.endDate || workout.end || workout.endTime;
      const startTime = startRaw ? new Date(startRaw) : new Date();
      const endTime = endRaw ? new Date(endRaw) : new Date();
      
      // Extract calories - use pre-extracted data first, then fallback to queries
      let calories = 0;
      
      console.log('=== CALORIE DEBUG START ===');
      console.log('totalEnergyBurned (pre-extracted):', workout.totalEnergyBurned);
      
      // Use pre-extracted calories data (extracted when fetching workouts)
      if (workout.totalEnergyBurned?.quantity) {
        calories = workout.totalEnergyBurned.quantity;
        console.log('Calories from pre-extracted data:', calories);
      }
      
      // Fallback: Try alternative property names
      if (!calories && workout.energyBurned) {
        console.log('Trying energyBurned:', JSON.stringify(workout.energyBurned));
        calories = typeof workout.energyBurned === 'number' ? workout.energyBurned : 
                   parseFloat(workout.energyBurned?.quantity || workout.energyBurned?.value || workout.energyBurned) || 0;
      }
      if (!calories && workout.activeEnergyBurned) {
        console.log('Trying activeEnergyBurned:', JSON.stringify(workout.activeEnergyBurned));
        calories = typeof workout.activeEnergyBurned === 'number' ? workout.activeEnergyBurned : 
                   parseFloat(workout.activeEnergyBurned?.quantity || workout.activeEnergyBurned?.value || workout.activeEnergyBurned) || 0;
      }
      // Method 6: Check for totalEnergy (alternative naming)
      if (!calories && workout.totalEnergy) {
        console.log('Trying totalEnergy:', JSON.stringify(workout.totalEnergy));
        calories = typeof workout.totalEnergy === 'number' ? workout.totalEnergy :
                   parseFloat(workout.totalEnergy?.quantity || workout.totalEnergy?.value || workout.totalEnergy) || 0;
      }
      // Method 7: Check in statistics object (some HealthKit versions)
      if (!calories && workout.statistics) {
        console.log('Trying statistics:', JSON.stringify(workout.statistics));
        const stats = workout.statistics;
        const energyStats = stats.activeEnergyBurned || stats.totalEnergyBurned || stats.energyBurned;
        if (energyStats) {
          calories = parseFloat(energyStats.sumQuantity?.quantity || energyStats.sum?.quantity || energyStats.quantity || energyStats) || 0;
        }
      }
      // Method 8: Check in workoutActivities (iOS 16+)
      if (!calories && workout.workoutActivities && workout.workoutActivities.length > 0) {
        console.log('Trying workoutActivities:', JSON.stringify(workout.workoutActivities[0]));
        const activity = workout.workoutActivities[0];
        if (activity.statistics) {
          const energyStats = activity.statistics.activeEnergyBurned || activity.statistics.totalEnergyBurned;
          if (energyStats) {
            calories = parseFloat(energyStats.sumQuantity?.quantity || energyStats.quantity || energyStats) || 0;
          }
        }
      }
      
      // Method 9: Query REAL calories from Apple Health using statistics (same as distance)
      // This queries active energy burned during the specific workout time period
      if (!calories && queryStatisticsForQuantity) {
        try {
          console.log('Querying calories statistics for workout time range...');
          
          // The function expects an options object with filter.date structure
          // This gets calories burned only during the workout period, not all-time
          const workoutCalorieOptions = {
            filter: {
              date: {
                startDate: startTime,  // Start date: when workout began
                endDate: endTime  // End date: when workout ended
              }
            }
          };
          
          const calorieStats = await queryStatisticsForQuantity(
            'HKQuantityTypeIdentifierActiveEnergyBurned',
            ['cumulativeSum'],
            workoutCalorieOptions
          );
          
          console.log('Calorie stats result:', JSON.stringify(calorieStats));
          
          if (calorieStats?.sumQuantity?.quantity) {
            const rawCalories = calorieStats.sumQuantity.quantity;
            const unit = calorieStats.sumQuantity.unit;
            
            // Handle different units (usually kcal or Cal)
            calories = Math.round(rawCalories);
            console.log('Calories from Apple Health:', calories, 'kcal (raw:', rawCalories, unit + ')');
          }
        } catch (calorieError) {
          console.log('Calorie query failed:', calorieError.message);
        }
      }
      
      // Method 10: Fallback - Calculate from HKAverageMETs if query failed
      if (!calories && workout.metadata?.HKAverageMETs) {
        const mets = workout.metadata.HKAverageMETs.quantity || workout.metadata.HKAverageMETs;
        if (mets && typeof mets === 'number' && mets > 0) {
          const estimatedWeight = 70;
          const durationHours = durationSeconds / 3600;
          calories = Math.round(mets * estimatedWeight * durationHours);
          console.log('Calories from METs (fallback):', calories);
        }
      }
      
      console.log('Final calories:', calories);
      console.log('=== CALORIE DEBUG END ===')
      
      // Extract distance - data was pre-extracted when fetching workouts
      // (HybridObject proxies lose their properties in React state, so we extract early)
      let distance = 0;
      console.log('=== DISTANCE DEBUG ===');
      console.log('totalDistance (pre-extracted):', workout.totalDistance);
      
      // Use pre-extracted totalDistance data
      if (workout.totalDistance) {
        distance = workout.totalDistance.quantity || 0;
        console.log('Distance from pre-extracted data:', distance, 'meters');
      }
      
      // If still no distance, try querying Apple Health
      if ((!distance || distance === 0) && isCardio) {
        const isCycling = activityType === 13 || activityType === 'cycling';
        const distanceType = isCycling 
          ? 'HKQuantityTypeIdentifierDistanceCycling'
          : 'HKQuantityTypeIdentifierDistanceWalkingRunning';
        
        console.log('Querying distance for workout time range...');
        console.log('Using distance type:', distanceType, 'from', startTime.toISOString(), 'to', endTime.toISOString());
        
        // Method 1: Try queryStatisticsForQuantity first (faster)
        // This queries distance traveled during the specific workout time period
        if (queryStatisticsForQuantity) {
          try {
            // The function expects an options object with filter.date structure
            // This gets distance only during the workout period, not all-time
            const workoutDistanceOptions = {
              filter: {
                date: {
                  startDate: startTime,  // Start date: when workout began
                  endDate: endTime  // End date: when workout ended
                }
              }
            };
            
            const distanceStats = await queryStatisticsForQuantity(
              distanceType,
              ['cumulativeSum'],
              workoutDistanceOptions
            );
            
            console.log('Distance stats result:', JSON.stringify(distanceStats));
            
            if (distanceStats?.sumQuantity?.quantity) {
              const rawDistance = distanceStats.sumQuantity.quantity;
              const unit = distanceStats.sumQuantity.unit;
              
              if (unit === 'km') distance = rawDistance * 1000;
              else if (unit === 'mi') distance = rawDistance * 1609.34;
              else distance = rawDistance;
              
              console.log('Distance from statistics:', Math.round(distance), 'meters');
            }
          } catch (statsError) {
            console.log('Statistics query failed:', statsError.message);
          }
        }
        
        // Method 2: Try queryQuantitySamples if statistics didn't work
        if ((!distance || distance === 0) && queryQuantitySamples) {
          try {
            console.log('Trying queryQuantitySamples for distance...');
            const distanceSamples = await queryQuantitySamples(distanceType, {
              from: startTime,
              to: endTime,
            });
            
            console.log('Distance samples returned:', distanceSamples?.length || 0);
            
            if (distanceSamples && distanceSamples.length > 0) {
              // Sum all distance samples
              let totalDistance = 0;
              for (const sample of distanceSamples) {
                const qty = sample.quantity || sample.value || 0;
                const unit = sample.unit || 'm';
                
                if (unit === 'km') totalDistance += qty * 1000;
                else if (unit === 'mi') totalDistance += qty * 1609.34;
                else totalDistance += qty;
              }
              distance = totalDistance;
              console.log('Distance from samples:', Math.round(distance), 'meters from', distanceSamples.length, 'samples');
            }
          } catch (samplesError) {
            console.log('Samples query failed:', samplesError.message);
          }
        }
      }
      
      // Fallback: estimate distance if still no data
      if ((!distance || distance === 0) && isCardio) {
        const durationMinutes = durationSeconds / 60;
        const isCycling = activityType === 13 || activityType === 'cycling';
        const isWalking = activityType === 52 || activityType === 'walking';
        const metersPerMin = isCycling ? 333 : isWalking ? 83 : 167;
        distance = Math.round(durationMinutes * metersPerMin);
        console.log('Estimated distance (fallback):', distance, 'm');
      }
      
      console.log('Final distance (meters):', distance);
      console.log('=== END DISTANCE DEBUG ===');
      
      // Extract heart rate if available (HealthKit may store it in metadata)
      let avgHeartRate = null;
      if (workout.metadata) {
        avgHeartRate = workout.metadata.HKAverageHeartRate || 
                      workout.metadata['HKAverageHeartRate'] ||
                      workout.metadata.averageHeartRate ||
                      null;
      }
      if (!avgHeartRate && workout.averageHeartRate) {
        avgHeartRate = workout.averageHeartRate;
      }
      if (!avgHeartRate && workout.heartRate?.average) {
        avgHeartRate = workout.heartRate.average;
      }
      
      // If no calories from workout object, try querying active energy samples for the workout time range
      console.log('Checking energy query conditions:', {
        caloriesStillZero: !calories || calories === 0,
        hasQueryQuantitySamples: !!queryQuantitySamples,
        hasActiveEnergyBurnedId: !!HKQuantityTypeIdentifier?.activeEnergyBurned,
        activeEnergyBurnedValue: HKQuantityTypeIdentifier?.activeEnergyBurned
      });
      
      if ((!calories || calories === 0) && queryQuantitySamples) {
        try {
          console.log('Querying active energy samples for workout time range...');
          console.log('Time range:', { from: startTime.toISOString(), to: endTime.toISOString() });
          
          // Use full HKQuantityTypeIdentifier string for the library
          const energyType = 'HKQuantityTypeIdentifierActiveEnergyBurned';
          console.log('Using energy type:', energyType);
          
          const energySamples = await queryQuantitySamples(
            energyType,
            {
              from: startTime,
              to: endTime,
              unit: 'kcal',
            }
          );
          console.log('Energy samples returned:', energySamples?.length || 0);
          if (energySamples && energySamples.length > 0) {
            console.log('First energy sample:', JSON.stringify(energySamples[0]));
            // Sum all energy samples in the workout time range
            calories = energySamples.reduce((sum, sample) => {
              const val = sample.quantity || sample.value || 0;
              return sum + val;
            }, 0);
            console.log('Calories from energy samples:', Math.round(calories));
            calories = Math.round(calories);
          }
        } catch (energyError) {
          console.log('Could not query energy samples:', energyError.message);
          console.log('Energy query error details:', energyError);
        }
      }
      
      // LAST RESORT: If still no calories, estimate based on activity and duration
      // Running: ~10 cal/min, Walking: ~5 cal/min, Cycling: ~8 cal/min
      if (!calories || calories === 0) {
        const durationMinutes = durationSeconds / 60;
        const calPerMin = activityType === 'running' || activityType === 37 ? 10 :
                         activityType === 'walking' || activityType === 52 ? 5 :
                         activityType === 'cycling' || activityType === 13 ? 8 : 7;
        calories = Math.round(durationMinutes * calPerMin);
        console.log('ESTIMATED calories (no Apple Health data):', calories, 'based on', durationMinutes, 'minutes');
      }
      
      // Debug: Log EVERYTHING from the workout object
      console.log('=== FULL HEALTHKIT WORKOUT DUMP ===');
      console.log('All keys:', Object.keys(workout));
      // Log every single property
      for (const key of Object.keys(workout)) {
        const val = workout[key];
        if (typeof val === 'object' && val !== null) {
          console.log(`${key}:`, JSON.stringify(val));
        } else {
          console.log(`${key}:`, val);
        }
      }
      console.log('=== END DUMP ===');
      console.log('Final extracted values:', { 
        calories, 
        distance, 
        avgHeartRate,
        durationMinutes: durationSeconds / 60
      });
      
      // Get workout name based on activity type
      const workoutName = getWorkoutNameFromType(activityType);
      
      // Get the Apple Health UUID to prevent duplicate imports
      const appleUuid = workout.uuid || workout.id || `${startTime.getTime()}_${activityType}`;
      
      if (isCardio) {
        // ========================================
        // INSERT INTO RUNS TABLE (for all cardio activities)
        // Running, walking, cycling, etc. go here regardless of distance
        // ========================================
        const pace = durationSeconds > 0 && distance > 0 
          ? (durationSeconds / 60) / (distance / 1000) // min per km
          : 0;
        
        console.log('=== PACE CALCULATION ===');
        console.log('Duration (seconds):', durationSeconds);
        console.log('Distance (meters):', distance);
        console.log('Calculated pace (min/km):', pace.toFixed(2));
        console.log('Pace formatted:', Math.floor(pace) + ':' + String(Math.round((pace % 1) * 60)).padStart(2, '0'));
        console.log('=== END PACE ===');
        
        // Map activity type to runs table enum: 'run', 'walk', or 'bike'
        let runsActivityType = 'run'; // default
        if (activityType === 37 || activityType === 'running') runsActivityType = 'run';
        else if (activityType === 52 || activityType === 'walking' || activityType === 'hiking') runsActivityType = 'walk';
        else if (activityType === 13 || activityType === 'cycling') runsActivityType = 'bike';
        
        // Try to get GPS route from Apple Health (with timeout)
        // Use _originalWorkout which has the actual proxy methods
        let gpsPath = [];
        const originalWorkout = workout._originalWorkout;
        if (originalWorkout?.getWorkoutRoutes) {
          try {
            console.log('Attempting to fetch GPS route from Apple Health...');
            const routePromise = originalWorkout.getWorkoutRoutes();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('GPS timeout')), 3000)
            );
            
            const routes = await Promise.race([routePromise, timeoutPromise]);
            console.log('GPS routes returned:', routes?.length || 0);
            
            if (routes && routes.length > 0 && routes[0].locations) {
              // Convert to our path format [{ latitude, longitude }]
              gpsPath = routes[0].locations.map(loc => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
              }));
              console.log('GPS path extracted:', gpsPath.length, 'points');
            }
          } catch (gpsError) {
            console.log('GPS route fetch failed (using empty path):', gpsError.message);
          }
        }
        
        const { data: runData, error } = await supabase.from('runs').insert({
          user_id: user.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_seconds: durationSeconds,
          distance_meters: distance || 0, // May be 0 for treadmill runs
          average_pace_minutes_per_km: pace,
          path: gpsPath, // GPS path from HealthKit if available
          status: 'completed',
          activity_type: runsActivityType,
          calories_burned: Math.round(calories) || 0,
          average_heart_rate: avgHeartRate ? Math.round(avgHeartRate) : null,
          notes: gpsPath.length > 0 ? 'Imported from Apple Health (with GPS)' : 'Imported from Apple Health',
        }).select('id').single();
        
        if (error) throw error;
        
        // Track this as an Apple Health import (so we don't re-export it)
        if (runData?.id) {
          try {
            await supabase.from('apple_health_imports').insert({
              user_id: user.id,
              target_table: 'runs',
              target_id: runData.id,
              apple_health_uuid: appleUuid,
              workout_type: runsActivityType,
              original_start_date: startTime.toISOString(),
            });
          } catch (e) {
            console.log('Could not track import:', e);
          }
        }
        
        Alert.alert('Success! 🏃', `${workoutName} added to your feed!`);
      } else {
        // ========================================
        // INSERT INTO USER_WORKOUT_LOGS TABLE (for strength training, yoga, etc.)
        // Note: This table uses 'profile_id' not 'user_id'
        // Duration is stored in SECONDS
        // ========================================
        const durationSeconds_safe = Math.max(0, Math.round(durationSeconds || 0));
        
        console.log('Inserting workout log:', {
          name: workoutName,
          durationSeconds: durationSeconds_safe,
          durationMinutes: Math.floor(durationSeconds_safe / 60),
          calories: Math.round(calories) || 0,
        });
        
        const { data: workoutData, error } = await supabase.from('user_workout_logs').insert({
          profile_id: user.id, // Table uses profile_id, not user_id
          user_id: user.id, // Some queries might use user_id
          workout_name: workoutName, // Clean name without "(Apple Health)"
          exercises: [], // No exercise data from HealthKit
          completed_sets: 0,
          exercise_count: 0,
          exercise_names: [],
          total_weight: 0,
          duration: durationSeconds_safe, // Duration in SECONDS
          calories_burned: Math.round(calories) || 0,
          completed_at: endTime.toISOString(),
        }).select('id').single();
        
        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }
        
        // Track this as an Apple Health import (so we don't re-export it)
        if (workoutData?.id) {
          try {
            await supabase.from('apple_health_imports').insert({
              user_id: user.id,
              target_table: 'user_workout_logs',
              target_id: workoutData.id,
              apple_health_uuid: appleUuid,
              workout_type: workoutName.toLowerCase(),
              original_start_date: startTime.toISOString(),
            });
          } catch (e) {
            console.log('Could not track import:', e);
          }
        }
        
        Alert.alert('Success! 💪', `${workoutName} added to your feed!`);
      }
      
      // Remove from local list after successful upload
      setAppleWorkouts(prev => prev.filter(w => (w.uuid || w.id) !== (workout.uuid || workout.id)));
      
    } catch (error) {
      console.error('Error uploading workout:', error);
      // Show more helpful error message
      const errorMessage = error?.message || error?.details || 'Unknown error';
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        Alert.alert('Already Imported', 'This workout has already been added to your feed.');
      } else {
        Alert.alert('Error', `Failed to upload: ${errorMessage}`);
      }
    } finally {
      setUploadingWorkout(null);
    }
  };

  // Helper: Convert Apple workout activity type to readable name
  const getWorkoutNameFromType = (activityType) => {
    const types = {
      37: 'Running',
      52: 'Walking', 
      13: 'Cycling',
      50: 'Strength Training',
      20: 'Functional Training',
      16: 'Elliptical',
      24: 'Swimming',
      46: 'Rowing',
      57: 'Hiking',
      35: 'Pilates',
      63: 'Yoga',
      77: 'HIIT',
      62: 'Core Training',
      58: 'Dance',
    };
    return types[activityType] || 'Workout';
  };

  // ==================================================
  // FETCH BETTERU WORKOUTS (for exporting to Apple Health)
  // Includes both strength workouts AND runs/walks/bikes
  // Filters out workouts that were imported FROM Apple Health
  // ==================================================
  const fetchBetterUWorkouts = async () => {
    if (!user?.id) return;
    
    setLoadingBetterUWorkouts(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Fetch strength workouts
      const { data: strengthWorkouts, error: strengthError } = await supabase
        .from('user_workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', thirtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false })
        .limit(20);
      
      // Fetch runs/walks/bikes
      const { data: cardioWorkouts, error: cardioError } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', thirtyDaysAgo.toISOString())
        .order('start_time', { ascending: false })
        .limit(20);
      
      if (strengthError) console.log('Strength fetch error:', strengthError);
      if (cardioError) console.log('Cardio fetch error:', cardioError);
      
      // Get list of IDs that were imported from Apple Health
      const { data: imports } = await supabase
        .from('apple_health_imports')
        .select('target_id, target_table')
        .eq('user_id', user.id);
      
      // Create Sets for fast lookup
      const importedStrengthIds = new Set((imports || []).filter(i => i.target_table === 'user_workout_logs').map(i => i.target_id));
      const importedRunIds = new Set((imports || []).filter(i => i.target_table === 'runs').map(i => i.target_id));
      
      // Filter and mark workout types
      const filteredStrength = (strengthWorkouts || [])
        .filter(w => !importedStrengthIds.has(w.id))
        .map(w => ({ ...w, _exportType: 'strength' }));
      
      const filteredCardio = (cardioWorkouts || [])
        .filter(w => !importedRunIds.has(w.id))
        .map(w => ({ 
          ...w, 
          _exportType: 'cardio',
          // Normalize field names for display
          workout_name: w.activity_type === 'bike' ? 'Cycling' : w.activity_type === 'walk' ? 'Walking' : 'Running',
          completed_at: w.end_time,
          calories_burned: w.calories_burned || 0,
        }));
      
      // Combine and sort by date
      const allWorkouts = [...filteredStrength, ...filteredCardio].sort((a, b) => {
        const dateA = new Date(a.completed_at || a.end_time);
        const dateB = new Date(b.completed_at || b.end_time);
        return dateB - dateA;
      });
      
      console.log('BetterU workouts for export:', allWorkouts.length, 
        '(strength:', filteredStrength.length, ', cardio:', filteredCardio.length, ')');
      setBetterUWorkouts(allWorkouts);
    } catch (error) {
      console.log('Error fetching BetterU workouts:', error);
      setBetterUWorkouts([]);
    } finally {
      setLoadingBetterUWorkouts(false);
    }
  };

  // ==================================================
  // EXPORT WORKOUT TO APPLE HEALTH
  // Handles both strength workouts and cardio (runs/walks/bikes)
  // ==================================================
  const exportWorkoutToAppleHealth = async (workout) => {
    if (!workout || !saveWorkoutSample) return;
    
    setExportingWorkout(workout.id);
    try {
      const isCardio = workout._exportType === 'cardio';
      
      // Calculate start and end times based on workout type
      let startTime, endTime, durationSeconds;
      
      if (isCardio) {
        // Cardio uses start_time and end_time
        startTime = new Date(workout.start_time);
        endTime = new Date(workout.end_time);
        durationSeconds = workout.duration_seconds || Math.round((endTime - startTime) / 1000);
      } else {
        // Strength uses completed_at and duration
        endTime = new Date(workout.completed_at);
        durationSeconds = workout.duration || 1800;
        startTime = new Date(endTime.getTime() - (durationSeconds * 1000));
      }
      
      // Determine workout activity type
      // 37 = Running, 52 = Walking, 13 = Cycling, 50 = Strength Training
      let workoutActivityType = 50; // Default to strength
      if (isCardio) {
        if (workout.activity_type === 'run') workoutActivityType = 37;
        else if (workout.activity_type === 'walk') workoutActivityType = 52;
        else if (workout.activity_type === 'bike') workoutActivityType = 13;
      }
      
      const durationMinutes = durationSeconds / 60;
      const caloriesBurned = workout.calories_burned || Math.round(durationMinutes * 5);
      const distanceMeters = workout.distance_meters || 0;
      
      console.log('Exporting workout to Apple Health:', {
        type: isCardio ? 'cardio' : 'strength',
        activityType: workoutActivityType,
        name: workout.workout_name,
        duration: durationMinutes + ' min',
        calories: caloriesBurned,
        distance: distanceMeters + ' m',
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      });
      
      // Build totals object
      const totals = {
        energyBurned: caloriesBurned,
      };
      
      // Add distance for cardio workouts
      if (isCardio && distanceMeters > 0) {
        totals.distance = distanceMeters; // meters
      }
      
      // Build quantity samples
      const quantities = [];
      
      // Add energy burned sample
      if (caloriesBurned > 0) {
        quantities.push({
          startDate: startTime,
          endDate: endTime,
          quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned',
          quantity: caloriesBurned,
          unit: 'kcal',
          metadata: {},
        });
      }
      
      // Add distance sample for cardio
      if (isCardio && distanceMeters > 0) {
        const distanceType = workout.activity_type === 'bike' 
          ? 'HKQuantityTypeIdentifierDistanceCycling'
          : 'HKQuantityTypeIdentifierDistanceWalkingRunning';
        
        quantities.push({
          startDate: startTime,
          endDate: endTime,
          quantityType: distanceType,
          quantity: distanceMeters,
          unit: 'm',
          metadata: {},
        });
      }
      
      console.log('Calling saveWorkoutSample with:', {
        activityType: workoutActivityType,
        quantities: quantities.length,
        totals,
      });
      
      await saveWorkoutSample(
        workoutActivityType,
        quantities,
        startTime,
        endTime,
        totals,
        {
          HKMetadataKeyWorkoutBrandName: 'BetterU',
          HKMetadataKeyExternalUUID: workout.id,
        }
      );
      
      // Build success message
      let successMsg = `"${workout.workout_name}" exported to Apple Health!`;
      if (isCardio && distanceMeters > 0) {
        const distanceKm = (distanceMeters / 1000).toFixed(2);
        successMsg += `\n${distanceKm} km • ${caloriesBurned} cal`;
      } else {
        successMsg += `\n${caloriesBurned} calories burned`;
      }
      
      Alert.alert('Success! 💪', successMsg);
      
      // Remove from list after successful export
      setBetterUWorkouts(prev => prev.filter(w => w.id !== workout.id));
    } catch (error) {
      console.error('Error exporting to Apple Health:', error);
      console.error('Error details:', JSON.stringify(error));
      Alert.alert('Error', 'Failed to export workout. Make sure you granted Apple Health write permissions.');
    } finally {
      setExportingWorkout(null);
    }
  };

  // Helper: Format duration for display
  // Handles cases where duration might be undefined, NaN, or calculated from dates
  const formatWorkoutDuration = (seconds, startDate, endDate) => {
    // Try to get duration from seconds, or calculate from dates
    let durationSecs = seconds;
    if (!durationSecs || isNaN(durationSecs)) {
      if (startDate && endDate) {
        durationSecs = (new Date(endDate) - new Date(startDate)) / 1000;
      }
    }
    
    if (!durationSecs || isNaN(durationSecs) || durationSecs <= 0) return '—';
    
    const mins = Math.floor(durationSecs / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };


  const GOALS = [
    { id: 'athleticism', label: 'Athleticism', description: 'Enhance overall athletic performance' },
    { id: 'strength', label: 'Strength', description: 'Build raw power and strength' },
    { id: 'muscle_growth', label: 'Muscle Growth', description: 'Focus on muscle hypertrophy' },
    { id: 'wellness', label: 'Wellness', description: 'Improve overall health and fitness' },
  ];


  const GENDERS = [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
    { id: 'non_binary', label: 'Non-Binary' },
    { id: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];


  const TRAINING_LEVELS = [
    { id: 'beginner', label: 'Beginner', description: 'New to fitness or returning after a long break' },
    { id: 'intermediate', label: 'Intermediate', description: 'Consistent training for 6+ months' },
    { id: 'advanced', label: 'Advanced', description: 'Experienced with 2+ years of training' },
  ];


  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Fetch theme costs from database
  useEffect(() => {
    const fetchThemeCosts = async () => {
      try {
        const { data, error } = await supabase
          .from('profile_theme_costs')
          .select('theme_key, neuros_cost')
          .eq('is_active', true);
        
        if (error) {
          console.error('Error fetching theme costs:', error);
          // Use default costs if fetch fails
          return;
        }
        
        // Convert array to object for easy lookup
        const costsMap = {};
        data?.forEach(item => {
          costsMap[item.theme_key] = item.neuros_cost;
        });
        
        setThemeCosts(costsMap);
      } catch (error) {
        console.error('Error fetching theme costs:', error);
      } finally {
        setThemeCostsLoading(false);
      }
    };
    
    fetchThemeCosts();
  }, []);

  // Fetch active custom background for display
  useEffect(() => {
    const fetchActiveBackground = async () => {
      if (!user?.id) return;
      
      try {
        // Fetch active background
        const { data: backgrounds, error: bgError } = await supabase
          .from('custom_backgrounds')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);
        
        if (bgError) {
          console.error('Error fetching custom background:', bgError);
          return;
        }
        
        setActiveCustomBackground(backgrounds?.[0] || null);
      } catch (error) {
        console.error('Error fetching custom background:', error);
      }
    };
    
    fetchActiveBackground();
  }, [user?.id, userProfile?.active_custom_background_id]);


  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();


      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found, redirect to onboarding
          router.replace('/(auth)/onboarding/welcome');
          return;
        }
        throw error;
      }


      updateProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };


  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
  };


  const getBMICategory = (bmi) => {
    if (!bmi) return null;
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };


  const formatValue = (value, type) => {
    if (!value) return '--';
    if (type === 'weight') {
      return `${convertWeight(value)} ${getWeightUnit()}`;
    }
    if (type === 'height') {
      return `${convertHeight(value)} ${getHeightUnit()}`;
    }
    return value;
  };

  // Helper to capitalize first letter of each word
  const capitalizeWords = (str) => {
    if (!str) return 'Not set';
    return str
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };


  const handleEdit = (field, value) => {
    setEditingField(field);
    if (field === 'weight' && value) {
      setEditValue(convertWeight(value));
    } else if (field === 'height' && value) {
      setEditValue(convertHeight(value));
    } else {
      setEditValue(value?.toString() || '');
    }
  };


  const handleOptionSelect = (value) => {
    setEditValue(value);
  };


  const handleSave = async () => {
    if (!editingField) return;


    try {
      let valueToSave = editValue;
     
      if (editingField === 'weight') {
        valueToSave = convertWeightBack(parseFloat(editValue));
      } else if (editingField === 'height') {
        valueToSave = convertHeightBack(parseFloat(editValue));
      } else if (editingField === 'fitness_goal') {
        // Ensure we're saving a single value, not an array
        valueToSave = editValue;
      } else if (editingField === 'training_level') {
        // Ensure training level is saved as a single value
        valueToSave = editValue;
      }


      const updates = { [editingField]: valueToSave };
      const { error } = await updateProfile(updates);
     
      if (error) {
        Alert.alert('Error', 'Failed to update profile');
        return;
      }


      setEditingField(null);
      setEditValue('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };


  // Referral program - share your unique code and earn rewards!
  const handleReferral = async () => {
    try {
      // Generate a unique referral code based on username
      const referralCode = (userProfile?.username || user?.id?.slice(0, 8) || 'BETTERU').toUpperCase();
      
      // Create a simple shareable message with the referral code and App Store link
      // Format it nicely so the link doesn't look like a blob of text
      const shareMessage = `Use my referral code to get started on BetterU!\n\n🎫 Code: ${referralCode}\n\n📱 Download here:\nhttps://apps.apple.com/us/app/betteru-social-fitness/id6744857930`;
      
      // Share with just the message (URL is already included in the message)
      try {
        const result = await Share.share({
          message: shareMessage,
          title: `BetterU Referral Code: ${referralCode}`, // Title for Android share sheet
        });
        
        // Check if sharing was successful
        if (result.action === Share.sharedAction) {
          console.log('Referral code shared successfully');
        } else if (result.action === Share.dismissedAction) {
          console.log('Share dismissed');
        }
      } catch (shareError) {
        // Fallback: try with just message if platform-specific sharing fails
        console.warn('Primary share method failed, trying fallback:', shareError);
        await Share.share({
          message: shareMessage,
        });
      }
    } catch (error) {
      console.error('Error sharing referral:', error);
      Alert.alert('Error', 'Failed to share referral code. Please try again.');
    }
  };
  
  // Show referral stats and rewards
  const showReferralInfo = async () => {
    const referralCode = (userProfile?.username || 'BETTERU').toUpperCase();
    
    // Fetch referral count
    let referralCount = 0;
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .eq('referrer_id', user?.id)
        .eq('status', 'completed');
      
      if (!error && data) {
        referralCount = data.length;
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
    
    const neurosBalance = userProfile?.neuros_balance || 0;
    
    Alert.alert(
      '✨ Refer Friends, Earn Neuros!',
      `Your referral code: ${referralCode}\n\n` +
      `Current Neuros: ${neurosBalance} ⭐\n` +
      `Completed Referrals: ${referralCount}\n\n` +
      `🎁 How It Works:\n` +
      `• Share your code with friends\n` +
      `• When they sign up: you both get +50 Neuros immediately!\n` +
      `• Spend Neuros on exclusive profile themes!\n\n` +
      `Share your code and unlock amazing themes!`,
      [
        { text: 'Share Code', onPress: handleReferral },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  // Get theme cost from database (falls back to 0 if not found)
  const getThemeCost = (themeKey) => {
    return themeCosts[themeKey] ?? 0; // Default to 0 (free) if cost not found
  };

  // Check if theme is unlocked (free or purchased)
  const isThemeUnlocked = (themeKey) => {
    const theme = PROFILE_THEMES[themeKey];
    if (!theme) return false;
    
    // Get cost from database
    const cost = getThemeCost(themeKey);
    
    // Free themes are always unlocked
    if (cost === 0) return true;
    
    // Check if user has purchased this theme
    const purchasedThemes = userProfile?.purchased_themes || [];
    return purchasedThemes.includes(themeKey);
  };

  // Handle rotating theme selection
  const handleRotatingThemeSelect = async (themeKey) => {
    try {
      // Check if owned
      const purchasedThemes = userProfile?.purchased_themes || [];
      if (!purchasedThemes.includes(themeKey)) {
        Alert.alert(
          'Theme Not Owned',
          'This theme is not in your collection. Visit the store to purchase it!',
          [
            { text: 'OK' },
            { 
              text: 'Go to Store', 
              onPress: () => {
                setShowThemeModal(false);
                setTimeout(() => router.push('/store'), 300);
              }
            }
          ]
        );
        return;
      }
      
      // Deactivate all custom backgrounds
      await supabase
        .from('custom_backgrounds')
        .update({ is_active: false })
        .eq('user_id', user?.id);
      
      // Set theme
      const { error } = await supabase
        .from('profiles')
        .update({ 
          profile_theme: themeKey,
          active_custom_background_id: null
        })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      if (updateProfile) {
        updateProfile({ 
          profile_theme: themeKey,
          active_custom_background_id: null
        });
      }
      
      setSelectedTheme(themeKey);
      setActiveCustomBackground(null);
      setShowThemeModal(false);
    } catch (error) {
      console.error('Error saving rotating theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    }
  };

  // Handle profile theme selection (only for owned themes)
  const handleThemeSelect = async (themeKey) => {
    try {
      const theme = PROFILE_THEMES[themeKey];
      if (!theme) return;

      const isUnlocked = isThemeUnlocked(themeKey);

      // Only allow selection of unlocked themes
      if (!isUnlocked) {
        Alert.alert(
          'Theme Not Owned',
          'This theme is not in your collection. Visit the store to purchase more themes!',
          [
            { text: 'OK' },
            { 
              text: 'Go to Store', 
              onPress: () => {
                setShowThemeModal(false);
                setTimeout(() => router.push('/store'), 300);
              }
            }
          ]
        );
        return;
      }

      // Theme is unlocked, just set it as active
      setSelectedTheme(themeKey);
      
      // Deactivate all custom backgrounds for this user
      await supabase
        .from('custom_backgrounds')
        .update({ is_active: false })
        .eq('user_id', user?.id);
      
      // Save to database - clear custom background when theme is selected
      const { error } = await supabase
        .from('profiles')
        .update({ 
          profile_theme: themeKey,
          active_custom_background_id: null // Clear custom background when theme is selected
        })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      // Update local profile
      if (updateProfile) {
        updateProfile({ 
          profile_theme: themeKey,
          active_custom_background_id: null // Clear custom background in local state
        });
      }
      
      // Clear active custom background from local state
      setActiveCustomBackground(null);
      
      setShowThemeModal(false);
    } catch (error) {
      console.error('Error saving theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    }
  };

  // Get current theme colors - handle both classic and rotating themes
  // If selectedTheme is not in PROFILE_THEMES, it's a rotating theme
  const currentTheme = PROFILE_THEMES[selectedTheme] || currentRotatingTheme || PROFILE_THEMES.default;
  
  // Fetch rotating theme details when selectedTheme changes
  useEffect(() => {
    const fetchRotatingThemeDetails = async () => {
      // Check if selectedTheme is a rotating theme (not in PROFILE_THEMES)
      if (!selectedTheme || PROFILE_THEMES[selectedTheme]) {
        setCurrentRotatingTheme(null);
        return;
      }
      
      try {
        // Fetch theme from theme_bank by theme_key
        const { data: themeData, error } = await supabase
          .from('theme_bank')
          .select('name, theme_key, image_url, background_color, gradient_colors')
          .eq('theme_key', selectedTheme)
          .eq('is_active', true)
          .single();
        
        if (error || !themeData) {
          console.error('Error fetching rotating theme:', error);
          setCurrentRotatingTheme(null);
          return;
        }
        
        // Format to match PROFILE_THEMES structure
        // Normalize image_url to convert Google Drive links to direct image URLs
        setCurrentRotatingTheme({
          name: themeData.name,
          backgroundColor: themeData.background_color || '#000000',
          gradientColors: themeData.gradient_colors || [themeData.background_color || '#000000', '#0a0a0a'],
          image_url: themeData.image_url ? normalizeImageUrl(themeData.image_url) : null, // Normalize Google Drive URLs to direct image URLs
        });
      } catch (error) {
        console.error('Error in fetchRotatingThemeDetails:', error);
        setCurrentRotatingTheme(null);
      }
    };
    
    fetchRotatingThemeDetails();
  }, [selectedTheme]);


  const validateInput = (field, value) => {
    if (field === 'full_name') {
      return value && value.trim().length > 0;
    }
    const numValue = parseFloat(value);
    switch (field) {
      case 'age':
        return !isNaN(numValue) && numValue >= 13 && numValue <= 120;
      case 'weight':
        if (useImperial) {
          return !isNaN(numValue) && numValue >= 66 && numValue <= 1100; // lbs
        }
        return !isNaN(numValue) && numValue >= 30 && numValue <= 500; // kg
      case 'height':
        if (useImperial) {
          return !isNaN(numValue) && numValue >= 39 && numValue <= 98; // inches
        }
        return !isNaN(numValue) && numValue >= 100 && numValue <= 250; // cm
      default:
        return true;
    }
  };

  const fetchSpotifyTopTracks = useCallback(async () => {
    if (!user) {
      setSpotifyTopTracks([]);
      return;
    }

    setSpotifyLoading(true);
    try {
      const { data, error } = await supabase
        .from('workout_spotify_tracks')
        .select('track_name, artist_name, track_id, album_image_url')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(75);

      if (error) {
        throw error;
      }

      const frequencyMap = new Map();
      (data || []).forEach((track) => {
        if (!track.track_name) {
          return;
        }
        const key = track.track_id ?? `${track.track_name}|||${track.artist_name ?? ''}`;
        const current = frequencyMap.get(key) ?? {
          track_name: track.track_name,
          artist_name: track.artist_name ?? '',
          track_id: track.track_id ?? null,
          album_image_url: track.album_image_url ?? null,
          play_count: 0,
        };
        current.play_count += 1;
        if (!current.album_image_url && track.album_image_url) {
          current.album_image_url = track.album_image_url;
        }
        if (!current.track_id && track.track_id) {
          current.track_id = track.track_id;
        }
        frequencyMap.set(key, current);
      });

      const sorted = Array.from(frequencyMap.values())
        .sort((a, b) => b.play_count - a.play_count)
        .slice(0, 3);

      setSpotifyTopTracks(sorted);
    } catch (error) {
      console.error('Failed to fetch Spotify top tracks:', error);
      setSpotifyTopTracks([]);
    } finally {
      setSpotifyLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSpotifyTopTracks();
  }, [fetchSpotifyTopTracks]);

  // Fetch displayed badge function (extracted for reuse)
  const fetchDisplayedBadge = async () => {
    if (!userProfile?.id) return;
      
      try {
        // First check if user has a displayed badge set
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('displayed_badge_id')
          .eq('id', userProfile.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          return;
        }
        
        // If no displayed badge is set, check if user has any badges and set the first one
        if (!profileData?.displayed_badge_id) {
          // Check if user has any badges
          const { data: userBadges } = await supabase
            .from('user_badges')
            .select('badge_id, earned_at')
            .eq('user_id', userProfile.id)
            .order('earned_at', { ascending: false })
            .limit(1)
            .single();
          
          if (userBadges) {
            // Auto-set the first badge as displayed
            await supabase.rpc('set_displayed_badge', {
              p_user_id: userProfile.id,
              p_badge_id: userBadges.badge_id,
            });
            // Fetch the badge definition
            const { data: badgeDef } = await supabase
              .from('badge_definitions')
              .select('*')
              .eq('id', userBadges.badge_id)
              .single();
            
            if (badgeDef) {
              // Normalize badge data - badge_definitions uses 'name', but get_user_badges uses 'badge_name'
              setDisplayedBadge({
                ...badgeDef,
                name: badgeDef.name, // Ensure name is set
                badge_name: badgeDef.name, // Also set badge_name for consistency
                earned_at: userBadges.earned_at,
                is_displayed: true,
              });
            }
            return;
          }
        }
        
        // Fetch displayed badge details
        const { data: badgeDefData, error: badgeError } = await supabase
          .from('badge_definitions')
          .select('*')
          .eq('id', profileData.displayed_badge_id)
          .single();
        
        if (badgeError || !badgeDefData) {
          return;
        }
        
        // Get earned_at from user_badges
        const { data: badgeData } = await supabase
          .from('user_badges')
          .select('earned_at, is_displayed')
          .eq('user_id', userProfile.id)
          .eq('badge_id', profileData.displayed_badge_id)
          .single();
        
        // Normalize badge data - badge_definitions uses 'name', but get_user_badges uses 'badge_name'
        setDisplayedBadge({
          ...badgeDefData,
          name: badgeDefData.name, // Ensure name is set
          badge_name: badgeDefData.name, // Also set badge_name for consistency
          earned_at: badgeData?.earned_at || null,
          is_displayed: badgeData?.is_displayed || false,
        });
      } catch (error) {
        console.error('Error fetching displayed badge:', error);
      }
    };

  // Fetch displayed badge when profile loads
  useEffect(() => {
    if (userProfile?.id) {
      fetchDisplayedBadge();
    }
  }, [userProfile?.id]);

  const spotifyTopTracksHeading = useMemo(
    () => (spotifyTopTracks.length ? 'Your top 3 songs' : null),
    [spotifyTopTracks.length]
  );

  const handleSpotifyConnected = useCallback(() => {
    setSpotifyStatusMessage('Spotify connected! ✅');
    fetchSpotifyTopTracks();
  }, [fetchSpotifyTopTracks]);

  const openSpotifyTrack = useCallback(async (track) => {
    const trackId = typeof track?.track_id === 'string' ? track.track_id.trim() : '';
    if (!trackId) {
      Alert.alert('Track unavailable', 'We could not find a Spotify link for this song.');
      return;
    }

    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
    try {
      const supported = await Linking.canOpenURL(spotifyUrl);
      if (!supported) {
        Alert.alert('Spotify unavailable', 'Spotify could not be opened on this device.');
        return;
      }
      await Linking.openURL(spotifyUrl);
    } catch (error) {
      console.error('Failed to open Spotify track link from profile:', error);
      Alert.alert('Error', 'Something went wrong while opening Spotify.');
    }
  }, []);


  const getDisplayValue = (field, value) => {
    if (!value) return '--';
    switch (field) {
      case 'weight':
        return useImperial
          ? `${(value * 2.20462).toFixed(1)} lbs`
          : `${value} kg`;
      case 'height':
        return useImperial
          ? `${(value / 2.54).toFixed(1)} in`
          : `${value} cm`;
      default:
        return value;
    }
  };


  const handleEditProfile = () => {
    router.push('/(auth)/onboarding/about-you');
  };


  const handleSettingsPress = () => {
    router.push('/(tabs)/settings');
  };


  const settingsOptions = [
    {
      title: 'Units',
      icon: 'scale-outline',
      color: '#4CAF50',
      onPress: () => setShowUnitsModal(true),
    },
    {
      title: 'Language',
      icon: 'language-outline',
      color: '#2196F3',
      onPress: () => setShowLanguageModal(true),
    },
    {
      title: 'Privacy Policy',
      icon: 'shield-checkmark-outline',
      color: '#9C27B0',
      onPress: () => Linking.openURL('https://betteruai.com/privacy'),
    },
    {
      title: 'Terms of Service',
      icon: 'document-text-outline',
      color: '#FF9800',
      onPress: () => Linking.openURL('https://betteruai.com/terms'),
    },
  ];


  const handleGoalEdit = async (type, value) => {
    try {
      // For water, allow up to 1 decimal place and convert to proper units
      const numValue = type === 'water' 
        ? parseFloat(parseFloat(value).toFixed(1))
        : parseFloat(value);
        
      if (isNaN(numValue) || numValue <= 0) {
        Alert.alert('Invalid Value', 'Please enter a valid number greater than 0');
        return;
      }

      // Update in tracking context (this handles AsyncStorage and Supabase persistence)
      const result = await updateGoal(type, numValue);
      if (!result) {
        throw new Error('Failed to update goal in tracking context');
      }

      // Update in settings context with proper unit conversion
      // This ensures the goal persists in SettingsContext as well
      let settingKey;
      let settingsValue;
      
      if (type === 'calories') {
        settingKey = 'calorie_goal';
        settingsValue = numValue;
      } else if (type === 'water') {
        settingKey = 'water_goal_ml';
        settingsValue = numValue * 1000; // Convert liters to milliliters for settings context
      } else if (type === 'protein') {
        settingKey = 'protein_goal';
        settingsValue = numValue;
      }
      
      if (settingKey) {
        const settingsResult = await updateSettings({ [settingKey]: settingsValue });
        
        if (!settingsResult.success) {
          console.warn('Warning: Failed to update settings context:', settingsResult.error);
          // Don't throw error here - the goal was already saved to TrackingContext and Supabase
          // SettingsContext update is just for consistency
        }
      }
      
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating goal:', error);
      Alert.alert('Error', 'Failed to update goal. Please try again.');
    }
  };


  const renderGoalSettings = () => null;


  const renderEditContent = () => {
    if (editingField === 'bio') {
      return (
        <TextInput
          style={[styles.modalInput, styles.bioInput]}
          value={editValue}
          onChangeText={setEditValue}
          placeholder="Tell us about yourself..."
          placeholderTextColor="#666"
          multiline={true}
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={100}
        />
      );
    }


    if (editingField === 'calorie_goal' || editingField === 'water_goal') {
      return (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.input}
            value={editValue}
            onChangeText={setEditValue}
            keyboardType="numeric"
            placeholder={editingField === 'calorie_goal' ? 'Enter calorie goal' : 'Enter water goal'}
            placeholderTextColor="#666"
          />
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.editButton, styles.cancelButton]}
              onPress={() => {
                setEditingField(null);
                setEditValue('');
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <PremiumFeature isPremium={userProfile.isPremium} onPress={() => handleGoalEdit(
              editingField === 'calorie_goal' ? 'calories' : 'water',
              editValue
            )}>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={() => handleGoalEdit(
                  editingField === 'calorie_goal' ? 'calories' : 'water',
                  editValue
                )}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </PremiumFeature>
          </View>
        </View>
      );
    }


    if (editingField === 'training_level') {
      return (
        <View style={styles.optionsGrid}>
          {TRAINING_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.optionCard,
                editValue === level.id && styles.selectedOptionCard,
              ]}
              onPress={() => handleOptionSelect(level.id)}
            >
              <Text style={[
                styles.optionLabel,
                editValue === level.id && styles.selectedOptionLabel
              ]}>
                {level.label}
              </Text>
              <Text style={[
                styles.optionDescription,
                editValue === level.id && styles.selectedOptionDescription
              ]}>
                {level.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }


    if (editingField === 'fitness_goal') {
      return (
        <View style={styles.optionsGrid}>
          {GOALS.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={[
                styles.optionCard,
                editValue === goal.id && styles.selectedOptionCard,
              ]}
              onPress={() => handleOptionSelect(goal.id)}
            >
              <Text style={[
                styles.optionLabel,
                editValue === goal.id && styles.selectedOptionLabel
              ]}>
                {goal.label}
              </Text>
              <Text style={[
                styles.optionDescription,
                editValue === goal.id && styles.selectedOptionDescription
              ]}>
                {goal.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }


    if (editingField === 'gender') {
      return (
        <View style={styles.optionsGrid}>
          {GENDERS.map((gender) => (
            <TouchableOpacity
              key={gender.id}
              style={[
                styles.optionCard,
                editValue === gender.id && styles.selectedOptionCard,
              ]}
              onPress={() => handleOptionSelect(gender.id)}
            >
              <Text style={[
                styles.optionLabel,
                editValue === gender.id && styles.selectedOptionLabel
              ]}>
                {gender.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }


    if (editingField === 'full_name') {
      return (
        <TextInput
          style={styles.modalInput}
          value={editValue}
          onChangeText={setEditValue}
          placeholder="Enter your name"
          placeholderTextColor="#666"
        />
      );
    }


    return (
      <>
        {(editingField === 'weight' || editingField === 'height') && (
          <View style={styles.unitToggle}>
            <Text style={styles.unitText}>
              {editingField === 'weight' ? 'kg' : 'cm'}
            </Text>
            <Switch
              value={useImperial}
              onValueChange={toggleUnits}
              trackColor={{ false: '#333', true: '#00ffff50' }}
              thumbColor={useImperial ? '#00ffff' : '#666'}
            />
            <Text style={styles.unitText}>
              {editingField === 'weight' ? 'lbs' : 'in'}
            </Text>
          </View>
        )}


        <TextInput
          style={styles.modalInput}
          value={editValue}
          onChangeText={setEditValue}
          placeholder={`Enter your ${editingField?.replace('_', ' ')}`}
          placeholderTextColor="#666"
          keyboardType={['age', 'weight', 'height'].includes(editingField) ? 'numeric' : 'default'}
        />
      </>
    );
  };


  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };


  // Handle profile image upload
  const handleAvatarEdit = async () => {
    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos to change your profile picture.');
      return;
    }
    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets || !result.assets[0]?.uri) return;
    setUploading(true);
    try {
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });
      formData.append('upload_preset', 'profilepics');
      const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/derqwaq9h/image/upload';
      const response = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      const data = await response.json();
      if (!data.secure_url) throw new Error('Upload failed');
      // Save to Supabase
      await updateProfile({ avatar_url: data.secure_url });
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Upload custom background image
   * This function handles the entire flow:
   * 1. Checks user has enough neuros
   * 2. Deducts neuros from balance
   * 3. Uploads image to Cloudinary
   * 4. Saves background to database
   * 5. Sets it as active
   */
  const handleBackgroundUpload = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to upload backgrounds.');
      return;
    }

    // Check neuros balance
    const currentNeuros = userProfile?.neuros_balance || 0;
    if (currentNeuros < backgroundUploadCost) {
      Alert.alert(
        'Insufficient Neuros',
        `You need ${backgroundUploadCost.toLocaleString()} Neuros to upload a custom background.\n\nCurrent balance: ${currentNeuros.toLocaleString()} ⭐`,
        [
          { text: 'OK' },
          {
            text: 'Earn Neuros',
            onPress: () => {
              // Show referral info or navigate to earn neuros
              handleReferralInfo();
            }
          }
        ]
      );
      return;
    }

    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos to upload a background.');
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16], // Portrait orientation for backgrounds
      quality: 0.8,
    });

    if (result.canceled || !result.assets || !result.assets[0]?.uri) return;

    setUploadingBackground(true);
    try {
      // Step 1: Deduct neuros first (before upload to prevent free uploads if balance changes)
      // Get current balance
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('neuros_balance')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = profileData?.neuros_balance || 0;
      if (currentBalance < backgroundUploadCost) {
        throw new Error(`Insufficient Neuros. You need ${backgroundUploadCost.toLocaleString()} Neuros.`);
      }

      // Deduct neuros
      const newBalance = currentBalance - backgroundUploadCost;
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ neuros_balance: newBalance })
        .eq('id', user.id);

      if (deductError) {
        throw new Error(`Failed to deduct Neuros: ${deductError.message}`);
      }

      // Step 2: Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'background.jpg',
      });
      formData.append('upload_preset', 'profilepics');
      const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/derqwaq9h/image/upload';
      
      const response = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.secure_url) throw new Error('Upload failed');

      // Step 3: Save background to database and set as active
      // First, deactivate all existing backgrounds
      await supabase
        .from('custom_backgrounds')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Insert new background as active
      const { data: newBackground, error: insertError } = await supabase
        .from('custom_backgrounds')
        .insert({
          user_id: user.id,
          image_url: data.secure_url,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update profile to reference the new background
      await supabase
        .from('profiles')
        .update({ active_custom_background_id: newBackground.id })
        .eq('id', user.id);

      // Refresh backgrounds list
      const { data: backgrounds } = await supabase
        .from('custom_backgrounds')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setCustomBackgrounds(backgrounds || []);
      setActiveCustomBackground(newBackground);

      // Update local profile with new neuros balance
      if (updateProfile) {
        await updateProfile({ neuros_balance: currentNeuros - backgroundUploadCost });
      }

      Alert.alert('Success!', `Background uploaded successfully! ${backgroundUploadCost.toLocaleString()} Neuros deducted.`);
    } catch (error) {
      console.error('Error uploading background:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload background. Please try again.');
      
      // If upload failed but neuros were deducted, we should refund
      // (In production, you might want to add a refund mechanism)
    } finally {
      setUploadingBackground(false);
    }
  };

  /**
   * Set a custom background as active
   * This deactivates all other backgrounds and activates the selected one
   */
  const handleSetActiveBackground = async (backgroundId) => {
    if (!user?.id) return;

    try {
      // Deactivate all backgrounds
      await supabase
        .from('custom_backgrounds')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Activate selected background
      const { error } = await supabase
        .from('custom_backgrounds')
        .update({ is_active: true })
        .eq('id', backgroundId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update profile reference
      await supabase
        .from('profiles')
        .update({ active_custom_background_id: backgroundId })
        .eq('id', user.id);

      // Refresh backgrounds
      const { data: backgrounds } = await supabase
        .from('custom_backgrounds')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setCustomBackgrounds(backgrounds || []);
      const active = backgrounds?.find(bg => bg.id === backgroundId);
      setActiveCustomBackground(active);

      // Update local profile
      if (updateProfile && active) {
        await updateProfile({ active_custom_background_id: active.id });
      }
    } catch (error) {
      console.error('Error setting active background:', error);
      Alert.alert('Error', 'Failed to set background. Please try again.');
    }
  };

  /**
   * Delete a custom background
   * Only allows deletion if it's not the active background (or if it's the only one)
   */
  const handleDeleteBackground = async (backgroundId) => {
    if (!user?.id) return;

    const background = customBackgrounds.find(bg => bg.id === backgroundId);
    if (!background) return;

    Alert.alert(
      'Delete Background',
      'Are you sure you want to delete this background? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // If it's the active background, we need to clear the profile reference
              if (background.is_active) {
                await supabase
                  .from('profiles')
                  .update({ active_custom_background_id: null })
                  .eq('id', user.id);
              }

              // Delete the background
              const { error } = await supabase
                .from('custom_backgrounds')
                .delete()
                .eq('id', backgroundId)
                .eq('user_id', user.id);

              if (error) throw error;

              // Refresh backgrounds
              const { data: backgrounds } = await supabase
                .from('custom_backgrounds')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

              setCustomBackgrounds(backgrounds || []);
              
              if (background.is_active) {
                setActiveCustomBackground(null);
                if (updateProfile) {
                  await updateProfile({ active_custom_background_id: null });
                }
              }

              Alert.alert('Success', 'Background deleted successfully.');
            } catch (error) {
              console.error('Error deleting background:', error);
              Alert.alert('Error', 'Failed to delete background. Please try again.');
            }
          }
        }
      ]
    );
  };


  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }


  if (!userProfile || !userProfile.email) {
    return <Text>No profile data found. Please complete onboarding.</Text>;
  }


  const bmi = calculateBMI(userProfile?.weight, userProfile?.height);
  const bmiCategory = getBMICategory(bmi);


  // Determine background source - prioritize custom background, then rotating theme image, then solid color
  // Normalize Google Drive URLs to direct image URLs for proper display
  const backgroundSource = activeCustomBackground?.image_url 
    ? { uri: normalizeImageUrl(activeCustomBackground.image_url) }
    : (currentRotatingTheme?.image_url ? { uri: normalizeImageUrl(currentRotatingTheme.image_url) } : null);
  
  const backgroundColor = (activeCustomBackground || currentRotatingTheme?.image_url) 
    ? 'transparent' 
    : currentTheme.backgroundColor;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Stationary background image - stays fixed while content scrolls */}
      {/* Shows custom background OR rotating theme image */}
      {backgroundSource && (
        <View style={styles.backgroundImageContainer}>
          <ImageBackground
            source={backgroundSource}
            style={styles.backgroundImage}
            resizeMode="cover"
            imageStyle={styles.backgroundImageStyleFullOpacity}
          />
          {/* No overlay - show original colors for both custom backgrounds and rotating theme images */}
        </View>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollPaddingBottom + PROFILE_SCROLL_EXTRA_BOTTOM },
        ]}
        showsVerticalScrollIndicator={false}
        style={backgroundSource ? styles.scrollViewWithBackground : null}
      >
        <View style={styles.headerSection}>
          {/* Avatar and Name Row */}
          <View style={styles.topRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrapper}>
              <PremiumAvatar
                userId={userProfile.id}
                source={userProfile.avatar_url ? { uri: userProfile.avatar_url } : null}
                size={100}
                style={styles.avatar}
                isPremium={userProfile.is_premium}
                username={userProfile.username}
                fullName={userProfile.full_name}
              />
                {/* Badge positioned at bottom right of avatar */}
                {displayedBadge && (
                  <View style={styles.badgeOverlay}>
                    <BadgeDisplay
                      badge={displayedBadge}
                      onPress={() => {
                        const badgeForModal = {
                          ...displayedBadge,
                          name: displayedBadge.name || displayedBadge.badge_name,
                          id: displayedBadge.id || displayedBadge.badge_id,
                        };
                        setSelectedBadge(badgeForModal);
                        setBadgeModalVisible(true);
                      }}
                      size="mediumLarge"
                      showLabel={false}
                    />
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={handleAvatarEdit} style={styles.editPhotoButton} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#00ffff" size={16} />
                ) : (
                  <View style={styles.editPhotoContent}>
                    <Ionicons name="camera" size={14} color="#00ffff" />
                    <Text style={styles.editPhotoText}>Edit</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.nameContainer}>
              <View style={styles.nameRow}>
              <Text style={styles.name}>{userProfile?.full_name || 'User'}</Text>
                <VerifiedBadge isVerified={userProfile?.isverified || false} size={18} />
              </View>
              <Text style={styles.username}>@{userProfile?.username || '--'}</Text>
              <Text style={styles.email}>{userProfile?.email}</Text>
              
              <TouchableOpacity
                style={styles.editNameButton}
                onPress={() => handleEdit('full_name', userProfile?.full_name)}
              >
                <Ionicons name="create-outline" size={16} color="#00ffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Neuro Counter and Bonds Button - Only visible to the user themselves */}
          <View style={styles.neuroActionsWrapper}>
            <View style={styles.neuroActionsContainer}>
              <TouchableOpacity
                style={styles.neuroCounterContainer}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={16} color="#FFD700" />
                <Text style={styles.neuroCounterText} numberOfLines={1}>
                  {(userProfile?.neuros_balance ?? 0).toLocaleString()} Neuros
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.bondsButton}
                onPress={() => router.push('/bonds')}
                activeOpacity={0.8}
              >
                <Ionicons name="trending-up" size={16} color="#00ffff" />
                <Text style={styles.bondsButtonText} numberOfLines={1}>My Bonds</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Trophy Case - Display all badges with View button */}
          <TrophyCase 
            userId={userProfile?.id} 
            onViewAll={() => setShowBadgeCollection(true)}
            isOwnProfile={true}
            onSetAsDisplay={async (badgeId) => {
              // Set the badge as displayed in database
              const { error } = await supabase
                .rpc('set_displayed_badge', {
                  p_user_id: user?.id,
                  p_badge_id: badgeId,
                });
              if (!error) {
                // Refresh the displayed badge
                await fetchDisplayedBadge();
              } else {
                console.error('Error setting displayed badge:', error);
                Alert.alert('Error', 'Failed to set displayed badge. Please try again.');
              }
            }}
          />

          {/* Simple Bio Section */}
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{userProfile?.bio || 'No bio yet'}</Text>
            <TouchableOpacity
              style={styles.editBioButton}
              onPress={() => handleEdit('bio', userProfile?.bio)}
            >
              <Ionicons name="create-outline" size={16} color="#00ffff" />
            </TouchableOpacity>
          </View>
         
          <TouchableOpacity onPress={() => router.push('/store')} style={styles.storeButton}>
            <Ionicons name="storefront-outline" size={20} color="#00ffff" />
            <Text style={styles.storeButtonText}>Store</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={showReferralInfo} style={styles.shareButton}>
            <Ionicons name="gift-outline" size={20} color="#00ffff" />
            <Text style={styles.shareButtonText}>Refer & Earn</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{formatValue(userProfile?.age)}</Text>
              <TouchableOpacity onPress={() => handleEdit('age', userProfile?.age)}>
                <Ionicons name="create-outline" size={16} color="#00ffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.statLabel}>Age</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>
                {formatValue(userProfile?.weight, 'weight')}
              </Text>
              <TouchableOpacity onPress={() => handleEdit('weight', userProfile?.weight)}>
                <Ionicons name="create-outline" size={16} color="#00ffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.statLabel}>Weight</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>
                {formatValue(userProfile?.height, 'height')}
              </Text>
              <TouchableOpacity onPress={() => handleEdit('height', userProfile?.height)}>
                <Ionicons name="create-outline" size={16} color="#00ffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.statLabel}>Height</Text>
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fitness Profile</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="trophy-outline" size={24} color="#00ffff" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Fitness Goal</Text>
                <View style={styles.infoValueRow}>
                  <Text style={styles.infoValue}>
                    {capitalizeWords(userProfile?.fitness_goal)}
                  </Text>
                  <TouchableOpacity onPress={() => handleEdit('fitness_goal', userProfile?.fitness_goal)}>
                    <Ionicons name="create-outline" size={16} color="#00ffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>


            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={24} color="#00ffff" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Gender</Text>
                <View style={styles.infoValueRow}>
                  <Text style={styles.infoValue}>
                    {capitalizeWords(userProfile?.gender)}
                  </Text>
                  <TouchableOpacity onPress={() => handleEdit('gender', userProfile?.gender)}>
                    <Ionicons name="create-outline" size={16} color="#00ffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>


            <View style={styles.infoRow}>
              <Ionicons name="barbell-outline" size={24} color="#00ffff" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Training Level</Text>
                <View style={styles.infoValueRow}>
                  <Text style={styles.infoValue}>
                    {userProfile?.training_level?.charAt(0).toUpperCase() + userProfile?.training_level?.slice(1) || 'Not set'}
                  </Text>
                  <TouchableOpacity onPress={() => handleEdit('training_level', userProfile?.training_level)}>
                    <Ionicons name="create-outline" size={16} color="#00ffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>


            <View style={[styles.infoRow, { marginBottom: 0 }]}>
              <Ionicons name="speedometer-outline" size={24} color="#00ffff" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>BMI</Text>
                <Text style={[styles.infoValue, { color: bmi ? '#00ffff' : '#fff' }]}>
                  {bmi ? (
                    <Text>
                      <Text style={styles.bmiValue}>{bmi}</Text>
                      <Text style={styles.bmiCategory}> ({bmiCategory})</Text>
                    </Text>
                  ) : 'Not available'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* TEMPORARILY DISABLED: Top 3 songs on profile
        {(spotifyLoading || spotifyTopTracksHeading) && (
          <View style={styles.spotifyTopTracksSection}>
            <View style={styles.spotifyTopTracksCard}>
              {spotifyLoading ? (
                <View style={styles.spotifyTopTracksLoading}>
                  <ActivityIndicator size="small" color="#38bdf8" />
                  <Text style={styles.spotifyTopTracksHelper}>Crunching your top songs…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.spotifyTopTracksTitle}>{spotifyTopTracksHeading}</Text>
                  <View style={styles.spotifyTopTracksList}>
                    {spotifyTopTracks.map((track, index) => (
                      <TouchableOpacity
                        key={`${track.track_id || track.track_name || index}-${index}`}
                        style={styles.spotifyTrackChip}
                        activeOpacity={0.85}
                        onPress={() => openSpotifyTrack(track)}
                      >
                        <View style={styles.spotifyTrackNumber}>
                          <Text style={styles.spotifyTrackNumberText}>{index + 1}</Text>
                        </View>
                        {track.album_image_url ? (
                          <Image source={{ uri: track.album_image_url }} style={styles.spotifyTrackArtwork} />
                        ) : (
                          <View style={styles.spotifyTrackArtworkFallback}>
                            <Ionicons name="musical-notes-outline" size={18} color="#38bdf8" />
                          </View>
                        )}
                        <View style={styles.spotifyTrackInfo}>
                          <Text style={styles.spotifyTrackTitle} numberOfLines={1}>
                            {track.track_name}
                          </Text>
                          {track.artist_name ? (
                            <Text style={styles.spotifyTrackArtist} numberOfLines={1}>
                              {track.artist_name}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.spotifyTrackPlayCount}>
                          <Ionicons name="play-outline" size={14} color="#38bdf8" />
                          <Text style={styles.spotifyTrackPlayCountText}>{track.play_count}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}
        */}

        {/* Music Integration Section */}
        {userProfile?.id && (() => {
          // Check if Spotify is enabled in settings
          // Default to false if not set (hidden by default)
          const spotifyEnabled = settings?.spotify_enabled === true;
          
          if (!spotifyEnabled) return null;
          
          return (
            <>
            <TouchableOpacity
              style={styles.musicIntegrationButton}
              activeOpacity={0.85}
              onPress={() => setMusicModalVisible(true)}
            >
              <View style={styles.musicIntegrationButtonContent}>
                <View style={styles.musicIntegrationButtonIcon}>
                  <Ionicons name="musical-notes-outline" size={20} color="#0f172a" />
                </View>
                <View style={styles.musicIntegrationButtonTextBlock}>
                  <Text style={styles.musicIntegrationButtonTitle}>Music Integration</Text>
                  <Text style={styles.musicIntegrationButtonSubtitle}>
                    Connect Spotify to power workouts, recaps, and profile stats.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0f172a" />
              </View>
            </TouchableOpacity>

            <Modal
              transparent
              visible={musicModalVisible}
              animationType="slide"
              onRequestClose={() => setMusicModalVisible(false)}
            >
              <View style={styles.musicModalBackdrop}>
                <View style={styles.musicModalCard}>
                  <TouchableOpacity
                    style={styles.musicModalClose}
                    onPress={() => setMusicModalVisible(false)}
                    accessibilityLabel="Close music integration"
                  >
                    <Ionicons name="close" size={22} color="#0f172a" />
                  </TouchableOpacity>
                  <ScrollView
                    style={styles.musicModalScroll}
                    contentContainerStyle={styles.musicModalContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.musicModalHeader}>
                      <Text style={styles.musicModalTitle}>Spotify x BetterU</Text>
                      <Text style={styles.musicModalSubtitle}>
                        Start a workout in BetterU, then keep Spotify playing in the background. While the timer runs we log every track from your connected Spotify account—even if it’s streaming from another device—so your recaps, community feed, and Top 3 songs all stay in sync.
                      </Text>
                    </View>

                    <View style={styles.spotifyCard}>
                      <View style={styles.spotifyLogoContainer}>
                        <View style={styles.spotifyBadge}>
                          <Ionicons name="musical-notes" size={18} color="#0f172a" />
                        </View>
                        <Text style={styles.spotifyHeadline}>Spotify x BetterU</Text>
                      </View>
                      <Text style={styles.spotifyDescription}>
                        Connect Spotify to surface your top workout songs automatically, add live track cards to your recaps, and boost motivation with real-time music insights.
                      </Text>

                      <View style={styles.spotifyPerksGrid}>
                        {[
                          { icon: 'flash', color: '#facc15', label: 'Auto-track songs' },
                          { icon: 'analytics', color: '#38bdf8', label: 'Playlist insights' },
                          { icon: 'globe', color: '#34d399', label: 'Share in community' },
                        ].map((perk) => (
                          <View key={perk.label} style={styles.spotifyPerkItem}>
                            <View style={[styles.spotifyPerkBadge, { backgroundColor: `${perk.color}22`, borderColor: `${perk.color}55` }]}> 
                              <Ionicons name={perk.icon} size={18} color={perk.color} />
                            </View>
                            <Text style={styles.spotifyPerkLabel}>{perk.label}</Text>
                          </View>
                        ))}
                      </View>

                      <SpotifyConnectButton
                        onConnected={() => {
                          fetchSpotifyTopTracks();
                          setSpotifyConnectedMessage('Spotify connected! ✅');
                          setMusicModalVisible(false);
                        }}
                      />

                      {spotifyConnectedMessage ? (
                        <Text style={styles.successMessage}>{spotifyConnectedMessage}</Text>
                      ) : (
                        <Text style={styles.helperText}>
                          Connected accounts automatically display their top songs and track chips in recaps.
                        </Text>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Modal>
            </>
          );
        })()}

        {/* Profile Theme Button */}
        <TouchableOpacity 
          style={styles.themeButton} 
          onPress={() => setShowThemeModal(true)}
        >
          <View style={[styles.themePreview, { backgroundColor: currentTheme.backgroundColor }]}>
            <Ionicons name="color-palette-outline" size={18} color="#fff" />
          </View>
          <View style={styles.themeButtonTextBlock}>
            <Text style={styles.themeButtonTitle}>Profile Theme</Text>
            <Text style={styles.themeButtonSubtitle}>
              {activeCustomBackground ? 'Custom Background Active' : currentTheme.name}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#00ffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color="#00ffff" />
          <Text style={styles.settingsButtonText}>Settings</Text>
        </TouchableOpacity>

        {/* Admin Section - Only show if user is admin */}
        {userProfile?.is_admin && (
          <TouchableOpacity 
            style={styles.adminButton} 
            onPress={() => router.push('/(tabs)/admin')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#ff0055" />
            <Text style={styles.adminButtonText}>Admin Dashboard</Text>
          </TouchableOpacity>
        )}

        {/* HealthKit Integration Button - Temporarily disabled for TestFlight */}
        {/* <TouchableOpacity
          style={styles.healthKitButton}
          activeOpacity={0.85}
          onPress={async () => {
            // Always open modal - it will show appropriate content based on HealthKit availability
            setHealthKitModalVisible(true);
            
            // If not authorized and on iOS, try to request authorization
            if (Platform.OS === 'ios' && !isHealthKitAuthorized && requestAuthorization) {
              try {
                await requestAuthorization();
                // Mark as requested so we show data even if status doesn't update immediately
                setHealthKitRequested(true);
              } catch (error) {
                console.log('Error requesting HealthKit authorization:', error);
              }
            }
          }}
        >
          <View style={styles.healthKitButtonContent}>
            <View style={styles.healthKitButtonIcon}>
              <Ionicons name="heart-outline" size={20} color="#0f172a" />
            </View>
            <View style={styles.healthKitButtonTextBlock}>
              <Text style={styles.healthKitButtonTitle}>Health Data</Text>
              <Text style={styles.healthKitButtonSubtitle}>
                {isHealthKitAuthorized 
                  ? 'View your health stats from Apple Health'
                  : 'Connect to Apple Health'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0f172a" />
          </View>
        </TouchableOpacity> */}





      </ScrollView>


      {editingField && (
      <Modal
          visible={true}
        transparent={true}
          animationType="slide"
          onRequestClose={() => setEditingField(null)}
      >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
                {editingField === 'calorie_goal' ? 'Edit Calorie Goal' :
                 editingField === 'water_goal' ? 'Edit Water Goal' :
                 editingField === 'full_name' ? 'Edit Name' : 'Edit Profile'}
            </Text>
            {renderEditContent()}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setEditingField(null);
                  setEditValue('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* HealthKit Modal - Temporarily disabled for TestFlight */}
      {false && (
      <Modal
        transparent
        visible={healthKitModalVisible}
        animationType="slide"
        onRequestClose={() => setHealthKitModalVisible(false)}
      >
        <View style={styles.healthKitModalBackdrop}>
          <View style={styles.healthKitModalCard}>
            <TouchableOpacity
              style={styles.healthKitModalClose}
              onPress={() => setHealthKitModalVisible(false)}
              accessibilityLabel="Close health data"
            >
              <Ionicons name="close" size={22} color="#0f172a" />
            </TouchableOpacity>
            <ScrollView
              style={styles.healthKitModalScroll}
              contentContainerStyle={styles.healthKitModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.healthKitModalHeader}>
                <View style={styles.healthKitIconContainer}>
                  <Ionicons name="heart" size={32} color="#ff0055" />
                </View>
                <Text style={styles.healthKitModalTitle}>Apple Health Data</Text>
                <Text style={styles.healthKitModalSubtitle}>
                  Your health stats synced from Apple Health
                </Text>
              </View>

              {/* Real HealthKit Stats */}
              {Platform.OS !== 'ios' ? (
                <View style={styles.healthKitPlaceholderNotice}>
                  <Ionicons name="information-circle-outline" size={20} color="#64748b" />
                  <Text style={styles.healthKitPlaceholderText}>
                    HealthKit is only available on iOS devices.
                  </Text>
                </View>
              ) : isHealthKitAuthorized ? (
                <>
                  <View style={styles.healthStatsGrid}>
                    <View style={styles.healthStatCard}>
                      <Ionicons name="footsteps-outline" size={24} color="#00ffff" />
                      <Text style={styles.healthStatValue}>
                        {/* Daily total from sumQuantity */}
                        {healthData.steps?.quantity != null
                          ? Math.round(healthData.steps.quantity).toLocaleString()
                          : '—'}
                      </Text>
                      <Text style={styles.healthStatLabel}>Steps Today</Text>
                    </View>
                    
                    <View style={styles.healthStatCard}>
                      <Ionicons name="flame-outline" size={24} color="#ff6b6b" />
                      <Text style={styles.healthStatValue}>
                        {healthData.calories?.quantity != null
                          ? Math.round(healthData.calories.quantity).toLocaleString()
                          : '—'}
                      </Text>
                      <Text style={styles.healthStatLabel}>Active Cal</Text>
                    </View>
                  </View>

                  <View style={styles.healthStatsGrid}>
                    <View style={styles.healthStatCard}>
                      <Ionicons name="time-outline" size={24} color="#4ecdc4" />
                      <Text style={styles.healthStatValue}>
                        {healthData.exercise?.quantity != null
                          ? `${Math.round(healthData.exercise.quantity)} min`
                          : '— min'}
                      </Text>
                      <Text style={styles.healthStatLabel}>Exercise</Text>
                    </View>
                    
                    <View style={styles.healthStatCard}>
                      <Ionicons name="heart-circle-outline" size={24} color="#ff0055" />
                      <Text style={styles.healthStatValue}>
                        {healthData.heartRate?.quantity 
                          ? `${Math.round(healthData.heartRate.quantity)} BPM`
                          : '— BPM'}
                      </Text>
                      <Text style={styles.healthStatLabel}>Heart Rate</Text>
                    </View>
                  </View>

                  <View style={styles.healthKitPlaceholderNotice}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#4ade80" />
                    <Text style={styles.healthKitPlaceholderText}>
                      Connected to Apple Health. Data updates automatically.
                    </Text>
                  </View>

                  {/* ====================================== */}
                  {/* APPLE WORKOUTS - Import to Feed */}
                  {/* ====================================== */}
                  <View style={styles.appleWorkoutsSection}>
                    <View style={styles.appleWorkoutsHeader}>
                      <Ionicons name="fitness-outline" size={22} color="#00ffff" />
                      <Text style={styles.appleWorkoutsTitle}>Import Workouts to Feed</Text>
                    </View>
                    <Text style={styles.appleWorkoutsSubtitle}>
                      Tap any workout from Apple Health to share it on your feed
                    </Text>

                    {loadingAppleWorkouts ? (
                      <ActivityIndicator color="#00ffff" style={{ marginTop: 16 }} />
                    ) : appleWorkouts.length === 0 ? (
                      <View style={styles.noWorkoutsNotice}>
                        <Ionicons name="calendar-outline" size={20} color="#64748b" />
                        <Text style={styles.noWorkoutsText}>
                          No workouts found in the last 30 days
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.appleWorkoutsList}>
                        {appleWorkouts.slice(0, visibleWorkoutsCount).map((workout, index) => {
                          const workoutId = workout.uuid || workout.id || index;
                          const isUploading = uploadingWorkout === workoutId;
                          const activityType = workout.workoutActivityType;
                          const workoutName = getWorkoutNameFromType(activityType);
                          const isCardio = [37, 52, 13, 16, 24, 46, 57].includes(activityType);
                          const distance = workout.totalDistance?.quantity || 0;
                          const calories = workout.totalEnergyBurned?.quantity || 0;
                          // Handle different property names from HealthKit
                          const startDate = workout.startDate || workout.start || workout.startTime;
                          const endDate = workout.endDate || workout.end || workout.endTime;
                          const duration = workout.duration;
                          const date = startDate ? new Date(startDate) : null;
                          
                          return (
                            <TouchableOpacity
                              key={workoutId}
                              style={[styles.appleWorkoutCard, isUploading && styles.appleWorkoutCardUploading]}
                              onPress={() => uploadAppleWorkoutToFeed(workout)}
                              disabled={isUploading}
                            >
                              <View style={styles.appleWorkoutIcon}>
                                <Ionicons 
                                  name={isCardio ? 'walk-outline' : 'barbell-outline'} 
                                  size={24} 
                                  color={isCardio ? '#4ecdc4' : '#ff6b6b'} 
                                />
                              </View>
                              <View style={styles.appleWorkoutInfo}>
                                <Text style={styles.appleWorkoutName}>{workoutName}</Text>
                                <Text style={styles.appleWorkoutDetails}>
                                  {formatWorkoutDuration(duration, startDate, endDate)}
                                  {isCardio && distance > 0 && ` • ${(distance / 1000).toFixed(2)} km`}
                                  {calories > 0 && ` • ${Math.round(calories)} cal`}
                                </Text>
                                {date && (
                                  <Text style={styles.appleWorkoutDate}>
                                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.appleWorkoutAction}>
                                {isUploading ? (
                                  <ActivityIndicator size="small" color="#00ffff" />
                                ) : (
                                  <Ionicons name="add-circle-outline" size={28} color="#00ffff" />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        
                        {/* Load More button - shows remaining workouts count */}
                        {appleWorkouts.length > visibleWorkoutsCount && (
                          <TouchableOpacity
                            style={styles.loadMoreButton}
                            onPress={() => setVisibleWorkoutsCount(prev => prev + 10)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="chevron-down-outline" size={20} color="#00ffff" />
                            <Text style={styles.loadMoreText}>
                              Load More ({appleWorkouts.length - visibleWorkoutsCount} remaining)
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {/* ====================================== */}
                  {/* BETTERU WORKOUTS - Export to Apple Health */}
                  {/* ====================================== */}
                  <View style={styles.appleWorkoutsSection}>
                    <View style={styles.appleWorkoutsHeader}>
                      <Ionicons name="cloud-upload-outline" size={22} color="#00ffff" />
                      <Text style={styles.appleWorkoutsTitle}>Export to Apple Health</Text>
                    </View>
                    <Text style={styles.appleWorkoutsSubtitle}>
                      Tap to load your BetterU workouts, then tap any workout to export
                    </Text>

                    <TouchableOpacity
                      style={styles.loadExportButton}
                      onPress={fetchBetterUWorkouts}
                      disabled={loadingBetterUWorkouts}
                      activeOpacity={0.8}
                    >
                      {loadingBetterUWorkouts ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={20} color="#fff" />
                          <Text style={styles.loadExportButtonText}>Refresh Workouts</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    {betterUWorkouts.length > 0 ? (
                      <View style={styles.appleWorkoutsList}>
                        {betterUWorkouts.slice(0, 15).map((workout) => {
                          const isExporting = exportingWorkout === workout.id;
                          const isCardio = workout._exportType === 'cardio';
                          const date = new Date(workout.completed_at || workout.end_time);
                          
                          // Calculate duration
                          const durationSeconds = isCardio 
                            ? (workout.duration_seconds || 0)
                            : (workout.duration || 0);
                          const durationMinutes = Math.floor(durationSeconds / 60);
                          const cals = workout.calories_burned || 0;
                          
                          // For cardio, show distance
                          const distanceKm = isCardio && workout.distance_meters 
                            ? (workout.distance_meters / 1000).toFixed(2) 
                            : null;
                          
                          // Choose icon based on workout type
                          const iconName = isCardio 
                            ? (workout.activity_type === 'bike' ? 'bicycle-outline' : 'walk-outline')
                            : 'barbell-outline';
                          
                          return (
                            <TouchableOpacity
                              key={workout.id}
                              style={[styles.appleWorkoutCard, isExporting && styles.appleWorkoutCardUploading]}
                              onPress={() => exportWorkoutToAppleHealth(workout)}
                              disabled={isExporting}
                            >
                              <View style={styles.appleWorkoutIcon}>
                                <Ionicons name={iconName} size={24} color="#00ffff" />
                              </View>
                              <View style={styles.appleWorkoutInfo}>
                                <Text style={styles.appleWorkoutName} numberOfLines={1}>
                                  {workout.workout_name}
                                </Text>
                                <Text style={styles.appleWorkoutDetails}>
                                  {durationMinutes} min
                                  {isCardio && distanceKm ? ` • ${distanceKm} km` : ''}
                                  {!isCardio && workout.exercise_count ? ` • ${workout.exercise_count} exercises` : ''}
                                  {cals > 0 ? ` • ${cals} cal` : ''}
                                </Text>
                                {date && (
                                  <Text style={styles.appleWorkoutDate}>
                                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.appleWorkoutAction}>
                                {isExporting ? (
                                  <ActivityIndicator size="small" color="#00ffff" />
                                ) : (
                                  <Ionicons name="cloud-upload-outline" size={28} color="#00ffff" />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        
                        {betterUWorkouts.length > 10 && (
                          <Text style={styles.moreWorkoutsText}>
                            + {betterUWorkouts.length - 10} more workouts
                          </Text>
                        )}
                      </View>
                    ) : !loadingBetterUWorkouts && (
                      <View style={styles.noWorkoutsNotice}>
                        <Ionicons name="barbell-outline" size={20} color="#64748b" />
                        <Text style={styles.noWorkoutsText}>
                          Load your workouts to export them to Apple Health
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.healthKitPlaceholderNotice}>
                  <Ionicons name="information-circle-outline" size={20} color="#64748b" />
                  <Text style={styles.healthKitPlaceholderText}>
                    Tap to authorize Apple Health access. After granting permission, close and reopen this modal to see your health data.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}

      {/* Badge Modal */}
      <BadgeModal
        visible={badgeModalVisible}
        badge={selectedBadge}
        onClose={() => {
          setBadgeModalVisible(false);
          setSelectedBadge(null);
        }}
        isOwnBadge={true}
        onSetAsDisplay={async (badgeId) => {
          const { error } = await supabase
            .rpc('set_displayed_badge', {
              p_user_id: user?.id,
              p_badge_id: badgeId,
            });
          if (!error && userProfile?.id) {
            // Refresh the displayed badge
            await fetchDisplayedBadge();
          } else if (error) {
            console.error('Error setting displayed badge:', error);
            Alert.alert('Error', 'Failed to set displayed badge. Please try again.');
          }
        }}
      />

      {/* Badge Collection Modal */}
      {showBadgeCollection && userProfile?.id && (
        <Modal
          visible={showBadgeCollection}
          animationType="slide"
          transparent={false}
          onRequestClose={async () => {
            setShowBadgeCollection(false);
            // Refresh displayed badge when closing the modal
            await fetchDisplayedBadge();
          }}
        >
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#222' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>My Badges</Text>
              <TouchableOpacity 
                onPress={async () => {
                  setShowBadgeCollection(false);
                  // Refresh displayed badge when closing the modal
                  await fetchDisplayedBadge();
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <BadgeCollection 
              userId={userProfile.id}
              onBadgePress={async (badge) => {
                // When a badge is set as displayed, refresh the displayed badge
                if (badge?.action === 'set_displayed') {
                  await fetchDisplayedBadge();
                }
              }}
            />
          </View>
        </Modal>
      )}

      {/* Profile Theme Modal */}
      <Modal
        visible={showThemeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.themeModalBackdrop}>
          <View style={styles.themeModalCard}>
            {/* Header */}
            <View style={styles.themeModalHeader}>
              <Text style={styles.themeModalTitle}>Choose Profile Theme</Text>
              <TouchableOpacity 
                style={styles.themeModalClose}
                onPress={() => setShowThemeModal(false)}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Scrollable Content */}
            <ScrollView 
              style={styles.themeModalScrollView}
              contentContainerStyle={styles.themeModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.themeModalSubtitle}>
                Select a theme from your collection. Buy more themes in the store!
              </Text>

              {/* Custom Background Info - Only visible to admins */}
              {userProfile?.is_admin && (
                <View style={styles.customBackgroundInfoCard}>
                  <Ionicons name="image-outline" size={24} color="#00ffff" />
                  <View style={styles.customBackgroundInfoText}>
                    <Text style={styles.customBackgroundInfoTitle}>Want a Custom Background?</Text>
                    <Text style={styles.customBackgroundInfoSubtitle}>
                      Upload your own background image in the store!
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.customBackgroundInfoButton}
                    onPress={() => {
                      setShowThemeModal(false);
                      setTimeout(() => router.push('/store'), 300);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#00ffff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Store Button */}
              <TouchableOpacity 
                style={styles.goToStoreButton}
                onPress={() => {
                  setShowThemeModal(false);
                  setTimeout(() => router.push('/store'), 300);
                }}
              >
                <Ionicons name="storefront-outline" size={20} color="#00ffff" />
                <Text style={styles.goToStoreButtonText}>Buy More Themes in the Store</Text>
                <Ionicons name="chevron-forward" size={18} color="#00ffff" />
              </TouchableOpacity>

              {/* Themes organized by Rarity */}
              {(() => {
                // Helper function to get rarity color
                const getRarityColor = (rarity) => {
                  switch (rarity) {
                    case 'common': return '#9e9e9e'; // Gray
                    case 'rare': return '#2196f3'; // Blue
                    case 'epic': return '#9c27b0'; // Purple
                    case 'legendary': return '#ff9800'; // Orange
                    case 'mythic': return '#f44336'; // Red
                    case 'classic': return '#ffd700'; // Gold for classic OG themes
                    default: return '#9e9e9e';
                  }
                };

                // Combine all themes with their rarity
                const allThemes = [];
                
                // Add rotating themes
                rotatingThemes.forEach((slot) => {
                  if (!slot.theme) return;
                  const theme = slot.theme;
                  const isOwned = (userProfile?.purchased_themes || []).includes(theme.theme_key);
                  if (!isOwned) return; // Only show owned themes
                  
                  allThemes.push({
                    id: slot.id,
                    type: 'rotating',
                    themeKey: theme.theme_key,
                    name: theme.name,
                    backgroundColor: theme.background_color || '#000',
                    imageUrl: theme.image_url,
                    rarity: slot.slot_rarity || 'common',
                    slot: slot,
                  });
                });
                
                // Add classic themes (OG themes - labeled as "classic" instead of "common")
                Object.entries(PROFILE_THEMES)
                  .filter(([key]) => isThemeUnlocked(key))
                  .forEach(([key, theme]) => {
                    allThemes.push({
                      id: `classic-${key}`,
                      type: 'classic',
                      themeKey: key,
                      name: theme.name,
                      backgroundColor: theme.backgroundColor,
                      imageUrl: null,
                      rarity: 'classic', // Changed from 'common' to 'classic' for OG themes
                      theme: theme,
                    });
                  });
                
                // Group by rarity
                const themesByRarity = {
                  mythic: [],
                  legendary: [],
                  epic: [],
                  rare: [],
                  common: [],
                  classic: [], // Add classic section for OG themes
                };
                
                allThemes.forEach(theme => {
                  const rarity = theme.rarity.toLowerCase();
                  if (themesByRarity[rarity]) {
                    themesByRarity[rarity].push(theme);
                  } else {
                    themesByRarity.common.push(theme); // Fallback to common
                  }
                });
                
                // Rarity order (most rare first, classic at the end)
                const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'common', 'classic'];
                const rarityLabels = {
                  mythic: 'Mythic',
                  legendary: 'Legendary',
                  epic: 'Epic',
                  rare: 'Rare',
                  common: 'Common',
                  classic: 'Classic', // Label for OG themes
                };
                
                // Render sections by rarity
                return rarityOrder.map(rarity => {
                  const themes = themesByRarity[rarity];
                  if (themes.length === 0) return null;
                  
                  const rarityColor = getRarityColor(rarity);
                  
                  return (
                    <View key={rarity} style={styles.raritySection}>
                      <View style={styles.raritySectionHeader}>
                        <View style={[styles.raritySectionBadge, { backgroundColor: rarityColor + '40', borderColor: rarityColor }]}>
                          <Text style={[styles.raritySectionTitle, { color: rarityColor }]}>
                            {rarityLabels[rarity]}
                          </Text>
                        </View>
                        <Text style={styles.raritySectionCount}>{themes.length} theme{themes.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.themeOptionsGrid}>
                        {themes.map((themeItem) => {
                          const isSelected = selectedTheme === themeItem.themeKey;
                          
                          return (
                            <TouchableOpacity
                              key={themeItem.id}
                              style={[
                                styles.themeOption,
                                themeItem.imageUrl 
                                  ? {} 
                                  : { backgroundColor: themeItem.backgroundColor, padding: 12 },
                                isSelected && styles.themeOptionSelected,
                              ]}
                              onPress={() => {
                                if (themeItem.type === 'rotating') {
                                  handleRotatingThemeSelect(themeItem.themeKey);
                                } else {
                                  handleThemeSelect(themeItem.themeKey);
                                }
                              }}
                            >
                              {/* Show image if available (like store), otherwise use background color */}
                              {themeItem.imageUrl ? (
                                <ImageBackground
                                  source={{ uri: normalizeImageUrl(themeItem.imageUrl) }}
                                  style={styles.themeOptionImageBackground}
                                  imageStyle={styles.themeOptionImageStyle}
                                  resizeMode="cover"
                                >
                                  <View style={styles.themeOptionContent}>
                                    <View style={styles.themeOptionHeader}>
                                      <Text style={styles.themeOptionName}>{themeItem.name}</Text>
                                    </View>
                                    {isSelected && (
                                      <View style={styles.themeOptionCheck}>
                                        <Ionicons name="checkmark-circle" size={24} color="#00ffff" />
                                      </View>
                                    )}
                                  </View>
                                </ImageBackground>
                              ) : (
                                <>
                                  <View style={styles.themeOptionHeader}>
                                    <Text style={styles.themeOptionName}>{themeItem.name}</Text>
                                  </View>
                                  {isSelected && (
                                    <View style={styles.themeOptionCheck}>
                                      <Ionicons name="checkmark-circle" size={24} color="#00ffff" />
                                    </View>
                                  )}
                                </>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                });
              })()}
              
              {/* Empty State */}
              {rotatingThemes.length === 0 && Object.entries(PROFILE_THEMES).filter(([key]) => isThemeUnlocked(key)).length === 0 && (
                <View style={styles.emptyThemesContainer}>
                  <Ionicons name="color-palette-outline" size={48} color="#666" />
                  <Text style={styles.emptyThemesText}>No themes in your collection yet</Text>
                  <Text style={styles.emptyThemesSubtext}>Visit the store to purchase themes!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};


const styles = StyleSheet.create({

 
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Same opacity background as bio section for visibility
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#FFD700', // Yellow outline (same color as the text)
    width: '100%',
  },
  storeButtonText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Same opacity background as bio section for visibility
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#00ffff',
    width: '100%',
  },
  shareButtonText: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  spotifySection: {
    marginBottom: 36,
    paddingHorizontal: 12,
    width: '100%',
    gap: 18,
  },
  spotifyCard: {
    borderRadius: 24,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    overflow: 'hidden',
  },
  spotifyCardBody: {
    padding: 24,
    gap: 18,
  },
  spotifyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spotifyIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyBadgeText: {
    color: '#e0f2fe',
    fontSize: 18,
    fontWeight: '700',
  },
  spotifyDescription: {
    color: '#cbd5f5',
    fontSize: 14,
    lineHeight: 22,
  },
  spotifyPerksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  spotifyPerkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  spotifyPerkText: {
    color: '#e2e8f0',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  spotifyActions: {
    gap: 14,
  },
  spotifyHelperText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  spotifySuccessText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
  },
  spotifyTopTracks: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
    paddingTop: 14,
    gap: 10,
  },
  spotifyTopTracksTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  spotifyTopTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spotifyTopTrackIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyTopTrackIndexText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  spotifyTopTrackInfo: {
    flex: 1,
    gap: 2,
  },
  spotifyTopTrackName: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 14,
  },
  spotifyTopTrackArtist: {
    color: '#94a3b8',
    fontSize: 12,
  },
  spotifyTopTrackCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  spotifyTopTrackCountText: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 12,
  },
  spotifyTopTracksLoading: {
    marginTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  spotifyTopTracksSection: {
    width: '100%',
    marginBottom: 32,
    marginTop: 8,
  },
  spotifyTopTracksCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    gap: 14,
    width: '100%',
  },
  spotifyTopTracksLoading: {
    alignItems: 'center',
    gap: 10,
  },
  spotifyTopTracksHelper: {
    color: '#94a3b8',
    fontSize: 13,
  },
  spotifyTopTracksTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spotifyTopTracksList: {
    gap: 12,
  },
  spotifyTrackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  spotifyTrackNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyTrackNumberText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  spotifyTrackArtwork: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  spotifyTrackArtworkFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyTrackInfo: {
    flex: 1,
    minWidth: 0,
  },
  spotifyTrackTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  spotifyTrackArtist: {
    color: '#cbd5f5',
    fontSize: 12,
    marginTop: 2,
  },
  spotifyTrackPlayCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  spotifyTrackPlayCountText: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 60,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  headerSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginRight: 20,
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: -17,
    right: -19,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    marginBottom: 10,
  },
  editPhotoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  editPhotoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editPhotoText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 15,
    position: 'relative',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  username: {
    color: '#00ffff',
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  email: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 12,
  },
  neuroActionsWrapper: {
    marginTop: 16,
    marginBottom: 12,
    marginLeft: -20,
    marginRight: -20,
    paddingLeft: 12,
    paddingRight: 12,
  },
  neuroActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  neuroCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
    flex: 2,
    minWidth: 0,
  },
  neuroCounterText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  bondsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#00ffff',
    flex: 1,
    minWidth: 0,
  },
  bondsButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  bondsButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  editNameButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
  },
  goalBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  goalText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingHorizontal: 5,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    minHeight: 90,
    justifyContent: 'center',
    elevation: 3,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(0, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 9,
    color: 'rgba(0, 255, 255, 0.7)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  editButton: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  editButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  modalContentWide: {
    width: '90%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  unitToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
  },
  unitText: {
    color: '#fff',
    fontSize: 16,
    marginHorizontal: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 18,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#00ffff',
  },
  disabledButton: {
    backgroundColor: '#00ffff50',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  optionCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedOptionCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderColor: '#00ffff',
  },
  optionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  selectedOptionLabel: {
    color: '#00ffff',
  },
  optionDescription: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  selectedOptionDescription: {
    color: '#fff',
  },
  // Profile Theme Button Styles
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  themePreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  themeButtonTextBlock: {
    flex: 1,
  },
  themeButtonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  themeButtonSubtitle: {
    color: '#00ffff',
    fontSize: 13,
    marginTop: 2,
  },
  // Profile Theme Modal Styles
  themeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  themeModalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    height: '85%',
    maxHeight: 700,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  themeModalScrollView: {
    flex: 1,
    minHeight: 0,
  },
  themeModalScrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  themeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexShrink: 0,
  },
  themeModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  themeModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeModalSubtitle: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  themeOptionsGrid: {
    gap: 10, // Reduced gap for tighter spacing
  },
  themeOption: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden', // Ensure image backgrounds are clipped to border radius
    minHeight: 60, // Reduced height for slimmer cards
  },
  themeOptionSelected: {
    borderColor: '#00ffff',
  },
  themeOptionName: {
    color: '#fff',
    fontSize: 15, // Slightly smaller font for slimmer appearance
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  themeOptionCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  themeOptionImageBackground: {
    width: '100%',
    minHeight: 60, // Fixed height to match themeOption minHeight
    maxHeight: 60, // Prevent infinite expansion
  },
  themeOptionImageStyle: {
    borderRadius: 14,
  },
  themeOptionContent: {
    flex: 1,
    width: '100%',
    padding: 12, // Reduced padding for slimmer cards
    minHeight: 60,
  },
  themeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  themeOptionLocked: {
    opacity: 0.6,
  },
  themeLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  themeCostText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sparksBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    gap: 8,
  },
  sparksBalanceText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  customBackgroundInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    gap: 12,
  },
  customBackgroundInfoText: {
    flex: 1,
  },
  customBackgroundInfoTitle: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  customBackgroundInfoSubtitle: {
    color: '#999',
    fontSize: 13,
    lineHeight: 18,
  },
  customBackgroundInfoButton: {
    padding: 8,
  },
  goToStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    gap: 12,
  },
  goToStoreButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  emptyThemesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyThemesText: {
    color: '#999',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyThemesSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  themeSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  raritySection: {
    marginTop: 24,
    marginBottom: 8,
  },
  raritySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  raritySectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  raritySectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  raritySectionCount: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  themeOptionLocked: {
    opacity: 0.6,
  },
  earnSparksButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  earnSparksText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#00ffff',
    width: '100%',
  },
  settingsButtonText: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  bmiValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
  bmiCategory: {
    color: '#fff',
    fontSize: 14,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  editContainer: {
    padding: 15,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  profileSection: {
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileValue: {
    fontSize: 16,
    color: '#fff',
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  bioSection: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    position: 'relative',
  },
  bioText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
    paddingRight: 40,
  },
  editBioButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignSelf: 'flex-start',
  },
  premiumText: {
    color: '#FFD700',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  username: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
    marginBottom: 2,
    alignSelf: 'center',
    letterSpacing: 0.5,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 85, 0.08)',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#ff0055',
    width: '100%',
  },
  adminButtonText: {
    color: '#ff0055',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  musicIntegrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#00ffff',
    width: '100%',
  },
  musicIntegrationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  musicIntegrationButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  musicIntegrationButtonTextBlock: {
    flex: 1,
  },
  musicIntegrationButtonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  musicIntegrationButtonSubtitle: {
    color: '#f8fafc',
    fontSize: 13,
    marginTop: 4,
  },
  musicModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  musicModalCard: {
    backgroundColor: 'rgba(10, 23, 42, 0.96)',
    borderRadius: 22,
    padding: 24,
    width: '95%',
    maxWidth: 420,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  musicModalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicModalScroll: {
    marginTop: 8,
  },
  musicModalContent: {
    paddingBottom: 12,
    gap: 14,
  },
  musicModalHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  musicModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  musicModalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    marginHorizontal: 8,
  },
  musicModalInfo: {
    fontSize: 13,
    color: '#cbd5f5',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  spotifyCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(5, 16, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    overflow: 'hidden',
    padding: 20,
    gap: 18,
  },
  spotifyLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spotifyBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  spotifyHeadline: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  spotifyDescription: {
    color: '#cbd5f5',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 15,
  },
  spotifyPerksGrid: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  spotifyPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 118, 180, 0.18)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  spotifyPerkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyPerkLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  spotifyButtonRow: {
    alignItems: 'center',
  },
  successMessage: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  helperText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    textAlign: 'center',
  },
  // HealthKit Button Styles
  healthKitButton: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 16,
    marginBottom: 12,
  },
  healthKitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthKitButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ff0055',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthKitButtonTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  healthKitButtonTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  healthKitButtonSubtitle: {
    color: '#1e293b',
    fontSize: 13,
    marginTop: 4,
  },
  // HealthKit Modal Styles
  healthKitModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  healthKitModalCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  healthKitModalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthKitModalScroll: {
    marginTop: 6,
  },
  healthKitModalContent: {
    paddingBottom: 10,
    gap: 20,
  },
  healthKitModalHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  badgeSection: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  viewAllBadgesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  viewAllBadgesText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  healthKitIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  healthKitModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  healthKitModalSubtitle: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  // Health Stats Grid
  healthStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  healthStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  healthStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  healthStatLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  healthKitPlaceholderNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  healthKitPlaceholderText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  
  // ====================================
  // APPLE WORKOUTS IMPORT STYLES
  // ====================================
  appleWorkoutsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  appleWorkoutsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  appleWorkoutsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  appleWorkoutsSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  noWorkoutsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 12,
  },
  noWorkoutsText: {
    fontSize: 13,
    color: '#64748b',
  },
  appleWorkoutsList: {
    gap: 10,
  },
  appleWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  appleWorkoutCardUploading: {
    opacity: 0.6,
    backgroundColor: '#f0fdfa',
  },
  appleWorkoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appleWorkoutInfo: {
    flex: 1,
  },
  appleWorkoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  appleWorkoutDetails: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 2,
  },
  appleWorkoutDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  appleWorkoutAction: {
    paddingLeft: 10,
  },
  moreWorkoutsText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
  },
  // Load More Button for pagination
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    gap: 8,
  },
  loadMoreText: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Load/Export Button for Apple Health
  loadExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00bcd4',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  loadExportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Export to Apple Health Section Styles
  exportSection: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  exportSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exportHeaderText: {
    flex: 1,
  },
  exportSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  exportSectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  exportLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00bcd4',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  exportLoadButtonDisabled: {
    backgroundColor: '#1e3a5f',
  },
  exportLoadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  exportWorkoutsList: {
    marginTop: 16,
  },
  exportListHeader: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  exportWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  exportWorkoutCardExporting: {
    opacity: 0.6,
  },
  exportWorkoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exportWorkoutInfo: {
    flex: 1,
  },
  exportWorkoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  exportWorkoutDetails: {
    fontSize: 13,
    color: '#00ffff',
    marginBottom: 2,
  },
  exportWorkoutDate: {
    fontSize: 12,
    color: '#64748b',
  },
  exportWorkoutAction: {
    marginLeft: 8,
  },
  exportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00ffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  exportEmptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  // Custom Background Styles
  backgroundImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    opacity: 0.4, // Moderate opacity for rotating theme images
  },
  backgroundImageStyleFullOpacity: {
    opacity: 1.0, // Full opacity for custom backgrounds (original colors)
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dark overlay to reduce brightness and improve text readability (only for rotating themes)
  },
  scrollViewWithBackground: {
    backgroundColor: 'transparent',
  },
  uploadBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd700',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 10,
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  uploadBackgroundButtonDisabled: {
    opacity: 0.6,
  },
  uploadBackgroundButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backgroundsList: {
    marginTop: 8,
  },
  backgroundsListTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  backgroundItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backgroundItemImage: {
    width: 100,
    height: 120,
    backgroundColor: '#333',
  },
  backgroundItemContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  backgroundItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backgroundItemDate: {
    color: '#aaa',
    fontSize: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
  },
  backgroundItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  backgroundActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  backgroundActionButtonDanger: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: '#ff4444',
  },
  backgroundActionButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
  },
  backgroundActionButtonTextDanger: {
    color: '#ff4444',
  },
  emptyBackgroundsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyBackgroundsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyBackgroundsSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});


export default ProfileScreen; 