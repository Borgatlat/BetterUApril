/**
 * Premium Workouts screen — /premium-workouts
 *
 * Replaces the old inline "Premium Workouts" section. Lists every
 * premium workout from utils/workoutCatalog.js as compact cards.
 *
 * Locking behavior:
 *   - If the user has an active premium subscription (isPremium from
 *     UserContext is true) all cards open the detail screen normally.
 *   - If the user is NOT premium, every card is shown as locked. We
 *     still let them tap it — the detail screen will display the
 *     workout (so they can see what they'd be unlocking) and the
 *     "Start Workout" button is replaced by an "Upgrade" CTA.
 *
 * Filter UX: a small horizontal row of pill chips lets the user filter
 * by goal type (strength / muscle growth / athleticism / wellness).
 * This makes the long list scannable without paging or search.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import CompactWorkoutCard from '../components/CompactWorkoutCard';
import ScreenHeader from '../components/ScreenHeader';
import { PREMIUM_WORKOUTS } from '../utils/workoutCatalog';
import { useUser } from '../context/UserContext';

// Goal chips. We show every PREMIUM_WORKOUT by default ('all') and let
// the user narrow down with one tap. The labels here are human-readable
// versions of the `goalType` field on each workout.
const GOAL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'muscle_growth', label: 'Hypertrophy' },
  { id: 'athleticism', label: 'Athletic' },
  { id: 'wellness', label: 'Wellness' },
];

const PremiumWorkoutsScreen = () => {
  const router = useRouter();
  const { isPremium } = useUser();
  const [activeFilter, setActiveFilter] = useState('all');

  /**
   * useMemo memoizes the filtered list so we don't re-filter on every
   * render — only when `activeFilter` changes. With only ~40 entries
   * this is purely a clarity choice (the perf gain is tiny here), but
   * it's the right pattern when filtering large lists.
   */
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return PREMIUM_WORKOUTS;
    return PREMIUM_WORKOUTS.filter((w) => w.goalType === activeFilter);
  }, [activeFilter]);

  /** Open the detail screen for the tapped premium workout. */
  const handleOpen = (workout) => {
    router.push({
      pathname: '/workout-detail',
      params: {
        workout: JSON.stringify(workout),
        // Premium workouts are passed as JSON (not by name) because they
        // include their own exercise/duration/intensity payload.
        startMode: 'custom',
        // Tells the detail screen to disable the start button and show
        // an "Upgrade" CTA instead. Expo Router stringifies booleans, so
        // we explicitly send 'true' / 'false' to make parsing easy.
        locked: isPremium ? 'false' : 'true',
        title: workout.name,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/*
        Gold accent here (vs. cyan elsewhere) reinforces the "premium"
        branding all the way up to the header. The header lives
        OUTSIDE the ScrollView so it stays pinned during scroll.
      */}
      <ScreenHeader
        title="Premium Workouts"
        subtitle={isPremium ? 'All unlocked' : `${PREMIUM_WORKOUTS.length} pro routines`}
        accent="#ffd700"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/*
          Two visually distinct banners depending on subscription state:
            - Non-premium: a tappable gold "Unlock" CTA.
            - Premium:     a subtle "thanks for subscribing" status row
                           so the screen still has a hero element.
          Hiding all hero content for premium users would leave the
          chips floating awkwardly at the top.
        */}
        {!isPremium ? (
          <TouchableOpacity
            onPress={() => router.push('/purchase-subscription')}
            activeOpacity={0.9}
            style={styles.upgradeWrap}
          >
            <LinearGradient
              colors={['#ffd700', '#ffb700']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeBanner}
            >
              <View style={styles.upgradeIcon}>
                <Ionicons name="star" size={22} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeTitle}>Unlock premium workouts</Text>
                <Text style={styles.upgradeSubtitle}>
                  Get every pro routine, advanced stats, and AI tuning.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.18)', 'rgba(255, 215, 0, 0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumStatusBanner}
          >
            <View style={styles.premiumStatusIcon}>
              <Ionicons name="checkmark-circle" size={22} color="#ffd700" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumStatusTitle}>You're premium</Text>
              <Text style={styles.premiumStatusSubtitle}>
                Every workout below is fully unlocked.
              </Text>
            </View>
          </LinearGradient>
        )}

        {/*
          Filter chip row — horizontal scroll so it never wraps on
          smaller phones. The chips use cyan (not gold) when active so
          they don't compete visually with the gold premium banner.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {GOAL_FILTERS.map((f) => {
            const active = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>
          {activeFilter === 'all'
            ? `${PREMIUM_WORKOUTS.length} pro workouts`
            : `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`}
        </Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="filter-outline" size={42} color="#666" />
            <Text style={styles.emptyTitle}>No workouts match this filter</Text>
            <Text style={styles.emptySubtitle}>
              Try selecting "All" to see every premium workout.
            </Text>
          </View>
        ) : (
          filtered.map((workout, idx) => (
            <CompactWorkoutCard
              // Premium workouts may share names across split days
              // (rare but possible), so we combine name + idx for a
              // key guaranteed to be unique inside this list.
              key={`${workout.name}-${idx}`}
              workout={workout}
              onPress={() => handleOpen(workout)}
              locked={!isPremium}
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
  upgradeWrap: {
    borderRadius: 14,
    marginBottom: 14,
    // Subtle "lifted" shadow makes the gold banner feel tappable.
    shadowColor: '#ffd700',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  upgradeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTitle: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  upgradeSubtitle: {
    color: '#000',
    fontSize: 12,
    opacity: 0.78,
    marginTop: 2,
  },
  premiumStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 14,
  },
  premiumStatusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
  },
  premiumStatusTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumStatusSubtitle: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
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

export default PremiumWorkoutsScreen;
