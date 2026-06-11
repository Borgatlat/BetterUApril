import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStreakShieldStatus } from '../../lib/premiumPerks';
import { getStreakStatus } from '../../utils/streakHelpers';

/**
 * Shows Premium Streak Shield status near the streak on Home.
 */
export function StreakShieldBanner({ userId }) {
  const [status, setStatus] = useState(null);
  const [isAtRisk, setIsAtRisk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return undefined;
    (async () => {
      const [s, streak] = await Promise.all([
        getStreakShieldStatus(userId),
        getStreakStatus(userId),
      ]);
      if (!cancelled) {
        setStatus(s);
        setIsAtRisk(Boolean(streak?.isAtRisk));
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!status?.isPremium) return null;

  if (status.shieldAvailable) {
    return (
      <View style={[styles.banner, isAtRisk && styles.bannerWarn]}>
        <Ionicons name="shield-checkmark" size={18} color="#FFD700" />
        <Text style={styles.text}>
          {isAtRisk
            ? 'Streak Shield ready — 1 missed day forgiven if you slip this month'
            : 'Streak Shield active — 1 missed day forgiven per month'}
        </Text>
      </View>
    );
  }

  if (status.shieldUsedThisMonth) {
    return (
      <View style={[styles.banner, styles.bannerUsed]}>
        <Ionicons name="shield" size={18} color="#888" />
        <Text style={styles.textMuted}>Streak Shield used this month — renews next month</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  bannerWarn: {
    backgroundColor: 'rgba(255, 100, 0, 0.1)',
    borderColor: 'rgba(255, 150, 0, 0.35)',
  },
  bannerUsed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  text: { flex: 1, color: '#FFD700', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  textMuted: { flex: 1, color: '#888', fontSize: 12, lineHeight: 16 },
});
