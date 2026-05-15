import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';

const SharedMessageLimitContext = createContext();

export const SharedMessageLimitProvider = ({ children }) => {
  const { isPremium } = useUser();
  const [sharedMessageCount, setSharedMessageCount] = useState(0);

  // Shared message limits - Premium users get 100 messages, free users get 10
  const MAX_DAILY_MESSAGES_FREE = 10; // Free users: 10 total messages per day across both AI assistants
  const MAX_DAILY_MESSAGES_PREMIUM = 100; // Premium users: 100 total messages per day across both AI assistants
  
  // Dynamic message limit based on premium status
  const MAX_DAILY_MESSAGES = isPremium ? MAX_DAILY_MESSAGES_PREMIUM : MAX_DAILY_MESSAGES_FREE;

  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Function to check and reset shared message count
  const checkAndResetSharedMessageCount = React.useCallback(async () => {
    try {
      const today = getTodayString();
      const storedDate = await AsyncStorage.getItem('sharedMessageCountDate');
      const storedCount = await AsyncStorage.getItem('sharedMessageCount');

      if (storedDate !== today) {
        // Reset for new day
        await AsyncStorage.setItem('sharedMessageCount', '0');
        await AsyncStorage.setItem('sharedMessageCountDate', today);
        setSharedMessageCount(0);
        console.log('[SharedMessageLimit] Reset message count for new day');
      } else {
        const count = parseInt(storedCount || '0', 10);
        setSharedMessageCount(count);
        console.log('[SharedMessageLimit] Loaded existing message count:', count);
      }
    } catch (error) {
      console.error('[SharedMessageLimit] Error checking message count:', error);
    }
  }, []);

  // Function to increment shared message count
  const incrementSharedMessageCount = React.useCallback(async () => {
    try {
      const newCount = sharedMessageCount + 1;
      setSharedMessageCount(newCount);
      await AsyncStorage.setItem('sharedMessageCount', newCount.toString());
      console.log('[SharedMessageLimit] Incremented message count to:', newCount);
      return newCount;
    } catch (error) {
      console.error('[SharedMessageLimit] Error incrementing message count:', error);
      return sharedMessageCount;
    }
  }, [sharedMessageCount]);

  // Function to get current message count
  const getCurrentMessageCount = () => {
    return sharedMessageCount;
  };

  // Function to check if user has reached the limit
  const hasReachedLimit = () => {
    return sharedMessageCount >= MAX_DAILY_MESSAGES;
  };

  // Function to get remaining messages
  const getRemainingMessages = () => {
    return Math.max(0, MAX_DAILY_MESSAGES - sharedMessageCount);
  };

  // Function to force refresh message count (for midnight reset)
  const forceRefreshMessageCount = React.useCallback(async () => {
    try {
      const today = getTodayString();
      await AsyncStorage.setItem('sharedMessageCount', '0');
      await AsyncStorage.setItem('sharedMessageCountDate', today);
      setSharedMessageCount(0);
      console.log('[SharedMessageLimit] Force refreshed message count for new day');
    } catch (error) {
      console.error('[SharedMessageLimit] Error force refreshing message count:', error);
    }
  }, []);

  // Load message count on mount
  useEffect(() => {
    checkAndResetSharedMessageCount();
  }, [checkAndResetSharedMessageCount]);

  // Reset message count when premium status changes (in case user upgrades/downgrades)
  useEffect(() => {
    console.log('[SharedMessageLimit] Premium status changed to:', isPremium);
    console.log('[SharedMessageLimit] New message limit:', MAX_DAILY_MESSAGES);
    // Force refresh to ensure the new limit is applied
    checkAndResetSharedMessageCount();
  }, [isPremium, checkAndResetSharedMessageCount]);

  const value = {
    sharedMessageCount,
    MAX_DAILY_MESSAGES,
    MAX_DAILY_MESSAGES_FREE,
    MAX_DAILY_MESSAGES_PREMIUM,
    isPremium,
    checkAndResetSharedMessageCount,
    incrementSharedMessageCount,
    getCurrentMessageCount,
    hasReachedLimit,
    getRemainingMessages,
    forceRefreshMessageCount,
  };

  return <SharedMessageLimitContext.Provider value={value}>{children}</SharedMessageLimitContext.Provider>;
};

export const useSharedMessageLimit = () => {
  const context = useContext(SharedMessageLimitContext);
  if (!context) {
    throw new Error('useSharedMessageLimit must be used within a SharedMessageLimitProvider');
  }
  return context;
}; 