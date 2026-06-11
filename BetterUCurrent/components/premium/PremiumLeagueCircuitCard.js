import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPremiumLeagueCircuit, PREMIUM_LEAGUE_BADGE } from '../../lib/premiumLeagueCircuit';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';

/**
 * Premium-exclusive monthly personal circuit in League tab.
 */
export default function PremiumLeagueCircuitCard({ userId, isPremium }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [circuit, setCircuit] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return undefined;
    }
    if (!isPremium) {
      setLoading(false);
      return undefined;
    }
    (async () => {
      const data = await getPremiumLeagueCircuit(userId);
      if (!cancelled) {
        setCircuit(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isPremium]);

  if (!isPremium) {
    return (
      <TouchableOpacity
        style={styles.lockedCard}
        onPress={() => navigateToPremiumPaywall(router, 'league_circuit')}
        activeOpacity={0.88}
      >
        <View style={styles.header}>
          <Ionicons name="diamond" size={22} color="#FFD700" />
          <Text style={styles.lockedTitle}>Premium League Circuit</Text>
          <Ionicons name="lock-closed" size={16} color="#666" />
        </View>
        <Text style={styles.lockedSub}>
          Exclusive monthly milestones — earn the Premium Circuit badge on your league profile.
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#FFD700" />
      </View>
    );
  }

  if (!circuit) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={PREMIUM_LEAGUE_BADGE.icon} size={22} color={PREMIUM_LEAGUE_BADGE.color} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Premium League Circuit</Text>
          <Text style={styles.subtitle}>Exclusive monthly milestones · {circuit.monthKey}</Text>
        </View>
        {circuit.earnedPremiumCircuitBadge ? (
          <View style={styles.badgeEarned}>
            <Ionicons name="ribbon" size={14} color="#000" />
            <Text style={styles.badgeEarnedText}>Earned</Text>
          </View>
        ) : (
          <Text style={styles.progressText}>{circuit.completedCount}/{circuit.totalMilestones}</Text>
        )}
      </View>

      {circuit.milestones.map((m) => (
        <View key={m.id} style={styles.milestoneRow}>
          <Ionicons
            name={m.complete ? 'checkmark-circle' : m.icon}
            size={18}
            color={m.complete ? '#00ff64' : '#666'}
          />
          <Text style={[styles.milestoneLabel, m.complete && styles.milestoneDone]}>{m.label}</Text>
          <Text style={styles.milestoneCount}>
            {Math.min(m.current, m.target)}/{m.target}
          </Text>
        </View>
      ))}

      <Text style={styles.footer}>
        Premium members get priority league badge + this exclusive circuit alongside team challenges.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    padding: 16,
    marginBottom: 16,
  },
  lockedCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { color: '#FFD700', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#999', fontSize: 12, marginTop: 2 },
  lockedTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  lockedSub: { color: '#999', fontSize: 13, lineHeight: 18 },
  progressText: { color: '#00ffff', fontWeight: '800', fontSize: 14 },
  badgeEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeEarnedText: { color: '#000', fontSize: 11, fontWeight: '800' },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  milestoneLabel: { flex: 1, color: '#ccc', fontSize: 14 },
  milestoneDone: { color: '#fff', textDecorationLine: 'line-through', opacity: 0.7 },
  milestoneCount: { color: '#00ffff', fontSize: 13, fontWeight: '700' },
  footer: { color: '#888', fontSize: 11, marginTop: 10, lineHeight: 16 },
});
