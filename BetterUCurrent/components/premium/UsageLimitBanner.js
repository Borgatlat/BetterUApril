import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';

/**
 * Warns free users before they hit AI walls — frames Premium as solving a real problem.
 */
export function UsageLimitBanner({ isPremium, messageCount, maxMessages }) {
  const router = useRouter();

  if (isPremium || !maxMessages) return null;

  const remaining = Math.max(0, maxMessages - messageCount);
  const ratio = messageCount / maxMessages;

  if (ratio < 0.7) return null;

  const urgent = remaining <= 2;

  return (
    <TouchableOpacity
      style={[styles.banner, urgent && styles.bannerUrgent]}
      onPress={() => navigateToPremiumPaywall(router, 'ai_messages')}
      activeOpacity={0.88}
    >
      <Ionicons name={urgent ? 'warning' : 'chatbubble-ellipses'} size={18} color={urgent ? '#ff6644' : '#00ffff'} />
      <View style={styles.textCol}>
        <Text style={styles.title}>
          {urgent
            ? `Only ${remaining} AI message${remaining === 1 ? '' : 's'} left today`
            : `${remaining} AI messages left today`}
        </Text>
        <Text style={styles.sub}>
          Running out mid-conversation is frustrating — Premium gives you 100/day
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#666" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  bannerUrgent: {
    backgroundColor: 'rgba(255, 80, 60, 0.1)',
    borderColor: 'rgba(255, 80, 60, 0.35)',
  },
  textCol: { flex: 1 },
  title: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sub: { color: '#999', fontSize: 11, marginTop: 2, lineHeight: 15 },
});
