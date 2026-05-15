import { supabase } from '../lib/supabase';

/**
 * Convert Date to local YYYY-MM-DD string (not UTC)
 * This ensures dates match the user's local timezone
 */
export const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get scheduled workouts for a specific week
 * @param {string} userId - The user's ID
 * @param {Date} startDate - Start of the week (Monday)
 * @param {Date} endDate - End of the week (Sunday)
 * @returns {Promise} Array of scheduled workouts
 */
export const getScheduledWorkoutsForWeek = async (userId, startDate, endDate) => {
  try {
    // Format dates as YYYY-MM-DD using LOCAL time (not UTC)
    const start = getLocalDateString(startDate);
    const end = getLocalDateString(endDate);

    const { data, error } = await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', start)  // Greater than or equal to start date
      .lte('scheduled_date', end)    // Less than or equal to end date
      .order('scheduled_date', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching scheduled workouts:', error);
    return { data: null, error };
  }
};

/**
 * Get scheduled activities for a specific date (can be multiple)
 * @param {string} userId - The user's ID
 * @param {Date} date - The specific date
 * @returns {Promise} Array of scheduled activities
 */
export const getScheduledActivitiesForDate = async (userId, date) => {
  try {
    const dateStr = getLocalDateString(date);

    const { data, error } = await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', dateStr)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching scheduled activities for date:', error);
    return { data: [], error };
  }
};

/**
 * Get scheduled workout for a specific date (backward compatibility)
 * @param {string} userId - The user's ID
 * @param {Date} date - The specific date
 * @returns {Promise} First scheduled workout object or null
 */
export const getScheduledWorkoutForDate = async (userId, date) => {
  try {
    const { data, error } = await getScheduledActivitiesForDate(userId, date);
    if (error) throw error;
    // Return first workout found, or null if none
    const workout = data?.find(a => a.activity_type === 'workout') || data?.[0] || null;
    return { data: workout, error: null };
  } catch (error) {
    console.error('Error fetching scheduled workout for date:', error);
    return { data: null, error };
  }
};

/**
 * Add a new scheduled activity (workout, run, walk, bike, or rest day)
 * @param {string} userId - The user's ID
 * @param {Date} date - The date to schedule
 * @param {Object} activityData - Object containing activity details
 * @returns {Promise} Created scheduled activity
 */
export const addScheduledWorkout = async (userId, date, activityData) => {
  try {
    const dateStr = getLocalDateString(date);
    
    // Determine activity type
    const activityType = activityData.activity_type || 
      (activityData.is_rest_day ? 'rest_day' : 'workout');

    const insertData = {
      user_id: userId,
      scheduled_date: dateStr,
      activity_type: activityType,
      is_rest_day: activityType === 'rest_day',
    };

    // Handle different activity types
    if (activityType === 'rest_day') {
      insertData.notes = activityData.notes || 'Rest day';
    } else if (activityType === 'workout') {
      insertData.workout_name = activityData.workout_name;
      insertData.workout_exercises = activityData.workout_exercises || [];
      insertData.notes = activityData.notes || null;
      insertData.title = activityData.title || activityData.workout_name;
    } else if (['run', 'walk', 'bike', 'mental_session'].includes(activityType)) {
      insertData.title = activityData.title;
      insertData.notes = activityData.notes || null;
      // No workout data for cardio or mental activities
    }

    const { data, error } = await supabase
      .from('scheduled_workouts')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding scheduled activity:', error);
    return { data: null, error };
  }
};

/**
 * Add a scheduled run
 * @param {string} userId - The user's ID
 * @param {Date} date - The date to schedule
 * @param {string} title - Title for the run
 * @param {string} notes - Optional notes
 * @returns {Promise} Created scheduled run
 */
export const addScheduledRun = async (userId, date, title, notes = null) => {
  return addScheduledWorkout(userId, date, {
    activity_type: 'run',
    title,
    notes
  });
};

/**
 * Add a scheduled walk
 * @param {string} userId - The user's ID
 * @param {Date} date - The date to schedule
 * @param {string} title - Title for the walk
 * @param {string} notes - Optional notes
 * @returns {Promise} Created scheduled walk
 */
export const addScheduledWalk = async (userId, date, title, notes = null) => {
  return addScheduledWorkout(userId, date, {
    activity_type: 'walk',
    title,
    notes
  });
};

/**
 * Add a scheduled bike ride
 * @param {string} userId - The user's ID
 * @param {Date} date - The date to schedule
 * @param {string} title - Title for the bike ride
 * @param {string} notes - Optional notes
 * @returns {Promise} Created scheduled bike ride
 */
export const addScheduledBike = async (userId, date, title, notes = null) => {
  return addScheduledWorkout(userId, date, {
    activity_type: 'bike',
    title,
    notes
  });
};

/**
 * Add a scheduled mental session
 * @param {string} userId - The user's ID
 * @param {Date} date - The date to schedule
 * @param {string} title - Title for the session
 * @param {string} notes - Optional notes
 * @param {Object} sessionData - Optional: { type: 'builtin', session: {...} } or { type: 'custom', custom_session_id: string }
 *   Used when starting the session to load the right session
 * @returns {Promise} Created scheduled mental session
 */
export const addScheduledMentalSession = async (userId, date, title, notes = null, sessionData = null) => {
  const notesToStore = sessionData ? JSON.stringify(sessionData) : notes;
  return addScheduledWorkout(userId, date, {
    activity_type: 'mental_session',
    title,
    notes: notesToStore
  });
};

/**
 * Add a rest day
 * @param {string} userId - The user's ID
 * @param {Date} date - The date to mark as rest day
 * @param {string} notes - Optional notes for the rest day
 * @returns {Promise} Created rest day entry
 */
export const addRestDay = async (userId, date, notes = 'Rest day') => {
  return addScheduledWorkout(userId, date, {
    activity_type: 'rest_day',
    notes: notes
  });
};

/**
 * Update an existing scheduled workout
 * @param {string} scheduledWorkoutId - The scheduled workout ID
 * @param {Object} workoutData - Object containing fields to update
 * @returns {Promise} Updated scheduled workout
 */
export const updateScheduledWorkout = async (scheduledWorkoutId, workoutData) => {
  try {
    const updateData = {
      ...workoutData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('scheduled_workouts')
      .update(updateData)
      .eq('id', scheduledWorkoutId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating scheduled workout:', error);
    return { data: null, error };
  }
};

/**
 * Delete a scheduled workout
 * @param {string} scheduledWorkoutId - The scheduled workout ID
 * @returns {Promise} Success boolean
 */
export const deleteScheduledWorkout = async (scheduledWorkoutId) => {
  try {
    const { error } = await supabase
      .from('scheduled_workouts')
      .delete()
      .eq('id', scheduledWorkoutId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting scheduled workout:', error);
    return { success: false, error };
  }
};

/**
 * Get the start and end dates for the current week (Monday to Sunday)
 * @param {Date} date - Reference date (defaults to today)
 * @returns {Object} Object with startDate and endDate
 */
export const getCurrentWeekDates = (date = new Date()) => {
  const current = new Date(date);
  const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday of current week
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  // Calculate Sunday of current week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { startDate: monday, endDate: sunday };
};

/**
 * Get array of all 7 days in the current week
 * @param {Date} date - Reference date (defaults to today)
 * @returns {Array} Array of Date objects for each day of the week
 */
export const getWeekDaysArray = (date = new Date()) => {
  const { startDate } = getCurrentWeekDates(date);
  const days = [];
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  
  return days;
};

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
export const isSameDay = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

