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
  if (g) return g.length > 48 ? `${g.slice(0, 48)}…` : g;
  return 'Untitled plan';
}

export default function ViewPlansModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadFutureuPlansHistory();
      setRows(list);
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
      'Set active plan',
      `Use "${planRowTitle(entry)}" as your main plan on Home and in Future U?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set active',
          onPress: async () => {
            const ok = await setActiveFutureuPlanFromHistory(entry);
            if (ok) {
              Alert.alert('Done', 'This plan is now your active plan.');
              router.back();
            } else {
              Alert.alert('Error', 'Could not update the active plan.');
            }
          },
        },
      ]
    );
  };

  const confirmDelete = (entry) => {
    Alert.alert(
      'Remove plan',
      `Remove "${planRowTitle(entry)}" from this list? Your active plan will not change unless it was the only copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFutureuPlanHistoryEntry(entry.id);
            await refresh();
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#1a0b2e', '#2d1b4e', '#0a0a0f']} style={styles.gradient}>
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your plans</Text>
          <View style={styles.headerBtn} />
        </View>
        <Text style={styles.hint}>
          Full Future U plans below. Use the icons to set active or remove. Checklist changes sync when
          you leave a row.
        </Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#22d3ee" size="large" />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No saved plans yet</Text>
            <Text style={styles.emptyBody}>
              Open Future U and send a message. Each new AI plan is saved here. If you already had one
              active plan, it appears after you open this screen once.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {rows.map((entry) => (
              <View key={entry.id} style={styles.planCard}>
                <View style={styles.planActions}>
                  <Text style={styles.planDate}>{formatPlanDate(entry.savedAt) || 'Saved plan'}</Text>
                  <View style={styles.planActionsRight}>
                    <TouchableOpacity
                      onPress={() => confirmSetActive(entry)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.iconBtn}
                      accessibilityLabel="Set as active plan"
                    >
                      <Ionicons name="checkmark-circle-outline" size={22} color="#22d3ee" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(entry)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.iconBtn}
                      accessibilityLabel="Remove plan from list"
                    >
                      <Ionicons name="trash-outline" size={22} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
                <UserPlan
                  externalPlan={entry.plan}
                  hideOpenButton
                  showPlansLibrary={false}
                  chatEmbed
                  textColor="#f8fafc"
                  subtextColor="#94a3b8"
                  onPlanChange={() => refresh()}
                />
              </View>
            ))}
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
    fontSize: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    lineHeight: 17,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 32,
  },
  planCard: {
    marginBottom: 20,
  },
  planActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  planDate: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  planActionsRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6, marginLeft: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { color: '#e2e8f0', fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyBody: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
});
