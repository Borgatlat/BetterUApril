/**
 * RecoveryScoreCard – Circle gauge with percentage ring, number in center, status to the right.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { hexToRgba } from '../utils/homePageCustomization';

const RING_SIZE = 64;
const STROKE = 5;

function getScoreTheme(score) {
  if (score >= 70) return { color: '#00e676', status: 'Ready' };
  if (score >= 40) return { color: '#ffca28', status: 'Take it easy' };
  return { color: '#ff7043', status: 'Recover' };
}

function ScoreRing({ score, color }) {
  const progress = Math.min(score / 100, 1);
  const r = (RING_SIZE - STROKE) / 2;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);
  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, styles.ringCenter]}>
        <Text style={[styles.scoreNum, { color }]}>{Math.round(score)}</Text>
      </View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.main}>
        <View style={styles.skeletonRing} />
        <View style={styles.skeletonMeta}>
          <View style={[styles.skeletonLine, { width: 100, marginBottom: 8 }]} />
          <View style={[styles.skeletonLine, { width: 120 }]} />
        </View>
      </View>
    </View>
  );
}

export function RecoveryScoreCard({
  score,
  hoursToRecoverLabel,
  loading,
  onPress,
  onWhatShouldIDo,
  compact,
  accentColor = '#00ffff',
}) {
  const theme = getScoreTheme(score ?? 0);
  const s = score ?? 0;

  if (loading) return <SkeletonCard />;

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact, { borderLeftColor: theme.color }]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityLabel="Recovery score"
      accessibilityRole="button"
    >
      <View style={styles.main}>
        <ScoreRing score={s} color={theme.color} />
        <View style={styles.meta}>
          <Text style={styles.status}>{theme.status}</Text>
          <Text style={styles.recover}>Recover: {hoursToRecoverLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.25)" style={styles.chevron} />
      </View>
      {onWhatShouldIDo && (
        <TouchableOpacity
          style={[
            styles.cta,
            {
              backgroundColor: hexToRgba(accentColor, 0.08),
              borderColor: hexToRgba(accentColor, 0.2),
            },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            onWhatShouldIDo();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.ctaText, { color: accentColor }]}>What should I do?</Text>
          <Ionicons name="sparkles" size={16} color={accentColor} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 4,
  },
  cardCompact: {
    padding: 16,
    borderRadius: 16,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  meta: {
    flex: 1,
    marginLeft: 16,
  },
  status: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  recover: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  chevron: {
    marginLeft: 8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
  },
  skeletonRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skeletonMeta: {
    marginLeft: 16,
    flex: 1,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
