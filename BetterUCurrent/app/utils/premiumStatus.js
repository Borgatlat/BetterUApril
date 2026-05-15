import { supabase } from '../../lib/supabase';

/**
 * Reads the signed-in user's premium flag from `profiles` (kept in sync by UserContext + purchases).
 * Does not force-upgrade anyone; use after login or for legacy callers that expected an async check.
 */
export async function checkAndUpdatePremiumStatus() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single();
    if (error) {
      return false;
    }
    return data?.is_premium === true;
  } catch (error) {
    console.error('Error reading premium status:', error);
    return false;
  }
}

/** Same as {@link checkAndUpdatePremiumStatus} — name kept for older imports. */
export async function getPremiumStatus() {
  return checkAndUpdatePremiumStatus();
}

/**
 * Whether another user's profile is marked premium (e.g. gold ring on avatars in lists).
 * Uses `profiles.is_premium` only — no writes.
 */
export async function isUserPremium(userId) {
  if (!userId) {
    return false;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .single();
    if (error) {
      return false;
    }
    return data?.is_premium === true;
  } catch (error) {
    console.error('Error checking user premium:', error);
    return false;
  }
}
