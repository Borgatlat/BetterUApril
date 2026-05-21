import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PLOT_HEIGHT = 80;

/**
 * Simple weight progression chart (custom, no chart-kit).
 */
export default function AnalyticsSparkline({
  values = [],
  labels = [],
  color = '#00ffff',
  unit = 'lbs',
}) {
  const nums = useMemo(() => values.map((v) => Number(v) || 0), [values]);
  const { min, max } = useMemo(() => {
    if (!nums.length) return { min: 0, max: 1 };
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    return { min: lo, max: hi === lo ? lo + 1 : hi };
  }, [nums]);

  if (nums.length < 2) return null;

  const range = max - min;

  return (
    <View style={styles.wrap}>
      <View style={styles.plot}>
        {nums.map((v, i) => {
          const norm = (v - min) / range;
          const dotBottom = 8 + norm * (PLOT_HEIGHT - 16);
          return (
            <View key={`pt-${i}`} style={styles.column}>
              <Text style={styles.topValue}>{Math.round(v)}</Text>
              <View style={[styles.dotLane, { height: PLOT_HEIGHT }]}>
                <View
                  style={[
                    styles.dot,
                    {
                      bottom: dotBottom,
                      backgroundColor: color,
                      borderColor: color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.bottomLabel} numberOfLines={1}>
                {labels[i] || ''}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.rangeHint}>
        {Math.round(min)}–{Math.round(max)} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingTop: 4,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 2,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  topValue: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
    minHeight: 12,
  },
  dotLane: {
    width: '100%',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  dot: {
    position: 'absolute',
    alignSelf: 'center',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    left: '50%',
    marginLeft: -4,
  },
  bottomLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  rangeHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
});
