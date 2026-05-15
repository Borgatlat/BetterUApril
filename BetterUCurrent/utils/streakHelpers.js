/**
 * Streak Helper Functions for BetterU
 * 
 * These functions help manage and retrieve user streak data from Supabase.
 * The streak system automatically updates when activities are completed via database triggers.
 * 
 * How streaks work:
 * - Any completed workout, mental session, or run/walk counts toward the streak
 * - Streak increments on consecutive days
 * - If a day is missed, streak resets to 1
 * - Same day activities don't increment (only one per day counts)
 */

import { supabase } from '../lib/supabase';

/**
 * Get streak status for a user
 * 
 * This function fetches the current streak, longest streak, and whether
 * the user has completed an activity today. Useful for displaying streak info.
 * 
 * @param {string} userId - The user's UUID
 * @returns {Promise<Object>} Streak status object with:
 *   - currentStreak: Current consecutive days
 *   - longestStreak: Best streak ever
 *   - hasActivityToday: Whether user completed activity today
 *   - isAtRisk: Whether streak will break if no activity today
 *   - lastActivityDate: Date of last activity (YYYY-MM-DD format)
 */
export async function getStreakStatus(userId) {
  try {
    if (!userId) {
      console.warn('[getStreakStatus] No userId provided');
      return {
        currentStreak: 0,
        longestStreak: 0,
        hasActivityToday: false,
        isAtRisk: false,
        lastActivityDate: null
      };
    }

    // Get user's local timezone (e.g., 'America/New_York', 'Europe/London')
    // JavaScript's Intl.DateTimeFormat can get the IANA timezone name
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Call the database function that calculates streak status
    // Pass the user's timezone so dates are calculated in their local time
    const { data, error } = await supabase.rpc('get_streak_status', {
      p_user_id: userId,
      p_timezone: userTimezone
    });

    if (error) {
      console.error('[getStreakStatus] Error calling RPC:', error);
      throw error;
    }

    // The RPC returns an array, get the first result
    const result = data?.[0] || {};

    return {
      currentStreak: result.current_streak || 0,
      longestStreak: result.longest_streak || 0,
      hasActivityToday: result.has_activity_today || false,
      isAtRisk: result.is_at_risk || false,
      lastActivityDate: result.last_activity_date || null
    };
  } catch (error) {
    console.error('[getStreakStatus] Error:', error);
    // Return safe defaults on error
    return {
      currentStreak: 0,
      longestStreak: 0,
      hasActivityToday: false,
      isAtRisk: false,
      lastActivityDate: null
    };
  }
}

/**
 * Manually refresh streak for a user
 * 
 * This function can be called after completing an activity to ensure
 * the streak is updated. However, database triggers should handle this
 * automatically, so this is mainly useful as a backup or for testing.
 * 
 * @param {string} userId - The user's UUID
 * @param {Date} activityTimestamp - Optional timestamp of activity (defaults to now)
 * @returns {Promise<Object|null>} Updated streak data or null on error
 */
export async function refreshStreak(userId, activityTimestamp = new Date()) {
  try {
    if (!userId) {
      console.warn('[refreshStreak] No userId provided');
      return null;
    }

    // Get user's local timezone (e.g., 'America/New_York')
    // This ensures the activity is counted for the correct LOCAL day
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Convert to ISO string (includes timezone info)
    // PostgreSQL will interpret this as TIMESTAMPTZ
    const timestampStr = activityTimestamp.toISOString();

    // Call the updated timezone-aware function
    // Now passes timestamp + timezone instead of just a date
    const { data, error } = await supabase.rpc('update_user_streak', {
      p_user_id: userId,
      p_activity_timestamp: timestampStr,
      p_timezone: userTimezone
    });

    if (error) {
      console.error('[refreshStreak] Error calling RPC:', error);
      throw error;
    }

    // Return the first result
    return data?.[0] || null;
  } catch (error) {
    console.error('[refreshStreak] Error:', error);
    return null;
  }
}

/**
 * Get streak data directly from the user_streaks table
 * 
 * This is a simpler query that just reads the streak table.
 * Use this if you don't need the calculated status fields.
 * 
 * @param {string} userId - The user's UUID
 * @returns {Promise<Object|null>} Streak data or null if not found
 */
export async function getStreakData(userId) {
  try {
    if (!userId) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no streak record exists yet, return defaults
      if (error.code === 'PGRST116') {
        return {
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null
        };
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[getStreakData] Error:', error);
    return null;
  }
}

/**
 * Recalculate a user's streak from scratch
 * 
 * This function completely recalculates the streak by looking at ALL 
 * activities in the database. Useful when:
 * - Streak got out of sync due to bugs
 * - Timezone changes affected the calculation
 * - User reports incorrect streak count
 * 
 * @param {string} userId - The user's UUID
 * @returns {Promise<Object|null>} New streak data or null on error
 */
export async function recalculateStreak(userId) {
  try {
    if (!userId) {
      console.warn('[recalculateStreak] No userId provided');
      return null;
    }

    // Get user's local timezone for accurate day calculations
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    console.log(`[recalculateStreak] Recalculating streak for user ${userId} in timezone ${userTimezone}`);

    // Call the database function that recalculates from activity history
    const { data, error } = await supabase.rpc('recalculate_user_streak', {
      p_user_id: userId,
      p_timezone: userTimezone
    });

    if (error) {
      console.error('[recalculateStreak] Error:', error);
      throw error;
    }

    const result = data?.[0];
    console.log('[recalculateStreak] Result:', result);
    
    return result || null;
  } catch (error) {
    console.error('[recalculateStreak] Error:', error);
    return null;
  }
}

/**
 * Save the user's timezone to their profile
 * 
 * Call this when the user first opens the app or when they change timezone.
 * This helps the server-side triggers use the correct timezone.
 * 
 * @param {string} userId - The user's UUID
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveUserTimezone(userId) {
  try {
    if (!userId) return false;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const { error } = await supabase
      .from('profiles')
      .update({ timezone })
      .eq('id', userId);

    if (error) {
      console.error('[saveUserTimezone] Error:', error);
      return false;
    }

    console.log(`[saveUserTimezone] Saved timezone ${timezone} for user`);
    return true;
  } catch (error) {
    console.error('[saveUserTimezone] Error:', error);
    return false;
  }
}

/**
 * Attempt to repair a recently broken streak.
 *
 * Call this AFTER the user completes your “recovery steps”
 * (for example: a special recovery workout + mental session).
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<{current_streak: number, longest_streak: number, repaired: boolean} | null>}
 */
export async function repairStreak(userId) {
  try {
    if (!userId) {
      console.warn('[repairStreak] No userId provided');
      return null;
    }
    else {
      const { data, error } = await supabase.rpc('repair_user_streak', {
        p_user_id: userId,
      });
      if (error) {
        console.error('[repairStreak] Error:', error);
        throw error;
      }

      const result = data?.[0] || null;
      if (result) {
      console.log('[repairStreak] Result:', result);
      return result;
   
      } 
      else {
        console.warn('[repairStreak] No result from repair');
        return null;
      }
    }
  } catch (error) {
    console.error('[repairStreak] Error:', error);
    return null;
  }
}
