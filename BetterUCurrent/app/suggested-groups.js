import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { GroupAvatar } from './components/GroupAvatar';

const SuggestedGroupsScreen = () => {
  const router = useRouter();
  const { userProfile } = useUser();
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState({});
  const [pendingRequests, setPendingRequests] = useState({});

  useEffect(() => {
    fetchSuggestedGroups();
    fetchPendingRequests();
  }, []);

  const fetchSuggestedGroups = async () => {
    try {
      setLoading(true);
      
      // First get all accepted friends
      const { data: accepted, error: acceptedError } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
        .eq('status', 'accepted');

      if (acceptedError) throw acceptedError;

      // Get friend IDs
      const friendIds = (accepted || []).map(f => 
        f.user_id === userProfile.id ? f.friend_id : f.user_id
      );

      if (friendIds.length === 0) {
        setSuggestedGroups([]);
        return;
      }

      // Get groups that friends are members of
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .in('user_id', friendIds);

      if (memberError) throw memberError;

      // Get unique group IDs
      const groupIds = [...new Set(memberGroups.map(mg => mg.group_id))];

      if (groupIds.length === 0) {
        setSuggestedGroups([]);
        return;
      }

      // Get groups with member counts and check if user is already a member
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select(`
          *,
          member_count:group_members(count),
          is_member:group_members!inner(user_id)
        `)
        .in('id', groupIds)
        .neq('created_by', userProfile.id);

      if (groupsError) throw groupsError;

      // Transform the data to get the actual count number and filter out groups user is already in
      const transformedGroups = groups
        ?.map(group => ({
          ...group,
          member_count: group.member_count[0]?.count || 0,
          is_member: group.is_member.some(m => m.user_id === userProfile.id)
        }))
        .filter(group => !group.is_member) || [];

      setSuggestedGroups(transformedGroups);
    } catch (error) {
      console.error('Error fetching suggested groups:', error);
      Alert.alert('Error', 'Failed to load suggested groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('join_requests')
        .select('group_id, status')
        .eq('user_id', userProfile.id)
        .eq('status', 'pending');

      if (error) throw error;

      // Create a map of group_id to status
      const requestsMap = {};
      data.forEach(request => {
        requestsMap[request.group_id] = request.status;
      });
      setPendingRequests(requestsMap);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setPendingRequests({});
    }
  };

  const handleJoinGroup = async (groupId, isPrivate) => {
    try {
      // Check if there's already a pending request
      if (pendingRequests[groupId]) {
        Alert.alert('Already Requested', 'You have already requested to join this group.');
        return;
      }

      // Check for blocked users in the group before joining
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (membersError) {
        console.error('Error fetching group members:', membersError);
      } else if (groupMembers && groupMembers.length > 0) {
        // Get blocked users (both directions)
        const { data: blockedByMe, error: blockedError } = await supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', userProfile.id);

        const { data: blockedMe, error: blockersError } = await supabase
          .from('blocks')
          .select('blocker_id')
          .eq('blocked_id', userProfile.id);

        // Combine all blocked user IDs
        const blockedIds = new Set();
        blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
        blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

        // Check if any group members are blocked
        const blockedMembers = groupMembers.filter(member => blockedIds.has(member.user_id));
        
        if (blockedMembers.length > 0) {
          // Get usernames of blocked members for the warning
          const { data: blockedProfiles } = await supabase
            .from('profiles')
            .select('username, full_name')
            .in('id', blockedMembers.map(m => m.user_id));

          const blockedNames = blockedProfiles?.map(p => p.full_name || p.username || 'a user').join(', ') || 'blocked users';
          
          Alert.alert(
            'Blocked Users in Group',
            `This group contains ${blockedMembers.length} ${blockedMembers.length === 1 ? 'user you have blocked' : 'users you have blocked'}: ${blockedNames}.\n\nYou won't be able to see their activities, but they will still be in the group. Do you want to proceed?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {}
              },
              {
                text: 'Join Anyway',
                onPress: async () => {
                  await performJoinGroup(groupId, isPrivate);
                }
              }
            ]
          );
          return;
        }
      }

      // No blocked users, proceed with join
      await performJoinGroup(groupId, isPrivate);
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to join group. Please try again.');
    } finally {
      setJoining(prev => ({ ...prev, [groupId]: false }));
    }
  };

  // Separate function to perform the actual join operation
  const performJoinGroup = async (groupId, isPrivate) => {
    try {
      setJoining(prev => ({ ...prev, [groupId]: true }));

      if (isPrivate) {
        // For private groups, create a join request
        const { data, error } = await supabase
          .from('join_requests')
          .insert({
            group_id: groupId,
            user_id: userProfile.id,
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;

        // Update the pending requests
        setPendingRequests(prev => ({
          ...prev,
          [groupId]: 'pending'
        }));

        Alert.alert('Success', 'Join request sent! The group owner will review your request.');
      } else {
        // For public groups, join directly
        const { error } = await supabase
          .from('group_members')
          .insert({
            group_id: groupId,
            user_id: userProfile.id,
            role: 'member'
          });

        if (error) throw error;

        // Update the groups list
        setSuggestedGroups(prev => prev.filter(g => g.id !== groupId));
        Alert.alert('Success', 'Joined group successfully!');
      }
    } catch (error) {
      console.error('Error performing join:', error);
      throw error;
    } finally {
      setJoining(prev => ({ ...prev, [groupId]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
                <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/community')}
        >
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suggested Groups</Text>
      </View>

      <ScrollView style={styles.content}>
        {suggestedGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No suggested groups found. Join more friends to see their groups!
            </Text>
          </View>
        ) : (
          suggestedGroups.map((group) => {
            const hasPendingRequest = pendingRequests[group.id] === 'pending';
            return (
              <View key={group.id} style={styles.groupCard}>
                <View style={styles.groupCardHeader}>
                  <Image 
                    source={{ uri: group.avatar_url || 'https://placehold.co/400x200' }} 
                    style={styles.groupBanner}
                  />
                  <GroupAvatar
                    groupName={group.name}
                    size={60}
                    source={group.avatar_url ? { uri: group.avatar_url } : null}
                    style={styles.groupAvatar} 
                  />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupDesc} numberOfLines={2}>
                    {group.description || 'No description'}
                  </Text>
                  <View style={styles.groupMeta}>
                    <View style={styles.groupMetaLeft}>
                      <Ionicons name="people" size={16} color="#00ffff" />
                      <Text style={styles.memberCount}>{group.member_count} members</Text>
                    </View>
                    <View style={styles.groupMetaRight}>
                      <Ionicons 
                        name={group.is_public ? 'globe' : 'lock-closed'} 
                        size={16} 
                        color="#00ffff" 
                      />
                      <Text style={styles.privacyStatus}>
                        {group.is_public ? 'Public' : 'Private'}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.joinButton,
                    group.is_public ? styles.joinButton : styles.requestButton,
                    hasPendingRequest && styles.pendingButton
                  ]}
                  onPress={() => handleJoinGroup(group.id, !group.is_public)}
                  disabled={joining[group.id] || hasPendingRequest}
                >
                  <Text style={[
                    styles.joinButtonText,
                    group.is_public ? styles.joinButtonText : styles.requestButtonText,
                    hasPendingRequest && styles.pendingButtonText
                  ]}>
                    {joining[group.id] 
                      ? (group.is_public ? 'Joining...' : 'Requesting...') 
                      : hasPendingRequest
                        ? 'Request Pending'
                        : (group.is_public ? 'Join Group' : 'Request to Join')}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingTop: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#00ffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 17,
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  groupCardHeader: {
    height: 100,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    position: 'relative',
  },
  groupBanner: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  groupAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    position: 'absolute',
    bottom: -30,
    left: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  groupInfo: {
    padding: 16,
    paddingTop: 40,
  },
  groupName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  groupDesc: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    padding: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  groupMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    color: '#00ffff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  privacyStatus: {
    color: '#00ffff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
    marginTop: 0,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  requestButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  joinButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  requestButtonText: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  pendingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#666',
  },
  pendingButtonText: {
    color: '#666',
  },
});

export default SuggestedGroupsScreen; 