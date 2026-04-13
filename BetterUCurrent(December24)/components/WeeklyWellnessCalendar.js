import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import ScheduledWorkoutModal from './ScheduledWorkoutModal';
import { getWeekDaysArray, getLocalDateString } from '../utils/scheduledWorkoutHelpers';
import { loadFutureuPlanArtifact, getFutureuChecklistByLocalDate } from '../utils/futureuPlanStorage';
import { NutritionTheme as T } from '../config/NutritionTheme';
import { hexToRgba } from '../utils/homePageCustomization';

/**
 * WeeklyWellnessCalendar - Compact week view for home screen
 * Shows 7 days with scheduled activities (run, walk, bike, workout, mental session, rest)
 * Tap a day to add/edit scheduled activities
 */
const WeeklyWellnessCalendar = ({ onScheduleUpdated, refreshKey = 0, accentColor = '#00ffff' }) => {
  const { userProfile } = useUser();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d);
    monday.setDate(diff);
    return monday;
  });
  const [scheduledByDate, setScheduledByDate] = useState({});
  /** Future U checklist rows keyed by local YYYY-MM-DD (see getFutureuChecklistByLocalDate). */
  const [futureChecklistByDate, setFutureChecklistByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const today = new Date();

  const loadWeekData = useCallback(async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    try {
      const days = getWeekDaysArray(weekStart);
      const startStr = getLocalDateString(days[0]);
      const endStr = getLocalDateString(days[6]);

      const { data, error } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', userProfile.id)
        .gte('scheduled_date', startStr)
        .lte('scheduled_date', endStr)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const byDate = {};
      (data || []).forEach((a) => {
        if (!byDate[a.scheduled_date]) byDate[a.scheduled_date] = [];
        byDate[a.scheduled_date].push(a);
      });
      setScheduledByDate(byDate);

      const plan = await loadFutureuPlanArtifact();
      setFutureChecklistByDate(getFutureuChecklistByLocalDate(plan));
    } catch (err) {
      console.error('Error loading weekly schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, weekStart]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData, refreshKey]);

  // When user returns from Future U with a new plan, refresh gold dots without waiting for week navigation.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const plan = await loadFutureuPlanArtifact();
        if (alive) setFutureChecklistByDate(getFutureuChecklistByLocalDate(plan));
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const days = getWeekDaysArray(weekStart);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const handleDayPress = (date) => {
    const dateStr = getLocalDateString(date);
    setSelectedDate(date);
    setSelectedActivities(scheduledByDate[dateStr] || []);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedDate(null);
    setSelectedActivities([]);
    loadWeekData();
    onScheduleUpdated?.();
  };

  const goPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToThisWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    setWeekStart(monday);
  };

  const activityColors = useMemo(
    () => ({
      run: '#ff6b6b',
      walk: '#4ecdc4',
      bike: '#45b7d1',
      workout: accentColor,
      mental_session: '#8b5cf6',
      rest_day: '#ffa500',
    }),
    [accentColor]
  );

  /** Gold dots = Future U “plans for the future” checklist due that day */
  const FUTURE_PLAN_DOT = '#eab308';

  const getWeekLabel = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const isCurrentWeek =
    weekStart <= today &&
    new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000) >= today;

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
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={goPrevWeek}
            style={[styles.navBtn, { backgroundColor: hexToRgba(accentColor, 0.18) }]}
          >
            <Ionicons name="chevron-back" size={20} color={accentColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToThisWeek}
            style={[styles.weekLabel, { backgroundColor: hexToRgba(accentColor, 0.18) }]}
            disabled={isCurrentWeek}
          >
            <Text
              style={[
                styles.weekLabelText,
                { color: accentColor },
                isCurrentWeek && styles.weekLabelTextDim,
              ]}
            >
              {isCurrentWeek ? 'This Week' : getWeekLabel()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNextWeek}
            style={[styles.navBtn, { backgroundColor: hexToRgba(accentColor, 0.18) }]}
          >
            <Ionicons name="chevron-forward" size={20} color={accentColor} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.daysRow}>
        {days.map((date, i) => {
          const dateStr = getLocalDateString(date);
          const activities = scheduledByDate[dateStr] || [];
          const futureItems = futureChecklistByDate[dateStr] || [];
          const futureIncomplete = futureItems.filter((it) => !it.completed);
          const isToday = isSameDay(date, today);
          const hasRest = activities.some((a) => a.activity_type === 'rest_day' || a.is_rest_day);
          const hasScheduled = activities.length > 0 && !hasRest;
          const hasFuturePlan = futureIncomplete.length > 0;

          const totalCount = activities.length + futureIncomplete.length;
          let actDots;
          let futDots;
          if (futureIncomplete.length === 0) {
            actDots = activities.slice(0, 3);
            futDots = [];
          } else if (activities.length === 0) {
            actDots = [];
            futDots = futureIncomplete.slice(0, 3);
          } else {
            actDots = activities.slice(0, 2);
            futDots = futureIncomplete.slice(0, 2);
          }
          const shownCount = actDots.length + futDots.length;
          const moreCount = totalCount > shownCount ? totalCount - shownCount : 0;

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.dayCell,
                isToday && {
                  borderColor: hexToRgba(accentColor, 0.45),
                  backgroundColor: hexToRgba(accentColor, 0.1),
                },
                (hasScheduled || hasFuturePlan) && !hasRest && styles.hasActivityCell,
                hasRest && styles.restDayCell,
              ]}
              onPress={() => handleDayPress(date)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayName, isToday && { color: accentColor }]}>{dayNames[i]}</Text>
              <Text style={[styles.dayNum, isToday && { color: accentColor }]}>{date.getDate()}</Text>
              <View style={styles.dotsRow}>
                {actDots.map((a, j) => (
                  <View
                    key={`a-${j}`}
                    style={[styles.dot, { backgroundColor: activityColors[a.activity_type] || accentColor }]}
                  />
                ))}
                {futDots.map((_, j) => (
                  <View key={`f-${j}`} style={[styles.dot, { backgroundColor: FUTURE_PLAN_DOT }]} />
                ))}
                {moreCount > 0 && <Text style={styles.moreText}>+{moreCount}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.hint}>
        Tap a day to plan run, walk, bike, workout, or mental session. Gold dots = Future U plan steps due that day.
      </Text>

      <ScheduledWorkoutModal
        visible={showModal}
        onClose={handleModalClose}
        selectedDate={selectedDate}
        existingActivities={selectedActivities}
        onWorkoutUpdated={() => {
          loadWeekData();
          onScheduleUpdated?.();
        }}
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navBtn: {
    padding: 6,
    borderRadius: T.inputRadius,
  },
  weekLabel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: T.inputRadius,
  },
  weekLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekLabelTextDim: {
    opacity: 0.85,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: T.inputRadius,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hasActivityCell: {
    borderColor: T.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  restDayCell: {
    borderColor: 'rgba(255, 165, 0, 0.35)',
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
  },
  dayName: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayNum: {
    color: T.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moreText: {
    color: T.textMuted,
    fontSize: 10,
  },
  hint: {
    color: T.textMuted,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default WeeklyWellnessCalendar;
