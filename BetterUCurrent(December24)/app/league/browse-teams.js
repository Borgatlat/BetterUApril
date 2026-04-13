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
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { createTeamJoinRequestNotification } from '../../utils/notificationHelpers';

// Mock data - will be replaced with real Supabase data
const MOCK_TEAMS = [
  { id: '1', name: 'Gym Warriors', avatar_url: null, current_league: 'Gold', member_count: 15, total_trophies: 1250 },
  { id: '2', name: 'Fitness Freaks', avatar_url: null, current_league: 'Silver', member_count: 8, total_trophies: 250 },
  { id: '3', name: 'Iron Squad', avatar_url: null, current_league: 'Platinum', member_count: 20, total_trophies: 2000 },
  { id: '4', name: 'Beast Mode', avatar_url: null, current_league: 'Bronze', member_count: 5, total_trophies: 50 },
  { id: '5', name: 'Elite Athletes', avatar_url: null, current_league: 'Diamond', member_count: 18, total_trophies: 6000 },
];

export default function BrowseTeamsScreen() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setLoading(true);
    try {
      // Fetch all teams with member counts
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          avatar_url,
          current_league,
          total_trophies,
          description
        `)
        .order('total_trophies', { ascending: false });

      if (error) {
        console.error('Error loading teams:', error);
        setTeams([]);
        setLoading(false);
        return;
      }

      // Get member counts for each team
      const teamsWithCounts = await Promise.all(
        teamsData.map(async (team) => {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);

          return {
            ...team,
            member_count: count || 0
          };
        })
      );

      setTeams(teamsWithCounts);
    } catch (error) {
      console.error('Error loading teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLeague = selectedLeague === 'all' || team.current_league === selectedLeague;
    return matchesSearch && matchesLeague;
  });

  const getLeagueColor = (league) => {
    const colors = {
      'Bronze': '#CD7F32',
      'Silver': '#C0C0C0',
      'Gold': '#FFD700',
      'Platinum': '#E5E4E2',
      'Diamond': '#00ffff',
      'Master': '#9B59B6',
    };
    return colors[league] || '#ffffff';
  };

  const joinTeam = async (teamId) => {
    if (!userProfile?.id) {
      Alert.alert('Error', 'Please log in to join a team');
      return;
    }

    try {
      // Check if user already has a team
      const { data: existingTeam } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userProfile.id)
        .single();

      if (existingTeam) {
        Alert.alert('Error', 'You are already in a team. Leave your current team to join another.');
        return;
      }

      // Check if user has any pending request (only one allowed at a time)
      const { data: existingRequest } = await supabase
        .from('team_join_requests')
        .select('id, team_id, teams:team_id(name)')
        .eq('user_id', userProfile.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        Alert.alert(
          'Pending Request', 
          `You already have a pending request to join "${existingRequest.teams?.name || 'a team'}". You can only have one pending request at a time. Cancel your current request to join a different team.`,
          [
            { text: 'OK' }
          ]
        );
        return;
      }

      // Check if team is full
      const { count: memberCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if (memberCount >= 20) {
        Alert.alert('Error', 'This team is full (20/20 members)');
        return;
      }

      // Check for blocked users in the team before joining
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
                style: 'cancel'
              },
              {
                text: 'Join Anyway',
                onPress: async () => {
                  await performJoinTeam(teamId);
                }
              }
            ]
          );
          return;
        }
      }

      // No blocked users, proceed with join
      await performJoinTeam(teamId);
    } catch (error) {
      console.error('Error joining team:', error);
      Alert.alert('Error', 'Failed to join team. Please try again.');
    }
  };

  // Separate function to perform the actual join operation
  const performJoinTeam = async (teamId) => {
    try {
      // Get team info for notification
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      // Create join request
      const { error: requestError } = await supabase
        .from('team_join_requests')
        .insert({
          team_id: teamId,
          user_id: userProfile.id,
          status: 'pending'
        });

      if (requestError) {
        throw requestError;
      }

      // Send notifications to team owners/admins
      // Get all owners and admins
      const { data: ownersAdmins } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .in('role', ['owner', 'admin']);

      if (ownersAdmins && ownersAdmins.length > 0) {
        // Import notification helper
        const { createTeamJoinRequestNotification } = await import('../../utils/notificationHelpers');
        
        // Notify each owner/admin
        const requesterName = userProfile.full_name || userProfile.username || 'Someone';
        for (const member of ownersAdmins) {
          await createTeamJoinRequestNotification(
            member.user_id, // team owner/admin to notify
            userProfile.id, // requester
            teamId,
            teamData?.name || 'your team',
            requesterName
          );
        }
      }

      Alert.alert(
        'Request Sent!', 
        'Your request to join has been sent to the team owner. They will review it soon.',
        [
          { text: 'OK', onPress: () => router.back() }
        ]
      );
    } catch (error) {
      console.error('Error sending join request:', error);
      Alert.alert('Error', error.message || 'Failed to send join request. Please try again.');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Browse Teams</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search teams..."
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.leagueFilter}
          contentContainerStyle={styles.leagueFilterContent}
        >
          {['all', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'].map(league => (
            <TouchableOpacity
              key={league}
              style={[
                styles.filterButton,
                selectedLeague === league && styles.filterButtonActive
              ]}
              onPress={() => setSelectedLeague(league)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedLeague === league && styles.filterButtonTextActive
              ]}>
                {league === 'all' ? 'All' : league}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredTeams}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.teamCard}
            onPress={() => router.push(`/league/team/${item.id}`)}
          >
            <View style={styles.teamCardContent}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.teamCardAvatar} />
              ) : (
                <View style={styles.teamCardAvatarPlaceholder}>
                  <Ionicons name="people" size={32} color="#00ffff" />
                </View>
              )}
              
              <View style={styles.teamCardInfo}>
                <Text style={styles.teamCardName}>{item.name}</Text>
                <View style={styles.teamCardDetails}>
                  <View style={styles.leagueTag}>
                    <View style={[styles.leagueDot, { backgroundColor: getLeagueColor(item.current_league) }]} />
                    <Text style={styles.leagueTier}>{item.current_league}</Text>
                  </View>
                  <Text style={styles.teamCardMembers}>{item.member_count}/20 members</Text>
                </View>
                <View style={styles.trophyInfo}>
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                  <Text style={styles.trophyCount}>{item.total_trophies.toLocaleString()} trophies</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.joinButton}
              onPress={() => joinTeam(item.id)}
            >
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyStateText}>No teams found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />
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
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 12,
  },
  leagueFilter: {
    marginBottom: 10,
  },
  leagueFilterContent: {
    paddingRight: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderColor: '#00ffff',
  },
  filterButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#00ffff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  teamCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCardContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  teamCardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  teamCardAvatarPlaceholder: {
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
  teamCardInfo: {
    flex: 1,
  },
  teamCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  teamCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  leagueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  leagueTier: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  teamCardMembers: {
    fontSize: 14,
    color: '#9ca3af',
  },
  trophyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trophyCount: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 6,
  },
  joinButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});

