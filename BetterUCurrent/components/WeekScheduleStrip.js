import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalDateString, isSameDay } from '../utils/scheduledWorkoutHelpers';
import { hexToRgba } from '../utils/homePageCustomization';
import { NutritionTheme as T } from '../config/NutritionTheme';

const DAY_NAMES_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FUTURE_PLAN_DOT = '#eab308';

const DEFAULT_ACTIVITY_COLORS = {
  run: '#ff6b6b',
  walk: '#4ecdc4',
  bike: '#45b7d1',
  workout: '#00ffff',
  mental_session: '#8b5cf6',
  rest_day: '#ffa500',
};

/**
 * Shared 7-day schedule strip (Mon–Sun). Used on Home and Workout tabs.
 */
export default function WeekScheduleStrip({
  days,
  weekStart,
  scheduledByDate = {},
  futureChecklistByDate = {},
  onDayPress,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  accentColor = '#00ffff',
  showFutureDots = true,
  /** Optional: (date, dateStr) => React node under day number (e.g. split label) */
  renderDayExtra,
  compact = false,
}) {
  const today = new Date();
  const activityColors = useMemo(
    () => ({ ...DEFAULT_ACTIVITY_COLORS, workout: accentColor }),
    [accentColor]
  );

  const getWeekLabel = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const isCurrentWeek =
    weekStart <= today && new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000) >= today;

  return (
    <View>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={onPrevWeek}
          style={[styles.navBtn, { backgroundColor: hexToRgba(accentColor, 0.18) }]}
        >
          <Ionicons name="chevron-back" size={20} color={accentColor} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onThisWeek}
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
          onPress={onNextWeek}
          style={[styles.navBtn, { backgroundColor: hexToRgba(accentColor, 0.18) }]}
        >
          <Ionicons name="chevron-forward" size={20} color={accentColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.daysRow}>
        {days.map((date, i) => {
          const dateStr = getLocalDateString(date);
          const activities = scheduledByDate[dateStr] || [];
          const futureItems = showFutureDots ? futureChecklistByDate[dateStr] || [] : [];
          const futureIncomplete = futureItems.filter((it) => !it.completed);
          const isToday = isSameDay(date, today);
          const hasRest = activities.some((a) => a.activity_type === 'rest_day' || a.is_rest_day);
          const hasScheduled = activities.length > 0 && !hasRest;
          const hasFuturePlan = futureIncomplete.length > 0;

          const totalCount = activities.length + futureIncomplete.length;
          let actDots;
          let futDots;
          if (!showFutureDots || futureIncomplete.length === 0) {
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
              key={dateStr}
              style={[
                styles.dayCell,
                compact && styles.dayCellCompact,
                isToday && {
                  borderColor: hexToRgba(accentColor, 0.45),
                  backgroundColor: hexToRgba(accentColor, 0.1),
                },
                (hasScheduled || hasFuturePlan) && !hasRest && styles.hasActivityCell,
                hasRest && styles.restDayCell,
              ]}
              onPress={() => onDayPress?.(date, activities)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayName, isToday && { color: accentColor }]}>
                {DAY_NAMES_MON[i]}
              </Text>
              <Text style={[styles.dayNum, isToday && { color: accentColor }]}>{date.getDate()}</Text>
              {renderDayExtra ? renderDayExtra(date, dateStr) : null}
              <View style={styles.dotsRow}>
                {actDots.map((a, j) => (
                  <View
                    key={`a-${a.id || j}`}
                    style={[
                      styles.dot,
                      { backgroundColor: activityColors[a.activity_type] || accentColor },
                    ]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
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
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: T.inputRadius,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 88,
  },
  dayCellCompact: {
    paddingVertical: 10,
    minHeight: 96,
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
    marginBottom: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    alignItems: 'center',
    marginTop: 2,
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
});
