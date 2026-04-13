import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const UserContext = createContext(undefined);

export const UserProvider = ({ children }) => {
  console.warn('[UserContext] UserProvider mounted');
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    console.warn('[UserContext] useEffect running. user:', user, 'profile:', profile);
    if (user) {
      checkSubscriptionStatus();
    } else {
      setIsPremium(false);
      setSubscriptionEndDate(null);
    }
  }, [user, profile]);

  const checkSubscriptionStatus = async () => {
    console.log('[UserContext] checkSubscriptionStatus called');
    try {
      const idToUse = profile?.profile_id || profile?.id || user?.id;
      console.log('[UserContext] IDs:', {
        userId: user?.id,
        profileId: profile?.profile_id,
        profile_id: profile?.id,
        idToUse
      });
      if (!idToUse) {
        console.log('No user or profile ID available for subscription check');
        setIsPremium(false);
        setSubscriptionEndDate(null);
        return;
      }
      console.log('Checking subscription status for ID:', idToUse);
      // Check for subscriptions with either profile_id or user_id
      const { data: allSubscriptions, error: listError } = await supabase
        .from('subscriptions')
        .select('*')
        .or(`profile_id.eq.${idToUse},user_id.eq.${idToUse}`);
      if (listError) {
        console.error('[UserContext] Error listing subscriptions:', listError);
      } else {
        console.log('[UserContext] Found subscriptions:', allSubscriptions?.length || 0, allSubscriptions);
        allSubscriptions?.forEach(sub => {
          console.log('[UserContext] Subscription:', {
            id: sub.id,
            status: sub.status,
            start_date: sub.start_date,
            end_date: sub.end_date,
            profile_id: sub.profile_id,
            user_id: sub.user_id
          });
        });
      }
      // Now check for active subscription
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .or(`profile_id.eq.${idToUse},user_id.eq.${idToUse}`)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1)
        .single();
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[UserContext] No active subscription found (no rows returned)');
          setIsPremium(false);
          setSubscriptionEndDate(null);
          return;
        }
        console.error('[UserContext] Error checking subscription:', error);
        setIsPremium(false);
        setSubscriptionEndDate(null);
        return;
      }
      console.log('[UserContext] Active subscription found:', subscription);
      if (subscription) {
        const now = new Date();
        const startDate = subscription.start_date ? new Date(subscription.start_date) : null;
        const endDate = subscription.end_date ? new Date(subscription.end_date) : null;
        const isActive = startDate && endDate && now >= startDate && now <= endDate;
        console.log('[UserContext] Subscription details:', {
          currentTime: now.toISOString(),
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          isActive: isActive,
          daysRemaining: endDate ? (endDate - now) / (1000 * 60 * 60 * 24) : null,
          raw: subscription
        });
        setIsPremium(isActive);
        console.log('[UserContext] setIsPremium called with:', isActive);
        if (isActive) {
          setSubscriptionEndDate(endDate);
          console.log('[UserContext] Premium status set to: true');
        } else {
          console.log('[UserContext] Subscription found but not active - end date has passed or not started', { startDate, endDate, now });
          setIsPremium(false);
          setSubscriptionEndDate(null);
        }
      } else {
        console.log('[UserContext] No active subscription found');
        setIsPremium(false);
        setSubscriptionEndDate(null);
      }
    } catch (error) {
      console.error('[UserContext] Unexpected error in checkSubscriptionStatus:', error);
      setIsPremium(false);
      setSubscriptionEndDate(null);
    }
  };

  return (
    <UserContext.Provider value={{ isPremium, subscriptionEndDate, checkSubscriptionStatus }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}; 