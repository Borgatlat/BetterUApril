import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Progress Rings Component
 * 
 * Displays multiple progress rings in a compact layout
 * Shows progress for: Calories, Water, Protein, Workouts, Mental Sessions
 * Each ring shows current progress toward goal
 */
const ProgressRings = ({ calories, water, protein, workouts, mental, accentColor = '#00ffff' }) => {
  const ringSize = 80;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  /**
   * Calculate progress percentage for a metric
   * Clamps between 0 and 1 (0% to 100%)
   */
  const calculateProgress = (current, goal) => {
    if (!goal || goal === 0) return 0;
    return Math.min(current / goal, 1);
  };

  /**
   * Render a single progress ring
   */
  const renderRing = (progress, color, label, value, goal, unit = '') => {
    const offset = circumference * (1 - progress);
    const percentage = Math.round(progress * 100);

    return (
      <View key={label} style={styles.ringContainer}>
        <Svg width={ringSize} height={ringSize}>
          {/* Background circle */}
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
          />
        </Svg>
        <View style={styles.ringLabelContainer}>
          <Text style={styles.ringLabel}>{label}</Text>
          <Text style={styles.ringValue}>
            {value}{unit} / {goal}{unit}
          </Text>
          <Text style={[styles.ringPercentage, { color }]}>{percentage}%</Text>
        </View>
      </View>
    );
  };

  // Calculate progress for each metric
  const calorieProgress = calculateProgress(calories?.consumed || 0, calories?.goal || 2000);
  const waterProgress = calculateProgress(
    (water?.consumed || 0) / 1000, // Convert ml to liters
    water?.goal || 2.0
  );
  const proteinProgress = calculateProgress(protein?.consumed || 0, protein?.goal || 100);
  
  // Rings use the same ratio helper: goal = 1 session per day (section title is “Today’s Progress”)
  const workoutProgress = calculateProgress(workouts ?? 0, 1);
  const mentalProgress = calculateProgress(mental ?? 0, 1);

  return (
    <View style={styles.container}>
      <View style={styles.ringsRow}>
        {renderRing(
          calorieProgress,
          '#ff4444',
          'Calories',
          Math.round(calories?.consumed || 0),
          calories?.goal || 2000,
          ' cal'
        )}
        {renderRing(
          waterProgress,
          '#00aaff',
          'Water',
          ((water?.consumed || 0) / 1000).toFixed(1),
          water?.goal || 2.0,
          'L'
        )}
        {renderRing(
          proteinProgress,
          '#00ff00',
          'Protein',
          Math.round(protein?.consumed || 0),
          protein?.goal || 100,
          'g'
        )}
      </View>
      <View style={styles.ringsRow}>
        {renderRing(
          workoutProgress,
          accentColor,
          'Workouts',
          workouts || 0,
          1,
          ''
        )}
        {renderRing(
          mentalProgress,
          '#8b5cf6',
          'Mental',
          mental || 0,
          1,
          ''
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  ringContainer: {
    alignItems: 'center',
    width: (screenWidth - 80) / 3, // 3 rings per row with padding
  },
  ringLabelContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  ringLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  ringValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  ringPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
});

export default ProgressRings;

