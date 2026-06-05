import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getLocalDateString } from './dateUtils';

const LOCAL_USAGE_KEY = (userId, featureType, date) =>
  `ai_gen_usage_${userId}_${featureType}_${date}`;

async function readLocalUsage(userId, featureType) {
  try {
    const raw = await AsyncStorage.getItem(
      LOCAL_USAGE_KEY(userId, featureType, getLocalDateString()),
    );
    const n = parseInt(raw || '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeLocalUsage(userId, featureType, count) {
  try {
    await AsyncStorage.setItem(
      LOCAL_USAGE_KEY(userId, featureType, getLocalDateString()),
      String(Math.max(0, count)),
    );
  } catch {
    /* non-fatal */
  }
}

/**
 * AI Generation Daily Limits
 * 
 * Premium users: 20 generations per day per feature
 * Free users: 1 generation per day per feature
 */
export const AI_GENERATION_LIMITS = {
  PREMIUM: {
    WORKOUT: 20,
    MEAL: 20,
    MENTAL_SESSION: 20,
    PHOTO_MEAL: 5,
    /** Future U (Claude) long-form planning — counts each successful assistant reply per day */
    FUTURE_U: 15,
  },
  FREE: {
    WORKOUT: 1,
    MEAL: 1,
    MENTAL_SESSION: 1,
    PHOTO_MEAL: 0,
    FUTURE_U: 2,
  },
};

/**
 * Feature types for AI generation
 */
export const FEATURE_TYPES = {
  WORKOUT: 'workout',
  MEAL: 'meal',
  MENTAL_SESSION: 'mental_session',
  PHOTO_MEAL: 'photo_meal',
  /** Must match `p_feature_type` values your Supabase RPC accepts (add `future_u` in DB if needed). */
  FUTURE_U: 'future_u',
};

/**
 * Checks if the user has reached their daily limit for a specific AI generation feature
 * 
 * This function:
 * 1. Gets the current user
 * 2. Checks their premium status
 * 3. Gets their current daily usage count for the feature
 * 4. Compares it against their limit (1 for free, 20 for premium)
 * 5. Returns whether they can generate more
 * 
 * @param {string} featureType - The type of AI generation ('workout', 'meal', or 'mental_session')
 * @param {boolean} isPremium - Whether the user is premium
 * @returns {Promise<{canGenerate: boolean, currentUsage: number, limit: number, remaining: number}>}
 */
export async function checkAIGenerationLimit(featureType, isPremium) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        canGenerate: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        error: 'User not authenticated'
      };
    }

    // Get the limit based on premium status
    const ftKey = String(featureType || '').toUpperCase();
    const limit = isPremium
      ? AI_GENERATION_LIMITS.PREMIUM[ftKey]
      : AI_GENERATION_LIMITS.FREE[ftKey];
    if (limit == null) {
      console.warn('[AI Limits] Unknown feature type:', featureType);
      return {
        canGenerate: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        error: 'Unknown feature type',
      };
    }

    // Get current usage count for today (use local date so limit resets at user's midnight)
    const { data: usageData, error } = await supabase.rpc('get_ai_generation_usage', {
      p_user_id: user.id,
      p_feature_type: featureType,
      p_usage_date: getLocalDateString()
    });

    if (error) {
      console.error('Error checking AI generation usage:', error);
      const localUsage = await readLocalUsage(user.id, featureType);
      const remaining = Math.max(0, limit - localUsage);
      return {
        canGenerate: localUsage < limit,
        currentUsage: localUsage,
        limit,
        remaining,
        error: error.message,
        source: 'local',
      };
    }

    const remoteUsage = usageData || 0;
    const localUsage = await readLocalUsage(user.id, featureType);
    const currentUsage = Math.max(remoteUsage, localUsage);
    if (localUsage > remoteUsage) {
      await writeLocalUsage(user.id, featureType, currentUsage);
    }
    const remaining = Math.max(0, limit - currentUsage);
    const canGenerate = currentUsage < limit;

    console.log(`[AI Limits] ${featureType} - Usage: ${currentUsage}/${limit}, Remaining: ${remaining}, Can Generate: ${canGenerate}`);

    return {
      canGenerate,
      currentUsage,
      limit,
      remaining
    };
  } catch (error) {
    console.error('Error in checkAIGenerationLimit:', error);
    // Fail open - allow generation if there's an error
    const fallbackLimit = isPremium
      ? (AI_GENERATION_LIMITS.PREMIUM[featureType.toUpperCase()] ?? 20)
      : (AI_GENERATION_LIMITS.FREE[featureType.toUpperCase()] ?? 1);
    return {
      canGenerate: true,
      currentUsage: 0,
      limit: fallbackLimit,
      remaining: fallbackLimit,
      error: error.message
    };
  }
}

/**
 * Increments the daily usage count for a specific AI generation feature
 * 
 * This function should be called AFTER a successful AI generation to track usage.
 * It uses a database function that handles upsert logic (insert or update).
 * 
 * @param {string} featureType - The type of AI generation ('workout', 'meal', or 'mental_session')
 * @returns {Promise<{success: boolean, newCount?: number, error?: string}>}
 */
export async function incrementAIGenerationUsage(featureType) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Call the database function to increment usage (use local date)
    // Always bump local counter so the UI updates even if Supabase RPC skips future_u.
    const localNext = (await readLocalUsage(user.id, featureType)) + 1;
    await writeLocalUsage(user.id, featureType, localNext);

    const { data: rpcCount, error } = await supabase.rpc('increment_ai_generation_usage', {
      p_user_id: user.id,
      p_feature_type: featureType,
      p_usage_date: getLocalDateString()
    });

    if (error) {
      console.warn('[AI Limits] Remote increment failed, using local count:', error.message || error);
    } else if (typeof rpcCount === 'number' && rpcCount > localNext) {
      await writeLocalUsage(user.id, featureType, rpcCount);
      return { success: true, newCount: rpcCount, source: 'remote' };
    }

    console.log(`[AI Limits] Incremented ${featureType} usage. New count: ${localNext}`);
    return {
      success: true,
      newCount: localNext,
      source: error ? 'local' : 'local+remote',
    };
  } catch (error) {
    console.error('Error in incrementAIGenerationUsage:', error);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const localNext = (await readLocalUsage(user.id, featureType)) + 1;
        await writeLocalUsage(user.id, featureType, localNext);
        return { success: true, newCount: localNext, source: 'local' };
      }
    } catch {
      /* ignore */
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gets the current usage and limit information for display purposes
 * 
 * @param {string} featureType - The type of AI generation
 * @param {boolean} isPremium - Whether the user is premium
 * @returns {Promise<{currentUsage: number, limit: number, remaining: number}>}
 */
export async function getAIGenerationUsageInfo(featureType, isPremium) {
  const limitInfo = await checkAIGenerationLimit(featureType, isPremium);
  return {
    currentUsage: limitInfo.currentUsage,
    limit: limitInfo.limit,
    remaining: limitInfo.remaining
  };
}
