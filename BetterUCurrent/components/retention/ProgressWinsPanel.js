import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getProgressSummary } from '../../utils/progressSummary';
import { getUserContext, getUserState } from '../../utils/userStateMachine';

/**
 * Shows monthly "wins" — expands when user is off-track (retention roadmap Phase 3).
 */
export function ProgressWinsPanel({ userId, accentColor = '#00ffff', compact = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('onTrack');
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      try {
        const [ctx, summary] = await Promise.all([
          getUserContext(userId),
          getProgressSummary(userId),
        ]);
        if (cancelled) return;
        setState(getUserState(ctx));
        setProgress(summary);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const offTrack = state === 'offTrack_recent' || state === 'offTrack_long';
  const showExpanded = offTrack || !compact;

  if (loading) {
    return (
      <View style={[styles.card, { borderColor: `${accentColor}22` }]}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  if (!progress) return null;

  const total = progress.totalThisMonth ?? 0;

  return (
    <View style={[styles.card, showExpanded && styles.cardExpanded, { borderColor: `${accentColor}33` }]}>
      <View style={styles.headerRow}>
        <Ionicons name={offTrack ? 'ribbon' : 'stats-chart'} size={20} color={accentColor} />
        <Text style={styles.title}>
          {offTrack ? 'You still showed up this month' : 'This month'}
        </Text>
      </View>

      {offTrack ? (
        <Text style={styles.subtitle}>
          Streaks reset — progress doesn&apos;t. {total} session{total === 1 ? '' : 's'} logged so far.
        </Text>
      ) : (
        <Text style={styles.subtitle}>{total} wellness session{total === 1 ? '' : 's'} logged</Text>
      )}

      <View style={styles.statRow}>
        <StatPill icon="barbell" label="Workouts" value={progress.workoutsThisMonth} color="#00ff64" />
        <StatPill icon="leaf" label="Mental" value={progress.mentalThisMonth} color="#8b5cf6" />
        <StatPill icon="walk" label="Runs" value={progress.runsThisMonth} color="#ff6464" />
      </View>

      {showExpanded && (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}44` }]}
          onPress={() => router.push('/(tabs)/mental')}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: accentColor }]}>
            {offTrack ? '5-minute easy reset' : 'Log a mental session'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={accentColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatPill({ icon, label, value, color }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  cardExpanded: {
    backgroundColor: 'rgba(0,255,255,0.04)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#999', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  statRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 2,
  },
  pillValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  pillLabel: { color: '#888', fontSize: 10, fontWeight: '600' },
  cta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctaText: { fontSize: 14, fontWeight: '700' },
});
