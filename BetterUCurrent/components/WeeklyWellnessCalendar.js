import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useWeeklySchedule } from '../hooks/useWeeklySchedule';
import { useScheduleRefresh } from '../context/ScheduleRefreshContext';
import { loadFutureuPlanArtifact, getFutureuChecklistByLocalDate } from '../utils/futureuPlanStorage';
import WeekScheduleStrip from './WeekScheduleStrip';
import DayScheduleModal from './DayScheduleModal';
import { NutritionTheme as T } from '../config/NutritionTheme';
import { hexToRgba } from '../utils/homePageCustomization';

/**
 * Home "Plan Your Week" — shared week strip + day planner (same data as Workout tab).
 */
const WeeklyWellnessCalendar = ({ accentColor = '#00ffff' }) => {
  const { userProfile } = useUser();
  const { refreshKey, notifyScheduleUpdated } = useScheduleRefresh();

  const {
    weekStart,
    days,
    scheduledByDate,
    futureChecklistByDate,
    setFutureChecklistByDate,
    loading,
    goPrevWeek,
    goNextWeek,
    goToThisWeek,
  } = useWeeklySchedule(userProfile?.id, { refreshKey });

  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedActivities, setSelectedActivities] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const plan = await loadFutureuPlanArtifact();
        if (!alive) return;
        setFutureChecklistByDate(getFutureuChecklistByLocalDate(plan));
      })();
      return () => {
        alive = false;
      };
    }, [setFutureChecklistByDate])
  );

  const handleDayPress = (date, activities) => {
    setSelectedDate(date);
    setSelectedActivities(activities || []);
    setShowModal(true);
  };

  const handleScheduleUpdated = () => {
    notifyScheduleUpdated();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="calendar-outline" size={22} color={accentColor} />
            <Text style={[styles.headerText, { color: accentColor }]}>Plan Your Week</Text>
          </View>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="calendar-outline" size={22} color={accentColor} />
          <Text style={[styles.headerText, { color: accentColor }]}>Plan Your Week</Text>
        </View>
      </View>

      <WeekScheduleStrip
        days={days}
        weekStart={weekStart}
        scheduledByDate={scheduledByDate}
        futureChecklistByDate={futureChecklistByDate}
        onDayPress={handleDayPress}
        onPrevWeek={goPrevWeek}
        onNextWeek={goNextWeek}
        onThisWeek={goToThisWeek}
        accentColor={accentColor}
        showFutureDots
      />

      <DayScheduleModal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDate(null);
          setSelectedActivities([]);
        }}
        selectedDate={selectedDate}
        existingActivities={selectedActivities}
        onScheduleUpdated={handleScheduleUpdated}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: T.sectionGap,
    borderWidth: 1,
    borderColor: T.cardBorder,
    ...T.glowCard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
});

export default WeeklyWellnessCalendar;
