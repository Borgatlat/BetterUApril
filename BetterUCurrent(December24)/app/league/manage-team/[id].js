"use client";

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { createTeamJoinRequestAcceptedNotification } from '../../../utils/notificationHelpers';

export default function ManageTeamScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'requests', 'invitations'
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (id && userProfile?.id) {
      loadTeamData();
    }
  }, [id, userProfile?.id]);

  const loadTeamData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get auth user to check ownership
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) {
        setLoading(false);
        return;
      }

      // Fetch team data
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (teamError) {
        console.error('Error fetching team:', teamError);
        setTeam(null);
        setLoading(false);
        return;
      }

      setTeam(teamData);
      const isTeamOwner = teamData.created_by === authUser.id;
      setIsOwner(isTeamOwner);

      // Check if user is admin
      const { data: userMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', id)
        .eq('user_id', authUser.id)
        .single();

      const isTeamAdmin = userMember?.role === 'admin';
      setIsAdmin(isTeamAdmin);

      // Always load members
      await loadMembers();

      // Only load management data if user is owner/admin
      if (isTeamOwner || isTeamAdmin) {
        await Promise.all([
          loadJoinRequests(),
          loadInvitations()
        ]);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    const { data: membersData, error } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('team_id', id)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true });

    if (!error && membersData) {
      const formattedMembers = membersData.map(m => ({
        id: m.profiles.id,
        username: m.profiles.username,
        full_name: m.profiles.full_name,
        avatar_url: m.profiles.avatar_url,
        role: m.role,
        joined_at: m.joined_at
      }));
      setMembers(formattedMembers);
    }
  };

  const loadJoinRequests = async () => {
    try {
      // Get current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) {
        console.error('No authenticated user');
        setJoinRequests([]);
        return;
      }

      console.log('Loading join requests for team:', id, 'User:', authUser.id);

      // Debug: Test ownership
      const { data: ownershipTest } = await supabase.rpc('test_team_ownership', {
        p_team_id: id
      });
      console.log('Ownership test:', ownershipTest);

      // ALWAYS try RPC function first - it bypasses RLS completely
      const { data: requestsData, error: rpcError } = await supabase.rpc('get_team_join_requests', {
        p_team_id: id
      });

      console.log('RPC result:', { requestsData, rpcError, dataLength: requestsData?.length });

      // If RPC function exists and worked, use it
      if (!rpcError) {
        // Handle both array and null/undefined
        const requests = Array.isArray(requestsData) ? requestsData : [];
        console.log('RPC returned', requests.length, 'requests');
        
        const formattedRequests = requests.map(r => ({
          id: r.id,
          user_id: r.user_id,
          username: r.username || 'Unknown',
          full_name: r.full_name || null,
          avatar_url: r.avatar_url || null,
          message: r.message,
          created_at: r.created_at
        }));
        setJoinRequests(formattedRequests);
        return;
      }

      // Log RPC errors for debugging
      console.error('RPC function error:', rpcError);
      
      // If RPC function doesn't exist (error code 42883 = function does not exist)
      if (rpcError && (rpcError.code === '42883' || rpcError.message?.includes('does not exist'))) {
        console.warn('RPC function does not exist. Please run the SQL migration file: 20250120000005_fix_join_requests_rls.sql');
      }

      // Fallback: Try direct query with multiple approaches
      // Approach 1: Simple query without join
      const { data: simpleRequests, error: simpleError } = await supabase
        .from('team_join_requests')
        .select('id, user_id, team_id, status, message, created_at')
        .eq('team_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (simpleError) {
        console.error('Simple query error:', simpleError);
        // Try checking if user is owner first
        const { data: teamData } = await supabase
          .from('teams')
          .select('created_by')
          .eq('id', id)
          .single();
        
        const { data: memberData } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', id)
          .eq('user_id', authUser.id)
          .single();

        const isOwner = teamData?.created_by === authUser.id || memberData?.role === 'owner' || memberData?.role === 'admin';
        console.log('Is owner?', isOwner, 'Team created_by:', teamData?.created_by, 'Member role:', memberData?.role);
        
        if (!isOwner) {
          console.error('User is not team owner/admin');
          setJoinRequests([]);
          return;
        }
      }

      if (simpleRequests && simpleRequests.length > 0) {
        // Fetch profiles separately
        const userIds = simpleRequests.map(r => r.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const formattedRequests = simpleRequests.map(r => {
          const profile = profilesMap.get(r.user_id);
          return {
            id: r.id,
            user_id: r.user_id,
            username: profile?.username || 'Unknown',
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
            message: r.message,
            created_at: r.created_at
          };
        });
        setJoinRequests(formattedRequests);
        return;
      }

      // Approach 2: Query with join
      const { data: requestsData2, error } = await supabase
        .from('team_join_requests')
        .select(`
          id,
          user_id,
          message,
          created_at,
          team_id,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('team_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Join query error:', error);
        setJoinRequests([]);
        return;
      }

      if (requestsData2 && requestsData2.length > 0) {
        const formattedRequests = requestsData2.map(r => ({
          id: r.id,
          user_id: r.profiles?.id || r.user_id,
          username: r.profiles?.username || 'Unknown',
          full_name: r.profiles?.full_name || null,
          avatar_url: r.profiles?.avatar_url || null,
          message: r.message,
          created_at: r.created_at
        }));
        setJoinRequests(formattedRequests);
      } else {
        setJoinRequests([]);
      }
    } catch (error) {
      console.error('Error loading join requests:', error);
      setJoinRequests([]);
    }
  };

  const loadInvitations = async () => {
    const { data: invitationsData, error } = await supabase
      .from('team_invitations')
      .select(`
        id,
        invited_user_id,
        message,
        created_at,
        profiles:invited_user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('team_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && invitationsData) {
      const formattedInvitations = invitationsData.map(i => ({
        id: i.id,
        user_id: i.profiles.id,
        username: i.profiles.username,
        full_name: i.profiles.full_name,
        avatar_url: i.profiles.avatar_url,
        message: i.message,
        created_at: i.created_at
      }));
      setInvitations(formattedInvitations);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      // Get request details before updating
      const { data: requestData } = await supabase
        .from('team_join_requests')
        .select(`
          user_id,
          team_id,
          teams:team_id(name)
        `)
        .eq('id', requestId)
        .single();

      if (!requestData) {
        throw new Error('Request not found');
      }

      // Update request status
      const { error } = await supabase
        .from('team_join_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      // Send notification to the user whose request was accepted
      await createTeamJoinRequestAcceptedNotification(
        requestData.user_id,
        requestData.team_id,
        requestData.teams?.name || 'A team'
      );

      Alert.alert('Success', 'Join request accepted!');
      await Promise.all([loadMembers(), loadJoinRequests()]);
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message || 'Failed to accept request.');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('team_join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert('Success', 'Join request rejected.');
      await loadJoinRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject request.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the team?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('team_id', id)
                .eq('user_id', memberId);

              if (error) throw error;

              Alert.alert('Success', 'Member removed from team.');
              await loadMembers();
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member.');
            }
          }
        }
      ]
    );
  };

  const handlePromoteToAdmin = async (memberId) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', id)
        .eq('user_id', memberId);

      if (error) throw error;

      Alert.alert('Success', 'Member promoted to admin!');
      await loadMembers();
    } catch (error) {
      console.error('Error promoting member:', error);
      Alert.alert('Error', 'Failed to promote member.');
    }
  };

  const handleSearchUsers = async (searchQuery) => {
    setInviteUsername(searchQuery);
    
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search for users by username or full name
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (usersError) {
        console.error('Error searching users:', usersError);
        setSearchResults([]);
        setSearching(false);
        return;
      }

      if (!usersData || usersData.length === 0) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      // Check which users are already in teams
      const userIds = usersData.map(u => u.id);
      const { data: teamMembersData } = await supabase
        .from('team_members')
        .select('user_id')
        .in('user_id', userIds);

      const usersInTeams = new Set(teamMembersData?.map(tm => tm.user_id) || []);

      // Filter and format results
      const results = usersData.map(user => ({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        inTeam: usersInTeams.has(user.id)
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInviteUser = async (userId, username) => {
    try {
      // Double-check if user is already in a team
      const { data: existingTeam } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .single();

      if (existingTeam) {
        Alert.alert('Error', 'This user is already in a team. They must leave their current team before being invited.');
        await handleSearchUsers(inviteUsername); // Refresh results
        return;
      }

      // Check if team is full
      const { count: memberCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', id);

      if (memberCount >= 20) {
        Alert.alert('Error', 'Team is full (20/20 members)');
        return;
      }

      // Check if there's already a pending invitation
      const { data: existingInvitation } = await supabase
        .from('team_invitations')
        .select('id')
        .eq('team_id', id)
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        Alert.alert('Info', 'You have already sent an invitation to this user.');
        return;
      }

      // Create invitation
      const { error: inviteError } = await supabase
        .from('team_invitations')
        .insert({
          team_id: id,
          invited_user_id: userId,
          invited_by_id: userProfile.id,
          status: 'pending'
        });

      if (inviteError) throw inviteError;

      Alert.alert('Success', `Invitation sent to ${username || 'user'}!`);
      setInviteModalVisible(false);
      setInviteUsername('');
      setSearchResults([]);
      await loadInvitations();
    } catch (error) {
      console.error('Error inviting user:', error);
      Alert.alert('Error', error.message || 'Failed to send invitation.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Team not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isOwner && !isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>You don't have permission to manage this team</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Team</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members ({members.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests ({joinRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'invitations' && styles.tabActive]}
          onPress={() => setActiveTab('invitations')}
        >
          <Text style={[styles.tabText, activeTab === 'invitations' && styles.tabTextActive]}>
            Invitations ({invitations.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Members Tab */}
        {activeTab === 'members' && (
          <View>
            {members.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                ) : (
                  <View style={styles.memberAvatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#00ffff" />
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.full_name || member.username}</Text>
                  <Text style={styles.memberRole}>
                    {member.role === 'owner' ? '👑 Owner' : member.role === 'admin' ? '⭐ Admin' : 'Member'}
                  </Text>
                </View>
                {isOwner && member.role !== 'owner' && (
                  <View style={styles.memberActions}>
                    {member.role === 'member' && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handlePromoteToAdmin(member.id)}
                      >
                        <Ionicons name="star-outline" size={18} color="#FFD700" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleRemoveMember(member.id)}
                    >
                      <Ionicons name="close-circle" size={18} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Join Requests Tab */}
        {activeTab === 'requests' && (
          <View>
            {joinRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color="#6b7280" />
                <Text style={styles.emptyStateText}>No pending requests</Text>
              </View>
            ) : (
              joinRequests.map((request) => (
                <View key={request.id} style={styles.requestItem}>
                  {request.avatar_url ? (
                    <Image source={{ uri: request.avatar_url }} style={styles.requestAvatar} />
                  ) : (
                    <View style={styles.requestAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color="#00ffff" />
                    </View>
                  )}
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{request.full_name || request.username}</Text>
                    {request.message && (
                      <Text style={styles.requestMessage}>{request.message}</Text>
                    )}
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.acceptButton, styles.actionButton]}
                      onPress={() => handleAcceptRequest(request.id)}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#00ff00" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectButton, styles.actionButton]}
                      onPress={() => handleRejectRequest(request.id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && (
          <View>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => setInviteModalVisible(true)}
            >
              <Ionicons name="person-add-outline" size={20} color="#00ffff" />
              <Text style={styles.inviteButtonText}>Invite Member</Text>
            </TouchableOpacity>

            {invitations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color="#6b7280" />
                <Text style={styles.emptyStateText}>No pending invitations</Text>
              </View>
            ) : (
              invitations.map((invitation) => (
                <View key={invitation.id} style={styles.requestItem}>
                  {invitation.avatar_url ? (
                    <Image source={{ uri: invitation.avatar_url }} style={styles.requestAvatar} />
                  ) : (
                    <View style={styles.requestAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color="#00ffff" />
                    </View>
                  )}
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{invitation.full_name || invitation.username}</Text>
                    <Text style={styles.requestStatus}>Pending invitation...</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Member</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Search for users by username or name to invite to your team.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Search by username or name..."
              placeholderTextColor="#6b7280"
              value={inviteUsername}
              onChangeText={handleSearchUsers}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            {/* Search Results */}
            {searching && (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="small" color="#00ffff" />
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            )}

            {!searching && searchResults.length > 0 && (
              <ScrollView style={styles.searchResultsContainer} keyboardShouldPersistTaps="handled">
                {searchResults.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.searchResultItem,
                      user.inTeam && styles.searchResultItemDisabled
                    ]}
                    onPress={() => {
                      if (!user.inTeam) {
                        handleInviteUser(user.id, user.full_name || user.username);
                      }
                    }}
                    disabled={user.inTeam}
                  >
                    {user.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={styles.searchResultAvatar} />
                    ) : (
                      <View style={styles.searchResultAvatarPlaceholder}>
                        <Ionicons name="person" size={20} color="#00ffff" />
                      </View>
                    )}
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>
                        {user.full_name || user.username}
                      </Text>
                      <Text style={styles.searchResultUsername}>@{user.username}</Text>
                    </View>
                    {user.inTeam ? (
                      <View style={styles.inTeamBadge}>
                        <Ionicons name="people" size={16} color="#ff4444" />
                        <Text style={styles.inTeamText}>In Team</Text>
                      </View>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color="#00ffff" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {!searching && inviteUsername.length >= 2 && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={48} color="#6b7280" />
                <Text style={styles.noResultsText}>No users found</Text>
                <Text style={styles.noResultsSubtext}>Try a different search term</Text>
              </View>
            )}

            {inviteUsername.length > 0 && inviteUsername.length < 2 && (
              <View style={styles.searchHintContainer}>
                <Text style={styles.searchHintText}>Type at least 2 characters to search</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setInviteModalVisible(false);
                  setInviteUsername('');
                  setSearchResults([]);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 16,
  },
  backLink: {
    color: '#00ffff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#00ffff',
  },
  tabText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00ffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  memberAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#00ffff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
    color: '#9ca3af',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  requestAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  requestAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#00ffff',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  requestMessage: {
    fontSize: 14,
    color: '#9ca3af',
  },
  requestStatus: {
    fontSize: 14,
    color: '#FFD700',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    // Styled via actionButton
  },
  rejectButton: {
    // Styled via actionButton
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  inviteButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalButtonConfirm: {
    backgroundColor: '#00ffff',
  },
  modalButtonTextCancel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  searchLoadingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  searchResultsContainer: {
    maxHeight: 300,
    marginBottom: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  searchResultItemDisabled: {
    opacity: 0.5,
    borderColor: '#ff4444',
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchResultAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#00ffff',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  searchResultUsername: {
    fontSize: 14,
    color: '#9ca3af',
  },
  inTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  inTeamText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '600',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginBottom: 20,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  searchHintContainer: {
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchHintText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

