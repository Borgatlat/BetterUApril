import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadFutureuPlanArtifact } from '../utils/futureuPlanStorage';
import UserPlan from './UserPlan';

/**
 * Compact active Future U plan on Home — checklist you can actually tap.
 */
export default function HomeActivePlanCard({ accentColor = '#22d3ee', onViewAll }) {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);
  const [plan, setPlan] = useState(null);

  const refresh = useCallback(async () => {
    const loaded = await loadFutureuPlanArtifact();
    if (loaded && typeof loaded === 'object') {
      const checklist = Array.isArray(loaded.checklist) ? loaded.checklist : [];
      const hasContent =
        !!(loaded.plan_title && String(loaded.plan_title).trim()) ||
        !!(loaded.goal && String(loaded.goal).trim()) ||
        checklist.length > 0;
      setHasPlan(hasContent);
      setPlan(hasContent ? loaded : null);
    } else {
      setHasPlan(false);
      setPlan(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!hasPlan || !plan) {
    return (
      <View style={styles.emptyCard}>
        <View style={[styles.emptyIcon, { backgroundColor: `${accentColor}22` }]}>
          <Ionicons name="rocket-outline" size={22} color={accentColor} />
        </View>
        <View style={styles.emptyTextCol}>
          <Text style={styles.emptyTitle}>No active plan yet</Text>
          <Text style={styles.emptyBody}>Future U builds a step-by-step plan you can check off here.</Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: accentColor }]}
          onPress={() => router.push('/Futureuai')}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>Start in Future U</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <UserPlan
        externalPlan={plan}
        variant="home"
        accentColor={accentColor}
        onPlanChange={(next) => {
          setPlan(next);
          setHasPlan(!!next);
        }}
      />
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/Futureuai')} activeOpacity={0.85}>
          <Ionicons name="chatbubbles-outline" size={16} color="#c4b5fd" />
          <Text style={styles.secondaryBtnText}>Continue in Future U</Text>
        </TouchableOpacity>
        {typeof onViewAll === 'function' ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onViewAll} activeOpacity={0.85}>
            <Ionicons name="layers-outline" size={16} color="#94a3b8" />
            <Text style={styles.secondaryBtnTextMuted}>All plans</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  emptyCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTextCol: { marginBottom: 14 },
  emptyTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptyBody: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  secondaryBtnText: { color: '#e9d5ff', fontSize: 13, fontWeight: '700' },
  secondaryBtnTextMuted: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
});
