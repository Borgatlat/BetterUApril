import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalDateString } from '../utils/scheduledWorkoutHelpers';
import { hexToRgba } from '../utils/homePageCustomization';

const MONTH_LABEL_WIDTH = 34;
const WEEK_LABEL_WIDTH = 26;
const CELL_GAP = 5;

const ActivityHeatMap = ({
  workouts,
  mentalSessions,
  accentColor = '#00ffff',
  timePeriod = 'week',
}) => {
  const [selectedKey, setSelectedKey] = useState(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    setSelectedKey(null);
  }, [timePeriod]);

  const onContentLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContentWidth(w);
  }, []);

  const heatData = useMemo(() => {
    const now = new Date();
    const w = workouts;
    const m = mentalSessions;

    const countForDate = (dateStr) => {
      let count = 0;
      (w || []).forEach((workout) => {
        if (workout.completed_at && getLocalDateString(new Date(workout.completed_at)) === dateStr) {
          count += 1;
        }
      });
      (m || []).forEach((session) => {
        if (session.completed_at && getLocalDateString(new Date(session.completed_at)) === dateStr) {
          count += 1;
        }
      });
      return count;
    };

    const buildDayCell = (date) => {
      const dateStr = getLocalDateString(date);
      return {
        key: dateStr,
        dateStr,
        count: countForDate(dateStr),
        dayNum: date.getDate(),
        weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      };
    };

    if (timePeriod === 'year') {
      const yearMonths = [];
      const flat = [];

      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          if (date > now) break;
          const cell = buildDayCell(date);
          cells.push(cell);
          flat.push(cell);
        }

        yearMonths.push({
          key: `${year}-${month}`,
          label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          cells,
        });
      }

      return {
        layoutType: 'yearWrap',
        subtitle: 'Last 12 months',
        allCells: flat,
        yearMonths,
      };
    }

    if (timePeriod === 'month') {
      const monthRows = [];
      const flat = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
        const weekCells = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + d);
          const cell = buildDayCell(date);
          weekCells.push(cell);
          flat.push(cell);
        }
        monthRows.push({ weekLabel: `W${4 - i}`, cells: weekCells });
      }
      return {
        layoutType: 'monthGrid',
        subtitle: 'Last 4 weeks',
        allCells: flat,
        monthRows,
      };
    }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      days.push(buildDayCell(date));
    }
    return {
      layoutType: 'weekRow',
      subtitle: 'Last 7 days',
      allCells: days,
    };
  }, [workouts, mentalSessions, timePeriod]);

  const { layoutType, subtitle, allCells, monthRows, yearMonths } = heatData;
  const maxCount = Math.max(1, ...allCells.map((c) => c.count));

  const yearCellSize = useMemo(() => {
    if (!contentWidth || layoutType !== 'yearWrap') return 12;
    const gridW = contentWidth - MONTH_LABEL_WIDTH;
    const target = 13;
    const cols = Math.max(6, Math.floor((gridW + CELL_GAP) / (target + CELL_GAP)));
    return Math.floor((gridW - (cols - 1) * CELL_GAP) / cols);
  }, [contentWidth, layoutType]);

  const getActivityColor = (count) => {
    if (!count || count === 0) return 'rgba(255, 255, 255, 0.08)';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return hexToRgba(accentColor, 0.35);
    if (ratio <= 0.5) return hexToRgba(accentColor, 0.55);
    if (ratio <= 0.75) return hexToRgba(accentColor, 0.72);
    return hexToRgba(accentColor, 0.95);
  };

  const selectedInfo = useMemo(() => {
    if (!selectedKey) return null;
    const cell = allCells.find((c) => c.key === selectedKey);
    if (!cell) return null;
    const date = new Date(`${cell.dateStr}T12:00:00`);
    return {
      title: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      count: cell.count,
    };
  }, [selectedKey, allCells]);

  const renderSquare = (cell, cellKey, size, styleOverride) => {
    if (!cell) {
      return (
        <View
          key={cellKey}
          style={[
            { width: size, height: size, marginBottom: CELL_GAP },
            styleOverride,
          ]}
        />
      );
    }
    const isSelected = selectedKey === cell.key;
    const radius = Math.max(3, Math.floor(size * 0.2));
    return (
      <TouchableOpacity
        key={cellKey}
        onPress={() => setSelectedKey(isSelected ? null : cell.key)}
        activeOpacity={0.7}
        style={[
          {
            width: size,
            height: size,
            marginBottom: CELL_GAP,
            borderRadius: radius,
          },
          styleOverride,
        ]}
        accessibilityLabel={`${cell.dateStr}, ${cell.count} activities`}
      >
        <View
          style={[
            styles.squareFill,
            {
              borderRadius: radius,
              backgroundColor: getActivityColor(cell.count),
              borderWidth: isSelected ? 2 : 0,
              borderColor: accentColor,
            },
          ]}
        />
      </TouchableOpacity>
    );
  };

  const legendSize =
    layoutType === 'yearWrap' ? yearCellSize : layoutType === 'monthGrid' ? 14 : 12;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: hexToRgba(accentColor, 0.06),
          borderColor: hexToRgba(accentColor, 0.2),
        },
      ]}
    >
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.content} onLayout={onContentLayout}>
        {layoutType === 'weekRow' && (
          <View style={styles.weekCardsRow}>
            {allCells.map((cell) => {
              const isSelected = selectedKey === cell.key;
              const isToday = cell.dateStr === getLocalDateString(new Date());
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.weekCard,
                    {
                      borderColor: isSelected
                        ? accentColor
                        : isToday
                          ? hexToRgba(accentColor, 0.45)
                          : 'rgba(255,255,255,0.08)',
                      backgroundColor: isSelected
                        ? hexToRgba(accentColor, 0.12)
                        : 'rgba(255,255,255,0.04)',
                    },
                  ]}
                  onPress={() => setSelectedKey(isSelected ? null : cell.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.weekCardDow, isToday && { color: accentColor }]}>
                    {cell.weekday.slice(0, 3)}
                  </Text>
                  <View
                    style={[
                      styles.weekCardDot,
                      { backgroundColor: getActivityColor(cell.count) },
                    ]}
                  />
                  <Text style={styles.weekCardNum}>{cell.dayNum}</Text>
                  {cell.count > 0 ? (
                    <Text style={[styles.weekCardCount, { color: accentColor }]}>
                      {cell.count}
                    </Text>
                  ) : (
                    <Text style={styles.weekCardCountEmpty}>—</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {layoutType === 'monthGrid' && monthRows && contentWidth > 0 && (
          <View style={styles.monthBlock}>
            {monthRows.map((row) => (
              <View key={row.weekLabel} style={styles.monthWeekRow}>
                <View style={styles.weekLabelCol}>
                  <Text style={styles.rowLabel}>{row.weekLabel}</Text>
                </View>
                <View style={styles.monthCellsRow}>
                  {row.cells.map((cell, colIndex) => (
                    <View key={`${row.weekLabel}-${colIndex}`} style={styles.monthCellSlot}>
                      <TouchableOpacity
                        onPress={() =>
                          setSelectedKey(
                            selectedKey === cell.key ? null : cell.key
                          )
                        }
                        activeOpacity={0.7}
                        style={[
                          styles.monthSquare,
                          {
                            backgroundColor: getActivityColor(cell.count),
                            borderWidth: selectedKey === cell.key ? 2 : 0,
                            borderColor: accentColor,
                          },
                        ]}
                        accessibilityLabel={`${cell.dateStr}, ${cell.count} activities`}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {layoutType === 'yearWrap' && yearMonths && contentWidth > 0 && (
          <View style={styles.yearBlock}>
            {yearMonths.map((month) => (
              <View key={month.key} style={styles.yearMonthRow}>
                <View style={styles.monthLabelCol}>
                  <Text style={styles.monthLabel}>{month.label}</Text>
                </View>
                <View
                  style={[
                    styles.yearWrapGrid,
                    { width: contentWidth - MONTH_LABEL_WIDTH },
                  ]}
                >
                  {month.cells.map((cell, idx) =>
                    renderSquare(
                      cell,
                      `${month.key}-${idx}`,
                      yearCellSize,
                      { marginRight: CELL_GAP }
                    )
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendSquares}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <View
              key={ratio}
              style={[
                styles.legendSquare,
                {
                  width: legendSize,
                  height: legendSize,
                  borderRadius: Math.max(2, Math.floor(legendSize * 0.2)),
                  backgroundColor: getActivityColor(
                    ratio === 0 ? 0 : Math.max(1, Math.round(ratio * maxCount))
                  ),
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.legendText}>More</Text>
      </View>

      {selectedInfo && (
        <View
          style={[
            styles.selectedInfo,
            {
              backgroundColor: hexToRgba(accentColor, 0.1),
              borderColor: hexToRgba(accentColor, 0.35),
            },
          ]}
        >
          <Text style={styles.selectedTitle}>{selectedInfo.title}</Text>
          <View style={styles.selectedStat}>
            <Ionicons name="checkmark-circle" size={16} color={accentColor} />
            <Text style={styles.selectedStatText}>
              {selectedInfo.count} {selectedInfo.count === 1 ? 'activity' : 'activities'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginBottom: 14,
    fontWeight: '500',
  },
  content: {
    width: '100%',
    alignSelf: 'stretch',
  },
  squareFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  monthBlock: {
    width: '100%',
    gap: 6,
  },
  monthWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  weekLabelCol: {
    width: WEEK_LABEL_WIDTH,
    justifyContent: 'center',
  },
  rowLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
  },
  monthCellsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: CELL_GAP,
    alignItems: 'center',
  },
  monthCellSlot: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 42,
  },
  monthSquare: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    minHeight: 28,
  },
  yearBlock: {
    width: '100%',
    gap: 10,
  },
  yearMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  monthLabelCol: {
    width: MONTH_LABEL_WIDTH,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: 4,
  },
  monthLabel: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  yearWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  weekCardsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  weekCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 88,
  },
  weekCardDow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  weekCardDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    marginBottom: 6,
  },
  weekCardNum: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  weekCardCount: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  weekCardCountEmpty: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  legendText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
  },
  legendSquares: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  selectedInfo: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectedStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedStatText: {
    color: '#aaa',
    fontSize: 12,
  },
});

export default ActivityHeatMap;
