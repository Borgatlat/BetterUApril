import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface UserContextType {
  isPremium: boolean;
  subscriptionEndDate: Date | null;
  checkSubscriptionStatus: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
    } else {
      setIsPremium(false);
      setSubscriptionEndDate(null);
    }
  }, [user]);

  const checkSubscriptionStatus = async () => {
    try {
      if (!user?.id) {
        console.log('No user ID available for subscription check');
        return;
      }

      console.log('Checking subscription status for user:', user.id);
      
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      console.log('Subscription data:', subscription);

      if (subscription) {
        const endDate = new Date(subscription.end_date);
        const isActive = endDate > new Date();
        console.log('Subscription end date:', endDate);
        console.log('Is subscription active:', isActive);
        
        setIsPremium(isActive);
        if (isActive) {
          setSubscriptionEndDate(endDate);
        }
      } else {
        console.log('No active subscription found');
        setIsPremium(false);
        setSubscriptionEndDate(null);
      }
    } catch (error) {
      console.error('Error in checkSubscriptionStatus:', error);
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