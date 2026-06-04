import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { navigateToHome } from '../../utils/safeNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { PremiumAvatar } from '../components/PremiumAvatar';
import {
  getAccountabilityPartners,
  removeAccountabilityPartner,
  triggerWeeklyCheckInReminders,
  getCheckInsForPartnership,
} from '../../utils/accountabilityService';
import {
  formatRhythmSummary,
  isCheckInDueThisWeek,
  isCheckInDayToday,
} from '../../utils/accountabilityUtils';
import { syncPartnershipLocalReminder } from '../../lib/accountabilityReminders';

export default function AccountabilityScreen() {
  const { userProfile } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      try {
        await triggerWeeklyCheckInReminders();
      } catch (reminderErr) {
        console.warn('[accountability] server reminders:', reminderErr?.message);
      }

      const list = await getAccountabilityPartners(userProfile.id);
      const enriched = await Promise.all(
        list.map(async (p) => {
          try {
            const history = await getCheckInsForPartnership(p.id, 6);
            return {
              ...p,
              checkInDue: isCheckInDueThisWeek(history, userProfile.id),
              isCheckInDay: isCheckInDayToday(p.check_in_day),
            };
          } catch {
            return { ...p, checkInDue: true, isCheckInDay: false };
          }
        }),
      );
      setPartners(enriched);

      await Promise.all(
        enriched.map((p) =>
          syncPartnershipLocalReminder({
            partnershipId: p.id,
            partnerName: p.partner?.full_name || p.partner?.username || 'your partner',
            checkInDay: p.check_in_day || 'sunday',
            reminderHourUtc: p.reminder_hour_utc ?? 18,
            enabled: p.reminders_enabled !== false,
          }).catch(() => {}),
        ),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRemovePartner = (partnershipId, partnerName) => {
    Alert.alert(
      'Remove accountability partner',
      `Stop weekly check-ins with ${partnerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccountabilityPartner(userProfile.id, partnershipId);
              load();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigateToHome(router)}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Accountability partners</Text>
        <View style={styles.headerRight} />
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/accountability/add-partner')}
      >
        <Ionicons name="person-add" size={22} color="#000" />
        <Text style={styles.addButtonText}>Add partner (from friends)</Text>
      </TouchableOpacity>

      <FlatList
        data={partners}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00ffff']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No accountability partners yet</Text>
            <Text style={styles.emptySubtext}>Add a friend to start weekly check-ins</Text>
          </View>
        }
        renderItem={({ item }) => {
          const name = item.partner?.full_name || item.partner?.username || 'Partner';
          return (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() =>
                  router.push({
                    pathname: '/accountability/check-in',
                    params: { partnershipId: item.id, partnerId: item.partner_id },
                  })
                }
                activeOpacity={0.8}
              >
                <PremiumAvatar uri={item.partner?.avatar_url} size={48} />
                <View style={styles.cardContent}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardName}>{name}</Text>
                    {item.checkInDue ? (
                      <View style={styles.dueBadge}>
                        <Text style={styles.dueBadgeText}>
                          {item.isCheckInDay ? 'Due today' : 'Due this week'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>Done</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {formatRhythmSummary(item)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsLink}
                onPress={() =>
                  router.push({
                    pathname: '/accountability/partnership-settings',
                    params: { partnershipId: item.id },
                  })
                }
              >
                <Ionicons name="calendar-outline" size={16} color="#00ffff" />
                <Text style={styles.settingsLinkText}>Rhythm & meetup</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerRight: { width: 40 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  addButtonText: { marginLeft: 10, color: '#000', fontWeight: '600' },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardContent: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  dueBadge: {
    backgroundColor: '#ff950033',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dueBadgeText: { color: '#ff9500', fontSize: 11, fontWeight: '700' },
  doneBadge: {
    backgroundColor: '#00ff0033',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneBadgeText: { color: '#6f6', fontSize: 11, fontWeight: '700' },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  settingsLinkText: { color: '#00ffff', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#ccc', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#666', marginTop: 4 },
});
