import { useUser } from '../../context/UserContext';

/**
 * Single source of truth for premium: reads from UserContext (same as useUser().isPremium).
 * Prefer this or useUser() so premium stays consistent with the subscriptions table sync.
 */
export function usePremiumStatus() {
  const { isPremium, checkSubscriptionStatus } = useUser();
  return { isPremium, loading: false, checkSubscriptionStatus };
}
