import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { AppState } from 'react-native';
import { useNotifications } from './NotificationContext';
import { useSharedMessageLimit } from './SharedMessageLimitContext';

// Create context with default values
const TrackingContext = createContext({
  calories: { consumed: 0, goal: 2000 },
  water: { consumed: 0, goal: 2.0 },
      protein: { consumed: 0, goal: 100 },
  mood: 'neutral',
  stats: {
    workouts: 0,
    minutes: 0,
    mental_sessions: 0,
    prs_this_month: 0,
    streak: 0,
    today_workout_completed: false,
    today_mental_completed: false
  },
  sleep: null,
  addCalories: async () => {},
  addWater: async () => {},
  addProtein: async () => {},
  addCarbs: async () => {},
  addFat: async () => {},
  logSleep: async () => false,
  updateMood: async () => {},
  updateGoal: async () => {},
  updateStats: async () => {},
  incrementStat: async () => {},
  setMood: () => {},
  setProtein: () => {}
});

export const TrackingProvider = ({ children }) => {
  const { user, profile } = useAuth();
  const { createNotification } = useNotifications();
  const { forceRefreshMessageCount } = useSharedMessageLimit();
  const [isMounted, setIsMounted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [calories, setCalories] = useState({
    consumed: 0,
    goal: 2000
  });
  
  const [water, setWater] = useState({
    consumed: 0,
    goal: 2.0
  });

  const [protein, setProtein] = useState({
    consumed: 0,
    goal: 100
  });

  const [sleep, setSleep] = useState(null); // { date, bedtime, waketime, duration_minutes, quality } for "last night"

  const [mood, setMood] = useState('neutral');
  const [stats, setStats] = useState({
    workouts: 0,
    minutes: 0,
    mental_sessions: 0,
    prs_this_month: 0,
    streak: 0,
    today_workout_completed: false,
    today_mental_completed: false
  });

  const [trackingData, setTrackingData] = useState({
    workouts: [],
    exercises: [],
    currentWorkout: null,
    currentExercise: null,
    workoutHistory: [],
    exerciseHistory: [],
    personalRecords: [],
    workoutStats: {},
    exerciseStats: {},
    isLoading: true,
    error: null
  });

  const [initializationError, setInitializationError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastResetDate, setLastResetDate] = useState(null);

  // Add retry logic for network requests
  const fetchWithRetry = async (operation, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  // Load initial stats and streak on profile load
  useEffect(() => {
    const loadInitialStats = async () => {
      if (!profile?.profile_id) return;
      
      try {
        setIsLoading(true);
        console.log('[TrackingContext] Loading initial stats for profile:', profile.profile_id);

        // Fetch user_stats with retry
        const { data: statsData, error: statsError } = await fetchWithRetry(() => 
          supabase
            .from('user_stats')
            .select('*')
            .eq('profile_id', profile.profile_id)
            .maybeSingle()
        );

        if (statsError) {
          console.error('Error fetching user stats:', statsError);
          return;
        }

        if (statsData) {
          console.log('[TrackingContext] Loaded user stats:', statsData);
          setStats(prev => ({
            ...prev,
            ...statsData,
            streak: prev.streak // Keep current streak until we fetch it
          }));
        }

        // Fetch streak with retry
        const { data: streakData, error: streakError } = await fetchWithRetry(() => 
          supabase
            .from('betteru_streaks')
            .select('*')
            .eq('profile_id', profile.profile_id)
            .maybeSingle()
        );

        if (streakError) {
          console.error('Error fetching streak:', streakError);
          return;
        }

        if (streakData) {
          console.log('[TrackingContext] Loaded streak data:', streakData);
          setStats(prev => ({
            ...prev,
            streak: streakData.current_streak || 0
          }));
        }
      } catch (error) {
        console.error('Error loading initial stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialStats();
  }, [profile?.profile_id]);

  // Safe state update function
  const safeSetState = (setter, value) => {
    if (isMounted) {
      setter(value);
    }
  };

  // Safe AsyncStorage operations
  const safeAsyncStorage = async (operation) => {
    try {
      return await operation();
    } catch (error) {
      console.error('AsyncStorage operation failed:', error);
      return null;
    }
  };

  // Safe Supabase operations with retry
  const safeSupabase = async (operation) => {
    try {
      return await fetchWithRetry(operation);
    } catch (error) {
      console.error('Supabase operation failed:', error);
      return { data: null, error };
    }
  };

  // Helper to get profile_id for the current user
  const getProfileId = async () => {
    console.log('[getProfileId] profile from AuthContext:', profile);
    if (profile?.id) return profile.id;
    console.log('No profile found in AuthContext');
    return null;
  };

  // Safe database operation wrapper with retry
  const safeDbOperation = async (operation) => {
    const profileId = await getProfileId();
    if (!profileId) {
      console.log('No profile ID found, skipping database operation');
      return { data: null, error: null };
    }
    try {
      return await fetchWithRetry(() => operation(profileId));
    } catch (error) {
      console.error('Error in database operation:', error);
      return { data: null, error };
    }
  };

  // Load saved data on mount
  useEffect(() => {
    setIsMounted(true);
    let retryTimeout;

    const loadSavedData = async () => {
      if (!profile?.id) {
        console.log('[TrackingContext] Profile not loaded yet, skipping loadSavedData');
        return;
      }
      try {
        console.log('[TrackingContext] Starting to load data for profile:', profile.id);
        setIsLoading(true);

        const today = new Date();
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 0, 0); // Reset at 11:59 PM instead of midnight
        // Use LOCAL time, not UTC (fixes 7pm reset bug)
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        console.log('[TrackingContext] Loading saved data for profile:', profile.id);
        console.log('[TrackingContext] Today\'s date:', todayStr);

        // Check if we need to reset based on last reset date
        const lastResetDate = await safeAsyncStorage(() => 
          AsyncStorage.getItem('lastResetDate')
        );

        if (lastResetDate) {
          const lastReset = new Date(lastResetDate);
          lastReset.setHours(23, 59, 0, 0);
          
          // If last reset was before today's 11:59 PM in user's timezone, reset everything
          if (lastReset.getTime() < todayEnd.getTime()) {
            console.log('[TrackingContext] Resetting daily data for new day');
            
            // Reset completion status in Supabase
            const { error } = await supabase
              .from('profiles')
              .update({
                today_workout_completed: false,
                today_mental_completed: false,
                daily_workouts_generated: 0,
                last_reset_date: todayStr
              })
              .eq('profile_id', profile.id);

            if (error) {
              console.error('[TrackingContext] Error resetting completion status:', error);
            }

            // Save reset date
            await safeAsyncStorage(() => 
              AsyncStorage.setItem('lastResetDate', todayEnd.toISOString())
            );

            // Reset calories and water in Supabase, but keep goals
            const { error: calorieError } = await supabase
              .from('calorie_tracking')
              .update({
                consumed: 0,
                updated_at: new Date().toISOString()
              })
              .eq('profile_id', profile.id)
              .eq('date', todayStr);

            if (calorieError) {
              console.error('[TrackingContext] Error resetting calories:', calorieError);
            }

            const { error: waterError } = await supabase
              .from('water_tracking')
              .update({
                glasses: 0,
                updated_at: new Date().toISOString()
              })
              .eq('profile_id', profile.id)
              .eq('date', todayStr);

            if (waterError) {
              console.error('[TrackingContext] Error resetting water:', waterError);
            }

            // Reset local state but keep goals
            setCalories(prev => ({ ...prev, consumed: 0 }));
            setWater(prev => ({ ...prev, consumed: 0 }));

            // Reset AI message count for new day
            await safeAsyncStorage(() => 
              AsyncStorage.setItem('sharedMessageCount', '0')
            );
            await safeAsyncStorage(() => 
              AsyncStorage.setItem('sharedMessageCountDate', todayStr)
            );
            console.log('[TrackingContext] Reset AI message count for new day');
          }
        } else {
          // First time setup - save today as last reset date
          await safeAsyncStorage(() => 
            AsyncStorage.setItem('lastResetDate', todayEnd.toISOString())
          );
        }

        // Load mood from AsyncStorage
        const savedMood = await safeAsyncStorage(() => 
          AsyncStorage.getItem('mood')
        );
        if (savedMood) {
          setMood(savedMood);
        }

        // Load protein from AsyncStorage
        const savedProtein = await safeAsyncStorage(() => 
          AsyncStorage.getItem('protein')
        );
        if (savedProtein) {
          setProtein(JSON.parse(savedProtein));
        }

        // Load stats from AsyncStorage
        const savedStats = await safeAsyncStorage(() => 
          AsyncStorage.getItem('stats')
        );
        if (savedStats) {
          setStats(JSON.parse(savedStats));
        }

        console.log('[TrackingContext] Finished loading saved data for profile:', profile.id);
        setIsLoading(false);
      } catch (error) {
        console.error('[TrackingContext] Error loading saved data:', error);
        setIsLoading(false);
      }
    };

    loadSavedData();

    return () => {
      setIsMounted(false);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [profile?.id]);

  // Define checkMidnightReset function outside useEffect for proper scope
  const checkMidnightReset = async () => {
    try {
      if (!user?.id || !profile?.profile_id) return;

      const now = new Date();
      // Calculate TODAY's 11:59 PM in user's local timezone (reset point)
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 0, 0);
      
      // Get the last reset date from AsyncStorage
      const storedLastResetDate = await safeAsyncStorage(() => 
        AsyncStorage.getItem('lastResetDate')
      );

      if (storedLastResetDate) {
        const lastReset = new Date(storedLastResetDate);
        lastReset.setHours(23, 59, 0, 0);
        
        // If last reset was before TODAY's 11:59 PM in user's timezone, reset everything
        // This ensures we only reset once per day, not multiple times
        if (lastReset.getTime() < todayEnd.getTime()) {
          console.log('[TrackingContext] 11:59 PM detected - Resetting daily tracking data for new day');
          
          // Delete ALL calorie tracking rows for this user
          console.log('[TrackingContext] Attempting to delete calorie tracking rows for profile_id:', profile.profile_id);
          const { data: calorieData, error: calorieDeleteError } = await supabase
            .from('calorie_tracking')
            .delete()
            .eq('profile_id', profile.profile_id)
            .select();

          if (calorieDeleteError) {
            console.error('[TrackingContext] Error deleting calorie tracking rows:', calorieDeleteError);
          } else {
            console.log('[TrackingContext] Successfully deleted calorie tracking rows:', calorieData);
          }

          // Delete ALL water tracking rows for this user
          console.log('[TrackingContext] Attempting to delete water tracking rows for profile_id:', profile.profile_id);
          const { data: waterData, error: waterDeleteError } = await supabase
            .from('water_tracking')
            .delete()
            .eq('profile_id', profile.profile_id)
            .select();

          if (waterDeleteError) {
            console.error('[TrackingContext] Error deleting water tracking rows:', waterDeleteError);
          } else {
            console.log('[TrackingContext] Successfully deleted water tracking rows:', waterData);
          }

          // Delete ALL daily macronutrient rows for this user
          console.log('[TrackingContext] Attempting to delete daily macronutrients for user_id:', profile.id);
          const { data: macroData, error: macroDeleteError } = await supabase
            .from('daily_macronutrients')
            .delete()
            .eq('user_id', profile.id)
            .select();

          if (macroDeleteError) {
            console.error('[TrackingContext] Error deleting daily macronutrient rows:', macroDeleteError);
          } else {
            console.log('[TrackingContext] Successfully deleted daily macronutrients:', macroData);
          }

          // Reset completion status in user_stats table
          const { error: statsError } = await supabase
            .from('user_stats')
            .update({
              today_workout_completed: false,
              today_mental_completed: false,
              daily_workouts_generated: 0,
              last_reset_date: todayEnd.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('profile_id', profile.profile_id);

          if (statsError) {
            console.error('[TrackingContext] Error resetting completion status:', statsError);
          } else {
            console.log('[TrackingContext] Successfully reset completion status in user_stats');
          }

          // Save reset date to AsyncStorage (use today's 11:59 PM)
          await safeAsyncStorage(() => 
            AsyncStorage.setItem('lastResetDate', todayEnd.toISOString())
          );

                // Reset local state but keep goals
      setCalories(prev => ({ ...prev, consumed: 0 }));
      setWater(prev => ({ ...prev, consumed: 0 }));
      setProtein(prev => ({ ...prev, consumed: 0 }));
      
      // Save the reset state to AsyncStorage to preserve goals
      await safeAsyncStorage(() => {
        AsyncStorage.setItem('calories', JSON.stringify({ ...calories, consumed: 0 }));
        AsyncStorage.setItem('water', JSON.stringify({ ...water, consumed: 0 }));
        AsyncStorage.setItem('protein', JSON.stringify({ ...protein, consumed: 0 }));
      });
          
          // Reset stats completion status
          setStats(prev => ({
            ...prev,
            today_workout_completed: false,
            today_mental_completed: false
          }));

          // Reset shared message count for AI assistants
          await forceRefreshMessageCount();

          // Also reset protein in AsyncStorage
          await safeAsyncStorage(() => 
            AsyncStorage.setItem('protein', JSON.stringify({
              consumed: 0,
              goal: protein.goal || 100
            }))
          );

          // Add a small delay to ensure database operations complete
          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log('[TrackingContext] Daily reset at 11:59 PM completed successfully');
        }
      } else {
        // First time setup - save today as last reset date
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('lastResetDate', todayEnd.toISOString())
        );
        console.log('[TrackingContext] First time setup - saved reset date');
      }
    } catch (error) {
      console.error('[TrackingContext] Error in daily reset:', error);
    }
  };

  // Check for 11:59 PM reset and set up interval
  useEffect(() => {
    if (!user?.id || !profile?.profile_id) {
      console.log('[TrackingContext] User or profile not loaded, skipping checkMidnightReset');
      return;
    }

    let interval;

    // Check for reset every minute to ensure we catch 11:59 PM
    interval = setInterval(checkMidnightReset, 60000);
    checkMidnightReset(); // Initial check

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user, profile?.profile_id, calories.goal, water.goal]);

  // Monitor app state changes to check for midnight reset when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('[TrackingContext] App became active, checking for 11:59 PM reset');
          checkMidnightReset();
        }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user, profile?.profile_id]);

  // Real-time subscription to daily_macronutrients table for protein tracking
  useEffect(() => {
    if (!user?.id || !profile?.id) return;

    console.log('[TrackingContext] Setting up real-time subscription for daily_macronutrients');
    
    const subscription = supabase
      .channel('daily_macronutrients_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_macronutrients',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('[TrackingContext] Daily macronutrients changed:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRecord = payload.new;
            const today = getTodayString();
            
            // Only update if it's for today
            if (newRecord.date === today) {
              console.log('[TrackingContext] Updating protein tracker with new value:', newRecord.protein);
              setProtein(prev => ({
                ...prev,
                consumed: newRecord.protein || 0
              }));
            }
          } else if (payload.eventType === 'DELETE') {
            // If record is deleted, reset protein consumed
            console.log('[TrackingContext] Daily macronutrients record deleted, resetting protein');
            setProtein(prev => ({
              ...prev,
              consumed: 0
            }));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[TrackingContext] Cleaning up daily_macronutrients subscription');
      subscription.unsubscribe();
    };
  }, [user?.id, profile?.id]);

  // Add this effect to load data when profile changes
  useEffect(() => {
    if (profile?.id) {
      console.log('[TrackingContext] Profile changed, loading data for:', profile.id);
      loadTrackingData();
    }
  }, [profile?.id]);

  const loadTrackingData = async () => {
    if (!user?.id || !profile?.id) {
      console.log('[TrackingContext] No user or profile ID available');
      return;
    }

    // Skip loading if this is a recovery/password reset session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.recovery_sent_at) {
        const recoveryTime = new Date(session.user.recovery_sent_at);
        const now = new Date();
        const timeDiff = now - recoveryTime;
        // If recovery was sent within the last hour, it's likely a password reset session
        if (timeDiff < 3600000) { // 1 hour in milliseconds
          console.log('[TrackingContext] Skipping data load - recovery session detected');
          return;
        }
      }
    } catch (error) {
      // Continue if check fails
    }

    try {
      console.log('[TrackingContext] Starting to load tracking data for profile:', profile.id);
      const today = getTodayString(); // Use local time helper
      
      // Load saved goals from AsyncStorage first
      const savedCalories = await AsyncStorage.getItem('calories');
      const savedWater = await AsyncStorage.getItem('water');
      const savedProtein = await AsyncStorage.getItem('protein');
      
      let calorieGoal = 2000; // Default
      let waterGoal = 2.0; // Default
      let proteinGoal = 100; // Default
      
      if (savedCalories) {
        try {
          const parsed = JSON.parse(savedCalories);
          calorieGoal = parsed.goal || 2000;
          console.log('[TrackingContext] Loaded calorie goal from AsyncStorage:', calorieGoal);
        } catch (e) {
          console.error('[TrackingContext] Error parsing saved calories:', e);
        }
      } else {
        console.log('[TrackingContext] No saved calorie goal found, using default:', calorieGoal);
      }
      
      if (savedWater) {
        try {
          const parsed = JSON.parse(savedWater);
          waterGoal = parsed.goal || 2.0;
          console.log('[TrackingContext] Loaded water goal from AsyncStorage:', waterGoal);
        } catch (e) {
          console.error('[TrackingContext] Error parsing saved water:', e);
        }
      } else {
        console.log('[TrackingContext] No saved water goal found, using default:', waterGoal);
      }
      
      if (savedProtein) {
        try {
          const parsed = JSON.parse(savedProtein);
          proteinGoal = parsed.goal || 100;
          console.log('[TrackingContext] Loaded protein goal from AsyncStorage:', proteinGoal);
        } catch (e) {
          console.error('[TrackingContext] Error parsing saved protein:', e);
        }
      } else {
        console.log('[TrackingContext] No saved protein goal found, using default:', proteinGoal);
      }

      // Try to fetch persisted goals from Supabase profile as authoritative source
      // If columns don't exist, we'll use the goals from AsyncStorage/defaults instead
      if (profile?.id) {
        try {
          const { data: profileGoals, error: profileGoalError } = await supabase
            .from('profiles')
            .select('calorie_goal, water_goal_ml, protein_goal')
            .eq('id', profile.id)
            .single();

          if (profileGoalError) {
            // If it's a column-not-found error (PGRST204), that's expected and we'll use AsyncStorage goals
            if (profileGoalError.code !== 'PGRST204') {
              console.warn('[TrackingContext] Error fetching profile goals (using AsyncStorage/defaults):', profileGoalError);
            }
          } else if (profileGoals) {
            // Only use Supabase values if they exist
            if (profileGoals.calorie_goal) {
              calorieGoal = profileGoals.calorie_goal;
            }
            if (profileGoals.water_goal_ml) {
              waterGoal = profileGoals.water_goal_ml / 1000;
            }
            if (profileGoals.protein_goal) {
              proteinGoal = profileGoals.protein_goal;
            }
          }
        } catch (fetchError) {
          // Handle any unexpected errors gracefully
          console.warn('[TrackingContext] Exception while fetching profile goals (using AsyncStorage/defaults):', fetchError);
        }
      }
      
      // Load calories from Supabase for today
      console.log('[loadTrackingData] Loading calories for profile_id:', profile.id, 'date:', today);
      const { data: calorieData, error: calorieError } = await supabase
        .from('calorie_tracking')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('date', today)
        .single();

      if (calorieError) {
        console.error('[TrackingContext] Error loading calorie data:', calorieError);
      } else {
        console.log('[TrackingContext] Loaded calorie data from Supabase:', calorieData);
        if (calorieData) {
          const newCalorieState = {
            consumed: calorieData.consumed || 0,
            goal: calorieGoal // Use saved goal, not Supabase goal
          };
          console.log('[TrackingContext] Setting calorie state to:', newCalorieState);
          setCalories(newCalorieState);
          await AsyncStorage.setItem('calories', JSON.stringify(newCalorieState));
        } else {
          // No calorie data for today, use saved goal
          const newCalorieState = {
            consumed: 0,
            goal: calorieGoal
          };
          console.log('[TrackingContext] No calorie data for today, using saved goal:', newCalorieState);
          setCalories(newCalorieState);
          await AsyncStorage.setItem('calories', JSON.stringify(newCalorieState));
        }
      }

      // Load water from Supabase for today
      console.log('[loadTrackingData] Loading water for profile_id:', profile.id, 'date:', today);
      const { data: waterData, error: waterError } = await supabase
        .from('water_tracking')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('date', today)
        .single();

      if (waterError) {
        console.error('[TrackingContext] Error loading water data:', waterError);
      } else {
        console.log('[TrackingContext] Loaded water data from Supabase:', waterData);
        if (waterData) {
          const newWaterState = {
            consumed: waterData.glasses * 250, // Convert glasses to ml
            goal: waterGoal // Use saved goal, not Supabase goal
          };
          console.log('[TrackingContext] Setting water state to:', newWaterState);
          setWater(newWaterState);
          await AsyncStorage.setItem('water', JSON.stringify(newWaterState));
        } else {
          // No water data for today, use saved goal
          const newWaterState = {
            consumed: 0,
            goal: waterGoal
          };
          console.log('[TrackingContext] No water data for today, using saved goal:', newWaterState);
          setWater(newWaterState);
          await AsyncStorage.setItem('water', JSON.stringify(newWaterState));
        }
      }

      // Load protein from daily_macronutrients for today
      console.log('[loadTrackingData] Loading macros for user_id:', profile.id, 'date:', today);
      const { data: macroData, error: macroError } = await supabase
        .from('daily_macronutrients')
        .select('*')
        .eq('user_id', profile.id)
        .eq('date', today)
        .maybeSingle(); // Use maybeSingle instead of single to handle no rows

      if (macroError) {
        console.error('[TrackingContext] Error loading macro data:', macroError);
      } else {
        console.log('[TrackingContext] Loaded macro data from Supabase:', macroData);
        if (macroData) {
          const newProteinState = {
            consumed: macroData.protein || 0,
            goal: proteinGoal // Use saved goal, not default
          };
          console.log('[TrackingContext] Setting protein state to:', newProteinState);
          setProtein(newProteinState);
          await AsyncStorage.setItem('protein', JSON.stringify(newProteinState));
        } else {
          // No macro data exists yet for today - this is normal
          console.log('[TrackingContext] No macro data for today yet - using saved goal');
          const defaultProteinState = {
            consumed: 0,
            goal: proteinGoal
          };
          setProtein(defaultProteinState);
          await AsyncStorage.setItem('protein', JSON.stringify(defaultProteinState));
        }
      }

      // Load sleep for today (date = morning we woke up, so "last night's sleep")
      // Wrapped in try/catch so missing sleep_tracking table doesn't break other tracking load
      try {
        const { data: sleepData, error: sleepError } = await supabase
          .from('sleep_tracking')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('date', today)
          .maybeSingle();
        if (!sleepError && sleepData) {
          setSleep({
            date: sleepData.date,
            bedtime: sleepData.bedtime,
            waketime: sleepData.waketime,
            duration_minutes: sleepData.duration_minutes || 0,
            quality: sleepData.quality
          });
          await AsyncStorage.setItem('sleep', JSON.stringify(sleepData));
        } else {
          setSleep(null);
          await AsyncStorage.removeItem('sleep');
        }
      } catch (sleepLoadErr) {
        console.warn('[TrackingContext] Sleep load skipped (table may not exist yet):', sleepLoadErr?.message);
        setSleep(null);
      }

      // Load other tracking data from AsyncStorage
      const storedData = await AsyncStorage.getItem('trackingData');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setTrackingData(prev => ({
            ...prev,
            ...parsedData,
            isLoading: false
          }));
        } catch (parseError) {
          console.error('Error parsing tracking data:', parseError);
          await AsyncStorage.removeItem('trackingData');
        }
      }

      setIsInitialized(true);
      setTrackingData(prev => ({
        ...prev,
        isLoading: false
      }));
      
      console.log('[TrackingContext] Finished loading tracking data for profile:', profile.id);
    } catch (error) {
      console.error('[TrackingContext] Error in loadTrackingData:', error);
      setInitializationError(error);
      setTrackingData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      setIsInitialized(true);
    }
  };

  // Add a new effect to reload data when the app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('[TrackingContext] App came to foreground, reloading data');
        loadTrackingData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id, profile?.profile_id]);

  // Enhanced addCalories function with goal completion notification
  // This function allows both positive (add) and negative (remove) amounts
  // Negative amounts are used to subtract calories when user removes food entries
  const addCalories = async (amount) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TrackingContext.js:842',message:'addCalories called',data:{amount,type:typeof amount,currentConsumed:calories.consumed},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TrackingContext.js:847',message:'Validation check before',data:{amount,isZero:amount===0,isNegative:amount<0,isNull:amount==null,willFail:amount==null||amount===0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Allow negative amounts (for removal), but reject null/undefined/0
      // amount === 0 is not meaningful - you can't add or remove zero calories
      if (amount == null || amount === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TrackingContext.js:850',message:'Validation failed - invalid amount',data:{amount,reason:amount==null?'null/undefined':'zero'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.error('[addCalories] Invalid amount:', amount);
        return false;
      }

      // Calculate new consumed value, ensuring it doesn't go below 0
      // Math.max ensures consumed never becomes negative (e.g., if removing more than exists)
      const newConsumed = Math.max(0, calories.consumed + amount);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TrackingContext.js:853',message:'Calculated new consumed',data:{previousConsumed:calories.consumed,amount,newConsumed,wasClamped:newConsumed!==calories.consumed+amount},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const newCalories = { ...calories, consumed: newConsumed };
      
      // Update local state
      setCalories(newCalories);
      
      // Save to AsyncStorage
      await safeAsyncStorage(() => 
        AsyncStorage.setItem('calories', JSON.stringify(newCalories))
      );

      // Update Supabase
      const profileId = await getProfileId();
      if (profileId) {
        const today = getTodayString();
        const { error } = await supabase
          .from('calorie_tracking')
          .upsert({
            profile_id: profileId,
            date: today,
            consumed: newConsumed,
            goal: calories.goal,
            updated_at: new Date().toISOString()
          }, { onConflict: 'profile_id,date' });

        if (error) {
          console.error('[addCalories] Error updating Supabase:', error);
        }
      }

      // Check if goal was reached and create notification
      // Only trigger notification if we're ADDING calories (amount > 0) and goal was crossed
      if (amount > 0 && newConsumed >= calories.goal && calories.consumed < calories.goal) {
        console.log('[addCalories] 🎉 Goal reached! Creating notification...');
        console.log('[addCalories] Previous consumed:', calories.consumed, 'New consumed:', newConsumed, 'Goal:', calories.goal);
        
        const result = await createNotification({
          type: 'goal_completion',
          title: 'Calorie Goal Achieved! 🎉',
          message: `Congratulations! You've reached your daily calorie goal of ${calories.goal} calories!`,
          data: { goal_type: 'calories', value: newConsumed, goal: calories.goal },
          priority: 3
        });
        
        console.log('[addCalories] Notification created:', result);
      }

      // Log the operation (add or remove)
      const operation = amount > 0 ? 'Added' : 'Removed';
      console.log(`[addCalories] ${operation} calories:`, Math.abs(amount), 'New total:', newConsumed);
      return true;
    } catch (error) {
      console.error('[addCalories] Error:', error);
      return false;
    }
  };

  // Enhanced addWater function with goal completion notification
  // This function allows both positive (add) and negative (remove) amounts
  // Negative amounts are used to subtract water when user removes entries
  const addWater = async (amount) => {
    try {
      // Allow negative amounts (for removal), but reject null/undefined/0
      // amount === 0 is not meaningful - you can't add or remove zero water
      if (amount == null || amount === 0) {
        console.error('[addWater] Invalid amount:', amount);
        return false;
      }

      // Calculate new consumed value, ensuring it doesn't go below 0
      // Math.max ensures consumed never becomes negative (e.g., if removing more than exists)
      const newConsumed = Math.max(0, water.consumed + amount);
      const newWater = { ...water, consumed: newConsumed };
      
      // Update local state
      setWater(newWater);
      
      // Save to AsyncStorage
      await safeAsyncStorage(() => 
        AsyncStorage.setItem('water', JSON.stringify(newWater))
      );

      // Update Supabase
      const profileId = await getProfileId();
      if (profileId) {
        const today = getTodayString();
        const glasses = Math.round(newConsumed / 250); // Convert ml to glasses
        const { error } = await supabase
          .from('water_tracking')
          .upsert({
            profile_id: profileId,
            date: today,
            glasses: glasses,
            goal: water.goal,
            updated_at: new Date().toISOString()
          }, { onConflict: 'profile_id,date' });

        if (error) {
          console.error('[addWater] Error updating Supabase:', error);
        }
      }

      // Check if goal was reached and create notification
      // Only trigger notification if we're ADDING water (amount > 0) and goal was crossed
      if (amount > 0 && newConsumed >= (water.goal * 1000) && water.consumed < (water.goal * 1000)) {
        console.log('[addWater] 💧 Goal reached! Creating notification...');
        console.log('[addWater] Previous consumed:', water.consumed, 'New consumed:', newConsumed, 'Goal:', water.goal * 1000);
        
        const result = await createNotification({
          type: 'goal_completion',
          title: 'Hydration Goal Achieved! 💧',
          message: `Great job! You've reached your daily water goal of ${water.goal}L!`,
          data: { goal_type: 'water', value: newConsumed, goal: water.goal * 1000 },
          priority: 3
        });
        
        console.log('[addWater] Notification created:', result);
      }

      // Log the operation (add or remove)
      const operation = amount > 0 ? 'Added' : 'Removed';
      console.log(`[addWater] ${operation} water:`, Math.abs(amount), 'ml. New total:', newConsumed, 'ml');
      return true;
    } catch (error) {
      console.error('[addWater] Error:', error);
      return false;
    }
  };

  // Enhanced addProtein function with goal completion notification
  // This function allows both positive (add) and negative (remove) amounts
  // Negative amounts are used to subtract protein when user removes entries
  const addProtein = async (amount) => {
    try {
      // Allow negative amounts (for removal), but reject null/undefined/0
      // amount === 0 is not meaningful - you can't add or remove zero protein
      if (amount == null || amount === 0) {
        console.error('[addProtein] Invalid amount:', amount);
        return false;
      }

      // Calculate new consumed value, ensuring it doesn't go below 0
      // Math.max ensures consumed never becomes negative (e.g., if removing more than exists)
      const newConsumed = Math.max(0, protein.consumed + amount);
      const newProtein = { ...protein, consumed: newConsumed };
      
      // Update local state
      setProtein(newProtein);
      
      // Save to AsyncStorage
      await safeAsyncStorage(() => 
        AsyncStorage.setItem('protein', JSON.stringify(newProtein))
      );

      // Update Supabase
      const profileId = await getProfileId();
      if (profileId) {
        const today = getTodayString();
        const { error } = await supabase
          .from('daily_macronutrients')
          .upsert({
            user_id: profileId,
            date: today,
            protein: newConsumed,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,date' });

        if (error) {
          console.error('[addProtein] Error updating Supabase:', error);
        }
      }

      // Check if goal was reached and create notification
      // Only trigger notification if we're ADDING protein (amount > 0) and goal was crossed
      if (amount > 0 && newConsumed >= protein.goal && protein.consumed < protein.goal) {
        console.log('[addProtein] 💪 Goal reached! Creating notification...');
        console.log('[addProtein] Previous consumed:', protein.consumed, 'New consumed:', newConsumed, 'Goal:', protein.goal);
        
        const result = await createNotification({
          type: 'goal_completion',
          title: 'Protein Goal Achieved! 💪',
          message: `Excellent! You've reached your daily protein goal of ${protein.goal}g!`,
          data: { goal_type: 'protein', value: newConsumed, goal: protein.goal },
          priority: 3
        });
        
        console.log('[addProtein] Notification created:', result);
      }

      // Log the operation (add or remove)
      const operation = amount > 0 ? 'Added' : 'Removed';
      console.log(`[addProtein] ${operation} protein:`, Math.abs(amount), 'g. New total:', newConsumed, 'g');
      return true;
    } catch (error) {
      console.error('[addProtein] Error:', error);
      return false;
    }
  };

  /**
   * Adjust carbs or fat on today's `daily_macronutrients` row (same source as the Nutrition screen).
   * Uses fetch → merge → update/insert so we never overwrite protein with a partial upsert by mistake.
   * @param {'carbs'|'fat'} column - which macro column to change
   * @param {number} amount - grams to add (positive) or remove (negative); zero is ignored
   */
  const adjustDailyMacroColumn = async (column, amount) => {
    try {
      if (amount == null || amount === 0) return false;
      if (column !== 'carbs' && column !== 'fat') return false;

      const profileId = await getProfileId();
      if (!profileId) return false;

      const today = getTodayString();
      const { data: existing, error: fetchError } = await supabase
        .from('daily_macronutrients')
        .select('*')
        .eq('user_id', profileId)
        .eq('date', today)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[adjustDailyMacroColumn] fetch:', fetchError);
        return false;
      }

      const current = Number(existing?.[column]) || 0;
      const next = Math.max(0, current + amount);

      if (existing) {
        const { error } = await supabase
          .from('daily_macronutrients')
          .update({ [column]: next, updated_at: new Date().toISOString() })
          .eq('user_id', profileId)
          .eq('date', today);
        if (error) {
          console.error('[adjustDailyMacroColumn] update:', error);
          return false;
        }
      } else {
        const row = {
          user_id: profileId,
          date: today,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0,
        };
        row[column] = next;
        const { error } = await supabase.from('daily_macronutrients').insert(row);
        if (error) {
          console.error('[adjustDailyMacroColumn] insert:', error);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('[adjustDailyMacroColumn]', error);
      return false;
    }
  };

  const addCarbs = async (amount) => adjustDailyMacroColumn('carbs', amount);
  const addFat = async (amount) => adjustDailyMacroColumn('fat', amount);

  // Persists sleep to Supabase sleep_tracking (same local calendar date as loadTrackingData uses).
  // Returns true only after DB + local state succeed so the UI can confirm or show an error.
  const logSleep = async ({ bedtime, waketime, duration_minutes, quality }) => {
    try {
      const profileId = await getProfileId();
      if (!profileId) {
        console.error('[TrackingContext] logSleep: no profile / not signed in');
        return false;
      }
      // Must match getTodayString() used when loading — UTC date here made saves "disappear" in non-UTC timezones.
      const dateStr = getTodayString();
      const payload = {
        profile_id: profileId,
        date: dateStr,
        bedtime: bedtime || null,
        waketime: waketime || null,
        duration_minutes: duration_minutes || 0,
        quality: quality ?? null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('sleep_tracking')
        .upsert(payload, { onConflict: 'profile_id,date' })
        .select()
        .single();
      if (error) {
        console.error('[TrackingContext] logSleep error:', error);
        return false;
      }
      setSleep({
        date: data.date,
        bedtime: data.bedtime,
        waketime: data.waketime,
        duration_minutes: data.duration_minutes || 0,
        quality: data.quality
      });
      await AsyncStorage.setItem('sleep', JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('[TrackingContext] logSleep exception:', err);
      return false;
    }
  };

  const updateGoal = async (type, amount) => {
    try {
      // Validate inputs
      if (!type || (type !== 'calories' && type !== 'water' && type !== 'protein')) {
        throw new Error('Invalid goal type');
      }
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Invalid goal amount');
      }

      // Update state and AsyncStorage
      if (type === 'calories') {
        const newCalories = { ...calories, goal: amount };
        setCalories(newCalories);
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('calories', JSON.stringify(newCalories))
        );
        console.log('[updateGoal] Updated calories goal:', amount);
        console.log('[updateGoal] Saved to AsyncStorage:', JSON.stringify(newCalories));
      } else if (type === 'water') {
        const newWater = { ...water, goal: amount };
        setWater(newWater);
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('water', JSON.stringify(newWater))
        );
        console.log('[updateGoal] Updated water goal:', amount);
        console.log('[updateGoal] Saved to AsyncStorage:', JSON.stringify(newWater));
      } else if (type === 'protein') {
        const newProtein = { ...protein, goal: amount };
        setProtein(newProtein);
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('protein', JSON.stringify(newProtein))
        );
        console.log('[updateGoal] Updated protein goal:', amount);
        console.log('[updateGoal] Saved to AsyncStorage:', JSON.stringify(newProtein));
      }

      // Try to persist goal to Supabase profile so values survive reinstall/device change
      // Note: If columns don't exist in the profiles table, this will fail gracefully
      // The goal is already saved to AsyncStorage above, which is what matters for daily use
      const profileId = await getProfileId();
      if (profileId) {
        const profileUpdates = {};
        if (type === 'calories') {
          profileUpdates.calorie_goal = Math.round(amount);
        } else if (type === 'water') {
          profileUpdates.water_goal_ml = Math.round(amount * 1000);
        } else if (type === 'protein') {
          profileUpdates.protein_goal = Math.round(amount);
        }

        if (Object.keys(profileUpdates).length > 0) {
          try {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                ...profileUpdates,
                updated_at: new Date().toISOString(),
              })
              .eq('id', profileId);

            if (profileError) {
              // Check if it's a column-not-found error (PGRST204)
              // If so, just log a warning since goals are already saved to AsyncStorage
              if (profileError.code === 'PGRST204') {
                console.warn(`[updateGoal] Goal column doesn't exist in profiles table yet (${Object.keys(profileUpdates)[0]}). Goal saved to AsyncStorage only.`);
              } else {
                // For other errors, log as error but don't fail the operation
                console.error('[updateGoal] Error persisting goal to profiles table:', profileError);
              }
            } else {
              console.log('[updateGoal] Synced goal to Supabase:', profileUpdates);
            }
          } catch (supabaseError) {
            // Catch any unexpected errors and log them, but don't fail the operation
            // The goal is already saved to AsyncStorage, which is the primary storage
            console.warn('[updateGoal] Exception while persisting to Supabase (goal saved to AsyncStorage):', supabaseError);
          }
        }
      }

      return true; // Return success - goals are saved to AsyncStorage regardless of Supabase result
    } catch (error) {
      console.error('[updateGoal] Error:', error);
      // Revert the state if there's an error
      if (type === 'calories') {
        setCalories(calories);
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('calories', JSON.stringify(calories))
        );
      } else if (type === 'water') {
        setWater(water);
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('water', JSON.stringify(water))
        );
      } else if (type === 'protein') {
        setProtein(protein);
        await safeAsyncStorage(() => 
          AsyncStorage.setItem('protein', JSON.stringify(protein))
        );
      }
      throw new Error(`Failed to update ${type} goal: ${error.message}`);
    }
  };

  const updateMood = async (newMood) => {
    try {
      setMood(newMood);
      await AsyncStorage.setItem('mood', newMood);

      // Update mental completion in stats
      await updateStats({
        today_mental_completed: true
      });

    } catch (error) {
      console.error('Error updating mood:', error);
    }
  };

  const updateStats = async (updates) => {
    try {
      const profileId = await getProfileId();
      if (!profileId) {
        console.error('No profile ID found');
        return;
      }

      // First get current stats
      const { data: currentStats, error: fetchError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('profile_id', profileId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching current stats:', fetchError);
        return;
      }

      // Prepare updates
      const newStats = {
        profile_id: profileId,
        ...currentStats,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('user_stats')
        .upsert(newStats, {
          onConflict: 'profile_id'
        });

      if (updateError) {
        console.error('Error updating stats:', updateError);
        return;
      }

      // Update local state
      setStats(prev => ({
        ...prev,
        ...updates
      }));

      // Also update AsyncStorage
      const currentLocalStats = await AsyncStorage.getItem('stats');
      const localStats = currentLocalStats ? JSON.parse(currentLocalStats) : {};
      const newLocalStats = {
        ...localStats,
        ...updates
      };
      await AsyncStorage.setItem('stats', JSON.stringify(newLocalStats));

    } catch (error) {
      console.error('Error in updateStats:', error);
    }
  };

  // Helper to get today's date string in LOCAL time (not UTC)
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Function to sync protein tracker with database
  const syncProteinTracker = async () => {
    try {
      if (!user?.id) return;

      const today = getTodayString();
      console.log('[TrackingContext] Syncing protein tracker with database for date:', today);

      const { data: macroData, error: macroError } = await supabase
        .from('daily_macronutrients')
        .select('protein')
        .eq('user_id', profile.id)
        .eq('date', today)
        .single();

      if (macroError && macroError.code !== 'PGRST116') {
        console.error('[TrackingContext] Error syncing protein tracker:', macroError);
        return;
      }

      const newProteinValue = macroData?.protein || 0;
      console.log('[TrackingContext] Syncing protein tracker to:', newProteinValue);
      
      setProtein(prev => ({
        ...prev,
        consumed: newProteinValue
      }));

      // Also update AsyncStorage
      await safeAsyncStorage(() => 
        AsyncStorage.setItem('protein', JSON.stringify({
          ...protein,
          consumed: newProteinValue
        }))
      );
    } catch (error) {
      console.error('[TrackingContext] Error in syncProteinTracker:', error);
    }
  };

  // Fetch streak from Supabase and update state
  const fetchStreak = async () => {
    const profileId = await getProfileId();
    if (!profileId) return;
    const { data: streakData, error } = await supabase
      .from('betteru_streaks')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (!error && streakData) {
      safeSetState(setStats, prev => ({ ...prev, streak: streakData.current_streak || 0 }));
      console.log('[fetchStreak] Updated streak from Supabase:', streakData);
    } else if (error) {
      console.error('[fetchStreak] Error fetching streak:', error);
    }
  };

  // Call fetchStreak on mount and when profile changes
  useEffect(() => {
    if (profile?.profile_id) {
      fetchStreak();
    }
  }, [profile?.profile_id]);

  // Robust incrementStat for streak
  const incrementStat = async (statName, amount = 1) => {
    try {
      const currentStats = await AsyncStorage.getItem('stats');
      const stats = currentStats ? JSON.parse(currentStats) : {
        workouts: 0,
        minutes: 0,
        calories: 0,
        water: 0,
        today_workout_completed: false
      };

      stats[statName] = (stats[statName] || 0) + amount;
      await AsyncStorage.setItem('stats', JSON.stringify(stats));
      setStats(stats);
    } catch (error) {
      console.error('Error incrementing stat:', error);
    }
  };

  const finishWorkout = async (workoutId, duration) => {
    try {
      const userId = await getProfileId();
      if (!userId) {
        console.log('[finishWorkout] No user ID found');
        return { success: false, error: 'No user ID found' };
      }

      // Update workout_logs
      const { data: logData, error: logError } = await supabase
        .from('user_workout_logs')
        .update({
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', workoutId)
        .select()
        .single();

      if (logError) {
        console.error('[finishWorkout] Error updating workout log:', logError);
        throw logError;
      }

      // Update stats in Supabase
      await updateStats({
        workouts: (stats.workouts || 0) + 1,
        minutes: (stats.minutes || 0) + Math.floor(duration / 60),
        today_workout_completed: true
      });

      return { success: true, data: { log: logData } };
    } catch (error) {
      console.error('[finishWorkout] Error:', error);
      return { success: false, error };
    }
  };

  // Debug function to check current state
  const debugGoals = async () => {
    try {
      const savedCalories = await AsyncStorage.getItem('calories');
      const savedWater = await AsyncStorage.getItem('water');
      const savedProtein = await AsyncStorage.getItem('protein');
      
      console.log('[TrackingContext] Debug - Current state:');
      console.log('  Calories state:', calories);
      console.log('  Water state:', water);
      console.log('  Protein state:', protein);
      console.log('[TrackingContext] Debug - AsyncStorage:');
      console.log('  Saved calories:', savedCalories);
      console.log('  Saved water:', savedWater);
      console.log('  Saved protein:', savedProtein);
    } catch (error) {
      console.error('[TrackingContext] Debug error:', error);
    }
  };

  return (
    <TrackingContext.Provider value={{
      calories,
      water,
      protein,
      sleep,
      mood,
      stats,
      trackingData,
      addCalories,
      addWater,
      addProtein,
      addCarbs,
      addFat,
      logSleep,
      updateMood,
      updateGoal,
      updateStats,
      incrementStat,
      setMood,
      setCalories,
      setWater,
      setProtein,
      setStats,
      syncProteinTracker,
      debugGoals
    }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
};

export const forceDailyReset = async (profile, calories, water, protein, setCalories, setWater, setStats) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const profileId = profile?.profile_id;
    const authUserId = profile?.id;
    console.log('[forceDailyReset] Forcing daily reset for profile:', profileId);
    console.log('[forceDailyReset] Auth user ID:', authUserId);
    console.log('[forceDailyReset] Profile object:', JSON.stringify(profile, null, 2));

    // Reset completion status in user_stats
    if (profileId) {
      const { error: statsError } = await supabase
        .from('user_stats')
        .update({
          today_workout_completed: false,
          today_mental_completed: false,
          daily_workouts_generated: 0,
          last_reset_date: todayStr,
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', profileId);

      if (statsError) {
        console.error('[forceDailyReset] Error resetting completion status:', statsError);
      }
    }

    // Delete ALL calorie tracking rows for this user
    if (profileId) {
      console.log('[forceDailyReset] Attempting to delete calorie tracking rows for profile_id:', profileId);
      const { data: calorieData, error: calorieError } = await supabase
        .from('calorie_tracking')
        .delete()
        .eq('profile_id', profileId)
        .select();

      if (calorieError) {
        console.error('[forceDailyReset] Error deleting calorie tracking rows:', calorieError);
      } else {
        console.log('[forceDailyReset] Successfully deleted calorie tracking rows:', calorieData);
      }
    }

    // Delete ALL water tracking rows for this user
    if (profileId) {
      console.log('[forceDailyReset] Attempting to delete water tracking rows for profile_id:', profileId);
      const { data: waterData, error: waterError } = await supabase
        .from('water_tracking')
        .delete()
        .eq('profile_id', profileId)
        .select();

      if (waterError) {
        console.error('[forceDailyReset] Error deleting water tracking rows:', waterError);
      } else {
        console.log('[forceDailyReset] Successfully deleted water tracking rows:', waterData);
      }
    }

    // Reset daily macronutrients in Supabase
    if (authUserId) {
      console.log('[forceDailyReset] Attempting to delete daily macronutrients for user_id:', authUserId);
      const { data: macroData, error: macroError } = await supabase
        .from('daily_macronutrients')
        .delete()
        .eq('user_id', authUserId)
        .select();

      if (macroError) {
        console.error('[forceDailyReset] Error resetting daily macronutrients:', macroError);
      } else {
        console.log('[forceDailyReset] Successfully deleted daily macronutrients:', macroData);
      }
    } else {
      console.error('[forceDailyReset] No auth user ID available for macros reset');
    }

    // Save reset date
    await AsyncStorage.setItem('lastResetDate', todayStr);

    // Reset calories and water in AsyncStorage
    const resetCalories = { consumed: 0, goal: calories?.goal || 2000 };
    const resetWater = { consumed: 0, goal: water?.goal || 2.0 };
    
    await AsyncStorage.setItem('calories', JSON.stringify(resetCalories));
    await AsyncStorage.setItem('water', JSON.stringify(resetWater));

    // Reset shared message count for AI assistants
    await AsyncStorage.setItem('sharedMessageCount', '0');
    await AsyncStorage.setItem('sharedMessageCountDate', todayStr.split('T')[0]);

    // Reset protein in AsyncStorage
    const currentProteinGoal = protein?.goal || 100;
    await AsyncStorage.setItem('protein', JSON.stringify({
      consumed: 0,
      goal: currentProteinGoal
    }));
    
    console.log('[forceDailyReset] Reset calories in AsyncStorage:', resetCalories);
    console.log('[forceDailyReset] Reset water in AsyncStorage:', resetWater);

    // Add a small delay to ensure database operations complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update local state
    if (typeof setCalories === 'function') setCalories(resetCalories);
    if (typeof setWater === 'function') setWater(resetWater);
    if (typeof setStats === 'function') setStats(prev => ({
      ...prev,
      today_workout_completed: false,
      today_mental_completed: false
    }));

    // Reload from Supabase and AsyncStorage to ensure UI is up to date
    if (profileId) {
      await reloadTrackingData(profileId, setCalories, setWater);
    }

    console.log('[forceDailyReset] Local state and AsyncStorage reset complete');
  } catch (error) {
    console.error('[forceDailyReset] Error:', error);
  }
};

const reloadTrackingData = async (profileId, setCalories, setWater) => {
  try {
    // Load saved goals from AsyncStorage first
    const savedCalories = await AsyncStorage.getItem('calories');
    const savedWater = await AsyncStorage.getItem('water');
    
    let calorieGoal = 2000; // Default
    let waterGoal = 2.0; // Default
    
  if (savedCalories) {
    try {
      const parsed = JSON.parse(savedCalories);
      calorieGoal = parsed.goal || 2000;
    } catch (e) {
      console.error('[reloadTrackingData] Error parsing saved calories:', e);
    }
  }
  
  if (savedWater) {
    try {
      const parsed = JSON.parse(savedWater);
      waterGoal = parsed.goal || 2.0;
    } catch (e) {
      console.error('[reloadTrackingData] Error parsing saved water:', e);
    }
  }
  
  // Try to fetch persisted goals from Supabase as fallback
  // If columns don't exist, we'll use the AsyncStorage goals we already loaded
  try {
    const { data: profileGoals, error: profileGoalError } = await supabase
      .from('profiles')
      .select('calorie_goal, water_goal_ml')
      .eq('id', profileId)
      .single();

    if (profileGoalError) {
      // If it's a column-not-found error (PGRST204), that's expected and we'll use AsyncStorage goals
      if (profileGoalError.code !== 'PGRST204') {
        console.warn('[reloadTrackingData] Error fetching profile goals (using AsyncStorage):', profileGoalError);
      }
    } else if (profileGoals) {
      // Only use Supabase values if they exist
      if (profileGoals.calorie_goal) {
        calorieGoal = profileGoals.calorie_goal;
      }
      if (profileGoals.water_goal_ml) {
        waterGoal = profileGoals.water_goal_ml / 1000;
      }
    }
  } catch (fetchError) {
    // Handle any unexpected errors gracefully - AsyncStorage goals will be used
    console.warn('[reloadTrackingData] Exception while fetching profile goals (using AsyncStorage):', fetchError);
  }
    
    // Reload calories from Supabase
    const today = getTodayString(); // Use local time helper
    const { data: calorieData } = await supabase
      .from('calorie_tracking')
      .select('*')
      .eq('profile_id', profileId)
      .eq('date', today)
      .maybeSingle();
    if (calorieData) {
      setCalories({ consumed: calorieData.consumed || 0, goal: calorieGoal });
    } else {
      setCalories({ consumed: 0, goal: calorieGoal });
    }
    
    // Reload water from Supabase
    const { data: waterData } = await supabase
      .from('water_tracking')
      .select('*')
      .eq('profile_id', profileId)
      .eq('date', today)
      .maybeSingle();
    if (waterData) {
      setWater({ consumed: (waterData.glasses || 0) * 250, goal: waterGoal });
    } else {
      setWater({ consumed: 0, goal: waterGoal });
    }
  } catch (error) {
    console.error('[reloadTrackingData] Error:', error);
  }
};

export { reloadTrackingData }; 