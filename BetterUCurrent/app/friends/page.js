import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { useRouter } from 'expo-router';
import { PremiumAvatar } from '../components/PremiumAvatar';

export default function FriendsScreen() {
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { userProfile } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Only fetch friends when userProfile is loaded
    if (userProfile?.id) {
      fetchFriends();
    }
  }, [userProfile?.id]);

  const fetchFriends = async () => {
    try {
      // Ensure userProfile is loaded before proceeding
      if (!userProfile?.id) {
        console.log('User profile not loaded yet, skipping friends fetch');
        return;
      }

      // Get blocked users (both directions) - this ensures mutual blocking works
      // Users I blocked AND users who blocked me should both be filtered out
      // Query 1: Users I have blocked
      const { data: blockedByMe, error: blockedError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userProfile.id);

      if (blockedError) {
        console.error('❌ Error fetching users I blocked:', blockedError);
      } else {
        console.log(`✅ Found ${blockedByMe?.length || 0} users I blocked`);
      }

      // Query 2: Users who blocked me (CRITICAL - these should not appear in friends list)
      const { data: blockedMe, error: blockersError } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', userProfile.id);

      if (blockersError) {
        console.error('❌ Error fetching users who blocked me:', blockersError);
      } else {
        console.log(`✅ Found ${blockedMe?.length || 0} users who blocked me`);
        if (blockedMe && blockedMe.length > 0) {
          blockedMe.forEach(block => {
            console.log(`   - User ${block.blocker_id} blocked me`);
          });
        }
      }

      // Combine all blocked user IDs (both directions)
      // This Set will contain:
      // 1. Users I have blocked (blocked_id where I'm the blocker)
      // 2. Users who have blocked me (blocker_id where I'm the blocked)
      const blockedIds = new Set();
      blockedByMe?.forEach(block => {
        if (block?.blocked_id) {
          blockedIds.add(block.blocked_id);
          console.log(`🔒 User ${userProfile.id} blocked: ${block.blocked_id}`);
        }
      });
      blockedMe?.forEach(block => {
        if (block?.blocker_id) {
          blockedIds.add(block.blocker_id);
          console.log(`🔒 User blocked ${userProfile.id}: ${block.blocker_id}`);
        }
      });

      console.log('🚫 Blocked user IDs to filter from friends:', Array.from(blockedIds));

      const { data: friendships, error } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          ),
          user:user_id (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          )
        `)
        .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error fetching friendships:', error);
        throw error;
      }

      // Transform the data to get friend profiles
      const allFriendProfiles = (friendships || [])
        .map(f => {
          const friend = f.user_id === userProfile.id ? f.friend : f.user;
          return {
            ...friend,
            friendship_id: f.id
          };
        })
        .filter(friend => friend?.id); // Remove any null/undefined friends

      // Filter out blocked users (mutual blocking - both directions)
      // This removes:
      // 1. Friends I have blocked
      // 2. Friends who have blocked me
      const friendProfiles = allFriendProfiles.filter(friend => {
        const isBlocked = blockedIds.has(friend.id);
        if (isBlocked) {
          console.log(`Filtering out blocked friend: ${friend.username || friend.id}`);
        }
        return !isBlocked;
      });

      console.log(`Friends list: ${allFriendProfiles.length} total, ${friendProfiles.length} after blocking filter`);
      setFriends(friendProfiles);
    } catch (error) {
      console.error('Error fetching friends:', error);
      // Set empty array on error to avoid showing stale data
      setFriends([]);
    }
  };

  const handleRemoveFriend = async (friendId, friendshipId) => {
    Alert.alert(
      "Remove Friend",
      "Are you sure you want to remove this friend?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friends')
                .delete()
                .eq('id', friendshipId);

              if (error) throw error;

              // Refresh friends list
              fetchFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert(
                "Error",
                "Failed to remove friend. Please try again."
              );
            }
          }
        }
      ]
    );
  };

  const renderFriend = ({ item }) => {
    // Debug: Log to verify friendship_id exists
    if (!item.friendship_id) {
      console.warn('Missing friendship_id for friend:', item.id, item.username);
    }
    
    return (
      <View style={styles.friendItem}>
        <TouchableOpacity 
          style={styles.friendContent}
          onPress={() => router.push(`/profile/${item.id}`)}
        >
          <PremiumAvatar
            userId={item.id}
            source={item.avatar_url ? { uri: item.avatar_url } : null}
            size={50}
            style={{ marginRight: 16 }}
            isPremium={item.is_premium}
            username={item.username}
            fullName={item.full_name}
          />
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{item.full_name || item.username}</Text>
            <Text style={styles.friendUsername}>@{item.username}</Text>
          </View>
        </TouchableOpacity>
        {item.friendship_id && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFriend(item.id, item.friendship_id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={24} color="#ff0055" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={fetchFriends}
            tintColor="#00ffff"
            colors={["#00ffff"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No friends found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendUsername: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
}); 