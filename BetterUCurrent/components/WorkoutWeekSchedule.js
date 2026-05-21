import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useWeeklySchedule } from '../hooks/useWeeklySchedule';
import { useScheduleRefresh } from '../context/ScheduleRefreshContext';
import WeekScheduleStrip from './WeekScheduleStrip';
import ScheduledWorkoutModal from './ScheduledWorkoutModal';
import { formatSplitDayLabel, isSplitRestDay } from '../utils/splitDayUtils';

const SPLIT_REST_COLOR = '#ffa500';
import { hexToRgba } from '../utils/homePageCustomization';

/** Gym/rest row for ScheduledWorkoutModal (same as old calendar single-day tap). */
function primaryGymActivity(activities) {
  if (!Array.isArray(activities) || activities.length === 0) return null;
  const workout = activities.find((a) => a.activity_type === 'workout' && !a.is_rest_day);
  if (workout) return workout;
  const rest = activities.find((a) => a.is_rest_day || a.activity_type === 'rest_day');
  if (rest) return rest;
  return null;
}

/**
 * Workout tab week schedule — same data as Home, plus training-split label per day.
 */
export default function WorkoutWeekSchedule({
  accentColor = '#00ffff',
  getSplitDayForDate,
  scheduleContextForDate,
}) {
  const { userProfile } = useUser();
  const { refreshKey, notifyScheduleUpdated } = useScheduleRefresh();

  const {
    weekStart,
    days,
    scheduledByDate,
    loading,
    goPrevWeek,
    goNextWeek,
    goToThisWeek,
  } = useWeeklySchedule(userProfile?.id, { refreshKey, loadFuturePlan: false });

  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [existingWorkout, setExistingWorkout] = useState(null);
  const [scheduleContext, setScheduleContext] = useState(null);

  const handleDayPress = (date, activities) => {
    setSelectedDate(date);
    setExistingWorkout(primaryGymActivity(activities));
    setScheduleContext(scheduleContextForDate?.(date) ?? null);
    setShowWorkoutModal(true);
  };

  const renderDayExtra = (date) => {
    if (!getSplitDayForDate) return null;
    const splitDay = getSplitDayForDate(date);
    const label = formatSplitDayLabel(splitDay);
    const isRest = isSplitRestDay(splitDay);
    const color = isRest ? SPLIT_REST_COLOR : accentColor;
    return (
      <Text style={[styles.splitLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { borderColor: hexToRgba(accentColor, 0.12) }]}>
        <Text style={styles.title}>This week</Text>
        <ActivityIndicator size="small" color={accentColor} style={{ marginVertical: 20 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: hexToRgba(accentColor, 0.12) }]}>
      <View style={styles.titleRow}>
        <Ionicons name="calendar-outline" size={20} color={accentColor} />
        <Text style={[styles.title, { color: accentColor }]}>This week</Text>
      </View>

      <WeekScheduleStrip
        days={days}
        weekStart={weekStart}
        scheduledByDate={scheduledByDate}
        futureChecklistByDate={{}}
        onDayPress={handleDayPress}
        onPrevWeek={goPrevWeek}
        onNextWeek={goNextWeek}
        onThisWeek={goToThisWeek}
        accentColor={accentColor}
        showFutureDots={false}
        renderDayExtra={renderDayExtra}
        compact
      />

      <ScheduledWorkoutModal
        visible={showWorkoutModal}
        onClose={() => {
          setShowWorkoutModal(false);
          setSelectedDate(null);
          setExistingWorkout(null);
          setScheduleContext(null);
        }}
        selectedDate={selectedDate}
        existingWorkout={existingWorkout}
        scheduleContext={scheduleContext}
        onWorkoutUpdated={() => {
          notifyScheduleUpdated();
          setShowWorkoutModal(false);
          setSelectedDate(null);
          setExistingWorkout(null);
          setScheduleContext(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderWidth: 1,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  splitLabel: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 44,
    marginTop: 2,
    marginBottom: 2,
  },
});
