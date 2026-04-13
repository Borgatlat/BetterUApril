/**
 * Live Activities Service for BetterU
 * 
 * Creates beautiful Live Activities on the iOS lock screen and Dynamic Island
 * showing real-time workout progress with timer, sets, and calories.
 */

import { Platform } from 'react-native';

// Dynamic import - only available in native builds, not Expo Go
let ExpoLiveActivity = null;
try {
  ExpoLiveActivity = require('expo-live-activity');
} catch (error) {
  console.log('expo-live-activity not available (expected in Expo Go)');
}

/**
 * Check if Live Activities are supported
 */
export function checkLiveActivitySupport() {
  if (Platform.OS !== 'ios') return false;
  if (!ExpoLiveActivity) return false;
  return true;
}

/**
 * Start a Live Activity for an active workout
 * 
 * Creates a styled lock screen widget with blue/cyan theme
 * 
 * @param {Object} workoutData - Workout info to display
 * @returns {Promise<string|null>} Activity ID if successful
 */
export async function startWorkoutLiveActivity({
  workoutId,
  workoutName,
  currentExercise,
  setsCompleted = 0,
  totalSets = 0,
  elapsedTime = 0,
  calories = 0,
}) {
  try {
    if (!checkLiveActivitySupport()) return null;

    // Calculate progress (0.0 to 1.0)
    const progress = totalSets > 0 ? Math.min(setsCompleted / totalSets, 1) : 0;

    // Format time
    const timeFormatted = formatTime(elapsedTime);

    // Build subtitle with emoji separators for visual appeal
    const setsText = `${setsCompleted}/${totalSets}`;
    const subtitle = `${currentExercise || 'Starting...'} │ ${setsText} │ ${timeFormatted}`;

    // expo-live-activity styling - blue theme
    const activityData = {
      // Content (dynamic)
      title: `🏋️ ${workoutName || 'Workout'}`,
      subtitle: subtitle,
      progress: progress,
      
      // Styling (static) - Blue/Cyan fitness theme
      name: 'BetterU',
      backgroundColor: '#0a1628',      // Dark blue background
      titleColor: '#4FC3F7',           // Light blue title
      subtitleColor: '#B3E5FC',        // Lighter blue subtitle
      progressViewTint: '#00BCD4',     // Cyan progress bar
      progressViewLabelColor: '#E1F5FE',
      padding: 20,
    };

    if (typeof ExpoLiveActivity.startActivity !== 'function') {
      console.log('startActivity function not available');
      return null;
    }

    const activityId = await ExpoLiveActivity.startActivity(activityData);

    if (activityId) {
      console.log('✅ Live Activity started:', activityId);
      return activityId;
    }
    
    return null;
  } catch (error) {
    console.log('Could not start Live Activity:', error.message);
    return null;
  }
}

/**
 * Update an existing Live Activity with new workout progress
 * 
 * Shows either:
 * - Normal mode: Exercise info with time and stats
 * - Rest mode: Prominent rest countdown
 * 
 * @param {string} activityId - The ID from startWorkoutLiveActivity()
 * @param {Object} updates - New state to display
 */
export async function updateWorkoutLiveActivity(activityId, updates) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.updateActivity !== 'function') return;

  try {
    // Calculate progress
    const progress = updates.totalSets > 0 
      ? Math.min(updates.setsCompleted / updates.totalSets, 1) 
      : 0;

    let title, subtitle;

    // Check if we're in rest mode
    if (updates.isResting && updates.restTimeRemaining > 0) {
      // 😤 REST MODE - Show rest countdown prominently
      const restMins = Math.floor(updates.restTimeRemaining / 60);
      const restSecs = updates.restTimeRemaining % 60;
      const restTimeFormatted = `${restMins}:${restSecs.toString().padStart(2, '0')}`;
      
      title = `😤 REST ${restTimeFormatted}`;
      // Stats: next exercise, sets left, calories
      const setsRemaining = (updates.totalSets || 0) - (updates.setsCompleted || 0);
      subtitle = `Next: ${updates.currentExercise || 'Exercise'}│${setsRemaining} sets left│🔥 ${Math.round(updates.calories || 0)} cal`;
    } else {
      // 🏋️ ACTIVE MODE - Show current exercise and all stats
      const timeText = updates.elapsedTime || '00:00';
      const setsText = `${updates.setsCompleted || 0}/${updates.totalSets || 0}`;
      const calText = `${Math.round(updates.calories || 0)} cal`;
      
      title = `🏋️ ${updates.workoutName || 'Workout'}`;
      
      // Format: "Exercise│Sets│Time│Calories" - icons added by Swift
      subtitle = `${updates.currentExercise || 'Working out'}│${setsText}│⏱ ${timeText}│🔥 ${calText}`;
    }

    const updateData = {
      title: title,
      subtitle: subtitle,
        progress: progress,
    };

    await ExpoLiveActivity.updateActivity(activityId, updateData);
  } catch (error) {
    // Silently fail - activity might have been dismissed
  }
}

