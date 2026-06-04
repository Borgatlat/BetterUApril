import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { navigateToAccountability, navigateToHome } from '../../utils/safeNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { PremiumAvatar } from '../components/PremiumAvatar';
import { supabase } from '../../lib/supabase';
import {
  addAccountabilityPartner,
  checkAccountabilityPartnersAvailable,
} from '../../utils/accountabilityService';
import { formatApiError } from '../../lib/formatApiError';
import { syncPartnershipLocalReminder } from '../../lib/accountabilityReminders';

export default function AddAccountabilityPartnerScreen() {
  const { userProfile } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState([]);
  const [partnerIds, setPartnerIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});
  const [setupError, setSetupError] = useState(null);

  useEffect(() => {
    if (!userProfile?.id) return;
    (async () => {
      try {
        await checkAccountabilityPartnersAvailable();
        setSetupError(null);

        const { data: friendRows } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
          .eq('status', 'accepted');
        const ids = (friendRows || []).map((f) =>
          f.user_id === userProfile.id ? f.friend_id : f.user_id
        );
        const { data: partnerRows, error: partnerListError } = await supabase
          .from('accountability_partners')
          .select('user_id, partner_id')
          .or(`user_id.eq.${userProfile.id},partner_id.eq.${userProfile.id}`);
        if (partnerListError) throw partnerListError;
        const already = new Set(
          (partnerRows || []).map((p) =>
            p.user_id === userProfile.id ? p.partner_id : p.user_id
          )
        );
        setPartnerIds(already);
        if (ids.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', ids);
        setFriends(profiles || []);
      } catch (e) {
        console.error(e);
        setSetupError(formatApiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile?.id]);

  const onAdd = async (friendId) => {
    setRequesting((s) => ({ ...s, [friendId]: true }));
    try {
      const row = await addAccountabilityPartner(userProfile.id, friendId);
      const friend = friends.find((f) => f.id === friendId);
      const name = friend?.full_name || friend?.username || 'your partner';
      if (row?.id) {
        await syncPartnershipLocalReminder({
          partnershipId: row.id,
          partnerName: name,
          checkInDay: 'sunday',
          reminderHourUtc: 18,
          enabled: true,
        }).catch(() => {});
      }
      setPartnerIds((s) => new Set([...s, friendId]));
      Alert.alert(
        'Done',
        "Partner added. They'll get a notification. Set your weekly rhythm from the partners list.",
      );
      navigateToAccountability(router);
    } catch (e) {
      Alert.alert('Could not add partner', formatApiError(e));
    } finally {
      setRequesting((s) => ({ ...s, [friendId]: false }));
    }
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
        <Text style={styles.title}>Add accountability partner</Text>
        <View style={styles.headerRight} />
      </View>

      <Text style={styles.subtitle}>Choose a friend for weekly check-ins</Text>

      {setupError ? (
        <View style={styles.setupBanner}>
          <Text style={styles.setupBannerText}>{setupError}</Text>
        </View>
      ) : null}

      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Add classmates from the Community → Friends tab first, then pick who you’d like as a
            partner for weekly accountability check-ins.
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          style={styles.list}
          renderItem={({ item }) => {
            const name = item.full_name || item.username || 'Friend';
            const isPartner = partnerIds.has(item.id);
            return (
              <View style={styles.row}>
                <PremiumAvatar uri={item.avatar_url} size={44} />
                <Text style={styles.name}>{name}</Text>
                {isPartner ? (
                  <Text style={styles.badge}>Partners</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.addBtn, setupError && styles.addBtnOff]}
                    onPress={() => onAdd(item.id)}
                    disabled={requesting[item.id] || Boolean(setupError)}
                  >
                    <Text style={styles.addBtnText}>
                      {requesting[item.id] ? 'Adding…' : 'Add as partner'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
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
    marginBottom: 12,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerRight: { width: 40 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  empty: { paddingVertical: 24 },
  emptyText: { color: '#888', fontSize: 16 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  name: { flex: 1, marginLeft: 12, fontSize: 16, color: '#fff' },
  badge: { color: '#00ffff', fontSize: 14 },
  addBtn: { backgroundColor: '#00ffff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnOff: { opacity: 0.4 },
  addBtnText: { color: '#000', fontWeight: '600' },
  setupBanner: {
    backgroundColor: 'rgba(255,80,80,0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.35)',
  },
  setupBannerText: { color: '#ff8a8a', fontSize: 13, lineHeight: 18 },
});
