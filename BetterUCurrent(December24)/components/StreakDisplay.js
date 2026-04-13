/**
 * Streak Display Component
 * 
 * This component displays the user's current streak with a fire emoji.
 * When clicked, it opens a modal showing detailed streak information.
 * 
 * Props:
 * - userId: The user ID to fetch streak for
 * - size: Size of the display ('small' | 'medium' | 'large')
 * - onPress: Optional callback when streak is pressed
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStreakStatus, recalculateStreak } from '../utils/streakHelpers';

// Key to track when we last recalculated (to avoid doing it too often)
const LAST_RECALC_KEY = 'streak_last_recalculated';

export function StreakDisplay({ userId, size = 'medium', onPress, refreshKey }) {
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    longestStreak: 0,
    hasActivityToday: false,
    isAtRisk: false
  });
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const hasRecalculated = useRef(false); // Track if we've recalculated this session

  const loadStreak = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await getStreakStatus(userId);
      setStreakData(data);
    } catch (error) {
      console.error('[StreakDisplay] Error loading streak:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Auto-recalculate streak once per day on app open
  // This ensures the streak is always accurate with timezone handling
  const autoRecalculateIfNeeded = useCallback(async () => {
    if (!userId || hasRecalculated.current) return;

    try {
      // Check when we last recalculated
      const lastRecalc = await AsyncStorage.getItem(LAST_RECALC_KEY);
      const today = new Date().toDateString();

      // Only recalculate once per day (or if never done before)
      if (lastRecalc !== today) {
        console.log('[StreakDisplay] Auto-recalculating streak for accuracy...');
        hasRecalculated.current = true;
        
        // Recalculate in background (don't block UI)
        recalculateStreak(userId).then(async () => {
          // Save that we recalculated today
          await AsyncStorage.setItem(LAST_RECALC_KEY, today);
          // Reload the updated streak
          loadStreak();
        }).catch(err => {
          console.log('[StreakDisplay] Auto-recalc failed:', err);
        });
      }
    } catch (error) {
      console.log('[StreakDisplay] Error checking recalc status:', error);
    }
  }, [userId, loadStreak]);

  // Fetch streak data when component mounts, userId changes, or refreshKey changes
  useEffect(() => {
    loadStreak();
    // Also check if we need to recalculate
    autoRecalculateIfNeeded();
  }, [loadStreak, autoRecalculateIfNeeded, refreshKey]);

  // Refresh streak when screen comes into focus (user navigates back to home)
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadStreak();
      }
    }, [userId, loadStreak])
  );

  // Also refresh when app comes to foreground (user returns to app)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        userId
      ) {
        // App has come to the foreground, refresh streak
        loadStreak();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [userId, loadStreak]);

  // Size configurations
  const sizeConfig = {
    small: {
      containerPadding: 8,
      fontSize: 14,
      iconSize: 16,
      minWidth: 60
    },
    medium: {
      containerPadding: 12,
      fontSize: 18,
      iconSize: 20,
      minWidth: 80
    },
    large: {
      containerPadding: 16,
      fontSize: 24,
      iconSize: 28,
      minWidth: 100
    }
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  if (loading) {
    return (
      <View style={[styles.container, { padding: config.containerPadding, minWidth: config.minWidth }]}>
        <ActivityIndicator size="small" color="#ff6b35" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          // Add warning border if streak is at risk
          borderColor: streakData.isAtRisk ? '#ff6b35' : 'transparent',
          borderWidth: streakData.isAtRisk ? 2 : 0
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="flame" 
        size={config.iconSize} 
        color={streakData.currentStreak > 0 ? "#ff6b35" : "#666"} 
      />
      <Text style={[styles.streakNumber, { fontSize: config.fontSize }]}>
        {streakData.currentStreak}
      </Text>
      {streakData.hasActivityToday && (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={12} color="#00ff00" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    gap: 6,
    position: 'relative',
    width: '100%',
    paddingVertical: 12,
  },
  streakNumber: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#000',
    borderRadius: 10
  }
});

