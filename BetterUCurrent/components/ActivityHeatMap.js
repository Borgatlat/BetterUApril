import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalDateString } from '../utils/scheduledWorkoutHelpers';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Activity Heat Map Component
 * 
 * Displays a GitHub-style contribution calendar showing activity streaks
 * Each square represents a day, with color intensity based on activity level
 * 
 * Color scheme:
 * - No activity: Dark gray (#161b22)
 * - Low activity: Light green (#0e4429)
 * - Medium activity: Medium green (#006d32)
 * - High activity: Bright green (#26a641)
 * - Very high activity: Dark green (#39d353)
 */
const ActivityHeatMap = ({ workouts, mentalSessions, userId, accentColor = '#00ffff' }) => {
  const [activityMap, setActivityMap] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);

  const buildActivityMap = useCallback(() => {
    const map = {};
    const now = new Date();

    // Keys use local calendar dates so they match completed_at in the user’s timezone
    for (let i = 0; i < 365; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);
      map[dateStr] = 0;
    }

    (workouts || []).forEach((workout) => {
      if (workout.completed_at) {
        const date = getLocalDateString(new Date(workout.completed_at));
        if (map[date] !== undefined) map[date] += 1;
      }
    });

    (mentalSessions || []).forEach((session) => {
      if (session.completed_at) {
        const date = getLocalDateString(new Date(session.completed_at));
        if (map[date] !== undefined) map[date] += 1;
      }
    });

    setActivityMap(map);
  }, [workouts, mentalSessions]);

  useEffect(() => {
    buildActivityMap();
  }, [buildActivityMap]);

  /**
   * Get color based on activity level
   * Returns color string for the activity square
   */
  const getActivityColor = (level) => {
    if (level === 0) return '#161b22'; // No activity
    if (level === 1) return '#0e4429'; // Low activity (1 activity)
    if (level === 2) return '#006d32'; // Medium activity (2 activities)
    if (level === 3) return '#26a641'; // High activity (3 activities)
    return '#39d353'; // Very high activity (4+ activities)
  };

  /**
   * Render the heat map grid
   * Creates a 7x53 grid (7 days per week, ~53 weeks)
   */
  const renderHeatMap = () => {
    const now = new Date();
    const squares = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Start from 364 days ago (to show full year)
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 364);
    
    // Find the day of week for the start date
    let startDayOfWeek = startDate.getDay();
    
    // Add empty squares to align with week start
    for (let i = 0; i < startDayOfWeek; i++) {
      squares.push(
        <View key={`empty-${i}`} style={[styles.square, styles.emptySquare]} />
      );
    }

    // Generate squares for each day
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = getLocalDateString(date);
      const activityLevel = activityMap[dateStr] || 0;
      const isSelected = selectedDay === dateStr;

      squares.push(
        <TouchableOpacity
          key={dateStr}
          style={[
            styles.square,
            {
              backgroundColor: getActivityColor(activityLevel),
              borderWidth: isSelected ? 2 : 0,
              borderColor: accentColor,
            }
          ]}
          onPress={() => setSelectedDay(isSelected ? null : dateStr)}
          activeOpacity={0.7}
        />
      );
    }

    return squares;
  };

  /**
   * Get activity summary for selected day
   */
  const getSelectedDayInfo = () => {
    if (!selectedDay) return null;

    const dayWorkouts = (workouts || []).filter((w) => {
      if (!w.completed_at) return false;
      return getLocalDateString(new Date(w.completed_at)) === selectedDay;
    });

    const dayMental = (mentalSessions || []).filter((m) => {
      if (!m.completed_at) return false;
      return getLocalDateString(new Date(m.completed_at)) === selectedDay;
    });

    const date = new Date(`${selectedDay}T12:00:00`);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      workouts: dayWorkouts.length,
      mental: dayMental.length,
      total: dayWorkouts.length + dayMental.length
    };
  };

  const selectedInfo = getSelectedDayInfo();

  return (
    <View style={styles.container}>
      <View style={styles.heatMapContainer}>
        {/* Day labels */}
        <View style={styles.dayLabels}>
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((day, index) => (
            <Text key={index} style={styles.dayLabel}>
              {day}
            </Text>
          ))}
        </View>

        {/* Heat map grid */}
        <View style={styles.grid}>
          {renderHeatMap()}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendSquares}>
          <View style={[styles.legendSquare, { backgroundColor: '#161b22' }]} />
          <View style={[styles.legendSquare, { backgroundColor: '#0e4429' }]} />
          <View style={[styles.legendSquare, { backgroundColor: '#006d32' }]} />
          <View style={[styles.legendSquare, { backgroundColor: '#26a641' }]} />
          <View style={[styles.legendSquare, { backgroundColor: '#39d353' }]} />
        </View>
        <Text style={styles.legendText}>More</Text>
      </View>

      {/* Selected day info */}
      {selectedInfo && (
        <View style={styles.selectedDayInfo}>
          <Text style={styles.selectedDayTitle}>{selectedInfo.date}</Text>
          <View style={styles.selectedDayStats}>
            <View style={styles.selectedDayStat}>
              <Ionicons name="fitness" size={16} color={accentColor} />
              <Text style={styles.selectedDayStatText}>
                {selectedInfo.workouts} {selectedInfo.workouts === 1 ? 'workout' : 'workouts'}
              </Text>
            </View>
            <View style={styles.selectedDayStat}>
              <Ionicons name="heart" size={16} color="#8b5cf6" />
              <Text style={styles.selectedDayStatText}>
                {selectedInfo.mental} {selectedInfo.mental === 1 ? 'session' : 'sessions'}
              </Text>
            </View>
            <View style={styles.selectedDayStat}>
              <Ionicons name="checkmark-circle" size={16} color="#00ff00" />
              <Text style={styles.selectedDayStatText}>
                {selectedInfo.total} total activities
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heatMapContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  dayLabels: {
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingTop: 2,
  },
  dayLabel: {
    color: '#666',
    fontSize: 10,
    height: 11,
    marginBottom: 1,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  square: {
    width: 11,
    height: 11,
    borderRadius: 2,
    marginRight: 3,
    marginBottom: 3,
  },
  emptySquare: {
    backgroundColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  legendText: {
    color: '#666',
    fontSize: 12,
  },
  legendSquares: {
    flexDirection: 'row',
    gap: 3,
  },
  legendSquare: {
    width: 11,
    height: 11,
    borderRadius: 2,
  },
  selectedDayInfo: {
    marginTop: 15,
    padding: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  selectedDayTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectedDayStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  selectedDayStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedDayStatText: {
    color: '#aaa',
    fontSize: 12,
  },
});

export default ActivityHeatMap;

