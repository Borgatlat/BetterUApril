"use client";

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function InvitationsScreen() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);

  useEffect(() => {
    loadInvitations();
  }, [userProfile?.id]);

  const loadInvitations = async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: invitationsData, error } = await supabase
        .from('team_invitations')
        .select(`
          id,
          team_id,
          message,
          created_at,
          teams:team_id (
            id,
            name,
            avatar_url,
            current_league,
            total_trophies
          ),
          profiles:invited_by_id (
            username,
            full_name
          )
        `)
        .eq('invited_user_id', userProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading invitations:', error);
        setInvitations([]);
      } else {
        const formattedInvitations = invitationsData.map(inv => ({
          id: inv.id,
          team_id: inv.team_id,
          team_name: inv.teams.name,
          team_avatar: inv.teams.avatar_url,
          team_league: inv.teams.current_league,
          team_trophies: inv.teams.total_trophies,
          invited_by: inv.profiles.full_name || inv.profiles.username,
          message: inv.message,
          created_at: inv.created_at
        }));
        setInvitations(formattedInvitations);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId, teamId) => {
    try {
      // Check if user already has a team
      const { data: existingTeam } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userProfile.id)
        .single();

      if (existingTeam) {
        Alert.alert('Error', 'You are already in a team. Leave your current team to accept this invitation.');
        return;
      }

      // Check for blocked users in the team before accepting invitation
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      if (membersError) {
        console.error('Error fetching team members:', membersError);
      } else if (teamMembers && teamMembers.length > 0) {
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

        // Check if any team members are blocked
        const blockedMembers = teamMembers.filter(member => blockedIds.has(member.user_id));
        
        if (blockedMembers.length > 0) {
          // Get usernames of blocked members for the warning
          const { data: blockedProfiles } = await supabase
            .from('profiles')
            .select('username, full_name')
            .in('id', blockedMembers.map(m => m.user_id));

          const blockedNames = blockedProfiles?.map(p => p.full_name || p.username || 'a user').join(', ') || 'blocked users';
          
          Alert.alert(
            'Blocked Users in Team',
            `This team contains ${blockedMembers.length} ${blockedMembers.length === 1 ? 'user you have blocked' : 'users you have blocked'}: ${blockedNames}.\n\nYou won't be able to see their activities, but they will still be in the team. Do you want to proceed?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: async () => {
                  // Reject the invitation if user cancels
                  await supabase
                    .from('team_invitations')
                    .update({ status: 'rejected' })
                    .eq('id', invitationId);
                  await loadInvitations();
                }
              },
              {
                text: 'Accept Anyway',
                onPress: async () => {
                  await performAcceptInvitation(invitationId);
                }
              }
            ]
          );
          return;
        }
      }

      // No blocked users, proceed with accepting invitation
      await performAcceptInvitation(invitationId);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', error.message || 'Failed to accept invitation.');
    }
  };

  // Separate function to perform the actual accept invitation operation
  const performAcceptInvitation = async (invitationId) => {
    try {
      // Update invitation status
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // The trigger will automatically add user to team
      Alert.alert('Success', 'You have joined the team!', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/(tabs)/community', params: { tab: 'league' } }) }
      ]);
      
      await loadInvitations();
    } catch (error) {
      console.error('Error performing accept invitation:', error);
      throw error;
    }
  };

  const handleRejectInvitation = async (invitationId) => {
    Alert.alert(
      'Reject Invitation',
      'Are you sure you want to reject this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('team_invitations')
                .update({ status: 'rejected' })
                .eq('id', invitationId);

              if (error) throw error;

              await loadInvitations();
            } catch (error) {
              console.error('Error rejecting invitation:', error);
              Alert.alert('Error', 'Failed to reject invitation.');
            }
          }
        }
      ]
    );
  };

  const getLeagueColor = (league) => {
    const colors = {
      'Bronze': '#CD7F32',
      'Silver': '#C0C0C0',
      'Gold': '#FFD700',
      'Platinum': '#E5E4E2',
      'Diamond': '#B9F2FF',
      'Master': '#9B59B6',
    };
    return colors[league] || '#ffffff';
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Invitations</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {invitations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={80} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No Invitations</Text>
            <Text style={styles.emptyStateDescription}>
              You don't have any pending team invitations.
            </Text>
          </View>
        ) : (
          invitations.map((invitation) => (
            <View key={invitation.id} style={styles.invitationCard}>
              <View style={styles.invitationHeader}>
                {invitation.team_avatar ? (
                  <Image source={{ uri: invitation.team_avatar }} style={styles.teamAvatar} />
                ) : (
                  <View style={styles.teamAvatarPlaceholder}>
                    <Ionicons name="people" size={24} color="#00ffff" />
                  </View>
                )}
                <View style={styles.invitationInfo}>
                  <Text style={styles.teamName}>{invitation.team_name}</Text>
                  <View style={styles.teamBadge}>
                    <View 
                      style={[
                        styles.leagueDot, 
                        { backgroundColor: getLeagueColor(invitation.team_league) }
                      ]} 
                    />
                    <Text style={styles.teamLeague}>{invitation.team_league}</Text>
                    <Text style={styles.teamTrophies}>🏆 {invitation.team_trophies}</Text>
                  </View>
                  <Text style={styles.invitedBy}>
                    Invited by {invitation.invited_by}
                  </Text>
                </View>
              </View>
              
              {invitation.message && (
                <Text style={styles.invitationMessage}>{invitation.message}</Text>
              )}

              <View style={styles.invitationActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleRejectInvitation(invitation.id)}
                >
                  <Ionicons name="close-circle" size={20} color="#ff4444" />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAcceptInvitation(invitation.id, invitation.team_id)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#00ff00" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  invitationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  invitationHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  teamAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  teamAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#00ffff',
  },
  invitationInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  teamLeague: {
    fontSize: 14,
    color: '#9ca3af',
    marginRight: 12,
  },
  teamTrophies: {
    fontSize: 14,
    color: '#FFD700',
  },
  invitedBy: {
    fontSize: 14,
    color: '#6b7280',
  },
  invitationMessage: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 16,
    paddingLeft: 76,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  acceptButton: {
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
  },
  rejectButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: '600',
  },
});

