/**
 * Workout Detail Screen — /workout-detail
 *
 * Shared "preview" screen that opens when a user taps a workout card on
 * any of the three category screens (Your Workouts, More Workouts,
 * Premium Workouts).
 *
 * Shows everything the user needs to decide if they want to do the
 * workout: title, description, time, intensity, full exercise list with
 * sets x reps, and a body diagram (the "muscle man") highlighting which
 * muscles the workout will train.
 *
 * Tapping "Start Workout" routes to `/active-workout` using the same
 * routing pattern the previous inline cards used:
 *   - startMode='type'   → starter workouts that exist in workoutData
 *                          (active-workout.js looks them up by name).
 *   - startMode='custom' → user/premium/AI workouts where we pass the
 *                          full workout object as JSON in the URL.
 *
 * Route params (all are strings because Expo Router serializes URLs):
 *   - workout:   JSON-encoded workout object (REQUIRED)
 *   - startMode: 'type' | 'custom' (defaults to 'custom')
 *   - locked:    'true' | 'false'  (premium gating, defaults to 'false')
 *   - title:     optional override for the screen header
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WorkoutImpactMap from '../components/WorkoutImpactMap';
import { promptResumeOrStartNew } from '../utils/pendingActiveWorkout';

/**
 * Try to JSON.parse the `workout` route param. We wrap in try/catch
 * because malformed URLs would otherwise crash the screen — better to
 * show a friendly error and a back button.
 */