/**
 * Show workout completion on Live Activity (doesn't dismiss it)
 * 
 * Updates the Live Activity to show final stats. The activity stays visible
 * so the user can see their results and manually dismiss it.
 * 
 * @param {string} activityId - The activity ID
 * @param {Object} finalStats - Final workout stats
 * @param {number} finalStats.duration - Duration in seconds
 * @param {number} finalStats.totalWeight - Total weight lifted
 * @param {number} finalStats.completedSets - Number of sets completed
 * @param {number} finalStats.exerciseCount - Number of exercises
 * @param {string} finalStats.workoutName - Name of the workout
 * @param {number} finalStats.calories - Estimated calories burned
 */
export async function endWorkoutLiveActivity(activityId, finalStats = {}) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.updateActivity !== 'function') return;

  try {
    // Format duration nicely (e.g., "45 min" or "1h 15m")
    const totalMins = Math.floor((finalStats.duration || 0) / 60);
    const durationText = totalMins >= 60 
      ? `${Math.floor(totalMins/60)}h ${totalMins%60}m`
      : `${totalMins} min`;
    
    // Format weight with commas (e.g., "12,450 lbs")
    const weightText = `${(finalStats.totalWeight || 0).toLocaleString()} lbs`;
    
    // Format sets and exercises
    const setsText = `${finalStats.completedSets || 0} sets`;
    const exercisesText = `${finalStats.exerciseCount || 0} exercises`;
    
    // Stats line with │ separators - icons will be added by Swift
    const statsLine = `⏱ ${durationText}│${weightText}│${setsText}│${exercisesText}`;
    
    // Update to show completion with celebration emoji
    await ExpoLiveActivity.updateActivity(activityId, {
      title: `🎉 ${finalStats.workoutName || 'Workout'} Complete!`,
      subtitle: statsLine,
      progress: 1.0,
    });
    
    console.log('✅ Live Activity updated with final stats');
  } catch (error) {
    console.log('Error updating Live Activity with final stats:', error);
  }
}

/**
 * Force end/dismiss a Live Activity immediately
 * Use this for abandoned workouts or cleanup
 * 
 * @param {string} activityId - The activity ID to end
 */
export async function dismissLiveActivity(activityId) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.endActivity !== 'function') return;

  try {
    await ExpoLiveActivity.endActivity(activityId);
    console.log('✅ Live Activity dismissed');
  } catch (error) {
    // Silently fail
  }
}

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// CARDIO LIVE ACTIVITIES (Run/Walk/Bike)
// ============================================

/**
 * Start a Live Activity for cardio (run/walk/bike)
 * Shows distance, pace (or speed for biking), time, and calories on lock screen
 * 
 * @param {Object} cardioData - Run/walk/bike info
 * @returns {Promise<string|null>} Activity ID if successful
 */
export async function startCardioLiveActivity({
  activityType = 'run', // 'run', 'walk', or 'bike'
  distance = 0,
  pace = 0,
  speed = 0, // kph - used for biking
  elapsedTime = 0,
  calories = 0,
}) {
  try {
    if (!checkLiveActivitySupport()) return null;

    // Get emoji and title based on activity type
    const activityInfo = {
      run: { emoji: '🏃', name: 'Run' },
      walk: { emoji: '🚶', name: 'Walk' },
      bike: { emoji: '🚴', name: 'Bike' },
      timed_distance: { emoji: '⚡', name: 'Timed Distance' },
    }[activityType] || { emoji: '🏃', name: 'Run' };

    // Format stats
    const timeFormatted = formatTime(elapsedTime);
    const distanceKm = (distance / 1000).toFixed(2);
    
    // For biking, show speed (kph). For running/walking, show pace (min/km)
    let speedOrPace;
    if (activityType === 'bike') {
      const speedKph = speed || (elapsedTime > 0 ? (distance / 1000) / (elapsedTime / 3600) : 0);
      speedOrPace = `${speedKph.toFixed(1)} kph`;
    } else {
      speedOrPace = `${formatPace(pace)}/km`;
    }
    
    const subtitle = `${distanceKm} km │ ${speedOrPace} │ ⏱ ${timeFormatted}`;
    
    const activityData = {
      title: `${activityInfo.emoji} ${activityInfo.name} in Progress`,
      subtitle: subtitle,
      progress: 0,
      name: 'BetterU',
      backgroundColor: '#0a1628',
      titleColor: '#4FC3F7',
      subtitleColor: '#B3E5FC',
      progressViewTint: '#00BCD4',
      progressViewLabelColor: '#E1F5FE',
      padding: 20,
    };

    if (typeof ExpoLiveActivity.startActivity !== 'function') {
      return null;
    }

    const activityId = await ExpoLiveActivity.startActivity(activityData);
    if (activityId) {
      console.log('✅ Cardio Live Activity started:', activityId);
      return activityId;
    }
    
    return null;
  } catch (error) {
    console.log('Could not start Cardio Live Activity:', error.message);
    return null;
  }
}

