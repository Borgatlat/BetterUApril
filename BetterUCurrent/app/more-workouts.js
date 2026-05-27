/**
 * More Workouts screen — /more-workouts
 *
 * Replaces the old inline "Workout Types" section. Lists the six
 * built-in starter workouts (Full Body, Upper Body Power, etc.) as
 * compact cards. Tapping a card opens /workout-detail.
 *
 * Data source: STARTER_WORKOUTS in utils/workoutCatalog.js. Names match
 * keys in active-workout's `workoutData` lookup table — that's why we
 * pass startMode='type' to workout-detail (it tells the start button
 * to route via `?type=NAME` instead of passing the full workout JSON).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import CompactWorkoutCard from '../components/CompactWorkoutCard';
import ScreenHeader from '../components/ScreenHeader';
import { STARTER_WORKOUTS } from '../utils/workoutCatalog';

/**
 * Filter chips: each chip uses a `match` predicate to decide whether
 * a given workout belongs in the chip's bucket. We match against the
 * `intensity` and `name` fields so adding new starter workouts won't
 * silently break the filter (the chip will simply not include them
 * if they don't match any predicate).
 */
const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  {
    id: 'strength',
    label: 'Strength',
    // "Power" workouts are the strength bucket here. We also include
    // anything explicitly tagged as Heavy/High intensity strength work.
    match: (w) => /power|strength|squat|deadlift/i.test(w.name),
  },
  {
    id: 'cardio',
    label: 'Cardio',
    match: (w) => /cardio|hiit/i.test(w.name) || /cardio|hiit/i.test(w.intensity || ''),
  },
  {
    id: 'core',
    label: 'Core',
    match: (w) => /core|abs/i.test(w.name),
  },
  {
    id: 'fullbody',
    label: 'Full Body',
    match: (w) => /full body/i.test(w.name),
  },
];

const MoreWorkoutsScreen = () => {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('all');

  // useMemo so the filter only re-runs when the active filter id changes,
  // not on every render. (The starter list is static, so the dependency
  // array is small.)
  const visibleWorkouts = useMemo(() => {
    const f = FILTERS.find((x) => x.id === activeFilter) || FILTERS[0];
    return STARTER_WORKOUTS.filter(f.match);
  }, [activeFilter]);

  /**
   * Open the detail screen for the tapped starter workout.
   * Note: we pass startMode='type' because these workouts are looked up
   * by name inside active-workout.js's `workoutData` map, not by JSON.
   */
  const handleOpen = (workout) => {
    router.push({
      pathname: '/workout-detail',
      params: {
        // We pass the full catalog entry so the detail screen has
        // description / time / intensity / exercises to render. The
        // detail screen's "Start" button uses startMode='type' to
        // route to /active-workout?type=NAME, where active-workout.js
        // looks up the FULL set/rep structure from its own table.
        workout: JSON.stringify(workout),
        startMode: 'type',
        title: workout.name,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title="More Workouts"
        subtitle={`${STARTER_WORKOUTS.length} starter routines`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/*
          Hero banner — sets a "library / curated" tone. We use a
          warm orange gradient here (vs. cyan elsewhere) so this
          section visually differs from "Your Workouts" without
          breaking the cyan/black accent system.
        */}
        <LinearGradient
          colors={['rgba(255, 165, 0, 0.18)', 'rgba(255, 100, 0, 0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerIcon}>
            <Ionicons name="barbell" size={22} color="#ffa500" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Curated routines</Text>
            <Text style={styles.bannerSubtitle}>
              Built-in workouts to get started. Tap any to preview, then start.
            </Text>
          </View>
        </LinearGradient>

        {/*
          Horizontal filter chips. We render them inside a horizontal
          ScrollView so additional chips never wrap or get clipped on
          smaller phones. `keyboardShouldPersistTaps="handled"` lets
          the user tap a chip even if the keyboard is open elsewhere.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setActiveFilter(f.id)}
                style={[styles.chip, isActive && styles.chipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>
          {activeFilter === 'all'
            ? 'All starter workouts'
            : `${visibleWorkouts.length} match${visibleWorkouts.length === 1 ? '' : 'es'}`}
        </Text>

        {/*
          Map starter workouts to compact cards. .map() returns a new
          array of React elements — one per workout. Each card needs
          a unique `key` so React can match elements across re-renders;
          the workout name is unique inside the starter list.
        */}
        {visibleWorkouts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="filter-outline" size={42} color="#666" />
            <Text style={styles.emptyTitle}>No workouts match that filter</Text>
            <Text style={styles.emptySubtitle}>
              Try selecting "All" to see every starter workout.
            </Text>
          </View>
        ) : (
          visibleWorkouts.map((workout) => (
            <CompactWorkoutCard
              key={workout.name}
              workout={workout}
              onPress={() => handleOpen(workout)}
            />
          ))
        )}
      </ScrollView>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.28)',
    marginBottom: 16,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.35)',
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
  chipRow: {
    paddingVertical: 4,
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.16)',
    borderColor: 'rgba(0, 255, 255, 0.5)',
  },
  chipText: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#00ffff',
  },
  sectionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default MoreWorkoutsScreen;
