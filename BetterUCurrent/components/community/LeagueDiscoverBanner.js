import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMMUNITY_THEME as T } from '../../config/communityTheme';

const DISMISS_KEY = '@BetterU_league_banner_dismissed';

/**
 * Dismissible nudge on Community feed — League lives under Community → League tab.
 */
export function LeagueDiscoverBanner({ onOpenLeague }) {
  const [visible, setVisible] = useState(true);

  React.useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((v) => {
      if (v === 'true') setVisible(false);
    });
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="trophy" size={22} color={T.communityAccent} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>BetterU League</Text>
        <Text style={styles.sub}>Join a team, compete in monthly challenges, earn trophies.</Text>
      </View>
      <TouchableOpacity style={styles.cta} onPress={onOpenLeague} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Open</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} hitSlop={12} accessibilityLabel="Dismiss league banner">
        <Ionicons name="close" size={18} color={T.communityTextMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: { color: T.communityText, fontSize: 14, fontWeight: '800' },
  sub: { color: T.communityTextMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  cta: {
    backgroundColor: T.communityAccent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: { color: '#000', fontSize: 12, fontWeight: '800' },
});
