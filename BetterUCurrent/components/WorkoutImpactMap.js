/**
 * WorkoutImpactMap
 * ----------------
 * Side-by-side front/back body diagram that highlights the muscles a
 * given workout will train. Mirrors the visual style of `RecoveryMap`
 * (used on the home screen) but flips the meaning: instead of showing
 * "how rested" each muscle is, it shows "what this workout WILL hit."
 *
 * Built on top of `react-native-body-highlighter` — same library the
 * RecoveryMap uses, so the body silhouettes look consistent.
 *
 * Props:
 *   - exercises: array of strings or { name, targetMuscles } objects.
 *   - workoutName: optional fallback when exercises don't tag muscles.
 *
 * The component accepts both formats because:
 *   - PREMIUM_WORKOUTS / STARTER_WORKOUTS use string arrays.
 *   - User-saved custom workouts use objects with { name, sets, reps }.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Body from 'react-native-body-highlighter';
import { buildWorkoutImpactData } from '../utils/workoutMuscleMap';

const { width: screenWidth } = Dimensions.get('window');

const WorkoutImpactMap = ({ exercises, workoutName }) => {
  // The body-highlighter library's internal SVG is sized at ~400 wide.
  // We scale to fit the screen while leaving room for two side-by-side
  // diagrams (front + back). Math.min caps it so the figure isn't huge
  // on tablets.
  const scale = Math.min(0.55, (screenWidth - 80) / 800);

  const { frontData, backData } = buildWorkoutImpactData(exercises, workoutName);

  // Color ramp: 1 = secondary (muted cyan), 2 = primary (bright cyan).
  // The library treats data array order as colors[intensity-1], so the
  // first entry maps to intensity 1 and the second to intensity 2.
  const colors = ['rgba(0, 255, 255, 0.4)', '#00ffff'];

  // If the workout doesn't map to any muscles (e.g. mobility-only data
  // with no recognized labels), tell the user gracefully instead of
  // showing an empty silhouette which looks broken.
  const hasAnyImpact = frontData.length > 0 || backData.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muscles worked</Text>

      {hasAnyImpact ? (
        <View style={styles.bodyRow}>
          <View style={styles.bodyColumn}>
            <Text style={styles.label}>Front</Text>
            <Body
              data={frontData}
              colors={colors}
              side="front"
              scale={scale}
              border="#444"
              defaultFill="#222"
            />
          </View>
          <View style={styles.bodyColumn}>
            <Text style={styles.label}>Back</Text>
            <Body
              data={backData}
              colors={colors}
              side="back"
              scale={scale}
              border="#444"
              defaultFill="#222"
            />
          </View>
        </View>
      ) : (
        <Text style={styles.emptyText}>
          No specific muscle targets identified for this workout.
        </Text>
      )}

      {hasAnyImpact ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#00ffff' }]} />
            <Text style={styles.legendText}>Primary</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: 'rgba(0, 255, 255, 0.4)' }]} />
            <Text style={styles.legendText}>Secondary</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  bodyColumn: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    color: '#aaa',
    fontSize: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 30,
  },
});

export default WorkoutImpactMap;
