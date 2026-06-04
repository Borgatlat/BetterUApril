"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { useTracking } from '../../context/TrackingContext';
import { supabase } from '../../lib/supabase';
import ActivityHeatMap from '../../components/ActivityHeatMap';
import AnalyticsMetricChart from '../../components/AnalyticsMetricChart';
import AnalyticsSparkline from '../../components/AnalyticsSparkline';
import RecoveryMap from '../../components/RecoveryMap';
import ProgressRings from '../../components/ProgressRings';
import AnalyticsAdvice from '../../components/AnalyticsAdvice';
import { getLocalDateString } from '../../utils/scheduledWorkoutHelpers';
import {
  mergeCalorieAndWaterTracking,
  applyTodayTrackingFromContext,
  getTrackingCalories,
  getTrackingWaterLiters,
  getAnalyticsChartTheme,
  sanitizeChartDataset,
  sumChartValues,
  buildLineChartConfig,
  ANALYTICS_CARD,
  calculateWeightProgressionFromWorkouts,
  buildPeriodActivityTotals,
  formatPrValue,
} from '../../utils/analyticsDataHelpers';
import { useFocusEffect, useRouter } from 'expo-router';
import { useHomePageCustomization } from '../../hooks/useHomePageCustomization';
import { hexToRgba } from '../../utils/homePageCustomization';
import { useBottomChromeInsets } from '../../context/BottomChromeContext';

const cardSurfaceStyle = {
  backgroundColor: ANALYTICS_CARD.backgroundColor,
  borderRadius: ANALYTICS_CARD.borderRadius,
  borderWidth: ANALYTICS_CARD.borderWidth,
  borderColor: ANALYTICS_CARD.borderColor,
};