function safeParse(jsonString) {
  if (!jsonString) return null;
  try {
    return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch {
    return null;
  }
}

/**
 * Render an exercise summary line.
 * - String exercise (e.g. 'Bench Press') → "3 × 8"  (sensible defaults)
 * - Object exercise with a `sets` array → "{sets.length} × {reps from first set}"
 * - Object exercise with `sets` + `reps` strings → those values directly.
 */
function formatExerciseMeta(exercise) {
  if (!exercise) return '';

  if (typeof exercise === 'string') {
    return '3 × 8';
  }

  // sets: number of sets (could be a number, string, or an array of set objects)
  let setCount;
  if (Array.isArray(exercise.sets)) {
    setCount = exercise.sets.length;
  } else if (exercise.sets != null) {
    setCount = exercise.sets;
  } else {
    setCount = 3;
  }

  // reps: pull from explicit field, or from first set in the array
  let reps;
  if (exercise.reps != null && exercise.reps !== '') {
    reps = exercise.reps;
  } else if (Array.isArray(exercise.sets) && exercise.sets[0]?.reps) {
    reps = exercise.sets[0].reps;
  } else {
    reps = '8';
  }

  return `${setCount} × ${reps}`;
}

/** Pretty-print "weight per set" if the workout was previously logged. */
function formatExerciseWeight(exercise) {
  if (!exercise || typeof exercise === 'string') return '';
  if (Array.isArray(exercise.sets)) {
    // Show the first non-empty weight, if any.
    const firstWithWeight = exercise.sets.find(
      (s) => s?.weight != null && String(s.weight).trim() !== ''
    );
    if (firstWithWeight) return `${firstWithWeight.weight} lbs`;
  }
  if (exercise.weight) return `${exercise.weight} lbs`;
  return '';
}

const WorkoutDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  // useSafeAreaInsets gives us the device's "do-not-cover" margins for
  // the status bar / notch / home indicator. We use insets.top to push
  // the floating back button below the notch — without this it would
  // sit ON TOP of the status bar on iPhone X-style devices.
  const insets = useSafeAreaInsets();

  // useMemo so we don't re-parse the JSON on every render (small perf win).
  const workout = useMemo(() => safeParse(params.workout), [params.workout]);
  const startMode = (params.startMode === 'type') ? 'type' : 'custom';
  const locked = params.locked === 'true';
  const screenTitle = params.title || workout?.workout_name || workout?.name || 'Workout';

  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];

  // ---------------------------------------------------------------
  // Start handler — routes to the correct active-workout entry point
  // depending on whether this is a starter (lookup-by-name) or a
  // custom/premium workout (passed as JSON).
  // ---------------------------------------------------------------
  const handleStart = () => {
    if (locked) {
      Alert.alert(
        'Premium Workout',
        'This workout is part of BetterU Premium. Upgrade to unlock.',
        [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/purchase-subscription') },
        ]
      );
      return;
    }

    const navigateToActiveWorkout = () => {
      if (startMode === 'type') {
        router.replace({
          pathname: '/active-workout',
          params: { type: workout.name || workout.workout_name },
        });
        return;
      }

      const startParams = { custom: 'true' };
      const routeWorkoutId = Array.isArray(params.workoutId)
        ? params.workoutId[0]
        : params.workoutId;
      const resolvedId = workout?.id || routeWorkoutId;
      if (resolvedId) {
        startParams.workoutId = String(resolvedId);
      } else if (workout) {
        startParams.workout = JSON.stringify(workout);
      } else {
        Alert.alert('Error', 'Workout data is missing. Please go back and try again.');
        return;
      }
      router.replace({
        pathname: '/active-workout',
        params: startParams,
      });
    };

    promptResumeOrStartNew({
      onResume: () => router.replace({ pathname: '/active-workout', params: { resume: 'true' } }),
      onStartNew: navigateToActiveWorkout,
    });
  };

  // ---------------------------------------------------------------
  // Floating back button — replaces the previous full-width header
  // bar (which the user found visually noisy). This is a small pill
  // anchored to the top-left, layered ABOVE the ScrollView via
  // `position: 'absolute'` + `zIndex`. It uses `insets.top + 12` so
  // it always clears the status bar / notch on every device.
  // ---------------------------------------------------------------
  const renderFloatingBack = () => (
    <TouchableOpacity
      onPress={() => {
        // router.canGoBack returns false if the user deep-linked
        // straight into this screen with no history. Fall back to
        // the workout tab so they don't get stuck.
        if (router.canGoBack && router.canGoBack()) router.back();
        else router.replace('/(tabs)/workout');
      }}
      style={[styles.floatingBack, { top: insets.top + 12 }]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={22} color="#00ffff" />
    </TouchableOpacity>
  );

  // Defensive: if params.workout was missing or unparseable, show a
  // friendly "couldn't load" view rather than crashing.
  if (!workout) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {renderFloatingBack()}
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={48} color="#cc6666" />
          <Text style={styles.errorText}>Couldn't load this workout.</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {renderFloatingBack()}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          // Push content BELOW the floating back button so the title
          // text isn't hidden behind it on first paint. Math:
          //   - safe area top
          //   - + 12 (back button's top offset)
          //   - + 36 (back button height)
          //   - + 12 (visual breathing room before content begins)
          { paddingTop: insets.top + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/*
          Hero block: title + description + meta + (optional) "How to" tip.
          The title is back here now that we don't render a full header
          bar above. The locked badge sits in a small row above the
          title for premium content.
        */}
        <View style={styles.heroCard}>
          {locked ? (
            <View style={styles.lockedBadgeRow}>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={12} color="#000" />
                <Text style={styles.lockedBadgeText}>Premium</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.heroTitle}>{screenTitle}</Text>

          {workout.description ? (
            <Text style={styles.heroDescription}>{workout.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            {workout.duration ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#00ffff" />
                <Text style={styles.metaText}>{workout.duration}</Text>
              </View>
            ) : null}
            {workout.intensity ? (
              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={16} color="#ffa500" />
                <Text style={styles.metaText}>{workout.intensity}</Text>
              </View>
            ) : null}
            {workout.repRange ? (
              <View style={styles.metaItem}>
                <Ionicons name="repeat-outline" size={16} color="#aaa" />
                <Text style={styles.metaText}>{workout.repRange}</Text>
              </View>
            ) : null}
          </View>

          {workout.howTo ? (
            <View style={styles.howToBox}>
              <Ionicons name="bulb-outline" size={16} color="#ffd700" />
              <Text style={styles.howToText}>{workout.howTo}</Text>
            </View>
          ) : null}
        </View>

        {/* Muscle map — the "muscle man" the user asked for */}
        <View style={styles.section}>
          <WorkoutImpactMap exercises={exercises} workoutName={workout.name || workout.workout_name} />
        </View>

        {/* Exercise list with sets x reps (and weights if present) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Exercises ({exercises.length})
          </Text>
          {exercises.length === 0 ? (
            <Text style={styles.emptyText}>No exercises in this workout.</Text>
          ) : (
            exercises.map((ex, idx) => {
              const name = typeof ex === 'string' ? ex : (ex?.name || `Exercise ${idx + 1}`);
              const meta = formatExerciseMeta(ex);
              const weight = formatExerciseWeight(ex);
              const muscles =
                typeof ex === 'object' && ex?.targetMuscles
                  ? Array.isArray(ex.targetMuscles)
                    ? ex.targetMuscles.join(', ')
                    : ex.targetMuscles
                  : null;

              return (
                <View key={`${name}-${idx}`} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {idx + 1}. {name}
                    </Text>
                    <Text style={styles.exerciseMeta}>{meta}</Text>
                  </View>
                  {(weight || muscles) ? (
                    <View style={styles.exerciseSubRow}>
                      {weight ? (
                        <View style={styles.exerciseSubItem}>
                          <Ionicons name="barbell-outline" size={13} color="#888" />
                          <Text style={styles.exerciseSubText}>{weight}</Text>
                        </View>
                      ) : null}
                      {muscles ? (
                        <View style={[styles.exerciseSubItem, { flexShrink: 1 }]}>
                          <Ionicons name="body-outline" size={13} color="#888" />
                          <Text style={styles.exerciseSubText} numberOfLines={1}>
                            {muscles}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Spacer so the floating start button doesn't overlap the last card */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.startButton, locked && styles.startButtonLocked]}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <Ionicons
            name={locked ? 'lock-closed' : 'play-circle'}
            size={22}
            color="#000"
          />
          <Text style={styles.startButtonText}>
            {locked ? 'Unlock with Premium' : 'Start Workout'}
          </Text>
        </TouchableOpacity>
      </View>
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
    // paddingTop is set inline so it can be `insets.top + 60` and
    // adjust for notched devices. Don't override it here.
    paddingBottom: 24,
  },
  // Small floating back-pill in the top-left. position:'absolute'
  // takes it out of the normal layout flow so it sits ON TOP of the
  // ScrollView (no full-width bar). zIndex makes sure the ScrollView
  // can't paint over it on slower renders.
  floatingBack: {
    position: 'absolute',
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
    zIndex: 10,
  },
  heroCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.18)',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  // Wraps the small "Premium" pill so it sits at the top of the
  // hero card (where the title used to be). flex-start keeps the
  // pill width-fit-content instead of stretching across the row.
  lockedBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffd700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  lockedBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  heroDescription: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '500',
  },
  howToBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  howToText: {
    flex: 1,
    color: '#ddd',
    fontSize: 12,
    lineHeight: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  exerciseName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseMeta: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseSubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  exerciseSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exerciseSubText: {
    color: '#999',
    fontSize: 12,
  },
  emptyText: {
    color: '#777',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonLocked: {
    backgroundColor: '#ffd700',
  },
  startButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    color: '#ccc',
    fontSize: 16,
  },
  errorButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  errorButtonText: {
    color: '#000',
    fontWeight: '700',
  },
});

export default WorkoutDetailScreen;
