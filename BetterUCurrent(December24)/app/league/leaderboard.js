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
  Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const { width: screenWidth } = Dimensions.get('window');

// Mock data - will be replaced with real Supabase data
const MOCK_LEADERBOARD = [
  { id: '1', name: 'Team Alpha', avatar_url: null, value: 15000, rank: 1, league: 'Master', isMyTeam: false },
  { id: '2', name: 'Team Beta', avatar_url: null, value: 12500, rank: 2, league: 'Diamond', isMyTeam: false },
  { id: '3', name: 'Team Gamma', avatar_url: null, value: 11200, rank: 3, league: 'Platinum', isMyTeam: false },
  { id: '4', name: 'Team Delta', avatar_url: null, value: 9800, rank: 4, league: 'Gold', isMyTeam: false },
  { id: '5', name: 'Team Epsilon', avatar_url: null, value: 9200, rank: 5, league: 'Gold', isMyTeam: false },
  { id: '15', name: 'Gym Warriors', avatar_url: null, value: 8500, rank: 15, league: 'Gold', isMyTeam: true },
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');

  useEffect(() => {
    if (userProfile?.id) {
      loadLeaderboard();
    } else {
      setLoading(false);
    }
  }, [userProfile?.id]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      // Get active challenge with full details
      const { data: activeChallenge, error: challengeError } = await supabase
        .from('league_challenges')
        .select('id, name, challenge_type, start_date, end_date, prize_description')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!activeChallenge || challengeError) {
        setLeaderboard([]);
        setChallenge(null);
        setLoading(false);
        return;
      }

      // Calculate days remaining accurately
      // Set end date to end of day (23:59:59.999)
      const endDate = new Date(activeChallenge.end_date);
      endDate.setHours(23, 59, 59, 999);
      
      // Set today to start of day (00:00:00.000) for accurate calculation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate difference in milliseconds, then convert to days
      const diffMs = endDate - today;
      const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      setChallenge({
        ...activeChallenge,
        days_remaining: Math.max(0, daysRemaining)
      });

      // Get user's team ID for highlighting
      let userTeam = null;
      if (userProfile?.id) {
        const { data, error: teamError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', userProfile.id)
          .single();
        
        // Only set userTeam if we got data and no error (PGRST116 is expected if user has no team)
        if (data && !teamError) {
          userTeam = data;
        } else if (teamError && teamError.code !== 'PGRST116') {
          console.error('Error fetching user team:', teamError);
        }
        
        // If user has a team, ensure it's enrolled and progress is updated
        if (userTeam?.team_id) {
          // First, check if team is enrolled, if not, enroll it
          const { data: existingParticipant } = await supabase
            .from('team_challenge_participants')
            .select('team_id')
            .eq('challenge_id', activeChallenge.id)
            .eq('team_id', userTeam.team_id)
            .single();
          
          if (!existingParticipant) {
            // Team not enrolled - enroll it now
            console.log('Team not enrolled, enrolling now...');
            const { error: enrollError } = await supabase
              .from('team_challenge_participants')
              .insert({
                challenge_id: activeChallenge.id,
                team_id: userTeam.team_id,
                current_value: 0
              });
            
            if (enrollError) {
              console.log('Error enrolling team:', enrollError);
            }
          }
          
          // Manually update progress for user's team to ensure it's current
          // This also recalculates ranks for ALL teams in the challenge
          // (update_team_challenge_progress updates ranks for all teams, not just one)
          const { error: updateError } = await supabase.rpc('update_team_challenge_progress', {
            p_challenge_id: activeChallenge.id,
            p_team_id: userTeam.team_id
          });
          
          if (updateError) {
            console.log('Could not update team progress:', updateError);
          } else {
            console.log('Team progress and ranks updated successfully');
          }
        }
      }

      // Fetch leaderboard - get all participants
      // First try with join, if that fails, fetch separately
      let participants = [];
      let error = null;
      
      const { data: participantsData, error: participantsError } = await supabase
        .from('team_challenge_participants')
        .select(`
          team_id,
          current_value,
          rank,
          teams:team_id (
            id,
            name,
            avatar_url,
            current_league,
            total_trophies
          )
        `)
        .eq('challenge_id', activeChallenge.id);
      
      error = participantsError;
      participants = participantsData || [];
      
      // Debug logging
      console.log('Active Challenge:', activeChallenge.id, activeChallenge.name);
      console.log('User Team ID:', userTeam?.team_id);
      console.log('Query error:', error);
      console.log('Participants found:', participants?.length || 0);
      
      if (error) {
        console.error('Error loading leaderboard:', error);
        // Try fetching without join as fallback
        const { data: participantsSimple, error: simpleError } = await supabase
          .from('team_challenge_participants')
          .select('team_id, current_value, rank')
          .eq('challenge_id', activeChallenge.id);
        
        if (!simpleError && participantsSimple) {
          // Fetch teams separately
          const teamIds = participantsSimple.map(p => p.team_id);
          const { data: teamsData } = await supabase
            .from('teams')
            .select('id, name, avatar_url, current_league, total_trophies')
            .in('id', teamIds);
          
          // Merge data
          const teamsMap = new Map(teamsData?.map(t => [t.id, t]) || []);
          participants = participantsSimple.map(p => ({
            ...p,
            teams: teamsMap.get(p.team_id) || null
          }));
          error = null;
          console.log('Fallback query succeeded, participants:', participants.length);
        }
      }
      
      if (participants && participants.length > 0) {
        console.log('Sample participant:', {
          team_id: participants[0].team_id,
          current_value: participants[0].current_value,
          rank: participants[0].rank,
          team_name: participants[0].teams?.name,
          has_teams: !!participants[0].teams
        });
      }

      if (error) {
        console.error('Error loading leaderboard (final):', error);
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      if (!participants || participants.length === 0) {
        console.log('No participants found for challenge');
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      // Use database rank directly - it's now calculated using RANK() which handles ties correctly
      // This ensures consistency with the league screen which also uses database rank
      // The database rank is recalculated when update_team_challenge_progress is called
      // which happens automatically via triggers when workouts are saved
      const finalParticipants = participants
        .filter(p => p.teams !== null); // Filter out any null team references

      // Sort by rank (from database) - this ensures consistent ordering
      // If rank is null, sort by current_value DESC as fallback
      const sortedParticipants = [...finalParticipants].sort((a, b) => {
        // Primary sort: by rank if both have ranks
        if (a.rank !== null && b.rank !== null) {
          return a.rank - b.rank;
        }
        // If only one has rank, prioritize it
        if (a.rank !== null) return -1;
        if (b.rank !== null) return 1;
        // Both NULL - sort by current_value DESC
        return b.current_value - a.current_value;
      });

      // Use database rank if available, otherwise calculate it
      // This ensures consistency with the league screen which uses database rank
      const leaderboardData = sortedParticipants.map((p, index) => {
        // Use database rank if available, otherwise calculate based on position
        // Database rank uses RANK() which handles ties correctly
        let actualRank = p.rank;
        
        // If rank is null, calculate it based on sorted position
        // This handles ties the same way RANK() does
        if (actualRank === null) {
          const firstWithSameValue = sortedParticipants.findIndex(
            team => team.current_value === p.current_value
          );
          actualRank = firstWithSameValue + 1;
        }
        
        const isMyTeam = userTeam?.team_id === p.team_id;
        
        // Ensure league has a default value if null
        const teamLeague = p.teams?.current_league || 'Bronze';
        
        // Log if this is the user's team
        if (isMyTeam) {
          console.log('Found user team in leaderboard:', {
            name: p.teams?.name,
            rank: actualRank,
            db_rank: p.rank,
            value: p.current_value,
            position: index,
            league: teamLeague
          });
        }
        
        return {
          id: p.teams?.id,
          team_id: p.team_id,
          name: p.teams?.name || 'Unknown Team',
          avatar_url: p.teams?.avatar_url || null,
          value: p.current_value || 0,
          rank: actualRank,
          league: teamLeague,
          isMyTeam: isMyTeam,
          estimatedTrophies: getEstimatedTrophies(actualRank)
        };
      });

      console.log('Final leaderboard:', {
        totalTeams: leaderboardData.length,
        top3: leaderboardData.slice(0, 3).map(t => ({ name: t.name, rank: t.rank, value: t.value })),
        userTeamFound: leaderboardData.find(t => t.isMyTeam) ? 'YES' : 'NO'
      });

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  // Show top 3 in podium - safely handle empty leaderboard
  const topThree = leaderboard && leaderboard.length > 0 ? leaderboard.slice(0, 3) : [];
  // Show ALL teams in the list (including top 3) so they can be filtered by category
  const restOfLeaderboard = leaderboard || [];

  const filteredLeaderboard = (restOfLeaderboard || []).filter(team => {
    if (!team || !team.name) return false; // Skip invalid teams
    const matchesSearch = !searchQuery || team.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLeague = selectedLeague === 'all' || (team.league && team.league === selectedLeague);
    return matchesSearch && matchesLeague;
  });

  const getTrophyEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getEstimatedTrophies = (rank) => {
    if (rank === 1) return 100;
    if (rank === 2) return 25;
    if (rank === 3) return 10;
    if (rank >= 4 && rank <= 10) return 5;
    if (rank >= 11 && rank <= 25) return 1;
    return 0;
  };

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
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Challenge Info */}
        {challenge && (
          <View style={styles.challengeCard}>
            <Text style={styles.challengeName}>{challenge.name}</Text>
            <View style={styles.challengeMeta}>
              <View style={styles.daysRemaining}>
                <Ionicons name="time-outline" size={16} color="#00ffff" />
                <Text style={styles.daysText}>
                  {(() => {
                    const days = challenge.days_remaining ?? 0;
                    if (days === 0) return 'Ends today';
                    if (days === 1) return '1 day left';
                    return `${days} days left`;
                  })()}
                </Text>
              </View>
              {challenge.prize_description && (
                <View style={styles.prizeBadge}>
                  <Ionicons name="trophy-outline" size={16} color="#FFD700" />
                  <Text style={styles.prizeText}>{challenge.prize_description}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        {/* Top 3 Podium */}
        {topThree.length > 0 && (
          <View style={styles.podiumContainer}>
            {/* 2nd Place - only show if we have 2+ teams */}
            {topThree.length >= 2 && (
              <View style={[styles.podiumItem, styles.secondPlace]}>
                <View style={styles.podiumRank}>
                  <Text style={styles.podiumRankText}>2</Text>
                </View>
                {topThree[1].avatar_url ? (
                  <Image source={{ uri: topThree[1].avatar_url }} style={styles.podiumAvatar} />
                ) : (
                  <View style={styles.podiumAvatarPlaceholder}>
                    <Ionicons name="people" size={24} color="#C0C0C0" />
                  </View>
                )}
                <Text style={styles.podiumName} numberOfLines={1}>{topThree[1].name || 'Unknown Team'}</Text>
                <Text style={styles.podiumValue}>{((topThree[1].value ?? 0)).toLocaleString()}</Text>
                <View style={[styles.medalBadge, { backgroundColor: 'rgba(192, 192, 192, 0.2)' }]}>
                  <Text style={styles.medalEmoji}>🥈</Text>
                </View>
              </View>
            )}
            {topThree.length === 1 && <View style={styles.podiumItem} />}

            {/* 1st Place (taller) - always show if we have at least 1 team */}
            <View style={[styles.podiumItem, styles.firstPlace]}>
              <View style={styles.podiumRank}>
                <Text style={styles.podiumRankText}>1</Text>
              </View>
              {topThree[0].avatar_url ? (
                <Image source={{ uri: topThree[0].avatar_url }} style={styles.podiumAvatar} />
              ) : (
                <View style={styles.podiumAvatarPlaceholder}>
                  <Ionicons name="people" size={28} color="#FFD700" />
                </View>
              )}
              <Text style={styles.podiumName} numberOfLines={1}>{topThree[0].name || 'Unknown Team'}</Text>
              <Text style={styles.podiumValue}>{((topThree[0].value ?? 0)).toLocaleString()}</Text>
              <View style={[styles.medalBadge, { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
                <Text style={styles.medalEmoji}>🥇</Text>
              </View>
            </View>

            {/* 3rd Place - only show if we have 3+ teams */}
            {topThree.length >= 3 ? (
              <View style={[styles.podiumItem, styles.thirdPlace]}>
                <View style={styles.podiumRank}>
                  <Text style={styles.podiumRankText}>3</Text>
                </View>
                {topThree[2].avatar_url ? (
                  <Image source={{ uri: topThree[2].avatar_url }} style={styles.podiumAvatar} />
                ) : (
                  <View style={styles.podiumAvatarPlaceholder}>
                    <Ionicons name="people" size={24} color="#CD7F32" />
                  </View>
                )}
                <Text style={styles.podiumName} numberOfLines={1}>{topThree[2].name || 'Unknown Team'}</Text>
                <Text style={styles.podiumValue}>{((topThree[2].value ?? 0)).toLocaleString()}</Text>
                <View style={[styles.medalBadge, { backgroundColor: 'rgba(205, 127, 50, 0.2)' }]}>
                  <Text style={styles.medalEmoji}>🥉</Text>
                </View>
              </View>
            ) : (
              <View style={styles.podiumItem} />
            )}
          </View>
        )}

        {/* Search and Filter */}
        <View style={styles.filterSection}>
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

        {/* Leaderboard List */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>Global Rankings</Text>
          {!challenge && (
            <Text style={styles.noChallengeText}>No active challenge</Text>
          )}
          {challenge && leaderboard.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No teams enrolled yet</Text>
              <Text style={styles.emptyStateSubtext}>Be the first team to join the challenge!</Text>
            </View>
          )}
          {challenge && leaderboard.length > 0 && filteredLeaderboard.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No teams found</Text>
              <Text style={styles.emptyStateSubtext}>Try a different filter or search term</Text>
            </View>
          )}
          {filteredLeaderboard.map((team, index) => (
            <TouchableOpacity
              key={team.id}
              style={[
                styles.leaderboardItem,
                team.isMyTeam && styles.myTeamHighlight
              ]}
              onPress={() => router.push(`/league/team/${team.id}`)}
            >
              <View style={styles.rankContainer}>
                <Text style={styles.rank}>{team.rank ?? '-'}</Text>
              </View>
              
              {team.avatar_url ? (
                <Image source={{ uri: team.avatar_url }} style={styles.teamAvatarSmall} />
              ) : (
                <View style={styles.teamAvatarSmallPlaceholder}>
                  <Ionicons name="people" size={20} color="#00ffff" />
                </View>
              )}
              
              <View style={styles.teamInfo}>
                <Text style={styles.teamName} numberOfLines={1}>{team.name || 'Unknown Team'}</Text>
                <View style={styles.leagueTag}>
                  <View style={[styles.leagueDot, { backgroundColor: getLeagueColor(team.league || 'Bronze') }]} />
                  <Text style={styles.leagueTier}>{team.league || 'Bronze'}</Text>
                </View>
              </View>
              
              <View style={styles.valueContainer}>
                <Text style={styles.value}>{(team.value ?? 0).toLocaleString()}</Text>
                {team.rank && team.rank <= 25 && (
                  <Text style={styles.trophyPreview}>
                    +{getEstimatedTrophies(team.rank)} 🏆
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingBottom: 100,
  },
  challengeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  challengeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  challengeMeta: {
    flexDirection: 'column',
  },
  daysRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  daysText: {
    fontSize: 14,
    color: '#00ffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  prizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  prizeText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 6,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    marginBottom: 20,
  },
  podiumItem: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  firstPlace: {
    marginBottom: 0,
  },
  secondPlace: {
    marginBottom: 20,
  },
  thirdPlace: {
    marginBottom: 40,
  },
  podiumRank: {
    marginBottom: 8,
  },
  podiumRankText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  podiumAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  podiumAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  podiumName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
    maxWidth: 80,
    textAlign: 'center',
  },
  podiumValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 8,
  },
  medalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  medalEmoji: {
    fontSize: 24,
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
  leaderboardSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  noChallengeText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  myTeamHighlight: {
    borderColor: '#00ffff',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  teamAvatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  teamAvatarSmallPlaceholder: {
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
  teamInfo: {
    flex: 1,
    marginRight: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  leagueTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  leagueTier: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 4,
  },
  trophyPreview: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
});