/** Section heading with colored ionicon in a soft rounded square — matches Home action cards. */
const SectionTitle = ({ icon, label, accent }) => (
  <View style={styles.sectionTitleRow}>
    <View style={[styles.sectionIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}>
      <Ionicons name={icon} size={18} color={accent} />
    </View>
    <Text style={styles.sectionLabel}>{label}</Text>
  </View>
);

const StatTile = ({ label, value, sub, icon, color }) => (
  <View style={[styles.statTile, cardSurfaceStyle]}>
    <View style={[styles.statTileIcon, { backgroundColor: hexToRgba(color, 0.12) }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statTileValue}>{value}</Text>
    <Text style={styles.statTileLabel}>{label}</Text>
    {sub ? <Text style={styles.statTileSub}>{sub}</Text> : null}
  </View>
);

const AnalyticsScreen = () => {
  const router = useRouter();
  const { userProfile } = useUser();
  const { stats, calories, water, protein } = useTracking();
  const insets = useSafeAreaInsets();
  const { prefs: homePrefs, reload: reloadHomePrefs } = useHomePageCustomization();
  useFocusEffect(
    useCallback(() => {
      reloadHomePrefs();
      setRecoveryMapRefreshKey((k) => k + 1);
    }, [reloadHomePrefs])
  );
  const homeBg = homePrefs.homeBackgroundColor || '#000000';
  const accent = homePrefs.homeAccentColor || '#00ffff';
  const { scrollPaddingBottom } = useBottomChromeInsets();

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
  const [recoveryMapRefreshKey, setRecoveryMapRefreshKey] = useState(0);
  const [runsData, setRunsData] = useState([]);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [periodTotals, setPeriodTotals] = useState(null);
  
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
  }, [userProfile?.id, timePeriod, calories?.consumed, water?.consumed]);

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
        workoutsForProgression,
        mentalResult,
        calorieTrackingResult,
        waterTrackingResult,
        runsResult,
        prResult,
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
          .select('completed_at, exercises, workout_name')
          .eq('user_id', userId)
          .gte('completed_at', progressionStartDateString)
          .lte('completed_at', nowTimestampIso)
          .order('completed_at', { ascending: true }),
        
        // Same table/columns as Mental tab + session summary
        supabase
          .from('mental_session_logs')
          .select('completed_at, duration, duration_seconds, session_type, session_name')
          .eq('profile_id', userId)
          .gte('completed_at', startDateString)
          .lte('completed_at', nowTimestampIso)
          .order('completed_at', { ascending: true }),

        // Same tables as TrackingContext on the home screen
        supabase
          .from('calorie_tracking')
          .select('date, consumed')
          .eq('profile_id', userId)
          .gte('date', startDateString)
          .lte('date', nowString)
          .order('date', { ascending: true }),

        supabase
          .from('water_tracking')
          .select('date, glasses')
          .eq('profile_id', userId)
          .gte('date', startDateString)
          .lte('date', nowString)
          .order('date', { ascending: true }),

        supabase
          .from('runs')
          .select('created_at, distance_meters, duration_seconds')
          .eq('user_id', userId)
          .gte('created_at', startDateString)
          .lte('created_at', nowTimestampIso)
          .order('created_at', { ascending: true }),

        supabase
          .from('personal_records')
          .select('id, exercise, weight_kg, time_minutes, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (workoutsResult.error) throw workoutsResult.error;
      if (workoutsForProgression.error) throw workoutsForProgression.error;
      if (mentalResult.error) {
        console.warn('Analytics: mental_session_logs fetch failed:', mentalResult.error);
      }
      if (calorieTrackingResult.error) {
        console.warn('Analytics: calorie_tracking fetch failed:', calorieTrackingResult.error);
      }
      if (waterTrackingResult.error) {
        console.warn('Analytics: water_tracking fetch failed:', waterTrackingResult.error);
      }

      const mentalRows = mentalResult.error ? [] : mentalResult.data || [];
      let tracking = mergeCalorieAndWaterTracking(
        calorieTrackingResult.error ? [] : calorieTrackingResult.data || [],
        waterTrackingResult.error ? [] : waterTrackingResult.data || []
      );
      tracking = applyTodayTrackingFromContext(tracking, calories, water);

      const workoutRows = workoutsResult.data || [];
      const runRows = runsResult.error ? [] : runsResult.data || [];
      const prRows = prResult.error ? [] : prResult.data || [];

      setWorkoutData(workoutRows);
      setMentalData(mentalRows);
      setCalorieData(tracking);
      setWaterData(tracking);
      setRunsData(runRows);
      setPersonalRecords(prRows);
      setPeriodTotals(buildPeriodActivityTotals(workoutRows, mentalRows, runRows));

      processChartData(workoutRows, mentalRows, tracking, timePeriod);
      calculateComparison(workoutRows, mentalRows, tracking);

      const progressionWorkouts = workoutsForProgression.data || [];
      setWorkoutLogsWithExercises(progressionWorkouts);
      setTopExercises(calculateWeightProgressionFromWorkouts(progressionWorkouts, 8));

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
  const chartTheme = useMemo(
    () => getAnalyticsChartTheme(homeBg, accent),
    [homeBg, accent]
  );

  const processChartData = (workouts, mental, tracking, period, themeAccent = accent) => {
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
        
        const dayTracking = tracking.find((t) => t.date === dateStr);
        calorieValues.push(getTrackingCalories(dayTracking));
        waterValues.push(getTrackingWaterLiters(dayTracking));
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
        
        const weekTracking = tracking.filter((t) => {
          const trackDate = new Date(t.date);
          return trackDate >= weekStart && trackDate <= weekEnd;
        });
        const weekCalories = weekTracking.reduce((sum, t) => sum + getTrackingCalories(t), 0);
        const weekWater = weekTracking.reduce((sum, t) => sum + getTrackingWaterLiters(t), 0);
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
        
        const monthTracking = tracking.filter((t) => {
          const trackDate = new Date(t.date);
          return trackDate >= monthStart && trackDate <= monthEnd;
        });
        const monthCalories = monthTracking.reduce((sum, t) => sum + getTrackingCalories(t), 0);
        const monthWater = monthTracking.reduce((sum, t) => sum + getTrackingWaterLiters(t), 0);
        calorieValues.push(monthCalories);
        waterValues.push(monthWater);
      }
    }

    // Set chart data
    const safeWorkouts = sanitizeChartDataset(workoutValues);
    const safeMental = sanitizeChartDataset(mentalValues);
    const safeCalories = sanitizeChartDataset(calorieValues);
    const safeWater = sanitizeChartDataset(waterValues);

    setWorkoutChartData({
      labels,
      datasets: [{
        data: safeWorkouts,
        color: (opacity = 1) => hexToRgba(themeAccent, opacity),
        strokeWidth: 2,
      }],
      totals: { sum: sumChartValues(safeWorkouts) },
    });

    setMentalChartData({
      labels,
      datasets: [{
        data: safeMental,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        strokeWidth: 2,
      }],
      totals: { sum: sumChartValues(safeMental) },
    });

    setCalorieChartData({
      labels,
      datasets: [{
        data: safeCalories,
        color: (opacity = 1) => `rgba(255, 68, 68, ${opacity})`,
        strokeWidth: 2,
      }],
      totals: { sum: sumChartValues(safeCalories) },
    });

    setWaterChartData({
      labels,
      datasets: [{
        data: safeWater,
        color: (opacity = 1) => `rgba(0, 170, 255, ${opacity})`,
        strokeWidth: 2,
      }],
      totals: { sum: sumChartValues(safeWater) },
    });
  };

  useEffect(() => {
    if (!userProfile?.id) return;
    const hasData =
      (workoutData?.length ?? 0) > 0 ||
      (mentalData?.length ?? 0) > 0 ||
      (calorieData?.length ?? 0) > 0;
    if (!hasData) return;
    processChartData(workoutData, mentalData, calorieData, timePeriod, accent);
  }, [accent, homeBg, timePeriod, workoutData, mentalData, calorieData, userProfile?.id]);

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
    const currentCalories = currentTracking.reduce((sum, t) => sum + getTrackingCalories(t), 0);
    const currentWater = currentTracking.reduce((sum, t) => sum + getTrackingWaterLiters(t), 0);

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
    const previousCalories = previousTracking.reduce((sum, t) => sum + getTrackingCalories(t), 0);
    const previousWater = previousTracking.reduce((sum, t) => sum + getTrackingWaterLiters(t), 0);

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

  const periodOverviewLabel = useMemo(() => {
    if (timePeriod === 'week') return 'Last 7 days';
    if (timePeriod === 'month') return 'Last 4 weeks';
    return 'Last 12 months';
  }, [timePeriod]);

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = () => {
    setRefreshing(true);
    setRecoveryMapRefreshKey((k) => k + 1);
    fetchAnalyticsData();
  };

  // Show full layout immediately so the page feels fast (especially on web).
  // Loading indicator appears inside the scroll area instead of blocking the whole screen.
  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: homeBg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: hexToRgba(accent, 0.12) }]}>
        <TouchableOpacity
          style={[styles.headerBackBtn, { backgroundColor: hexToRgba(accent, 0.12) }]}
          onPress={() => navigateToHome(router)}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Ionicons name="arrow-back" size={22} color={accent} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}>
            <Ionicons name="analytics" size={22} color={accent} />
          </View>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>
        <View style={[styles.periodSelector, cardSurfaceStyle, { padding: 4 }]}>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
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
        <View style={styles.section}>
          <SectionTitle icon="pulse-outline" label={"Today's Progress"} accent={accent} />
          <ProgressRings
            calories={calories}
            water={water}
            protein={protein}
            workouts={workoutsToday}
            mental={mentalToday}
            accentColor={accent}
          />
        </View>

        {periodTotals && (
          <View style={styles.section}>
            <SectionTitle icon="grid-outline" label={`Overview · ${periodOverviewLabel}`} accent={accent} />
            <View style={styles.statGrid}>
              <StatTile
                label="Workouts"
                value={String(periodTotals.workouts)}
                icon="barbell-outline"
                color={accent}
              />
              <StatTile
                label="Mental"
                value={String(periodTotals.mental)}
                icon="leaf-outline"
                color="#8b5cf6"
              />
              <StatTile
                label="Runs"
                value={String(periodTotals.runs)}
                sub={
                  periodTotals.runs > 0
                    ? `${periodTotals.runDistanceMiles.toFixed(1)} mi`
                    : undefined
                }
                icon="walk-outline"
                color="#ff6464"
              />
              <StatTile
                label="Lifts tracked"
                value={String(periodTotals.liftsTracked)}
                sub={
                  periodTotals.liftsProgressing > 0
                    ? `${periodTotals.liftsProgressing} progressing`
                    : undefined
                }
                icon="trending-up-outline"
                color="#86efac"
              />
            </View>
          </View>
        )}

        {/* Comparison Card - Current Period vs Previous Period */}
        {comparisonData && (
          <View style={styles.section}>
            <SectionTitle
              icon="git-compare-outline"
              label={
                timePeriod === 'week' ? 'This Week vs Last Week' :
                timePeriod === 'month' ? 'This Month vs Last Month' :
                'This Year vs Last Year'
              }
              accent={accent}
            />
            <View style={[styles.comparisonCard, cardSurfaceStyle]}>
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

        <View style={styles.section}>
          <SectionTitle icon="barbell-outline" label="Weight progression" accent={accent} />
          <Text style={styles.sectionSubtitle}>
            Max weight per lift from your logged workouts (last 6 months)
          </Text>
          {topExercises.length > 0 ? (
            <View style={[styles.progressionCard, cardSurfaceStyle]}>
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
                    <View
                      style={[
                        styles.miniChartContainer,
                        {
                          backgroundColor: chartTheme.containerBg,
                          borderColor: chartTheme.containerBorder,
                        },
                      ]}
                    >
                      <AnalyticsSparkline
                        values={exercise.allWeights.map((w) => w.weight)}
                        labels={exercise.allWeights.map((_, i) => {
                          if (i === 0) return 'Start';
                          if (i === exercise.allWeights.length - 1) return 'Now';
                          return '';
                        })}
                        color={accent}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyInsightCard, cardSurfaceStyle]}>
              <Ionicons name="barbell-outline" size={28} color="#666" />
              <Text style={styles.emptyInsightTitle}>No lift data yet</Text>
              <Text style={styles.emptyInsightBody}>
                Finish a workout and log sets with weight and reps. Your top lifts and trends will show up here.
              </Text>
            </View>
          )}
        </View>

        {personalRecords.length > 0 && (
          <View style={styles.section}>
            <SectionTitle icon="trophy-outline" label="Personal records" accent={accent} />
            <View style={[styles.progressionCard, cardSurfaceStyle]}>
              {personalRecords.map((pr, index) => (
                <View
                  key={pr.id}
                  style={[
                    styles.prRow,
                    index < personalRecords.length - 1 && styles.progressionItemBorder,
                  ]}
                >
                  <Text style={styles.progressionExerciseName} numberOfLines={1}>
                    {pr.exercise || 'Record'}
                  </Text>
                  <Text style={[styles.prValue, { color: accent }]}>{formatPrValue(pr)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {periodTotals && periodTotals.runs > 0 && (
          <View style={styles.section}>
            <SectionTitle icon="walk-outline" label="Running" accent="#ff6464" />
            <View style={[styles.runSummaryCard, cardSurfaceStyle]}>
              <Text style={styles.runSummaryBig}>{periodTotals.runs}</Text>
              <Text style={styles.runSummaryLabel}>runs in this period</Text>
              <Text style={styles.runSummaryMeta}>
                {periodTotals.runDistanceMiles.toFixed(1)} mi total · ~
                {periodTotals.runDurationMinutes} min moving
              </Text>
            </View>
          </View>
        )}

        {userProfile?.id ? (
          <View style={styles.recoveryMapWrap}>
            <RecoveryMap
              userId={userProfile.id}
              refreshKey={recoveryMapRefreshKey}
              accentColor={accent}
            />
          </View>
        ) : null}

        {/* Workout Chart */}
        {workoutChartData && (
          <View style={styles.section}>
            <SectionTitle icon="fitness-outline" label="Workouts" accent={accent} />
            <View
              style={[
                styles.chartContainer,
                {
                  backgroundColor: chartTheme.containerBg,
                  borderColor: chartTheme.containerBorder,
                },
              ]}
            >
              <AnalyticsMetricChart
                labels={workoutChartData.labels}
                values={workoutChartData.datasets[0]?.data}
                barColor={accent}
                summaryLabel="Total in period"
                summaryValue={String(workoutChartData.totals?.sum ?? 0)}
              />
            </View>
          </View>
        )}

        {mentalChartData && (
          <View style={styles.section}>
            <SectionTitle icon="heart-outline" label="Mental Sessions" accent="#8b5cf6" />
            <View
              style={[
                styles.chartContainer,
                {
                  backgroundColor: chartTheme.containerBg,
                  borderColor: chartTheme.containerBorder,
                },
              ]}
            >
              <AnalyticsMetricChart
                labels={mentalChartData.labels}
                values={mentalChartData.datasets[0]?.data}
                barColor="#8b5cf6"
                summaryLabel="Total in period"
                summaryValue={String(mentalChartData.totals?.sum ?? 0)}
              />
            </View>
          </View>
        )}

        {calorieChartData && (
          <View style={styles.section}>
            <SectionTitle icon="flame-outline" label="Calories" accent="#ff4444" />
            <View
              style={[
                styles.chartContainer,
                {
                  backgroundColor: chartTheme.containerBg,
                  borderColor: chartTheme.containerBorder,
                },
              ]}
            >
              <AnalyticsMetricChart
                labels={calorieChartData.labels}
                values={calorieChartData.datasets[0]?.data}
                barColor="#ff6464"
                summaryLabel="Total kcal"
                summaryValue={(calorieChartData.totals?.sum ?? 0).toLocaleString()}
              />
            </View>
          </View>
        )}

        {waterChartData && (
          <View style={styles.section}>
            <SectionTitle icon="water-outline" label="Water Intake" accent="#00aaff" />
            <View
              style={[
                styles.chartContainer,
                {
                  backgroundColor: chartTheme.containerBg,
                  borderColor: chartTheme.containerBorder,
                },
              ]}
            >
              <AnalyticsMetricChart
                labels={waterChartData.labels}
                values={waterChartData.datasets[0]?.data}
                barColor="#00aaff"
                summaryLabel="Total liters"
                summaryValue={`${(waterChartData.totals?.sum ?? 0).toFixed(1)} L`}
                formatValue={(v) => {
                  const n = Number(v) || 0;
                  return n >= 10 || n === 0 ? String(Math.round(n * 10) / 10) : n.toFixed(1);
                }}
              />
            </View>
          </View>
        )}

        {/* AI Advice Section */}
        <View style={styles.section}>
          <SectionTitle icon="bulb-outline" label="Personalized Advice" accent={accent} />
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
        <View style={[styles.comparisonIconContainer, { backgroundColor: hexToRgba(color, 0.12) }]}>
          <Ionicons name={icon} size={22} color={color} />
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
    gap: 10,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  recoveryMapWrap: {
    paddingTop: 8,
    marginBottom: 10,
    paddingHorizontal: 20,
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
    letterSpacing: 0.5,
    flex: 1,
  },
  chartContainer: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    padding: 14,
    gap: 4,
  },
  statTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statTileValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  statTileLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  statTileSub: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  emptyInsightCard: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyInsightTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyInsightBody: {
    color: '#888',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  prValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  runSummaryCard: {
    padding: 18,
    alignItems: 'center',
  },
  runSummaryBig: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  runSummaryLabel: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  runSummaryMeta: {
    color: '#666',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  comparisonCard: {
    padding: 16,
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
    width: 48,
    height: 48,
    borderRadius: 14,
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
    padding: 16,
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
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});

export default AnalyticsScreen;