/**
 * Update cardio Live Activity with new stats
 */
export async function updateCardioLiveActivity(activityId, updates) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.updateActivity !== 'function') return;

  try {
    const activityInfo = {
      run: { emoji: '🏃', name: 'Run' },
      walk: { emoji: '🚶', name: 'Walk' },
      bike: { emoji: '🚴', name: 'Bike' },
      timed_distance: { emoji: '⚡', name: 'Timed Distance' },
    }[updates.activityType] || { emoji: '🏃', name: 'Run' };

    const timeFormatted = formatTime(updates.elapsedTime || 0);
    const distanceKm = ((updates.distance || 0) / 1000).toFixed(2);
    const cals = Math.round(updates.calories || 0);
    
    // For biking, show speed (kph). For running/walking/timed distance, show pace (min/km)
    let speedOrPace;
    if (updates.activityType === 'bike') {
      const elapsedHours = (updates.elapsedTime || 1) / 3600;
      const speedKph = elapsedHours > 0 ? ((updates.distance || 0) / 1000) / elapsedHours : 0;
      speedOrPace = `${speedKph.toFixed(1)} kph`;
    } else {
      speedOrPace = `${formatPace(updates.pace || 0)}/km`;
    }
    
    let title, subtitle;
    
    if (updates.isPaused) {
      title = `⏸️ ${activityInfo.name} Paused`;
      subtitle = `${distanceKm} km │ ${speedOrPace} │ 🔥 ${cals} cal`;
    } else {
      title = `${activityInfo.emoji} ${activityInfo.name}`;
      subtitle = `${distanceKm} km │ ${speedOrPace} │ ⏱ ${timeFormatted} │ 🔥 ${cals} cal`;
    }

    await ExpoLiveActivity.updateActivity(activityId, {
      title: title,
      subtitle: subtitle,
      progress: 0, // No fixed progress for cardio
    });
  } catch (error) {
    // Silently fail
  }
}

/**
 * End cardio Live Activity with final stats
 */
export async function endCardioLiveActivity(activityId, finalStats = {}) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.updateActivity !== 'function') return;

  try {
    const activityInfo = {
      run: { emoji: '🏃', name: 'Run' },
      walk: { emoji: '🚶', name: 'Walk' },
      bike: { emoji: '🚴', name: 'Bike' },
      timed_distance: { emoji: '⚡', name: 'Timed Distance' },
    }[finalStats.activityType] || { emoji: '🏃', name: 'Run' };

    const totalMins = Math.floor((finalStats.duration || 0) / 60);
    const durationText = totalMins >= 60 
      ? `${Math.floor(totalMins/60)}h ${totalMins%60}m`
      : `${totalMins} min`;
    
    const distanceKm = ((finalStats.distance || 0) / 1000).toFixed(2);
    const cals = Math.round(finalStats.calories || 0);
    
    // For biking, show average speed (kph). For running/walking/timed distance, show pace (min/km)
    let speedOrPace;
    if (finalStats.activityType === 'bike') {
      const durationHours = (finalStats.duration || 1) / 3600;
      const avgSpeedKph = durationHours > 0 ? ((finalStats.distance || 0) / 1000) / durationHours : 0;
      speedOrPace = `${avgSpeedKph.toFixed(1)} kph`;
    } else {
      speedOrPace = `${formatPace(finalStats.averagePace || 0)}/km`;
    }
    
    await ExpoLiveActivity.updateActivity(activityId, {
      title: `🎉 ${activityInfo.name} Complete!`,
      subtitle: `${distanceKm} km │ ${speedOrPace} │ ⏱ ${durationText} │ 🔥 ${cals} cal`,
      progress: 1.0,
    });
    
    console.log('✅ Cardio Live Activity updated with final stats');
  } catch (error) {
    console.log('Error updating Cardio Live Activity:', error);
  }
}

