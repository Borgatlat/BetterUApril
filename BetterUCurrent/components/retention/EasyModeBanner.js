import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getUserContext, getUserState } from '../../utils/userStateMachine';

/**
 * Shown on Home when user is off-track or opened a "easy mode" notification.
 * Offers a low-friction 5-minute mental reset (retention roadmap Phase 3).
 */
export function EasyModeBanner({ userId, accentColor = '#00ffff', forceVisible = false }) {
  const router = useRouter();
  const [visible, setVisible] = useState(forceVisible);
  const [state, setState] = useState(null);

  useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      return undefined;
    }
    if (!userId) return undefined;

    let cancelled = false;
    getUserContext(userId).then((ctx) => {
      if (cancelled) return;
      const s = getUserState(ctx);
      setState(s);
      setVisible(s === 'offTrack_recent' || s === 'offTrack_long');
    });
    return () => {
      cancelled = true;
    };
  }, [userId, forceVisible]);

  if (!visible) return null;

  return (
    <View style={[styles.card, { borderColor: `${accentColor}44`, backgroundColor: `${accentColor}0c` }]}>
      <View style={styles.row}>
        <Ionicons name="leaf" size={22} color="#8b5cf6" />
        <View style={styles.textCol}>
          <Text style={styles.title}>Easy mode</Text>
          <Text style={styles.sub}>
            {state === 'offTrack_long'
              ? 'Welcome back — start with one small win today.'
              : 'No pressure. A 5-minute reset still counts.'}
          </Text>
        </View>
        {!forceVisible ? (
          <TouchableOpacity onPress={() => setVisible(false)} hitSlop={10}>
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: '#8b5cf655' }]}
          onPress={() => router.push('/(tabs)/mental')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>5-min mental</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { borderColor: `${accentColor}55` }]}
          onPress={() => router.push('/(tabs)/workout')}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: accentColor }]}>Quick workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  textCol: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sub: { color: '#aaa', fontSize: 13, marginTop: 4, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
