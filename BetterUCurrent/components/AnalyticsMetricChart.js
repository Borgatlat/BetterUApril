import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
const BAR_MAX_HEIGHT = 132;

function defaultFormatValue(v) {
  const n = Number(v) || 0;
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (Number.isInteger(n) || n === Math.floor(n)) return String(Math.round(n));
  return n.toFixed(1);
}

/**
 * Custom analytics bar chart (no react-native-chart-kit).
 */
export default function AnalyticsMetricChart({
  labels = [],
  values = [],
  barColor = '#00ffff',
  summaryLabel,
  summaryValue,
  formatValue = defaultFormatValue,
}) {
  const nums = useMemo(() => values.map((v) => Number(v) || 0), [values]);
  const max = useMemo(() => Math.max(1, ...nums), [nums]);
  const gridTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((max * (steps - i)) / steps));
  }, [max]);

  if (!labels.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data for this period</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {(summaryLabel != null || summaryValue != null) && (
        <View style={styles.summaryRow}>
          {summaryLabel ? <Text style={styles.summaryLabel}>{summaryLabel}</Text> : null}
          {summaryValue != null ? (
            <Text style={[styles.summaryValue, { color: barColor }]}>{summaryValue}</Text>
          ) : null}
        </View>
      )}

      <View style={styles.chartBody}>
        <View style={styles.yAxis}>
          {gridTicks.map((tick) => (
            <Text key={tick} style={styles.yTick}>
              {formatValue(tick)}
            </Text>
          ))}
        </View>

        <View style={styles.plotArea}>
          <View style={styles.grid}>
            {gridTicks.map((tick) => (
              <View key={`g-${tick}`} style={styles.gridLine} />
            ))}
          </View>

          <View style={styles.barsRow}>
            {labels.map((label, i) => {
              const v = nums[i] ?? 0;
              const barH = v > 0 ? Math.max(10, (v / max) * BAR_MAX_HEIGHT) : 4;
              return (
                <View key={`${label}-${i}`} style={styles.column}>
                  <Text style={styles.barValue} numberOfLines={1}>
                    {v > 0 ? formatValue(v) : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barH,
                          backgroundColor: v > 0 ? barColor : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.xLabel} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: BAR_MAX_HEIGHT + 56,
  },
  yAxis: {
    width: 36,
    height: BAR_MAX_HEIGHT + 28,
    justifyContent: 'space-between',
    paddingBottom: 28,
    marginRight: 6,
  },
  yTick: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'right',
  },
  plotArea: {
    flex: 1,
    position: 'relative',
  },
  grid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: BAR_MAX_HEIGHT + 28,
    justifyContent: 'space-between',
    paddingBottom: 28,
  },
  gridLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    paddingTop: 0,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  barValue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    minHeight: 14,
  },
  barTrack: {
    width: '88%',
    maxWidth: 36,
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  xLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
});
