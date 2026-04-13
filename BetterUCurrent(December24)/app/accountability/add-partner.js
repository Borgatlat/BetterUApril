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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { PremiumAvatar } from '../components/PremiumAvatar';
import { supabase } from '../../lib/supabase';
import { addAccountabilityPartner } from '../../utils/accountabilityService';

export default function AddAccountabilityPartnerScreen() {
  const { userProfile } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState([]);
  const [partnerIds, setPartnerIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});

  useEffect(() => {
    if (!userProfile?.id) return;
    (async () => {
      try {
        const { data: friendRows } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
          .eq('status', 'accepted');
        const ids = (friendRows || []).map((f) =>
          f.user_id === userProfile.id ? f.friend_id : f.user_id
        );
        const { data: partnerRows } = await supabase
          .from('accountability_partners')
          .select('user_id, partner_id')
          .or(`user_id.eq.${userProfile.id},partner_id.eq.${userProfile.id}`);
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
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile?.id]);

  const onAdd = async (friendId) => {
    setRequesting((s) => ({ ...s, [friendId]: true }));
    try {
      await addAccountabilityPartner(userProfile.id, friendId);
      setPartnerIds((s) => new Set([...s, friendId]));
      Alert.alert('Done', "Partner added. They'll get a notification.");
      router.back();
    } catch (e) {
      Alert.alert('Error', e.message);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Add accountability partner</Text>
        <View style={styles.headerRight} />
      </View>

      <Text style={styles.subtitle}>Choose a friend for weekly check-ins</Text>

      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Add friends in Community first, then come back here.
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
                    style={styles.addBtn}
                    onPress={() => onAdd(item.id)}
                    disabled={requesting[item.id]}
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
  addBtnText: { color: '#000', fontWeight: '600' },
});
