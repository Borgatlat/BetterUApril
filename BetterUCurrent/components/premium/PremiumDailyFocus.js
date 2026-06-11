import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getUserWellnessFocus } from '../../lib/premiumProblemSolver';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';

/**
 * Home hero: one real problem → one clear action (Premium gets 3-step plan).
 */
export function PremiumDailyFocus({
  userId,
  isPremium,
  messageCount = 0,
  maxMessages = 10,
  onOpenTherapist,
  onOpenTrainer,
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
      <View style={styles.card}>
        <ActivityIndicator color="#00ffff" />
      </View>
    );
  }

  if (!focus?.primaryProblem) return null;

  const { primaryProblem, actionPlan } = focus;

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
    <View style={[styles.card, focus.state === 'atRisk' && styles.cardUrgent]}>
      <View style={styles.header}>
        <Ionicons name={primaryProblem.icon || 'bulb'} size={22} color={focus.state === 'atRisk' ? '#ff8844' : '#00ffff'} />
        <Text style={styles.headerTitle}>Today&apos;s focus</Text>
        {isPremium && (
          <View style={styles.premiumTag}>
            <Text style={styles.premiumTagText}>Premium plan</Text>
          </View>
        )}
      </View>

      <Text style={styles.problem}>{primaryProblem.problem}</Text>
      <Text style={styles.solution}>{primaryProblem.solution}</Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => go(primaryProblem, primaryProblem.route, primaryProblem.params)}
        activeOpacity={0.88}
      >
        <Text style={styles.ctaText}>{primaryProblem.cta}</Text>
        <Ionicons name="arrow-forward" size={18} color="#000" />
      </TouchableOpacity>

      {primaryProblem.premiumUnlock && !isPremium && (
        <TouchableOpacity
          onPress={() => navigateToPremiumPaywall(router, 'daily_focus')}
          style={styles.premiumHint}
        >
          <Ionicons name="sparkles" size={14} color="#FFD700" />
          <Text style={styles.premiumHintText}>{primaryProblem.premiumUnlock}</Text>
        </TouchableOpacity>
      )}

      {actionPlan?.length > 0 && (
        <View style={styles.planBlock}>
          <Text style={styles.planTitle}>{isPremium ? 'Your 3-step plan' : 'Next step'}</Text>
          {actionPlan.map((step) => (
            <TouchableOpacity
              key={`${step.step}-${step.text}`}
              style={styles.planRow}
              onPress={() => {
                if (step.isPremiumCta) navigateToPremiumPaywall(router, 'daily_focus');
                else go(null, step.route, step.params);
              }}
              disabled={!step.route && !step.isPremiumCta}
            >
              <Text style={styles.planStep}>{step.step}.</Text>
              <Text style={[styles.planText, step.isPremiumCta && styles.planPremium]}>
                {step.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  cardUrgent: {
    backgroundColor: 'rgba(255, 120, 0, 0.08)',
    borderColor: 'rgba(255, 120, 0, 0.35)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 },
  premiumTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  premiumTagText: { color: '#FFD700', fontSize: 10, fontWeight: '800' },
  problem: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 6 },
  solution: { color: '#aaa', fontSize: 13, lineHeight: 18, marginBottom: 14 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00ffff',
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: '#000', fontSize: 15, fontWeight: '800' },
  premiumHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  premiumHintText: { color: '#FFD700', fontSize: 12, fontWeight: '600', flex: 1 },
  planBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  planTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  planRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  planStep: { color: '#00ffff', fontWeight: '800', width: 18 },
  planText: { color: '#ccc', fontSize: 13, flex: 1, lineHeight: 18 },
  planPremium: { color: '#FFD700' },
});