/**
 * Format pace (minutes per km) to MM:SS
 */
function formatPace(paceMinPerKm) {
  if (!paceMinPerKm || paceMinPerKm <= 0 || !isFinite(paceMinPerKm)) return '--:--';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// MENTAL SESSION LIVE ACTIVITIES
// ============================================

/**
 * Start a Live Activity for mental session (meditation/breathing)
 * Shows session type, time remaining, and current step
 * 
 * @param {Object} sessionData - Mental session info
 * @returns {Promise<string|null>} Activity ID if successful
 */
export async function startMentalLiveActivity({
  sessionType = 'meditation', // 'meditation' or 'breathing'
  sessionName = '',
  duration = 0, // Total duration in seconds
  currentStep = '',
}) {
  try {
    if (!checkLiveActivitySupport()) return null;

    const sessionInfo = {
      meditation: { emoji: '🧘', name: 'Meditation' },
      breathing: { emoji: '🌬️', name: 'Breathing' },
    }[sessionType] || { emoji: '🧘', name: 'Mindfulness' };

    const timeFormatted = formatTime(duration);
    
    const activityData = {
      title: `${sessionInfo.emoji} ${sessionName || sessionInfo.name}`,
      subtitle: `${currentStep || 'Focus on your breath'} │ ⏱ ${timeFormatted} left`,
      progress: 0,
      name: 'BetterU',
      backgroundColor: '#0a1628',
      titleColor: '#9C27B0', // Purple for mental wellness
      subtitleColor: '#CE93D8',
      progressViewTint: '#7C4DFF',
      progressViewLabelColor: '#E1BEE7',
      padding: 20,
    };

    if (typeof ExpoLiveActivity.startActivity !== 'function') {
      return null;
    }

    const activityId = await ExpoLiveActivity.startActivity(activityData);
    if (activityId) {
      console.log('✅ Mental Live Activity started:', activityId);
      return activityId;
    }
    
    return null;
  } catch (error) {
    console.log('Could not start Mental Live Activity:', error.message);
    return null;
  }
}

/**
 * Update mental session Live Activity
 */
export async function updateMentalLiveActivity(activityId, updates) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.updateActivity !== 'function') return;

  try {
    const sessionInfo = {
      meditation: { emoji: '🧘', name: 'Meditation' },
      breathing: { emoji: '🌬️', name: 'Breathing' },
    }[updates.sessionType] || { emoji: '🧘', name: 'Mindfulness' };

    const timeFormatted = formatTime(updates.timeRemaining || 0);
    const totalDuration = updates.totalDuration || 1;
    const progress = 1 - ((updates.timeRemaining || 0) / totalDuration);
    
    let title, subtitle;
    
    if (updates.isPaused) {
      title = `⏸️ ${updates.sessionName || sessionInfo.name} Paused`;
      subtitle = `${updates.currentStep || 'Paused'} │ ⏱ ${timeFormatted} left`;
    } else {
      title = `${sessionInfo.emoji} ${updates.sessionName || sessionInfo.name}`;
      subtitle = `${updates.currentStep || 'Breathe deeply'} │ ⏱ ${timeFormatted} left`;
    }

    await ExpoLiveActivity.updateActivity(activityId, {
      title: title,
      subtitle: subtitle,
      progress: Math.max(0, Math.min(progress, 1)),
    });
  } catch (error) {
    // Silently fail
  }
}

/**
 * End mental session Live Activity
 */
export async function endMentalLiveActivity(activityId, finalStats = {}) {
  if (!activityId) return;
  if (!ExpoLiveActivity || typeof ExpoLiveActivity.updateActivity !== 'function') return;

  try {
    const sessionInfo = {
      meditation: { emoji: '🧘', name: 'Meditation' },
      breathing: { emoji: '🌬️', name: 'Breathing' },
    }[finalStats.sessionType] || { emoji: '🧘', name: 'Mindfulness' };

    const totalMins = Math.floor((finalStats.duration || 0) / 60);
    const durationText = totalMins >= 60 
      ? `${Math.floor(totalMins/60)}h ${totalMins%60}m`
      : `${totalMins} min`;
    
    await ExpoLiveActivity.updateActivity(activityId, {
      title: `🎉 ${finalStats.sessionName || sessionInfo.name} Complete!`,
      subtitle: `You practiced for ${durationText}. Great job! 🌟`,
      progress: 1.0,
    });
    
    console.log('✅ Mental Live Activity updated with final stats');
  } catch (error) {
    console.log('Error updating Mental Live Activity:', error);
  }
}
