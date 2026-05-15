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
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

// Mock data - will be replaced with real Supabase data
const MOCK_TEAM_DATA = {
  id: '1',
  name: 'Gym Warriors',
  description: 'We train hard, we win harder! Join us for the ultimate fitness journey.',
  avatar_url: null,
  total_trophies: 1250,
  current_league: 'Gold',
  best_league: 'Gold',
  member_count: 15,
  created_by: 'user1',
  created_at: '2024-01-15',
};

const MOCK_MEMBERS = [
  { id: '1', username: 'user1', full_name: 'John Doe', avatar_url: null, role: 'owner' },
  { id: '2', username: 'user2', full_name: 'Jane Smith', avatar_url: null, role: 'admin' },
  { id: '3', username: 'user3', full_name: 'Mike Johnson', avatar_url: null, role: 'member' },
];

const MOCK_TROPHY_HISTORY = [
  { month: 'Jan', trophies: 100 },
  { month: 'Feb', trophies: 25 },
  { month: 'Mar', trophies: 10 },
  { month: 'Apr', trophies: 5 },
  { month: 'May', trophies: 50 },
  { month: 'Jun', trophies: 30 },
];

export default function TeamDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [trophyHistory, setTrophyHistory] = useState([]);
  const [detailedTrophyHistory, setDetailedTrophyHistory] = useState([]);
  const [challengeHistory, setChallengeHistory] = useState([]);
  const [officialTeamTotal, setOfficialTeamTotal] = useState(null); // Official total from database (matches leaderboard)
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadTeamData();
  }, [id]);

  const loadTeamData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
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

      // Get member count
      const { count: memberCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamData.id);

      setTeam({
        ...teamData,
        member_count: memberCount || 0
      });
      setIsOwner(teamData.created_by === userProfile?.id);

      // Get active challenge for contribution calculation
      const { data: activeChallenge } = await supabase
        .from('league_challenges')
        .select('id, start_date, end_date, challenge_type')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
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

      if (!membersError && membersData) {
        // Calculate contributions for each member if there's an active challenge
        let membersWithContributions = [];
        
        if (activeChallenge && activeChallenge.challenge_type === 'workout_minutes') {
          // Calculate workout minutes for each member
          membersWithContributions = await Promise.all(
            membersData.map(async (m) => {
              let contributionMinutes = 0;
              
              // Calculate member's workout minutes for the current challenge period
              // duration is stored in SECONDS, so divide by 60 to get minutes
              // Only count workouts >= 10 minutes (600 seconds)
              // Use date filtering to match database exactly
              // Database uses: DATE(completed_at) BETWEEN start_date AND end_date
              // This means it includes all workouts from start_date 00:00:00 to end_date 23:59:59
              const startDate = activeChallenge.start_date + 'T00:00:00.000Z';
              const endDate = activeChallenge.end_date + 'T23:59:59.999Z';
              
              const { data: workoutData, error: workoutError } = await supabase
                .from('user_workout_logs')
                .select('duration')
                .eq('user_id', m.user_id)
                .gte('duration', 600) // 10 minute minimum (600 seconds)
                .gte('completed_at', startDate)
                .lte('completed_at', endDate);
              
              // Calculate workout minutes from gym workouts
              let workoutMinutes = 0;
              if (!workoutError && workoutData && workoutData.length > 0) {
                // Sum all workout durations, then divide by 60
                const totalSeconds = workoutData.reduce((sum, workout) => {
                  return sum + (workout.duration || 0);
                }, 0);
                workoutMinutes = totalSeconds / 60;
              }
              
              // Also fetch runs, walks, and bikes from the runs table
              // These should also be included in workout minutes
              const { data: runsData, error: runsError } = await supabase
                .from('runs')
                .select('duration_seconds')
                .eq('user_id', m.user_id)
                .eq('status', 'completed')  // Only count completed activities
                .gte('duration_seconds', 600) // 10 minute minimum (600 seconds)
                .gte('created_at', startDate)
                .lte('created_at', endDate);
              
              // Calculate minutes from runs/walks/bikes
              let runsMinutes = 0;
              if (!runsError && runsData && runsData.length > 0) {
                // Sum all run durations, then divide by 60
                const totalSeconds = runsData.reduce((sum, run) => {
                  return sum + (run.duration_seconds || 0);
                }, 0);
                runsMinutes = totalSeconds / 60;
              }
              
              // Total contribution = workouts + runs/walks/bikes
              // Floor to match database INTEGER truncation
              contributionMinutes = Math.floor(workoutMinutes + runsMinutes);
              
              return {
                id: m.profiles.id,
                user_id: m.user_id,
                username: m.profiles.username,
                full_name: m.profiles.full_name,
                avatar_url: m.profiles.avatar_url,
                role: m.role,
                contributionMinutes: contributionMinutes
              };
            })
          );
          
          // Sort by contribution (highest first) within role groups
          membersWithContributions.sort((a, b) => {
            // First sort by role priority
            const roleOrder = { owner: 0, admin: 1, member: 2 };
            if (roleOrder[a.role] !== roleOrder[b.role]) {
              return roleOrder[a.role] - roleOrder[b.role];
            }
            // Then sort by contribution (highest first)
            return b.contributionMinutes - a.contributionMinutes;
          });
        } else {
          // No active challenge or not workout_minutes type - just format members
          membersWithContributions = membersData.map(m => ({
            id: m.profiles.id,
            user_id: m.user_id,
            username: m.profiles.username,
            full_name: m.profiles.full_name,
            avatar_url: m.profiles.avatar_url,
            role: m.role,
            contributionMinutes: 0
          }));
        }
        
        setMembers(membersWithContributions);
        setIsAdmin(membersData.find(m => m.user_id === userProfile?.id && m.role === 'admin') !== undefined);
      }

      // Fetch detailed trophy history with challenge info
      const { data: trophyData, error: trophyError } = await supabase
        .from('team_trophy_history')
        .select(`
          id,
          trophies_earned,
          base_trophies,
          multiplier,
          rank_achieved,
          earned_at,
          league_challenges:challenge_id (
            id,
            name,
            challenge_type,
            start_date,
            end_date
          )
        `)
        .eq('team_id', id)
        .order('earned_at', { ascending: false });

      if (!trophyError && trophyData) {
        // Set detailed trophy history
        setDetailedTrophyHistory(trophyData);

        // Group by month for the chart (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const recentTrophies = trophyData.filter(entry => new Date(entry.earned_at) >= sixMonthsAgo);
        const monthlyTrophies = {};
        recentTrophies.forEach(entry => {
          const date = new Date(entry.earned_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyTrophies[monthKey]) {
            monthlyTrophies[monthKey] = 0;
          }
          monthlyTrophies[monthKey] += entry.trophies_earned;
        });

        // Convert to array format
        const historyArray = Object.entries(monthlyTrophies).map(([key, trophies]) => {
          const [year, month] = key.split('-');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return {
            month: monthNames[parseInt(month) - 1],
            trophies
          };
        });

        setTrophyHistory(historyArray.slice(-6)); // Last 6 months
      } else {
        setDetailedTrophyHistory([]);
        setTrophyHistory([]);
      }

      // Fetch all challenge participation history
      const { data: challengeData, error: challengeError } = await supabase
        .from('team_challenge_participants')
        .select(`
          id,
          current_value,
          final_value,
          rank,
          final_rank,
          trophies_earned,
          joined_at,
          last_updated,
          league_challenges:challenge_id (
            id,
            name,
            challenge_type,
            start_date,
            end_date,
            status,
            prize_description
          )
        `)
        .eq('team_id', id)
        .order('joined_at', { ascending: false });
      
      // Get the official team total for the active challenge (matches leaderboard calculation)
      // This is the source of truth - calculated by the database function
      if (activeChallenge && challengeData) {
        const activeParticipation = challengeData.find(
          p => p.league_challenges?.id === activeChallenge.id && p.league_challenges?.status === 'active'
        );
        if (activeParticipation) {
          // Use the official database-calculated value (same as leaderboard)
          setOfficialTeamTotal(activeParticipation.current_value || 0);
        } else {
          setOfficialTeamTotal(null);
        }
      } else {
        setOfficialTeamTotal(null);
      }

      if (!challengeError && challengeData) {
        setChallengeHistory(challengeData);
      } else {
        setChallengeHistory([]);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      setTeam(null);
    } finally {
      setLoading(false);
    }
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

  const maxTrophies = Math.max(...trophyHistory.map(h => h.trophies), 100);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Details</Text>
        {(isOwner || isAdmin) && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push(`/league/manage-team/${id}`)} style={styles.headerActionButton}>
              <Ionicons name="people-outline" size={24} color="#00ffff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/league/team-settings/${id}`)} style={styles.headerActionButton}>
              <Ionicons name="settings-outline" size={24} color="#00ffff" />
            </TouchableOpacity>
          </View>
        )}
        {!(isOwner || isAdmin) && <View style={styles.placeholder} />}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Team Header */}
        <View style={styles.teamHeader}>
          {team.avatar_url ? (
            <Image source={{ uri: team.avatar_url }} style={styles.teamAvatar} />
          ) : (
            <View style={styles.teamAvatarPlaceholder}>
              <Ionicons name="people" size={48} color="#00ffff" />
            </View>
          )}
          <Text style={styles.teamName}>{team.name}</Text>
          {team.description && (
            <Text style={styles.teamDescription}>{team.description}</Text>
          )}
        </View>

        {/* Team Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{team.total_trophies.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Trophies</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.leagueBadge, { backgroundColor: `${getLeagueColor(team.current_league)}20` }]}>
              <Text style={[styles.leagueText, { color: getLeagueColor(team.current_league) }]}>
                {team.current_league}
              </Text>
            </View>
            <Text style={styles.statLabel}>Current League</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{team.member_count}/20</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>

        {/* Trophy History Chart */}
        <View style={styles.trophyHistoryCard}>
          <Text style={styles.sectionTitle}>Trophy History (Last 6 Months)</Text>
          {trophyHistory.length === 0 ? (
            <View style={styles.emptyTrophyHistory}>
              <Ionicons name="trophy-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyTrophyText}>No trophies earned yet</Text>
              <Text style={styles.emptyTrophySubtext}>Complete challenges to earn trophies!</Text>
            </View>
          ) : (
            <View style={styles.trophyChart}>
              {trophyHistory.map((entry, index) => {
                const maxTrophies = Math.max(...trophyHistory.map(h => h.trophies), 100);
                return (
                  <View key={index} style={styles.trophyBarContainer}>
                    <View style={styles.trophyBarWrapper}>
                      <View 
                        style={[
                          styles.trophyBarFill, 
                          { 
                            height: `${(entry.trophies / maxTrophies) * 100}%`,
                            backgroundColor: entry.trophies === maxTrophies ? '#FFD700' : '#00ffff'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.trophyMonth}>{entry.month}</Text>
                    <Text style={styles.trophyValue}>{entry.trophies}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Detailed Trophy History */}
        {detailedTrophyHistory.length > 0 && (
          <View style={styles.trophyHistoryCard}>
            <Text style={styles.sectionTitle}>Trophy Awards</Text>
            <FlatList
              data={detailedTrophyHistory}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.trophyAwardItem}>
                  <View style={styles.trophyAwardHeader}>
                    <View style={styles.trophyAwardLeft}>
                      <View style={styles.trophyIconContainer}>
                        <Ionicons 
                          name="trophy" 
                          size={24} 
                          color={item.rank_achieved === 1 ? '#FFD700' : item.rank_achieved === 2 ? '#C0C0C0' : item.rank_achieved === 3 ? '#CD7F32' : '#00ffff'} 
                        />
                      </View>
                      <View style={styles.trophyAwardInfo}>
                        <Text style={styles.trophyAwardName}>
                          {item.league_challenges?.name || 'Unknown Challenge'}
                        </Text>
                        <Text style={styles.trophyAwardDate}>
                          {new Date(item.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.trophyAwardRight}>
                      <Text style={styles.trophyAwardRank}>#{item.rank_achieved}</Text>
                      <Text style={styles.trophyAwardTrophies}>+{item.trophies_earned} 🏆</Text>
                    </View>
                  </View>
                  <Text style={styles.trophyAwardDetails}>
                    {item.base_trophies} base × {item.multiplier}x multiplier = {item.trophies_earned} trophies
                  </Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Challenge Participation History */}
        {challengeHistory.length > 0 && (
          <View style={styles.trophyHistoryCard}>
            <Text style={styles.sectionTitle}>Competition History</Text>
            <FlatList
              data={challengeHistory}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const challenge = item.league_challenges;
                const finalRank = item.final_rank || item.rank;
                const finalValue = item.final_value || item.current_value;
                const status = challenge?.status || 'unknown';
                
                return (
                  <View style={styles.challengeHistoryItem}>
                    <View style={styles.challengeHistoryHeader}>
                      <View style={styles.challengeHistoryLeft}>
                        <Text style={styles.challengeHistoryName}>
                          {challenge?.name || 'Unknown Challenge'}
                        </Text>
                        <Text style={styles.challengeHistoryType}>
                          {challenge?.challenge_type?.replace('_', ' ') || 'Unknown Type'}
                        </Text>
                        <Text style={styles.challengeHistoryDate}>
                          {challenge?.start_date ? new Date(challenge.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - {challenge?.end_date ? new Date(challenge.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </Text>
                      </View>
                      <View style={styles.challengeHistoryRight}>
                        {status === 'completed' ? (
                          <>
                            {finalRank && (
                              <Text style={styles.challengeHistoryRank}>#{finalRank}</Text>
                            )}
                            {item.trophies_earned > 0 && (
                              <Text style={styles.challengeHistoryTrophies}>+{item.trophies_earned} 🏆</Text>
                            )}
                          </>
                        ) : status === 'active' ? (
                          <>
                            {finalRank && (
                              <View style={styles.challengeActiveBadge}>
                                <Text style={styles.challengeActiveText}>#{finalRank}</Text>
                              </View>
                            )}
                            <Text style={styles.challengeActiveLabel}>Active</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    {finalValue !== null && finalValue !== undefined && (
                      <Text style={styles.challengeHistoryValue}>
                        Final Score: {finalValue.toLocaleString()} {challenge?.challenge_type === 'workout_minutes' ? 'minutes' : ''}
                      </Text>
                    )}
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* Members List */}
        <View style={styles.membersCard}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionTitle}>Members ({team?.member_count || members.length}/20)</Text>
            {(isOwner || isAdmin) && (
              <TouchableOpacity onPress={() => router.push(`/league/manage-team/${id}`)}>
                <Text style={styles.manageButton}>Manage</Text>
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={members}
            keyExtractor={(item) => item.id || item.user_id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
                ) : (
                  <View style={styles.memberAvatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#00ffff" />
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.full_name || item.username}</Text>
                  <View style={styles.memberRoleContainer}>
                    <Text style={styles.memberRole}>
                      {item.role === 'owner' ? '👑 Owner' : item.role === 'admin' ? '⭐ Admin' : 'Member'}
                    </Text>
                    {item.contributionMinutes !== undefined && item.contributionMinutes > 0 && (
                      <Text style={styles.memberContribution}>
                        {item.contributionMinutes.toLocaleString()} min
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionButton: {
    padding: 8,
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
  teamHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  teamAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#00ffff',
  },
  teamAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#00ffff',
  },
  teamName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  teamDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 10,
  },
  leagueBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  leagueText: {
    fontSize: 16,
    fontWeight: '700',
  },
  trophyHistoryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
  },
  trophyChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
  },
  trophyBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  trophyBarWrapper: {
    width: 30,
    height: 150,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  trophyBarFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  trophyMonth: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  trophyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffff',
  },
  membersCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  manageButton: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
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
  memberRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  memberRole: {
    fontSize: 14,
    color: '#9ca3af',
  },
  memberContribution: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffff',
  },
  emptyTrophyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTrophyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTrophySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  trophyAwardItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  trophyAwardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trophyAwardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trophyIconContainer: {
    marginRight: 12,
  },
  trophyAwardInfo: {
    flex: 1,
  },
  trophyAwardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  trophyAwardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  trophyAwardRight: {
    alignItems: 'flex-end',
  },
  trophyAwardRank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 4,
  },
  trophyAwardTrophies: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  trophyAwardDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  challengeHistoryItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  challengeHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  challengeHistoryLeft: {
    flex: 1,
    marginRight: 12,
  },
  challengeHistoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  challengeHistoryType: {
    fontSize: 12,
    color: '#00ffff',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  challengeHistoryDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  challengeHistoryRight: {
    alignItems: 'flex-end',
  },
  challengeHistoryRank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 4,
  },
  challengeHistoryTrophies: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  challengeActiveBadge: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  challengeActiveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00ffff',
  },
  challengeActiveLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  challengeHistoryValue: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
});

