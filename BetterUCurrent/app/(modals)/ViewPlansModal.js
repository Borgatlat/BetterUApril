import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  loadFutureuPlansHistory,
  loadFutureuPlanArtifact,
  setActiveFutureuPlanFromHistory,
  removeFutureuPlanHistoryEntry,
} from '../../utils/futureuPlanStorage';
import UserPlan from '../../components/UserPlan';

function formatPlanDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function planRowTitle(entry) {
  const p = entry?.plan;
  if (!p || typeof p !== 'object') return 'Untitled plan';
  const t = p.plan_title && String(p.plan_title).trim();
  if (t) return t;
  const g = p.goal && String(p.goal).trim();
  if (g) return g.length > 56 ? `${g.slice(0, 56)}…` : g;
  return 'Untitled plan';
}

function planProgress(entry) {
  const list = Array.isArray(entry?.plan?.checklist) ? entry.plan.checklist : [];
  const done = list.filter((c) => c.completed).length;
  return { done, total: list.length };
}

export default function ViewPlansModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [activeSavedAt, setActiveSavedAt] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, active] = await Promise.all([
        loadFutureuPlansHistory(),
        loadFutureuPlanArtifact(),
      ]);
      setRows(list);
      setActiveSavedAt(active?.savedAt || null);
    } catch (e) {
      console.error('[ViewPlansModal]', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const confirmSetActive = (entry) => {
    Alert.alert(
      'Use this plan',
      `Make "${planRowTitle(entry)}" your active plan on Home and in Future U?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use this plan',
          onPress: async () => {
            const ok = await setActiveFutureuPlanFromHistory(entry);
            if (ok) {
              await refresh();
              Alert.alert('Updated', 'This is now your active plan.');
            } else {
              Alert.alert('Error', 'Could not update the active plan.');
            }
          },
        },
      ]
    );
  };

  const confirmDelete = (entry) => {
    Alert.alert('Remove plan', `Remove "${planRowTitle(entry)}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeFutureuPlanHistoryEntry(entry.id);
          if (expandedId === entry.id) setExpandedId(null);
          await refresh();
        },
      },
    ]);
  };

  const toggleExpanded = (id) => {
    setExpandedId((cur) => (cur === id ? null : id));
  };

  return (
    <LinearGradient colors={['#1a0b2e', '#2d1b4e', '#0a0a0f']} style={styles.gradient}>
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your plans</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/Futureuai')} hitSlop={12}>
            <Ionicons name="add-circle-outline" size={26} color="#22d3ee" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#22d3ee" size="large" />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No saved plans yet</Text>
            <Text style={styles.emptyBody}>
              Chat with Future U to generate a plan. Each new plan is saved here automatically.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/Futureuai')}
              activeOpacity={0.88}
            >
              <Text style={styles.emptyBtnText}>Open Future U</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.hint}>Tap a plan to expand steps. Check items off directly in the list.</Text>
            {rows.map((entry) => {
              const { done, total } = planProgress(entry);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isActive =
                !!activeSavedAt &&
                !!entry.savedAt &&
                String(entry.savedAt) === String(activeSavedAt);
              const expanded = expandedId === entry.id;

              return (
                <View key={entry.id} style={styles.planShell}>
                  <TouchableOpacity
                    style={[styles.planHeader, expanded && styles.planHeaderExpanded]}
                    onPress={() => toggleExpanded(entry.id)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.planHeaderMain}>
                      <Text style={styles.planTitle} numberOfLines={2}>
                        {planRowTitle(entry)}
                      </Text>
                      <Text style={styles.planDate}>{formatPlanDate(entry.savedAt) || 'Saved plan'}</Text>
                      {total > 0 ? (
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%` }]} />
                          </View>
                          <Text style={styles.progressText}>
                            {done}/{total}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.planHeaderRight}>
                      {isActive ? (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      ) : null}
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#94a3b8"
                      />
                    </View>
                  </TouchableOpacity>

                  {expanded ? (
                    <UserPlan
                      externalPlan={entry.plan}
                      variant="library"
                      hideOpenButton
                      showPlansLibrary={false}
                      onPlanChange={() => refresh()}
                    />
                  ) : null}

                  <View style={styles.planActions}>
                    {!isActive ? (
                      <TouchableOpacity
                        style={styles.useBtn}
                        onPress={() => confirmSetActive(entry)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#0f172a" />
                        <Text style={styles.useBtnText}>Use this plan</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.activeLabel}>
                        <Ionicons name="checkmark-circle" size={18} color="#34d399" />
                        <Text style={styles.activeLabelText}>Active on Home</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => confirmDelete(entry)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 92, 246, 0.25)',
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  planShell: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  planHeaderExpanded: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
  },
  planHeaderMain: { flex: 1, minWidth: 0 },
  planHeaderRight: { alignItems: 'flex-end', gap: 8 },
  planTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800', lineHeight: 22 },
  planDate: { color: '#64748b', fontSize: 12, marginTop: 4, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#22d3ee' },
  progressText: { color: '#94a3b8', fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  activeBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  activeBadgeText: { color: '#6ee7b7', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  planActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(139, 92, 246, 0.15)',
  },
  useBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#22d3ee',
    borderRadius: 10,
    paddingVertical: 11,
  },
  useBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 13 },
  activeLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  activeLabelText: { color: '#6ee7b7', fontWeight: '700', fontSize: 13 },
  removeBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
  },
  removeBtnText: { color: '#fda4af', fontWeight: '700', fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 28,
  },
  emptyTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptyBody: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#22d3ee',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});
