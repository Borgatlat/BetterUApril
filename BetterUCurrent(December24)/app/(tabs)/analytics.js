"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { useTracking } from '../../context/TrackingContext';
import { supabase } from '../../lib/supabase';
import { LineChart, BarChart } from 'react-native-chart-kit';
import ActivityHeatMap from '../../components/ActivityHeatMap';
import RecoveryMap from '../../components/RecoveryMap';
import ProgressRings from '../../components/ProgressRings';
import AnalyticsAdvice from '../../components/AnalyticsAdvice';
import { getLocalDateString } from '../../utils/scheduledWorkoutHelpers';
import { useFocusEffect } from 'expo-router';
import { useHomePageCustomization } from '../hooks/useHomePageCustomization';
import { hexToRgba } from '../../utils/homePageCustomization';

const { width: screenWidth } = Dimensions.get('window');

function parseExercisesField(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Analytics Dashboard Screen
 * 
 * This screen provides comprehensive visual analytics including:
 * - Weekly/monthly charts for workouts, mental sessions, calories, water
 * - Trend lines showing improvement over time
 * - Comparison views (this week vs last week)
 * - Heat map calendar for activity streaks
 * - Progress rings for multiple metrics
 * - AI-powered advice for improvement
 */
const AnalyticsScreen = () => {
  const { userProfile } = useUser();
  const { stats, calories, water, protein } = useTracking();
  const insets = useSafeAreaInsets();
  const { prefs: homePrefs, reload: reloadHomePrefs } = useHomePageCustomization();
  useFocusEffect(
    useCallback(() => {
      reloadHomePrefs();
    }, [reloadHomePrefs])
  );
  const homeBg = homePrefs.homeBackgroundColor || '#000000';
  const accent = homePrefs.homeAccentColor || '#00ffff';
  
  // State for time period selection (week, month, or year)
  const [timePeriod, setTimePeriod] = useState('week'); // 'week', 'month', or 'year'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [workoutData, setWorkoutData] = useState([]);
  const [mentalData, setMentalData] = useState([]);
  const [calorieData, setCalorieData] = useState([]);
  const [waterData, setWaterData] = useState([]);
  
  // Comparison data (this week vs last week)
  const [comparisonData, setComparisonData] = useState(null);
  
  // Weight progression data (also used by RecoveryMap to avoid extra fetch)
  const [topExercises, setTopExercises] = useState([]);
  const [workoutLogsWithExercises, setWorkoutLogsWithExercises] = useState([]);
  
  // Chart data states
  const [workoutChartData, setWorkoutChartData] = useState(null);
  const [mentalChartData, setMentalChartData] = useState(null);
  const [calorieChartData, setCalorieChartData] = useState(null);
  const [waterChartData, setWaterChartData] = useState(null);

  const { workoutsToday, mentalToday } = useMemo(() => {
    const key = getLocalDateString(new Date());
    const wCount = (workoutData || []).filter(
      (row) => row?.completed_at && getLocalDateString(new Date(row.completed_at)) === key
    ).length;
    const mCount = (mentalData || []).filter(
      (row) => row?.completed_at && getLocalDateString(new Date(row.completed_at)) === key
    ).length;
    return { workoutsToday: wCount, mentalToday: mCount };
  }, [workoutData, mentalData]);

  // Fetch all analytics data
  useEffect(() => {
    if (userProfile?.id) {
      fetchAnalyticsData();
    }
  }, [userProfile?.id, timePeriod]);

  /**
   * Main function to fetch all analytics data
   * Fetches workouts, mental sessions, calories, and water data
   * Then processes it into chart-ready format
   */
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const userId = userProfile?.id;
      if (!userId) return;

      // Calculate date ranges based on time period
      const now = new Date();
      const startDate = new Date();
      
      if (timePeriod === 'week') {
        // Get last 2 weeks for comparison
        startDate.setDate(now.getDate() - 14);
      } else if (timePeriod === 'month') {
        startDate.setMonth(now.getMonth()-2);
      } else if (timePeriod === 'year') {
        startDate.setFullYear(now.getFullYear()-2);
      } ;
      
      
     

      const startDateString = startDate.toISOString().split('T')[0];
      const nowString = now.toISOString().split('T')[0];
      // Timestamps must use full ISO for upper bound — a date-only string becomes midnight and drops same-day workouts.
      const nowTimestampIso = now.toISOString();

      // For weight progression, we want a longer date range (6 months or all time)
      // Progression tracking is more meaningful over longer periods than weekly/monthly views
      // Using 6 months to catch more historical data
      const progressionStartDate = new Date(now);
      progressionStartDate.setMonth(now.getMonth() - 6); // Last 6 months for progression
      const progressionStartDateString = progressionStartDate.toISOString().split('T')[0];

      // Fetch all data in parallel for better performance
      const [
        workoutsResult,
        workoutsForProgression, // Separate query for progression with longer date range
        mentalResult,
        trackingResult,
      ] = await Promise.all([
        // Fetch workouts for charts (based on selected time period)
        supabase
          .from('user_workout_logs')
          .select('completed_at, duration, exercise_count')
          .eq('user_id', userId)
          .gte('completed_at', startDateString)
          .lte('completed_at', nowTimestampIso)
          .order('completed_at', { ascending: true }),
        
        // Fetch workouts for weight progression (longer date range - last 3 months)
        // Including exercises JSONB field which contains detailed weight/rep data
        // The exercises field contains: [{ name, sets: [{ weight, reps, completed }] }]
        supabase
          .from('user_workout_logs')
          .select('completed_at, exercises')
          .eq('user_id', userId)
          .gte('completed_at', progressionStartDateString)
          .lte('completed_at', nowTimestampIso)
          .order('completed_at', { ascending: true }),
        
        // Fetch mental sessions
        supabase
          .from('mental_session_logs')
          .select('completed_at, duration_minutes')
          .eq('profile_id', userId)
          .gte('completed_at', startDateString)
          .lte('completed_at', nowTimestampIso)
          .order('completed_at', { ascending: true }),
        
        // Fetch daily tracking (calories, water)
        // Note: user_tracking structure may vary - try to get both user_id and profile_id matches
        // Also handle different column names (calories vs calories_consumed, water_liters vs water_consumed_ml)
        supabase
          .from('user_tracking')
          .select('date, calories, calories_consumed, water_liters, water_consumed_ml')
          .or(`user_id.eq.${userId},profile_id.eq.${userId}`)
          .gte('date', startDateString)
          .lte('date', nowString)
          .order('date', { ascending: true }),
      ]);

      if (workoutsResult.error) throw workoutsResult.error;
      if (workoutsForProgression.error) throw workoutsForProgression.error;
      if (mentalResult.error) throw mentalResult.error;
      if (trackingResult.error) throw trackingResult.error;

      // Process and set data
      setWorkoutData(workoutsResult.data || []);
      setMentalData(mentalResult.data || []);
      
      // Process tracking data
      const tracking = trackingResult.data || [];
      setCalorieData(tracking);
      setWaterData(tracking);

      // Process data into chart format
      processChartData(
        workoutsResult.data || [],
        mentalResult.data || [],
        tracking,
        timePeriod
      );

      // Calculate comparison data
      calculateComparison(
        workoutsResult.data || [],
        mentalResult.data || [],
        tracking
      );

      // Calculate weight progression from exercises data (using longer date range)
      // This analyzes the exercises JSONB field to track how much weight users increased
      const progressionWorkouts = workoutsForProgression.data || [];
      setWorkoutLogsWithExercises(progressionWorkouts);
      console.log('Workouts for progression:', progressionWorkouts.length, 'workouts found');
      if (progressionWorkouts.length > 0) {
        console.log('Sample workout exercises:', progressionWorkouts[0]?.exercises);
      }
      calculateWeightProgression(progressionWorkouts);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Process raw data into chart-ready format
   * Groups data by day/week and calculates totals
   */
  const processChartData = (workouts, mental, tracking, period) => {
    const now = new Date();
    let labels = [];
    let workoutValues = [];
    let mentalValues = [];
    let calorieValues = [];
    let waterValues = [];

    if (period === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        labels.push(dayLabel);
        
        // Count workouts for this day
        const dayWorkouts = workouts.filter(w => {
          const workoutDate = new Date(w.completed_at).toISOString().split('T')[0];
          return workoutDate === dateStr;
        });
        workoutValues.push(dayWorkouts.length);
        
        // Count mental sessions for this day
        const dayMental = mental.filter(m => {
          const mentalDate = new Date(m.completed_at).toISOString().split('T')[0];
          return mentalDate === dateStr;
        });
        mentalValues.push(dayMental.length);
        
        // Get calories and water for this day
        // Handle different column names in user_tracking table
        const dayTracking = tracking.find(t => t.date === dateStr);
        const calories = dayTracking?.calories || dayTracking?.calories_consumed || 0;
        const water = dayTracking?.water_liters || (dayTracking?.water_consumed_ml ? dayTracking.water_consumed_ml / 1000 : 0);
        calorieValues.push(calories);
        waterValues.push(water);
      }
    } else if (period === 'month') {
      // Last 4 weeks (month view)
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekLabel = `Week ${4 - i}`;
        labels.push(weekLabel);
        
        // Count workouts in this week
        const weekWorkouts = workouts.filter(w => {
          const workoutDate = new Date(w.completed_at);
          return workoutDate >= weekStart && workoutDate <= weekEnd;
        });
        workoutValues.push(weekWorkouts.length);
        
        // Count mental sessions in this week
        const weekMental = mental.filter(m => {
          const mentalDate = new Date(m.completed_at);
          return mentalDate >= weekStart && mentalDate <= weekEnd;
        });
        mentalValues.push(weekMental.length);
        
        // Sum calories and water for this week
        // Handle different column names in user_tracking table
        const weekTracking = tracking.filter(t => {
          const trackDate = new Date(t.date);
          return trackDate >= weekStart && trackDate <= weekEnd;
        });
        const weekCalories = weekTracking.reduce((sum, t) => {
          return sum + (t.calories || t.calories_consumed || 0);
        }, 0);
        const weekWater = weekTracking.reduce((sum, t) => {
          const water = t.water_liters || (t.water_consumed_ml ? t.water_consumed_ml / 1000 : 0);
          return sum + water;
        }, 0);
        calorieValues.push(weekCalories);
        waterValues.push(weekWater);
      }
    } else if (period === 'year') {
      // Last 12 months (year view)
      // Shows monthly data points for the past year
      for (let i = 11; i >= 0; i--) {
        // Calculate start and end of each month
        // monthStart: First day of the month (e.g., Jan 1, Feb 1)
        // monthEnd: Last day of the month (e.g., Jan 31, Feb 28)
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        
        // Label: Short month name (e.g., "Jan", "Feb", "Mar")
        // toLocaleDateString formats the date - { month: 'short' } gives us 3-letter month names
        const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });
        labels.push(monthLabel);
        
        // Count workouts in this month
        // Filter workouts that occurred between monthStart and monthEnd
        const monthWorkouts = workouts.filter(w => {
          const workoutDate = new Date(w.completed_at);
          return workoutDate >= monthStart && workoutDate <= monthEnd;
        });
        workoutValues.push(monthWorkouts.length);
        
        // Count mental sessions in this month
        const monthMental = mental.filter(m => {
          const mentalDate = new Date(m.completed_at);
          return mentalDate >= monthStart && mentalDate <= monthEnd;
        });
        mentalValues.push(monthMental.length);
        
        // Sum calories and water for this month
        // Handle different column names in user_tracking table
        const monthTracking = tracking.filter(t => {
          const trackDate = new Date(t.date);
          return trackDate >= monthStart && trackDate <= monthEnd;
        });
        const monthCalories = monthTracking.reduce((sum, t) => {
          return sum + (t.calories || t.calories_consumed || 0);
        }, 0);
        const monthWater = monthTracking.reduce((sum, t) => {
          const water = t.water_liters || (t.water_consumed_ml ? t.water_consumed_ml / 1000 : 0);
          return sum + water;
        }, 0);
        calorieValues.push(monthCalories);
        waterValues.push(monthWater);
      }
    }

    // Set chart data
    setWorkoutChartData({
      labels,
      datasets: [{
        data: workoutValues,
        color: (opacity = 1) => hexToRgba(accent, opacity),
        strokeWidth: 2
      }]
    });

    setMentalChartData({
      labels,
      datasets: [{
        data: mentalValues,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, // Purple
        strokeWidth: 2
      }]
    });

    setCalorieChartData({
      labels,
      datasets: [{
        data: calorieValues,
        color: (opacity = 1) => `rgba(255, 68, 68, ${opacity})`, // Red
        strokeWidth: 2
      }]
    });

    setWaterChartData({
      labels,
      datasets: [{
        data: waterValues,
        color: (opacity = 1) => `rgba(0, 170, 255, ${opacity})`, // Blue
        strokeWidth: 2
      }]
    });
  };

  /**
   * Calculate comparison between current period and previous period
   * Provides percentage changes for each metric
   * Handles week, month, and year comparisons based on timePeriod state
   */
  const calculateComparison = (workouts, mental, tracking) => {
    const now = new Date();
    let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;
    
    // Set date ranges based on selected time period
    // This allows the comparison to work for week, month, or year views
    if (timePeriod === 'week') {
      // This week vs last week
      // Current period: last 7 days (today and 6 days before)
      currentPeriodStart = new Date(now);
      currentPeriodStart.setDate(now.getDate() - 6);
      currentPeriodEnd = new Date(now);
      // Previous period: the week before (7-13 days ago)
      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodEnd = new Date(currentPeriodStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    } else if (timePeriod === 'month') {
      // This month vs last month
      // Current period: from the 1st of current month to today
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentPeriodEnd = new Date(now);
      // Previous period: the entire previous month
      previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // Last day of previous month
    } else if (timePeriod === 'year') {
      // This year vs last year
      // Current period: from January 1st of current year to today
      currentPeriodStart = new Date(now.getFullYear(), 0, 1); // Month 0 = January
      currentPeriodEnd = new Date(now);
      // Previous period: the entire previous year
      previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
      previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59); // December 31st of previous year
    }

    // Calculate totals for current period
    const currentWorkouts = workouts.filter(w => {
      const date = new Date(w.completed_at);
      return date >= currentPeriodStart && date <= currentPeriodEnd;
    }).length;

    const currentMental = mental.filter(m => {
      const date = new Date(m.completed_at);
      return date >= currentPeriodStart && date <= currentPeriodEnd;
    }).length;

    const currentTracking = tracking.filter(t => {
      const date = new Date(t.date);
      return date >= currentPeriodStart && date <= currentPeriodEnd;
    });
    const currentCalories = currentTracking.reduce((sum, t) => {
      return sum + (t.calories || t.calories_consumed || 0);
    }, 0);
    const currentWater = currentTracking.reduce((sum, t) => {
      const water = t.water_liters || (t.water_consumed_ml ? t.water_consumed_ml / 1000 : 0);
      return sum + water;
    }, 0);

    // Calculate totals for previous period
    const previousWorkouts = workouts.filter(w => {
      const date = new Date(w.completed_at);
      return date >= previousPeriodStart && date <= previousPeriodEnd;
    }).length;

    const previousMental = mental.filter(m => {
      const date = new Date(m.completed_at);
      return date >= previousPeriodStart && date <= previousPeriodEnd;
    }).length;

    const previousTracking = tracking.filter(t => {
      const date = new Date(t.date);
      return date >= previousPeriodStart && date <= previousPeriodEnd;
    });
    const previousCalories = previousTracking.reduce((sum, t) => {
      return sum + (t.calories || t.calories_consumed || 0);
    }, 0);
    const previousWater = previousTracking.reduce((sum, t) => {
      const water = t.water_liters || (t.water_consumed_ml ? t.water_consumed_ml / 1000 : 0);
      return sum + water;
    }, 0);

    // Calculate percentage changes
    // Formula: ((current - previous) / previous) * 100
    // Handles division by zero (if previous is 0, return 100% if current > 0, else 0%)
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Store comparison data - using thisWeek/lastWeek keys for backward compatibility
    // The UI component uses these keys regardless of the actual time period
    setComparisonData({
      workouts: {
        thisWeek: currentWorkouts,
        lastWeek: previousWorkouts,
        change: calculateChange(currentWorkouts, previousWorkouts)
      },
      mental: {
        thisWeek: currentMental,
        lastWeek: previousMental,
        change: calculateChange(currentMental, previousMental)
      },
      calories: {
        thisWeek: currentCalories,
        lastWeek: previousCalories,
        change: calculateChange(currentCalories, previousCalories)
      },
      water: {
        thisWeek: currentWater,
        lastWeek: previousWater,
        change: calculateChange(currentWater, previousWater)
      }
    });
  };

  /**
   * Calculate weight progression for each exercise
   * 
   * This function analyzes the exercises JSONB data stored in user_workout_logs to:
   * - Track the first recorded weight for each exercise
   * - Track the latest/heaviest weight for each exercise
   * - Calculate percentage and absolute weight increases
   * - Store all weights over time for charting
   * 
   * Why group by exercise name? So we can compare the same exercise across different
   * workouts and track progression. For example, if someone did Bench Press on Jan 1
   * with 135 lbs and on Jan 15 with 185 lbs, we can show +50 lbs increase.
   * 
   * Why use max weight per workout? Users might do different weights across sets
   * (e.g., 135x10, 155x8, 175x5). Using max weight captures their best effort.
   */
  const calculateWeightProgression = (workouts) => {
    console.log('Calculating weight progression from', workouts.length, 'workouts');
    
    // Object to store exercise progression data
    // Structure: { "Bench Press": { firstWeight: 135, latestWeight: 185, allWeights: [...] } }
    const exerciseData = {};

    // Loop through each workout to extract exercise data
    workouts.forEach((workout, workoutIndex) => {
      const exercises = parseExercisesField(workout.exercises);
      if (!exercises || exercises.length === 0) {
        if (workout.exercises != null) {
          console.log(`Workout ${workoutIndex} has no usable exercises array`);
        }
        return;
      }
      const workoutDate = new Date(workout.completed_at);
      
      // Skip if date is invalid
      if (isNaN(workoutDate.getTime())) {
        console.log(`Workout ${workoutIndex} has invalid date:`, workout.completed_at);
        return;
      }
      
      console.log(`Processing workout ${workoutIndex} with ${exercises.length} exercises`);

      exercises.forEach((exercise) => {
        const exerciseName = exercise.name || exercise.exerciseName || exercise.title;
        if (!exerciseName) return;

        // Skip exercises without sets or bodyweight exercises (weight = 0)
        // We only want to track weighted exercises for progression
        if (!exercise.sets || exercise.sets.length === 0) return;

        // Find the maximum weight used in this workout for this exercise
        // Count sets that look “done”: explicit completed flag OR weight+reps filled (matches active-workout save logic)
        const completedSets = exercise.sets.filter((set) => {
          if (!set) return false;
          const weight = parseFloat(set.weight) || 0;
          if (weight <= 0) return false;
          const repsRaw = set.reps;
          const reps = typeof repsRaw === 'string' && repsRaw.includes('-')
            ? parseInt(repsRaw.split('-')[0], 10) || 0
            : parseInt(repsRaw, 10) || 0;
          if (set.completed === true) return true;
          return reps > 0;
        });
        
        if (completedSets.length === 0) {
          console.log(`  Exercise "${exerciseName}" has no completed sets with weight > 0`);
          return;
        }

        // Get the maximum weight from all completed sets
        // parseFloat converts string weights to numbers, with fallback to 0
        const maxWeight = Math.max(
          ...completedSets.map(set => parseFloat(set.weight) || 0)
        );

        if (maxWeight > 0) {
          console.log(`  Exercise "${exerciseName}" max weight: ${maxWeight} lbs`);
          // First time seeing this exercise? Initialize the tracking object
          if (!exerciseData[exerciseName]) {
            exerciseData[exerciseName] = {
              firstWeight: maxWeight,
              firstDate: workoutDate,
              latestWeight: maxWeight,
              latestDate: workoutDate,
              allWeights: [], // Store all weights over time for charting
              workoutCount: 0
            };
          }

          // Update latest weight to the most recent workout's weight (not necessarily the heaviest)
          // For progression tracking, we want to compare first weight vs most recent weight
          // This gives users a true picture of their progression over time
          // If the workout date is newer, update to this weight (even if it's lighter than previous)
          if (workoutDate > exerciseData[exerciseName].latestDate) {
            exerciseData[exerciseName].latestWeight = maxWeight;
            exerciseData[exerciseName].latestDate = workoutDate;
          } else if (workoutDate.getTime() === exerciseData[exerciseName].latestDate.getTime()) {
            // If same date, use the heavier weight (in case of multiple workouts same day)
            if (maxWeight > exerciseData[exerciseName].latestWeight) {
              exerciseData[exerciseName].latestWeight = maxWeight;
            }
          }

          // Track all weights over time for trend analysis and charting
          // This allows us to show a line chart of weight progression
          exerciseData[exerciseName].allWeights.push({
            weight: maxWeight,
            date: workoutDate,
            // Also calculate volume (weight × reps) for the best set
            // Volume = total weight moved, which is another useful metric
            volume: maxWeight * completedSets
              .filter(set => parseFloat(set.weight) === maxWeight)
              .reduce((sum, set) => sum + (parseInt(set.reps) || 0), 0)
          });

          exerciseData[exerciseName].workoutCount++;
        }
      });
    });

    // Convert the exerciseData object to an array and calculate progression metrics
    // Object.entries converts { "Bench Press": {...} } to [ ["Bench Press", {...}] ]
    const progressionArray = Object.entries(exerciseData).map(([name, data]) => {
      // Calculate absolute weight increase (latest - first)
      const weightIncrease = data.latestWeight - data.firstWeight;
      
      // Calculate percentage increase
      // If firstWeight is 0, we can't divide by it, so return 0
      // Otherwise: ((new - old) / old) * 100 gives percentage change
      const percentIncrease = data.firstWeight > 0 
        ? ((weightIncrease / data.firstWeight) * 100)
        : 0;
      
      // Calculate average weekly increase for more meaningful insights
      // This tells users "you're adding X lbs per week on average"
      const daysDiff = (data.latestDate - data.firstDate) / (1000 * 60 * 60 * 24); // Convert ms to days
      const weeksDiff = daysDiff / 7;
      const weeklyIncrease = weeksDiff > 0 ? (weightIncrease / weeksDiff) : 0;

      return {
        name,
        firstWeight: data.firstWeight,
        latestWeight: data.latestWeight,
        weightIncrease,
        percentIncrease: parseFloat(percentIncrease.toFixed(1)),
        weeklyIncrease: parseFloat(weeklyIncrease.toFixed(1)),
        workoutCount: data.workoutCount,
        // Sort allWeights by date for proper chart display
        allWeights: data.allWeights.sort((a, b) => a.date - b.date)
      };
    });

    // Filter and sort exercises:
    // - Show exercises done at least 1 time (even with 1 workout, we can show current weight)
    // - For progression (increase), we'll need at least 2 workouts, but let's show all exercises
    //   and indicate if they need more data for progression tracking
    // - Sort by weight increase (biggest gains first) - exercises with no increase sorted by current weight
    const filteredExercises = progressionArray
      .filter(ex => ex.workoutCount >= 1) // Lowered from 2 to 1 to show data sooner
      .sort((a, b) => {
        // Sort by weight increase if available, otherwise by current weight (most recent/heaviest first)
        if (a.workoutCount >= 2 && b.workoutCount >= 2) {
          return b.weightIncrease - a.weightIncrease;
        }
        return b.latestWeight - a.latestWeight;
      })
      .slice(0, 5); // Take top 5 exercises

    console.log(`Found ${filteredExercises.length} exercises to display:`, filteredExercises.map(e => ({
      name: e.name,
      workouts: e.workoutCount,
      increase: e.weightIncrease
    })));

    setTopExercises(filteredExercises);
  };

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData();
  };

  // Chart theme: same accent + soft surfaces as the Home tab (see home.js cards / Recovery).
  const chartConfig = useMemo(
    () => ({
      backgroundColor: homeBg,
      backgroundGradientFrom: 'rgba(255,255,255,0.07)',
      backgroundGradientTo: 'rgba(255,255,255,0.02)',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
      style: { borderRadius: 16 },
      propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: accent,
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: 'rgba(255, 255, 255, 0.1)',
        strokeWidth: 1,
      },
    }),
    [accent, homeBg]
  );

  // Show full layout immediately so the page feels fast (especially on web).
  // Loading indicator appears inside the scroll area instead of blocking the whole screen.
  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: homeBg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: hexToRgba(accent, 0.12) }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}>
            <Ionicons name="analytics" size={22} color={accent} />
          </View>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>
        <View style={[styles.periodSelector, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'week' && { backgroundColor: hexToRgba(accent, 0.22) },
            ]}
            onPress={() => setTimePeriod('week')}
          >
            <Text
              style={[
                styles.periodButtonText,
                timePeriod === 'week' && { color: accent, fontWeight: '700' },
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'month' && { backgroundColor: hexToRgba(accent, 0.22) },
            ]}
            onPress={() => setTimePeriod('month')}
          >
            <Text
              style={[
                styles.periodButtonText,
                timePeriod === 'month' && { color: accent, fontWeight: '700' },
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'year' && { backgroundColor: hexToRgba(accent, 0.22) },
            ]}
            onPress={() => setTimePeriod('year')}
          >
            <Text
              style={[
                styles.periodButtonText,
                timePeriod === 'year' && { color: accent, fontWeight: '700' },
              ]}
            >
              Year
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
          />
        }
      >
        {loading && !workoutChartData ? (
          <View style={[styles.section, styles.centerContent]}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : null}
        {/* Progress Rings - Current Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{"Today's Progress"}</Text>
          <ProgressRings
            calories={calories}
            water={water}
            protein={protein}
            workouts={workoutsToday}
            mental={mentalToday}
            accentColor={accent}
          />
        </View>

        {/* Comparison Card - Current Period vs Previous Period */}
        {comparisonData && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {timePeriod === 'week' ? 'This Week vs Last Week' : 
               timePeriod === 'month' ? 'This Month vs Last Month' : 
               'This Year vs Last Year'}
            </Text>
            <View style={styles.comparisonCard}>
              <ComparisonItem
                label="Workouts"
                thisWeek={comparisonData.workouts.thisWeek}
                lastWeek={comparisonData.workouts.lastWeek}
                change={comparisonData.workouts.change}
                icon="fitness"
                color={accent}
              />
              <ComparisonItem
                label="Mental Sessions"
                thisWeek={comparisonData.mental.thisWeek}
                lastWeek={comparisonData.mental.lastWeek}
                change={comparisonData.mental.change}
                icon="heart"
                color="#8b5cf6"
              />
              <ComparisonItem
                label="Calories"
                thisWeek={Math.round(comparisonData.calories.thisWeek)}
                lastWeek={Math.round(comparisonData.calories.lastWeek)}
                change={comparisonData.calories.change}
                icon="flame"
                color="#ff4444"
              />
              <ComparisonItem
                label="Water (L)"
                thisWeek={comparisonData.water.thisWeek.toFixed(1)}
                lastWeek={comparisonData.water.lastWeek.toFixed(1)}
                change={comparisonData.water.change}
                icon="water"
                color="#00aaff"
              />
            </View>
          </View>
        )}

        {/* Weight Progression Section - Shows how much users increased weight on their lifts */}
        {topExercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Weight Progression</Text>
            <Text style={styles.sectionSubtitle}>
              Track your strength gains by seeing how much you've increased weight on each exercise
            </Text>
            <View style={styles.progressionCard}>
              {topExercises.map((exercise, index) => (
                <View key={index} style={[
                  styles.progressionItem,
                  index < topExercises.length - 1 && styles.progressionItemBorder
                ]}>
                  {/* Exercise header with name and increase badge */}
                  <View style={styles.progressionHeader}>
                    <Text style={styles.progressionExerciseName}>{exercise.name}</Text>
                    {/* Show badge for progression (2+ workouts) or current weight (1 workout) */}
                    {exercise.workoutCount >= 2 ? (
                      <View style={[
                        styles.progressionBadge, 
                        exercise.weightIncrease > 0 
                          ? { backgroundColor: 'rgba(0, 255, 0, 0.2)' }
                          : exercise.weightIncrease < 0
                          ? { backgroundColor: 'rgba(255, 68, 68, 0.2)' }
                          : { backgroundColor: 'rgba(255, 170, 0, 0.2)' }
                      ]}>
                        <Ionicons 
                          name={exercise.weightIncrease > 0 ? "trending-up" : exercise.weightIncrease < 0 ? "trending-down" : "remove"} 
                          size={16} 
                          color={exercise.weightIncrease > 0 ? "#00ff00" : exercise.weightIncrease < 0 ? "#ff4444" : "#ffaa00"} 
                        />
                        <Text style={[
                          styles.progressionBadgeText,
                          { color: exercise.weightIncrease > 0 ? "#00ff00" : exercise.weightIncrease < 0 ? "#ff4444" : "#ffaa00" }
                        ]}>
                          {exercise.weightIncrease > 0 ? '+' : ''}{exercise.weightIncrease.toFixed(0)} lbs
                        </Text>
                      </View>
                    ) : exercise.workoutCount === 1 ? (
                      <View style={[styles.progressionBadge, { backgroundColor: hexToRgba(accent, 0.2) }]}>
                        <Ionicons name="information-circle" size={16} color={accent} />
                        <Text style={[styles.progressionBadgeText, { color: accent }]}>
                          {exercise.latestWeight.toFixed(0)} lbs
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  
                  {/* Stats row: Started weight, Current weight, Percentage increase */}
                  <View style={styles.progressionStats}>
                    <View style={styles.progressionStat}>
                      <Text style={styles.progressionStatLabel}>
                        {exercise.workoutCount >= 2 ? 'Started' : 'Weight'}
                      </Text>
                      <Text style={styles.progressionStatValue}>
                        {exercise.firstWeight.toFixed(0)} lbs
                      </Text>
                    </View>
                    {exercise.workoutCount >= 2 ? (
                      <>
                        <View style={styles.progressionStat}>
                          <Text style={styles.progressionStatLabel}>Current</Text>
                          <Text style={styles.progressionStatValue}>
                            {exercise.latestWeight.toFixed(0)} lbs
                          </Text>
                        </View>
                        <View style={styles.progressionStat}>
                          <Text style={styles.progressionStatLabel}>Increase</Text>
                          <Text style={[
                            styles.progressionStatValue, 
                            { color: exercise.percentIncrease > 0 ? '#00ff00' : '#ff4444' }
                          ]}>
                            {exercise.percentIncrease > 0 ? '+' : ''}{exercise.percentIncrease}%
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.progressionStat}>
                        <Text style={styles.progressionStatLabel}>Workouts</Text>
                        <Text style={styles.progressionStatValue}>
                          {exercise.workoutCount}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Show message if need more workouts for progression tracking */}
                  {exercise.workoutCount === 1 && (
                    <View style={styles.weeklyIncreaseContainer}>
                      <Ionicons name="information-circle" size={14} color="#ffaa00" />
                      <Text style={[styles.weeklyIncreaseText, { color: '#ffaa00' }]}>
                        Complete 2+ workouts with this exercise to see progression
                      </Text>
                    </View>
                  )}

                  {/* Weekly increase indicator - shows average lbs per week (only if 2+ workouts) */}
                  {exercise.workoutCount >= 2 && exercise.weeklyIncrease > 0 && (
                    <View style={[styles.weeklyIncreaseContainer, { backgroundColor: hexToRgba(accent, 0.1) }]}>
                      <Ionicons name="calendar" size={14} color={accent} />
                      <Text style={[styles.weeklyIncreaseText, { color: accent }]}>
                        Averaging +{exercise.weeklyIncrease.toFixed(1)} lbs/week
                      </Text>
                    </View>
                  )}

                  {/* Mini line chart showing weight progression over time */}
                  {/* Only show chart if there are multiple data points (at least 2 workouts) */}
                  {exercise.allWeights.length > 1 && (
                    <View style={styles.miniChartContainer}>
                      <LineChart
                        data={{
                          // Labels: show "Start" on first point, "Now" on last point, empty for middle points
                          // This keeps the chart clean while showing progression direction
                          labels: exercise.allWeights.map((_, i) => {
                            if (i === 0) return 'Start';
                            if (i === exercise.allWeights.length - 1) return 'Now';
                            return '';
                          }),
                          datasets: [{
                            // Map all weights to array for chart
                            data: exercise.allWeights.map(w => w.weight),
                            // Cyan color matching app theme
                            color: (opacity = 1) => hexToRgba(accent, opacity),
                            strokeWidth: 2
                          }]
                        }}
                        width={screenWidth - 80}
                        height={80}
                        chartConfig={{
                          ...chartConfig,
                          decimalPlaces: 0, // No decimals for weight (e.g., 135 not 135.5)
                        }}
                        bezier // Smooth curved lines instead of sharp angles
                        withDots={true} // Show dots on each data point
                        withShadow={false} // No shadow for cleaner mini chart
                        withInnerLines={false} // No inner grid lines for simplicity
                        withOuterLines={false} // No outer border
                        withVerticalLabels={true} // Show weight values on Y-axis
                        withHorizontalLabels={false} // Hide X-axis labels (we show Start/Now in labels array)
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {topExercises.length === 0 && workoutLogsWithExercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Weight Progression</Text>
            <Text style={styles.sectionSubtitle}>
              Workouts are loading, but there are no weighted sets to chart yet. Log exercises with weight on the bar
              (sets with weight and reps) when you finish a workout — then strength trends appear here.
            </Text>
          </View>
        )}

        {/* Recovery Map - muscle group recovery % from last trained */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recovery map</Text>
          <RecoveryMap
            userId={userProfile?.id}
            workouts={workoutLogsWithExercises}
            accentColor={accent}
            showSectionTitle={false}
          />
        </View>

        {/* Activity Heat Map */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Activity Heat Map</Text>
          <ActivityHeatMap
            workouts={workoutData}
            mentalSessions={mentalData}
            userId={userProfile?.id}
            accentColor={accent}
          />
        </View>

        {/* Workout Chart */}
        {workoutChartData && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Workouts</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={workoutChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withDots={true}
                withShadow={true}
              />
            </View>
          </View>
        )}

        {/* Mental Sessions Chart */}
        {mentalChartData && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Mental Sessions</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={mentalChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withDots={true}
                withShadow={true}
              />
            </View>
          </View>
        )}

        {/* Calories Chart */}
        {calorieChartData && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Calories</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={calorieChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withDots={true}
                withShadow={true}
              />
            </View>
          </View>
        )}

        {/* Water Chart */}
        {waterChartData && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Water Intake</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={waterChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withDots={true}
                withShadow={true}
              />
            </View>
          </View>
        )}

        {/* AI Advice Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Personalized Advice</Text>
          <AnalyticsAdvice
            workoutData={workoutData}
            mentalData={mentalData}
            calorieData={calorieData}
            waterData={waterData}
            comparisonData={comparisonData}
            stats={stats}
            accentColor={accent}
          />
        </View>

        {/* Extra space above tab bar (scrollContent already adds paddingBottom: 80). */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

/**
 * Comparison Item Component
 * Shows a single metric comparison between this week and last week
 */
const ComparisonItem = ({ label, thisWeek, lastWeek, change, icon, color }) => {
  const isPositive = change >= 0;
  const changeColor = isPositive ? '#00ff00' : '#ff4444';
  const changeIcon = isPositive ? 'arrow-up' : 'arrow-down';

  return (
    <View style={styles.comparisonItem}>
      <View style={styles.comparisonItemLeft}>
        <View style={[styles.comparisonIconContainer, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View>
          <Text style={styles.comparisonLabel}>{label}</Text>
          <Text style={styles.comparisonValue}>
            {thisWeek} <Text style={styles.comparisonSubtext}>vs {lastWeek}</Text>
          </Text>
        </View>
      </View>
      <View style={[styles.comparisonChange, { backgroundColor: `${changeColor}20` }]}>
        <Ionicons name={changeIcon} size={16} color={changeColor} />
        <Text style={[styles.comparisonChangeText, { color: changeColor }]}>
          {Math.abs(change).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  /** Same idea as home “action” icon circles: soft fill + icon uses accent from prefs. */
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  periodSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  /** Matches home.js scrollContent — room above the tab bar. */
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },
  /** Same rhythm as home sections: full width, horizontal padding, space below. */
  section: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  /** Matches home `sectionLabel`: small caps-ish label above each block. */
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  /** Same card surface as home `actionCard`: very soft fill + hairline border. */
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chart: {
    borderRadius: 16,
  },
  comparisonCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  comparisonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  comparisonItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  comparisonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 2,
  },
  comparisonValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  comparisonSubtext: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'normal',
  },
  comparisonChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  comparisonChangeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    marginTop: -4,
  },
  progressionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 0,
  },
  progressionItem: {
    paddingVertical: 15,
  },
  progressionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 0,
  },
  progressionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressionExerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  progressionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressionBadgeText: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  progressionStat: {
    alignItems: 'center',
    flex: 1,
  },
  progressionStatLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  progressionStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  weeklyIncreaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  weeklyIncreaseText: {
    fontSize: 12,
    fontWeight: '500',
  },
  miniChartContainer: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
});

export default AnalyticsScreen;

