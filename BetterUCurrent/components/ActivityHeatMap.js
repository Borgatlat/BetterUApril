import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalDateString } from '../utils/scheduledWorkoutHelpers';
import { hexToRgba } from '../utils/homePageCustomization';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_SIZE = 11;
const CELL_GAP = 2;
const ROW_LABEL_WIDTH = 24;

const ActivityHeatMap = ({
  workouts,
  mentalSessions,
  accentColor = '#00ffff',
  timePeriod = 'week',
}) => {
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    setSelectedKey(null);
  }, [timePeriod]);

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
        const startDow = monthStart.getDay();
        const totalSlots = startDow + daysInMonth;
        const numRows = Math.ceil(totalSlots / 7);
        const rows = Array.from({ length: numRows }, () => Array(7).fill(null));

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          if (date > now) break;

          const slot = startDow + day - 1;
          const rowIndex = Math.floor(slot / 7);
          const colIndex = slot % 7;
          const cell = buildDayCell(date);
          rows[rowIndex][colIndex] = cell;
          flat.push(cell);
        }

        yearMonths.push({
          key: `${year}-${month}`,
          label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          rows,
        });
      }

      return {
        layoutType: 'yearStack',
        subtitle: 'Last 12 months — oldest at top, today at bottom',
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
        subtitle: 'Last 4 weeks — one square per day',
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
      subtitle: 'Last 7 days — one square per day',
      allCells: days,
    };
  }, [workouts, mentalSessions, timePeriod]);

  const { layoutType, subtitle, allCells, monthRows, yearMonths } = heatData;
  const maxCount = Math.max(1, ...allCells.map((c) => c.count));

  const getActivityColor = (count) => {
    if (!count || count === 0) return 'rgba(255, 255, 255, 0.06)';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return hexToRgba(accentColor, 0.28);
    if (ratio <= 0.5) return hexToRgba(accentColor, 0.45);
    if (ratio <= 0.75) return hexToRgba(accentColor, 0.62);
    return hexToRgba(accentColor, 0.88);
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

  const renderSquare = (cell, cellKey) => {
    if (!cell) {
      return (
        <View
          key={cellKey}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            marginRight: CELL_GAP,
            marginBottom: CELL_GAP,
          }}
        />
      );
    }
    const isSelected = selectedKey === cell.key;
    return (
      <TouchableOpacity
        key={cellKey}
        onPress={() => setSelectedKey(isSelected ? null : cell.key)}
        activeOpacity={0.7}
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          marginRight: CELL_GAP,
          marginBottom: CELL_GAP,
        }}
      >
        <View
          style={[
            styles.square,
            {
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: getActivityColor(cell.count),
              borderWidth: isSelected ? 1.5 : 0,
              borderColor: accentColor,
            },
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderDayRow = (cells, rowKey) => (
    <View key={rowKey} style={styles.dayRow}>
      {cells.map((cell, colIndex) =>
        renderSquare(cell, `${rowKey}-${colIndex}`)
      )}
    </View>
  );

  const renderWeekdayHeader = () => (
    <View style={styles.headerRow}>
      <View style={styles.rowLabelSpacer} />
      <View style={styles.dayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text
            key={`wd-${i}`}
            style={[
              styles.weekdayHeader,
              {
                width: CELL_SIZE,
                marginRight: CELL_GAP,
              },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );

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

      {layoutType === 'weekRow' && (
        <View style={styles.block}>
          <View style={styles.headerRow}>
            <View style={styles.rowLabelSpacer} />
            <View style={styles.dayRow}>
              {allCells.map((cell) => {
                const label = new Date(`${cell.dateStr}T12:00:00`).toLocaleDateString(
                  'en-US',
                  { weekday: 'narrow' }
                );
                return (
                  <Text
                    key={`wh-${cell.key}`}
                    style={[
                      styles.weekdayHeader,
                      { width: CELL_SIZE, marginRight: CELL_GAP },
                    ]}
                  >
                    {label}
                  </Text>
                );
              })}
            </View>
          </View>
          <View style={styles.headerRow}>
            <View style={styles.rowLabelSpacer} />
            <View style={styles.dayRow}>
              {allCells.map((cell) => renderSquare(cell, cell.key))}
            </View>
          </View>
        </View>
      )}

      {layoutType === 'monthGrid' && monthRows && (
        <View style={styles.block}>
          {renderWeekdayHeader()}
          {monthRows.map((row) => (
            <View key={row.weekLabel} style={styles.headerRow}>
              <Text style={styles.rowLabel}>{row.weekLabel}</Text>
              {renderDayRow(row.cells, row.weekLabel)}
            </View>
          ))}
        </View>
      )}

      {layoutType === 'yearStack' && yearMonths && (
        <View style={styles.block}>
          {renderWeekdayHeader()}
          {yearMonths.map((month) => (
            <View key={month.key} style={styles.yearMonthBlock}>
              <View style={styles.headerRow}>
                <Text style={styles.rowLabel}>{month.label}</Text>
                <View>
                  {month.rows.map((row, rowIndex) =>
                    renderDayRow(row, `${month.key}-r${rowIndex}`)
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendSquares}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <View
              key={ratio}
              style={[
                styles.legendSquare,
                {
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
    padding: 15,
    borderWidth: 1,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 17,
  },
  block: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowLabelSpacer: {
    width: ROW_LABEL_WIDTH,
  },
  rowLabel: {
    width: ROW_LABEL_WIDTH,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '600',
    paddingTop: 1,
  },
  weekdayHeader: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: CELL_GAP,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  yearMonthBlock: {
    marginBottom: 10,
  },
  square: {
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  legendText: {
    color: 'rgba(255, 255, 255, 0.45)',
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
