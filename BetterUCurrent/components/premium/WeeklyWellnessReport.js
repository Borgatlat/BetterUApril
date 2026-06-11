import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getWeeklyWellnessReport } from '../../utils/weeklyWellnessReport';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';

/**
 * Premium weekly digest with problems, wins, and actionable next steps.
 */
export function WeeklyWellnessReport({ userId, isPremium, accentColor = '#FFD700' }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !isPremium) {
      setLoading(false);
      return undefined;
    }
    (async () => {
      const data = await getWeeklyWellnessReport(userId);
      if (!cancelled) {
        setReport(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isPremium]);

  if (!isPremium) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.lockedCard]}
        onPress={() => navigateToPremiumPaywall(router, 'wellness_report')}
        activeOpacity={0.88}
      >
        <View style={styles.headerRow}>
          <Ionicons name="document-text" size={20} color={accentColor} />
          <Text style={styles.title}>Weekly Wellness Report</Text>
          <Ionicons name="lock-closed" size={16} color="#888" />
        </View>
        <Text style={styles.lockedText}>
          See what worked, what slipped, and exactly what to do next — not just stats.
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.card, { borderColor: `${accentColor}33` }]}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  if (!report) return null;

  return (
    <View style={[styles.card, { borderColor: `${accentColor}44` }]}>
      <View style={styles.headerRow}>
        <Ionicons name="document-text" size={20} color={accentColor} />
        <Text style={styles.title}>Your Weekly Report</Text>
        <View style={styles.premiumPill}>
          <Text style={styles.premiumPillText}>Premium</Text>
        </View>
      </View>
      <Text style={styles.insight}>{report.insight}</Text>

      {report.wins?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Wins</Text>
          {report.wins.map((w) => (
            <View key={w} style={styles.winRow}>
              <Ionicons name="checkmark-circle" size={14} color="#00ff64" />
              <Text style={styles.winText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {report.problems?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Gaps to fix</Text>
          {report.problems.map((p) => (
            <View key={p} style={styles.problemRow}>
              <Ionicons name="alert-circle" size={14} color="#ff8844" />
              <Text style={styles.problemText}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.statRow}>
        {report.highlights.map((h) => (
          <View key={h.label} style={styles.pill}>
            <Ionicons name={h.icon} size={16} color={h.color} />
            <Text style={styles.pillValue}>{h.value}</Text>
            <Text style={styles.pillLabel}>{h.label}</Text>
          </View>
        ))}
      </View>

      {report.actionPlan?.length > 0 && (
        <View style={styles.actionBlock}>
          <Text style={styles.sectionLabel}>Do this next</Text>
          {report.actionPlan.map((step, i) => (
            <TouchableOpacity
              key={step.text}
              style={styles.actionRow}
              onPress={() => step.route && router.push(step.route)}
              disabled={!step.route}
            >
              <Text style={styles.actionNum}>{i + 1}</Text>
              <Text style={styles.actionText}>{step.text}</Text>
              {step.route ? <Ionicons name="arrow-forward" size={14} color="#00ffff" /> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.footerText}>
        {report.deltaTotal >= 0 ? '+' : ''}{report.deltaTotal} vs last week · {report.streak} day streak
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  lockedCard: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  premiumPill: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  premiumPillText: { color: '#FFD700', fontSize: 10, fontWeight: '800' },
  insight: { color: '#ccc', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  lockedText: { color: '#999', fontSize: 13, lineHeight: 18 },
  section: { marginBottom: 10 },
  sectionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  winRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  winText: { color: '#bbb', fontSize: 13, flex: 1, lineHeight: 18 },
  problemRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  problemText: { color: '#ffaa88', fontSize: 13, flex: 1, lineHeight: 18 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 4 },
  pill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 2,
  },
  pillValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  pillLabel: { color: '#888', fontSize: 10 },
  actionBlock: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  actionNum: { color: '#00ffff', fontWeight: '800', width: 16 },
  actionText: { color: '#fff', fontSize: 13, flex: 1, lineHeight: 18 },
  footerText: { color: '#00ffff', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
