import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { isSameDay } from '../utils/scheduledWorkoutHelpers';
import { supabase } from '../lib/supabase';

/**
 * Convert Date to local YYYY-MM-DD string (not UTC)
 */
const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * MonthlyWorkoutCalendar Component
 * Displays a weekly calendar view with scheduled workouts and optional split-day labels (e.g. Push, Pull, Rest).
 * Users can navigate between weeks and tap days to schedule workouts.
 * selectedSplit: { id, label, days } (days = 7-element array Sun–Sat). getSplitDayForDate(date, split) returns the label for that day.
 */
const MonthlyWorkoutCalendar = React.forwardRef(({ onDayPress, selectedSplit, getSplitDayForDate }, ref) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:24',message:'Component initialization started',data:{onDayPress:!!onDayPress},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const { userProfile } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledWorkouts, setScheduledWorkouts] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSelectedDay, setIsSelectedDay] = useState(false);
  const today = new Date();

  // Day names for display (7 days: Sunday - Saturday)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /**
   * Get the start of the week (Sunday) for a given date
   * This function finds which Sunday the given date falls within
   * Returns a new Date object set to the Sunday of that week
   */
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = d.getDate() - day; // Subtract days to get to Sunday
    return new Date(d.setDate(diff));
  };

  
  /**
   * Get all 7 days in the current week (Sunday - Saturday)
   * Returns array of date objects for the calendar grid
   * Each day object has: { date: Date, isCurrentWeek: true }
   */
  const getWeekDays = (date) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:54',message:'getWeekDays called',data:{dateString:date?.toISOString?.()||'invalid'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    try {
      const weekStart = getWeekStart(date);
      const days = [];
      
      // Get all 7 days of the week (Sunday through Saturday)
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i); // Add i days to Sunday
        days.push({ date: day, isCurrentWeek: true });
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:66',message:'getWeekDays completed',data:{daysCount:days.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return days;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:70',message:'getWeekDays error',data:{error:error?.message||'unknown',stack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  };

  /**
   * Load scheduled workouts for the current week
   * This function queries the database for all workouts between Sunday and Saturday
   * of the week that contains currentDate
   */
  const loadScheduledWorkouts = async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    try {
      // Get start (Sunday) and end (Saturday) of current week
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Add 6 days to get Saturday
      weekEnd.setHours(23, 59, 59, 999); // Set to end of Saturday

      // Fetch scheduled workouts from database using LOCAL time
      const startStr = getLocalDateString(weekStart);
      const endStr = getLocalDateString(weekEnd);

      const { data, error } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', userProfile.id)
        .gte('scheduled_date', startStr)
        .lte('scheduled_date', endStr)
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.error('Error loading scheduled workouts:', error);
        return;
      }

      // Convert array to object with date as key for easy lookup
      // This allows us to quickly check if a date has a workout: workoutsMap['2024-12-15']
      const workoutsMap = {};
      if (data) {
        data.forEach(workout => {
          workoutsMap[workout.scheduled_date] = workout;
        });
      }

      setScheduledWorkouts(workoutsMap);
    } catch (error) {
      console.error('Error loading scheduled workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load workouts when component mounts or week changes
  // useEffect runs when userProfile?.id or currentDate changes
  useEffect(() => {
    loadScheduledWorkouts();
  }, [userProfile?.id, currentDate]);

  /**
   * Navigate to previous week
   * Subtracts 7 days from currentDate to move back one week
   */
  const goToPreviousWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7); // Subtract 7 days
      return newDate;
    });
  };

  /**
   * Navigate to next week
   * Adds 7 days to currentDate to move forward one week
   */
  const goToNextWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7); // Add 7 days
      return newDate;
    });
  };

  /**
   * Jump back to current week
   * Resets currentDate to today, which will show the week containing today
   */
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  /**
   * Handle day press
   */
  const handleDayPress = (date) => {
    const dateStr = getLocalDateString(date);
    const scheduledWorkout = scheduledWorkouts[dateStr];
    
    if (onDayPress) {
      onDayPress(date, scheduledWorkout);
    }
  };

  // Expose refresh method to parent component
  // This allows the parent to call calendarRef.current.refresh() to reload workouts
  React.useImperativeHandle(ref, () => ({
    refresh: loadScheduledWorkouts
  }));

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:173',message:'About to call getWeekDays',data:{currentDateString:currentDate?.toISOString?.()||'invalid',hasGetWeekDays:typeof getWeekDays==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  let weekDays;
  try {
    weekDays = getWeekDays(currentDate);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:178',message:'Error calling getWeekDays',data:{error:error?.message||'unknown',stack:error?.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // Fallback to empty array if getWeekDays fails
    weekDays = [];
  }
  
  // Format week range (e.g., "Dec 1 - Dec 7, 2024" or "Dec 29 - Jan 4, 2025")
  // This creates a readable string showing the date range of the current week
  const weekStart = getWeekStart(currentDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const formatWeekRange = () => {
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const startDay = weekStart.getDate();
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const endDay = weekEnd.getDate();
    const year = weekStart.getFullYear();
    
    // If both dates are in the same month: "Dec 1 - 7, 2024"
    // If they cross months: "Dec 29 - Jan 4, 2025"
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  };

  // Check if we're viewing current week
  // Compares the Sunday of the current week with the Sunday of today's week
  const currentWeekStart = getWeekStart(today);
  const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:203',message:'Before render',data:{loading,weekDaysLength:weekDays?.length||0,hasWeekDays:!!weekDays},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="calendar-outline" size={20} color="#00ffff" />
          <Text style={styles.headerText}>Workout Schedule</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#00ffff" />
        </View>
      </View>
    );
  }

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MonthlyWorkoutCalendar.js:216',message:'Rendering main view',data:{weekDaysLength:weekDays?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  return (
    <View style={styles.container}>
      {/* Header with week navigation */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="calendar-outline" size={20} color="#00ffff" />
          <Text style={styles.headerText}>Workout Schedule</Text>
        </View>
        <TouchableOpacity onPress={loadScheduledWorkouts} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={18} color="#00ffff" />
        </TouchableOpacity>
      </View>

      {/* Week navigation */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity style={styles.navButton} onPress={goToPreviousWeek}>
          <Ionicons name="chevron-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        
        <View style={styles.weekTitleContainer}>
          <Text style={styles.weekTitle}>{formatWeekRange()}</Text>
          {!isCurrentWeek && (
            <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
              <Ionicons name="today-outline" size={16} color="#00ffff" />
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity style={styles.navButton} onPress={goToNextWeek}>
          <Ionicons name="chevron-forward" size={24} color="#00ffff" />
        </TouchableOpacity>
      </View>

      {/* Day names header */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((name, index) => (
          <View key={index} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{name}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid - single row for 7 days */}
      <View style={styles.calendarGrid}>
        {(weekDays || []).map((item, index) => {
          const { date } = item;
          const dateStr = getLocalDateString(date);
          const scheduled = scheduledWorkouts[dateStr];
          const isToday = isSameDay(date, today);
          const isRestDay = scheduled?.is_rest_day;
          const hasWorkout = scheduled && !isRestDay;
          const splitDayLabel = selectedSplit && typeof getSplitDayForDate === 'function' ? getSplitDayForDate(date, selectedSplit) : null;
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayCell,
                hasWorkout && styles.hasWorkoutCell,
                isRestDay && styles.restDayCell,
                isToday && styles.todayCell,
              ]}
              onPress={() => handleDayPress(date)}
              activeOpacity={0.7}
            >
              {/* Today indicator label */}
              {isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
              
              {/* Day number */}
              <Text style={[
                styles.dayNumber,
                hasWorkout && styles.hasWorkoutText,
                isRestDay && styles.restDayText,
              ]}>
                {date.getDate()}
              </Text>
              {/* Split day label (e.g. Push, Pull, Rest) from the selected weekly schedule */}
              {splitDayLabel != null && splitDayLabel !== '' && (
                <Text style={[styles.splitDayLabel, isToday && styles.splitDayLabelToday]} numberOfLines={1}>
                  {typeof splitDayLabel === 'string' ? (splitDayLabel.charAt(0).toUpperCase() + splitDayLabel.slice(1).toLowerCase()) : splitDayLabel}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Helper text */}
      <Text style={styles.helperText}>
        Tap any day to schedule a workout
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  refreshButton: {
    padding: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  weekTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  weekTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    gap: 4,
  },
  todayButtonText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  
    
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  todayCell: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00ffff',
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    position: 'relative',
    minHeight: 60,
  },
  dayNameText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    gap: 8, // Space between day cells
  },
  dayCell: {
    flex: 1, // Each day takes equal space (1/7th of width)
    aspectRatio: 0.9, // Make taller (lower ratio = taller boxes)
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    minHeight: 60, // Ensure minimum height for readability
  },
  todayBadge: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  todayBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#00ffff',
    letterSpacing: 0.5,
  },
  hasWorkoutCell: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: '#00ffff',
    borderWidth: 2,
  },
  restDayCell: {
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    borderColor: '#ffa500',
    borderWidth: 2,
  },
  dayNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hasWorkoutText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  restDayText: {
    color: '#ffa500',
    fontWeight: 'bold',
  },
  splitDayLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  splitDayLabelToday: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
  },
  helperText: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default MonthlyWorkoutCalendar;
