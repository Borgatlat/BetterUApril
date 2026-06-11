import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const GUIDED_AUDIO_PREVIEW_KEY = 'betteru_guided_audio_preview_used_v1';
const PHOTO_MEAL_PREVIEW_KEY = 'betteru_photo_meal_preview_used_v1';

/** One free guided-audio session for non-premium users (conversion hook). */
export async function hasUsedGuidedAudioPreview() {
  const v = await AsyncStorage.getItem(GUIDED_AUDIO_PREVIEW_KEY);
  return v === '1';
}

export async function markGuidedAudioPreviewUsed() {
  await AsyncStorage.setItem(GUIDED_AUDIO_PREVIEW_KEY, '1');
}

export async function canUseGuidedAudioPreview() {
  return !(await hasUsedGuidedAudioPreview());
}

/** One free AI meal photo scan for non-premium users. */
export async function hasUsedPhotoMealPreview() {
  const v = await AsyncStorage.getItem(PHOTO_MEAL_PREVIEW_KEY);
  return v === '1';
}

export async function markPhotoMealPreviewUsed() {
  await AsyncStorage.setItem(PHOTO_MEAL_PREVIEW_KEY, '1');
}

export async function canUsePhotoMealPreview() {
  return !(await hasUsedPhotoMealPreview());
}

export function getCurrentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Premium Streak Shield — 1 forgiven missed day per calendar month.
 * Backed by user_streaks.streak_shield_used_month when migration is applied;
 * falls back to AsyncStorage if RPC/column unavailable.
 */
export async function getStreakShieldStatus(userId) {
  const monthKey = getCurrentMonthKey();
  const defaults = {
    isPremium: false,
    shieldAvailable: false,
    shieldUsedThisMonth: false,
    monthKey,
  };

  if (!userId) return defaults;

  try {
    const [{ data: profile }, { data: shieldRows, error: shieldError }] = await Promise.all([
      supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle(),
      supabase.rpc('get_streak_shield_status', { p_user_id: userId }),
    ]);

    const isPremium = profile?.is_premium === true;
    if (!shieldError && shieldRows?.[0]) {
      const row = shieldRows[0];
      return {
        isPremium,
        shieldAvailable: Boolean(row.shield_available),
        shieldUsedThisMonth: Boolean(row.shield_used_this_month),
        monthKey: row.month_key || monthKey,
      };
    }
  } catch (e) {
    console.warn('[getStreakShieldStatus] RPC fallback:', e?.message);
  }

  try {
    const [{ data: profile }, streakRow] = await Promise.all([
      supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle(),
      supabase.from('user_streaks').select('streak_shield_used_month').eq('user_id', userId).maybeSingle(),
    ]);
    const isPremium = profile?.is_premium === true;
    const usedMonth = streakRow?.data?.streak_shield_used_month;
    const shieldUsedThisMonth = usedMonth === monthKey;
    return {
      isPremium,
      shieldAvailable: isPremium && !shieldUsedThisMonth,
      shieldUsedThisMonth,
      monthKey,
    };
  } catch (_) {
    const localKey = `streak_shield_used_${userId}`;
    const used = await AsyncStorage.getItem(localKey);
    return {
      ...defaults,
      isPremium: false,
      shieldUsedThisMonth: used === monthKey,
      shieldAvailable: false,
    };
  }
}
