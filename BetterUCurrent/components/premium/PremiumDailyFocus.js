import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getUserWellnessFocus } from '../../lib/premiumProblemSolver';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';
import { hexToRgba } from '../../utils/homePageCustomization';

/**
 * Compact home nudge: one problem → one tap action.
 */
export function PremiumDailyFocus({
  userId,
  isPremium,
  messageCount = 0,
  maxMessages = 10,
  onOpenTherapist,
  onOpenTrainer,
  accentColor = '#00ffff',
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return undefined;
    }
    (async () => {
      const data = await getUserWellnessFocus(userId, {
        isPremium,
        messageCount,
        maxMessages,
      });
      if (!cancelled) {
        setFocus(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isPremium, messageCount, maxMessages]);

  if (!userId || loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={accentColor} size="small" />
      </View>
    );
  }

  if (!focus?.primaryProblem) return null;

  const { primaryProblem } = focus;
  const urgent = focus.state === 'atRisk';
  const accent = urgent ? '#ff8844' : accentColor;

  const go = (action, route, params) => {
    if (action?.id === 'ai_support' && onOpenTherapist) {
      onOpenTherapist();
      return;
    }
    if (!route) return;
    if (params) router.push({ pathname: route, params });
    else router.push(route);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.card,
          urgent && styles.cardUrgent,
          { borderColor: hexToRgba(accent, urgent ? 0.35 : 0.14) },
        ]}
        onPress={() => go(primaryProblem, primaryProblem.route, primaryProblem.params)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Today's focus: ${primaryProblem.problem}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}>
          <Ionicons name={primaryProblem.icon || 'bulb'} size={20} color={accent} />
        </View>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.kicker}>Today&apos;s focus</Text>
            {isPremium ? (
              <View style={styles.premiumTag}>
                <Text style={styles.premiumTagText}>Premium</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.problem} numberOfLines={2}>
            {primaryProblem.problem}
          </Text>
          <Text style={styles.hint} numberOfLines={1}>
            {primaryProblem.solution}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#666" />
      </TouchableOpacity>

      {primaryProblem.premiumUnlock && !isPremium ? (
        <TouchableOpacity
          onPress={() => navigateToPremiumPaywall(router, 'daily_focus')}
          style={styles.premiumHint}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={13} color="#FFD700" />
          <Text style={styles.premiumHintText} numberOfLines={1}>
            {primaryProblem.premiumUnlock}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  loadingCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardUrgent: {
    backgroundColor: 'rgba(255, 120, 0, 0.06)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  kicker: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  premiumTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumTagText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  problem: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  hint: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  premiumHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  premiumHintText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});
