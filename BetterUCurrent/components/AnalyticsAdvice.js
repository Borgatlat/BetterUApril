import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Analytics Advice Component
 * 
 * Provides AI-powered personalized advice based on user's analytics data
 * Includes:
 * - Progressive overload suggestions
 * - Workout frequency recommendations
 * - Recovery advice
 * - Nutrition tips
 * - Mental wellness suggestions
 */
const AnalyticsAdvice = ({
  workoutData,
  mentalData,
  calorieData,
  waterData,
  comparisonData,
  stats,
  /** Matches Home accent from “Change your home page” so advice cards feel like the same app. */
  accentColor = '#00ffff',
}) => {
  const [advice, setAdvice] = useState([]);

  useEffect(() => {
    generateAdvice();
  }, [workoutData, mentalData, calorieData, waterData, comparisonData, stats, accentColor]);

  /**
   * Generate personalized advice based on user data
   * Analyzes patterns and provides actionable recommendations
   */
  const generateAdvice = () => {
    const adviceList = [];

    // Analyze workout data for progressive overload
    if (workoutData && workoutData.length > 0) {
      const workoutAdvice = analyzeWorkouts(workoutData);
      if (workoutAdvice) adviceList.push(workoutAdvice);
    }

    // Analyze mental session frequency
    if (mentalData && mentalData.length > 0) {
      const mentalAdvice = analyzeMentalSessions(mentalData);
      if (mentalAdvice) adviceList.push(mentalAdvice);
    }

    // Analyze nutrition
    if (calorieData && calorieData.length > 0) {
      const nutritionAdvice = analyzeNutrition(calorieData, waterData);
      if (nutritionAdvice) adviceList.push(...nutritionAdvice);
    }

    // Analyze trends from comparison data
    if (comparisonData) {
      const trendAdvice = analyzeTrends(comparisonData);
      if (trendAdvice) adviceList.push(...trendAdvice);
    }

    // General recommendations
    const generalAdvice = generateGeneralAdvice(stats);
    if (generalAdvice) adviceList.push(...generalAdvice);

    setAdvice(adviceList);
  };

  /**
   * Analyze workout data for progressive overload opportunities
   * Checks for:
   * - Consistent workout frequency
   * - Increasing volume/weight over time
   * - Recovery patterns
   */
  const analyzeWorkouts = (workouts) => {
    if (workouts.length < 3) {
      return {
        type: 'workout',
        icon: 'fitness',
        color: accentColor,
        title: 'Build Consistency',
        message: 'Complete 3+ workouts this week to establish a routine. Consistency is key to progress!',
        priority: 'medium'
      };
    }

    // Calculate average workouts per week
    const recentWorkouts = workouts.slice(-14); // Last 2 weeks
    const workoutsPerWeek = recentWorkouts.length / 2;

    if (workoutsPerWeek < 3) {
      return {
        type: 'workout',
        icon: 'fitness',
        color: accentColor,
        title: 'Increase Frequency',
        message: `You're averaging ${workoutsPerWeek.toFixed(1)} workouts per week. Aim for 3-4 workouts weekly for optimal results.`,
        priority: 'high'
      };
    }

    // Check for progressive overload opportunity
    const totalWeight = recentWorkouts.reduce((sum, w) => {
      // Try to extract total weight from exercises if available
      if (w.exercises && Array.isArray(w.exercises)) {
        const exerciseWeight = w.exercises.reduce((exSum, ex) => {
          return exSum + ((ex.weight || 0) * (ex.sets || 0) * (ex.reps || 0));
        }, 0);
        return sum + exerciseWeight;
      }
      return sum;
    }, 0);

    if (totalWeight > 0) {
      return {
        type: 'workout',
        icon: 'trending-up',
        color: accentColor,
        title: 'Progressive Overload',
        message: 'Great consistency! Try increasing weight by 2.5-5% or adding 1-2 reps per set to continue building strength.',
        priority: 'high'
      };
    }

    return {
      type: 'workout',
      icon: 'checkmark-circle',
      color: '#00ff00',
      title: 'Excellent Progress',
      message: 'You\'re maintaining great workout consistency! Keep up the momentum.',
      priority: 'low'
    };
  };

  /**
   * Analyze mental session frequency and patterns
   */
  const analyzeMentalSessions = (mental) => {
    const recentSessions = mental.slice(-14); // Last 2 weeks
    const sessionsPerWeek = recentSessions.length / 2;

    if (sessionsPerWeek < 2) {
      return {
        type: 'mental',
        icon: 'heart',
        color: '#8b5cf6',
        title: 'Mental Wellness',
        message: 'Aim for 2-3 mental wellness sessions per week. Regular practice improves overall well-being.',
        priority: 'medium'
      };
    }

    return {
      type: 'mental',
      icon: 'heart',
      color: '#8b5cf6',
      title: 'Wellness Balance',
      message: 'You\'re maintaining good mental wellness habits. Consider adding morning meditation for even better results.',
      priority: 'low'
    };
  };

  /**
   * Analyze nutrition data (calories and water)
   */
  const analyzeNutrition = (calories, water) => {
    const adviceList = [];

    // Analyze calorie consistency
    // Handle different column names in user_tracking table
    const recentCalories = calories.slice(-7); // Last week
    const avgCalories = recentCalories.reduce((sum, c) => {
      return sum + (c.calories || c.calories_consumed || 0);
    }, 0) / recentCalories.length;

    if (avgCalories < 1200) {
      adviceList.push({
        type: 'nutrition',
        icon: 'warning',
        color: '#ff4444',
        title: 'Low Calorie Intake',
        message: 'Your average daily calories are quite low. Ensure you\'re eating enough to support your activity level and recovery.',
        priority: 'high'
      });
    } else if (avgCalories > 3500) {
      adviceList.push({
        type: 'nutrition',
        icon: 'flame',
        color: '#ff4444',
        title: 'High Calorie Intake',
        message: 'Your calorie intake is high. If weight loss is a goal, consider a moderate deficit of 300-500 calories.',
        priority: 'medium'
      });
    }

    // Analyze water intake
    if (water && water.length > 0) {
      const recentWater = water.slice(-7);
      const avgWater = recentWater.reduce((sum, w) => {
        const waterValue = w.water_liters || (w.water_consumed_ml ? w.water_consumed_ml / 1000 : 0);
        return sum + waterValue;
      }, 0) / recentWater.length;

      if (avgWater < 1.5) {
        adviceList.push({
          type: 'nutrition',
          icon: 'water',
          color: '#00aaff',
          title: 'Hydration Reminder',
          message: 'Aim for 2-3 liters of water daily, especially on workout days. Proper hydration improves performance and recovery.',
          priority: 'high'
        });
      }
    }

    return adviceList;
  };

  /**
   * Analyze trends from comparison data
   */
  const analyzeTrends = (comparison) => {
    const adviceList = [];

    // Workout trend
    if (comparison.workouts.change < -20) {
      adviceList.push({
        type: 'trend',
        icon: 'trending-down',
        color: '#ff4444',
        title: 'Workout Frequency Down',
        message: `Your workouts decreased by ${Math.abs(comparison.workouts.change).toFixed(0)}% this week. Try to get back on track with at least 3 workouts.`,
        priority: 'high'
      });
    } else if (comparison.workouts.change > 20) {
      adviceList.push({
        type: 'trend',
        icon: 'trending-up',
        color: '#00ff00',
        title: 'Great Progress!',
        message: `You increased workouts by ${comparison.workouts.change.toFixed(0)}%! Keep this momentum going.`,
        priority: 'low'
      });
    }

    // Mental session trend
    if (comparison.mental.change < -30) {
      adviceList.push({
        type: 'trend',
        icon: 'heart-outline',
        color: '#8b5cf6',
        title: 'Mental Wellness',
        message: 'Don\'t forget about mental wellness! Even 10 minutes of meditation can make a difference.',
        priority: 'medium'
      });
    }

    return adviceList;
  };

  /**
   * Generate general advice based on overall stats
   */
  const generateGeneralAdvice = (stats) => {
    const adviceList = [];

    // Streak advice
    if (stats && stats.streak) {
      if (stats.streak >= 7 && stats.streak < 30) {
        adviceList.push({
          type: 'streak',
          icon: 'flame',
          color: '#ff4444',
          title: `${stats.streak} Day Streak!`,
          message: 'You\'re on fire! Keep the streak alive by maintaining daily activity.',
          priority: 'low'
        });
      } else if (stats.streak >= 30) {
        adviceList.push({
          type: 'streak',
          icon: 'trophy',
          color: '#FFD700',
          title: 'Incredible Streak!',
          message: `${stats.streak} days strong! You've built an amazing habit. Consider a rest day if needed.`,
          priority: 'low'
        });
      }
    }

    // Recovery advice
    if (stats && stats.workouts >= 5) {
      adviceList.push({
        type: 'recovery',
        icon: 'bed',
        color: '#8b5cf6',
        title: 'Recovery Time',
        message: 'You\'ve been training hard! Make sure to get 7-9 hours of sleep and consider a rest day for optimal recovery.',
        priority: 'medium'
      });
    }

    return adviceList;
  };

  /**
   * Get priority color for advice card border
   */
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#ff4444';
      case 'medium':
        return '#ffaa00';
      case 'low':
        return '#00ff00';
      default:
        return accentColor;
    }
  };

  if (advice.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bulb-outline" size={48} color="#666" />
        <Text style={styles.emptyText}>Keep tracking to receive personalized advice!</Text>
      </View>
    );
  }

  // Sort advice by priority (high -> medium -> low)
  const sortedAdvice = [...advice].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });

  return (
    <View style={styles.container}>
      {sortedAdvice.map((item, index) => (
        <View
          key={index}
          style={[
            styles.adviceCard,
            { borderLeftColor: item.color, borderLeftWidth: 4 }
          ]}
        >
          <View style={styles.adviceHeader}>
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={styles.adviceTextContainer}>
              <Text style={styles.adviceTitle}>{item.title}</Text>
              <Text style={styles.adviceMessage}>{item.message}</Text>
            </View>
          </View>
          {item.priority === 'high' && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityBadgeText}>Important</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  adviceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  adviceHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adviceTextContainer: {
    flex: 1,
  },
  adviceTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  adviceMessage: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 8,
  },
  priorityBadgeText: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default AnalyticsAdvice;

