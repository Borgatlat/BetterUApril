/**
 * Your Workouts screen — /your-workouts
 *
 * Replaces the old inline "Your Workouts" section that used to live on
 * the main workout tab. Dedicated screen with smaller, denser cards so
 * more workouts fit on the screen at once.
 *
 * Each card shows only vital info (title + a "Custom workout" subtitle
 * + the exercise count). Tapping a card navigates to /workout-detail
 * which shows the full breakdown + muscle map + Start button.
 *
 * Data source: fetches the user's custom workouts directly from
 * Supabase. Re-fetches every time the screen is focused so freshly
 * created workouts appear instantly.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import CompactWorkoutCard from '../components/CompactWorkoutCard';
import ScreenHeader from '../components/ScreenHeader';

const YourWorkoutsScreen = () => {
  const router = useRouter();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetch the current user's custom workouts.
   *
   * We resolve the user → profile → profile_id chain because the
   * `workouts` table is keyed on `profile_id` (not auth user id).
   * This mirrors what fetchUserWorkouts does on the main workout tab.
   */
  const loadWorkouts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWorkouts([]);
        return;
      }

      // Look up the profile row that maps auth user → profile id.
      // .single() returns one row OR null; we fall back to user.id if
      // the profile doesn't exist yet (matches workout tab behavior).
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single();
      const profileId = profile?.id || user.id;

      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (err) {
      console.error('Error loading user workouts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // useFocusEffect runs every time this screen comes into view (i.e.
  // when the user navigates to it OR returns from another screen).
  // That keeps the list fresh after creating/editing/deleting workouts.
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  // Pull-to-refresh handler used by RefreshControl.
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkouts();
  }, [loadWorkouts]);

  /** Open the detail screen for a tapped workout. */
  const handleOpenWorkout = (workout) => {
    // Custom workouts are passed via JSON because they aren't in the
    // active-workout.js `workoutData` lookup table. startMode='custom'
    // tells workout-detail to route to /active-workout?custom=true.
    router.push({
      pathname: '/workout-detail',
      params: {
        // Short id survives URL limits even if the JSON below is truncated.
        workoutId: workout.id ? String(workout.id) : undefined,
        workout: JSON.stringify({
          ...workout,
          name: workout.workout_name || workout.name,
        }),
        startMode: 'custom',
        title: workout.workout_name || workout.name || 'Workout',
      },
    });
  };

  /** Delete a workout (with confirmation). */
  const handleDelete = (workoutId) => {
    Alert.alert('Delete workout', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
            if (error) throw error;
            // setWorkouts(prev => ...) is "functional setState" — React
            // gives us the latest state value as `prev` so we never
            // read stale state.
            setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
          } catch (err) {
            console.error('Error deleting workout:', err);
            Alert.alert('Error', 'Could not delete workout.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title="Your Workouts"
        subtitle={loading ? null : `${workouts.length} saved`}
        rightAction={(
          <TouchableOpacity
            onPress={() => router.push('/create-workout')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerAddBtn}
            accessibilityLabel="Create new workout"
          >
            <Ionicons name="add" size={22} color="#000" />
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#00ffff" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#00ffff"
            />
          )}
        >
          {/*
            Themed banner: cyan gradient with the bookmark icon. Sets
            the "your stuff" mood without requiring extra navigation
            chrome. LinearGradient gives it that subtle glassy feel
            that matches the rest of the app's accent palette.
          */}
          <LinearGradient
            colors={['rgba(0, 255, 255, 0.18)', 'rgba(0, 136, 255, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerIcon}>
              <Ionicons name="bookmark" size={22} color="#00ffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Your library</Text>
              <Text style={styles.bannerSubtitle}>
                Custom workouts you've built. Tap any to preview, then start.
              </Text>
            </View>
          </LinearGradient>

          {workouts.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bookmark-outline" size={42} color="#00ffff" />
              </View>
              <Text style={styles.emptyTitle}>No custom workouts yet</Text>
              <Text style={styles.emptySubtitle}>
                Build a routine tailored to you and it'll appear here.
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/create-workout')}
              >
                <Ionicons name="add" size={18} color="#000" />
                <Text style={styles.createButtonText}>Create your first one</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Saved workouts</Text>
              {workouts.map((w) => (
                <View key={w.id} style={styles.cardWrap}>
                  <CompactWorkoutCard
                    workout={{
                      name: w.workout_name || w.name,
                      description: 'Custom workout',
                    }}
                    badgeText={`${Array.isArray(w.exercises) ? w.exercises.length : 0} exercises`}
                    onPress={() => handleOpenWorkout(w)}
                  />
                  {/*
                    Delete button overlaid in the top-right of the card.
                    Absolutely positioned inside a wrapper so it doesn't
                    disturb the card's layout. We use a tinted red bg
                    so it reads as "destructive" without yelling.
                  */}
                  <TouchableOpacity
                    style={styles.deleteFloating}
                    onPress={() => handleDelete(w.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cyan "+" pill in the right-side header slot. Bright fill so it
  // pops against the dark header even at small sizes.
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00ffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
    marginBottom: 18,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00ffff',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  cardWrap: {
    position: 'relative',
  },
  deleteFloating: {
    position: 'absolute',
    top: 10,
    right: 50,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.25)',
  },
});

export default YourWorkoutsScreen;
