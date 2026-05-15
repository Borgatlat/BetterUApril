"use client";

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

/**
 * League hub UI (teams, challenges) used in two places:
 * - Standalone hidden tab route `/(tabs)/league` (full screen with safe area)
 * - Embedded inside Community when the user picks the League pill (`embedded={true}`)
 *
 * When `embedded` is true we use a plain View as the root so we do not double-apply
 * top safe-area padding next to the Community header.
 */
function LeagueRoot({ embedded, children }) {
  if (embedded) {
    return <View style={styles.container}>{children}</View>;
  }
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {children}
    </SafeAreaView>
  );
}

export default function LeagueContent({ embedded = false }) {
  const router = useRouter();
  const { userProfile } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasTeam, setHasTeam] = useState(false);
  const [team, setTeam] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [teamRank, setTeamRank] = useState(null);
  const [teamProgress, setTeamProgress] = useState(0);

  useEffect(() => {
    loadLeagueData();
  }, [userProfile?.id]);

  const loadLeagueData = async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: teamMember, error: memberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', userProfile.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        console.error('Error checking team membership:', memberError);
        setHasTeam(false);
        setLoading(false);
        return;
      }

      if (!teamMember) {
        setHasTeam(false);
        setLoading(false);
        return;
      }

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamMember.team_id)
        .single();

      if (teamError) {
        console.error('Error fetching team:', teamError);
        setHasTeam(false);
        setLoading(false);
        return;
      }

      const { count: memberCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamData.id);

      setTeam({
        ...teamData,
        member_count: memberCount || 0,
      });
      setHasTeam(true);

      const { data: activeChallenge, error: challengeError } = await supabase
        .from('league_challenges')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!challengeError && activeChallenge) {
        const endDate = new Date(activeChallenge.end_date);
        endDate.setHours(23, 59, 59, 999);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffMs = endDate - today;
        const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        setChallenge({
          ...activeChallenge,
          days_remaining: Math.max(0, daysRemaining),
        });

        const { data: enrollmentCheck } = await supabase
          .from('team_challenge_participants')
          .select('id')
          .eq('challenge_id', activeChallenge.id)
          .eq('team_id', teamData.id)
          .single();

        if (!enrollmentCheck) {
          await supabase
            .from('team_challenge_participants')
            .insert({
              challenge_id: activeChallenge.id,
              team_id: teamData.id,
              current_value: 0,
            })
            .select();
        }

        const { error: updateError } = await supabase.rpc('update_team_challenge_progress', {
          p_challenge_id: activeChallenge.id,
          p_team_id: teamData.id,
        });

        if (updateError) {
          console.error('Error updating team progress:', updateError);
        }

        const { data: participation, error: partError } = await supabase
          .from('team_challenge_participants')
          .select('current_value, rank')
          .eq('challenge_id', activeChallenge.id)
          .eq('team_id', teamData.id)
          .single();

        if (!partError && participation) {
          setTeamRank(participation.rank || null);
          setTeamProgress(participation.current_value || 0);
        } else {
          console.error('Error fetching participation:', partError);
          setTeamRank(null);
          setTeamProgress(0);
        }
      } else {
        setChallenge(null);
        setTeamRank(null);
        setTeamProgress(0);
      }
    } catch (error) {
      console.error('Error loading league data:', error);
      setHasTeam(false);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeagueData();
    setRefreshing(false);
  };

  if (!loading && !hasTeam) {
    return (
      <LeagueRoot embedded={embedded}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ffff" />
          }
        >
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="trophy-outline" size={80} color="#00ffff" />
            </View>
            <Text style={styles.emptyStateTitle}>Join BetterU League</Text>
            <Text style={styles.emptyStateDescription}>
              Compete with teams worldwide in monthly challenges. Earn trophies, climb leagues, and win prizes!
            </Text>

            <TouchableOpacity
              style={styles.createTeamButton}
              onPress={() => router.push('/league/create-team')}
            >
              <Text style={styles.createTeamButtonText}>Create Team</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.browseTeamsButton}
              onPress={() => router.push('/league/browse-teams')}
            >
              <Text style={styles.browseTeamsButtonText}>Browse Teams</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.invitationsButton}
              onPress={() => router.push('/league/invitations')}
            >
              <Ionicons name="mail-outline" size={20} color="#00ffff" />
              <Text style={styles.invitationsButtonText}>View Invitations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.requestsButton}
              onPress={() => router.push('/league/my-requests')}
            >
              <Ionicons name="person-add-outline" size={20} color="#00ffff" />
              <Text style={styles.requestsButtonText}>My Join Requests</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LeagueRoot>
    );
  }

  if (loading) {
    return (
      <LeagueRoot embedded={embedded}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
        </View>
      </LeagueRoot>
    );
  }

  return (
    <LeagueRoot embedded={embedded}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ffff" />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, embedded && { paddingTop: 8 }]}>
          <Text style={styles.headerTitle}>BetterU League</Text>
          {team && (
            <TouchableOpacity onPress={() => router.push(`/league/team-settings/${team.id}`)}>
              <Ionicons name="settings-outline" size={24} color="#00ffff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.teamCard}>
          <View style={styles.teamHeader}>
            {team?.avatar_url ? (
              <Image source={{ uri: team.avatar_url }} style={styles.teamAvatar} />
            ) : (
              <View style={styles.teamAvatarPlaceholder}>
                <Ionicons name="people" size={32} color="#00ffff" />
              </View>
            )}
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{team?.name}</Text>
              <View style={styles.leagueBadge}>
                <Ionicons name="trophy" size={16} color="#FFD700" />
                <Text style={styles.leagueText}>{team?.current_league}</Text>
              </View>
            </View>
          </View>

          <View style={styles.teamStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{team?.total_trophies?.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Trophies</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{team?.member_count}/20</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewTeamButton}
            onPress={() => router.push(`/league/team/${team?.id}`)}
          >
            <Text style={styles.viewTeamButtonText}>View Team →</Text>
          </TouchableOpacity>
        </View>

        {challenge && (
          <View style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <Text style={styles.challengeName}>{challenge.name}</Text>
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
            </View>

            <View style={styles.rankSection}>
              <Text style={styles.rankLabel}>Your Team Rank</Text>
              <Text style={styles.rankValue}>{teamRank ? `#${teamRank}` : 'Unranked'}</Text>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Team Progress</Text>
                <Text style={styles.progressValue}>
                  {teamProgress.toLocaleString()}{' '}
                  {challenge?.challenge_type === 'workout_minutes' ? 'min' : ''}
                </Text>
              </View>
            </View>

            {challenge.prize_description && (
              <View style={styles.prizeSection}>
                <Ionicons name="trophy-outline" size={16} color="#FFD700" />
                <Text style={styles.prizeText}>{challenge.prize_description}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewLeaderboardButton}
              onPress={() => router.push('/league/leaderboard')}
            >
              <Text style={styles.viewLeaderboardButtonText}>View Full Leaderboard →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.quickStatsCard}>
          <Text style={styles.quickStatsTitle}>Quick Stats</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatItem}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={styles.quickStatValue}>{teamRank ? `#${teamRank}` : '-'}</Text>
              <Text style={styles.quickStatLabel}>Your Rank</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="time" size={20} color="#00ffff" />
              <Text style={styles.quickStatValue}>{teamProgress.toLocaleString()}</Text>
              <Text style={styles.quickStatLabel}>Team Total</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="people" size={20} color="#00ffff" />
              <Text style={styles.quickStatValue}>
                {Math.round(teamProgress / (team?.member_count || 1))}
              </Text>
              <Text style={styles.quickStatLabel}>Avg/Member</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LeagueRoot>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyStateIcon: {
    marginBottom: 30,
  },
  emptyStateTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  createTeamButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  createTeamButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  browseTeamsButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    alignItems: 'center',
  },
  browseTeamsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  invitationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    width: '100%',
    marginTop: 12,
    gap: 8,
  },
  invitationsButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  requestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    width: '100%',
    marginTop: 12,
    gap: 8,
  },
  requestsButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  teamCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  leagueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  leagueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
    marginLeft: 6,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2a2a2a',
  },
  viewTeamButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  viewTeamButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  challengeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  challengeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  daysRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  daysText: {
    fontSize: 12,
    color: '#00ffff',
    fontWeight: '600',
    marginLeft: 4,
  },
  rankSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 12,
  },
  rankLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  rankValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00ffff',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  prizeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  prizeText: {
    fontSize: 14,
    color: '#FFD700',
    marginLeft: 8,
    flex: 1,
  },
  viewLeaderboardButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  viewLeaderboardButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickStatsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  quickStatsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00ffff',
    marginTop: 8,
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
