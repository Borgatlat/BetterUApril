import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import FeedCard from '../../components/FeedCard';
import { Ionicons } from '@expo/vector-icons';
import { PremiumAvatar } from '../../components/PremiumAvatar';
import { useAuth } from '../../../context/AuthContext';

export default function GroupFeedScreen() {
  const { id, name } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const router = useRouter();
  const { currentUserId } = useAuth();

  useEffect(() => {
    fetchGroupFeed();
  }, [id]);

  const fetchGroupFeed = async () => {
    try {
      // Get all members of the group
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', id);

      if (membersError) throw membersError;

      const memberIds = (members || []).map(m => m.user_id);

      // Filter out blocked users (both directions - users we blocked and users who blocked us)
      // This ensures mutual blocking works properly
      let nonBlockedMemberIds = memberIds;
      if (currentUserId) {
        const { data: blockedByMe, error: blockedError } = await supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', currentUserId)
          .in('blocked_id', memberIds);

        const { data: blockedMe, error: blockersError } = await supabase
          .from('blocks')
          .select('blocker_id')
          .eq('blocked_id', currentUserId)
          .in('blocker_id', memberIds);

        // Combine all blocked user IDs
        const blockedIds = new Set();
        blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
        blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

        // Filter out blocked users from member list
        nonBlockedMemberIds = memberIds.filter(id => !blockedIds.has(id));
      }

      // Get profiles to check ban status
      const { data: memberProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, ban_status')
        .in('id', nonBlockedMemberIds);

      if (profilesError) throw profilesError;

      // Filter out banned users
      const nonBannedMemberIds = nonBlockedMemberIds.filter(userId => {
        const profile = memberProfiles?.find(p => p.id === userId);
        return profile && !profile.ban_status; // Only include users without ban_status
      });

      console.log('Group feed filtering:', {
        totalMembers: memberIds.length,
        nonBannedMembers: nonBannedMemberIds.length,
        bannedMembers: memberIds.length - nonBannedMemberIds.length
      });

      // Get all activities from non-banned group members
      const [workouts, mentalSessions, runs, prs] = await Promise.all([
        // Workouts
        supabase
          .from('user_workout_logs')
          .select('*')
          .in('user_id', nonBannedMemberIds)
          .order('created_at', { ascending: false }),

        // Mental Sessions
        supabase
          .from('mental_session_logs')
          .select('*')
          .in('profile_id', nonBannedMemberIds)
          .order('completed_at', { ascending: false }),

        // Runs
        supabase
          .from('runs')
          .select('*')
          .in('user_id', nonBannedMemberIds)
          .order('start_time', { ascending: false }),

        // PRs
        supabase
          .from('personal_records')
          .select('*')
          .in('user_id', nonBannedMemberIds)
          .order('created_at', { ascending: false })
      ]);

      if (workouts.error) throw workouts.error;
      if (mentalSessions.error) throw mentalSessions.error;
      if (runs.error) throw runs.error;
      if (prs.error) throw prs.error;

      // Fetch all kudos in bulk
      const [workoutKudos, mentalKudos, runKudos] = await Promise.all([
        supabase
          .from('workout_kudos')
          .select('*')
          .in('workout_id', (workouts.data || []).map(w => w.id)),
        supabase
          .from('mental_session_kudos')
          .select('*')
          .in('session_id', (mentalSessions.data || []).map(m => m.id)),
        supabase
          .from('run_kudos')
          .select('*')
          .in('run_id', (runs.data || []).map(r => r.id))
      ]);

      if (workoutKudos.error) throw workoutKudos.error;
      if (mentalKudos.error) throw mentalKudos.error;
      if (runKudos.error) throw runKudos.error;

      // Create kudos maps for quick lookup
      const kudosMap = {};
      (workoutKudos.data || []).forEach(k => {
        if (!kudosMap[k.workout_id]) kudosMap[k.workout_id] = [];
        kudosMap[k.workout_id].push(k);
      });
      (mentalKudos.data || []).forEach(k => {
        if (!kudosMap[k.session_id]) kudosMap[k.session_id] = [];
        kudosMap[k.session_id].push(k);
      });
      (runKudos.data || []).forEach(k => {
        if (!kudosMap[k.run_id]) kudosMap[k.run_id] = [];
        kudosMap[k.run_id].push(k);
      });

      // Get current user for kudos check and blocking filter
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserIdForFilter = currentUser?.id || currentUserId;

      // Double-check: Filter out blocked users' activities (safety net in case any slipped through)
      // This ensures mutual blocking - if either user blocked the other, activities are hidden
      let blockedUserIdsForFilter = new Set();
      if (currentUserIdForFilter) {
        const { data: blockedByMeCheck, error: blockedCheckError } = await supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', currentUserIdForFilter);

        const { data: blockedMeCheck, error: blockersCheckError } = await supabase
          .from('blocks')
          .select('blocker_id')
          .eq('blocked_id', currentUserIdForFilter);

        if (!blockedCheckError && blockedByMeCheck) {
          blockedByMeCheck.forEach(block => blockedUserIdsForFilter.add(block.blocked_id));
        }
        if (!blockersCheckError && blockedMeCheck) {
          blockedMeCheck.forEach(block => blockedUserIdsForFilter.add(block.blocker_id));
        }
      }

      // Filter activities to remove any from blocked users (mutual blocking check)
      // This is a final safety check to ensure no blocked users' content appears
      const filteredWorkouts = (workouts.data || []).filter(w => !blockedUserIdsForFilter.has(w.user_id));
      const filteredMentalSessions = (mentalSessions.data || []).filter(m => !blockedUserIdsForFilter.has(m.profile_id));
      const filteredRuns = (runs.data || []).filter(r => !blockedUserIdsForFilter.has(r.user_id));
      const filteredPRs = (prs.data || []).filter(p => !blockedUserIdsForFilter.has(p.user_id));

      // Get all unique user IDs from the filtered activities
      const allUserIds = new Set([
        ...filteredWorkouts.map(w => w.user_id),
        ...filteredMentalSessions.map(m => m.profile_id),
        ...filteredRuns.map(r => r.user_id),
        ...filteredPRs.map(p => p.user_id)
      ]);

      // Fetch profiles for all users
      const { data: profiles, error: userProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (userProfilesError) throw userProfilesError;

      // Create a map of user profiles for quick lookup
      const profileMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      // Combine and format all activities (using filtered data to ensure no blocked users)
      const allActivities = [
        ...filteredWorkouts.map(w => ({
          ...w,
          type: 'workout',
          targetId: w.id,
          profiles: profileMap[w.user_id],
          stats: [
            { label: 'Duration', value: `${Math.floor(w.duration / 60)} min` },
            { label: 'Exercises', value: w.exercise_count }
          ],
          kudos: kudosMap[w.id] || [],
          hasKudoed: (kudosMap[w.id] || []).some(k => k.user_id === currentUser?.id)
        })),
        ...filteredMentalSessions.map(m => ({
          ...m,
          type: 'mental',
          targetId: m.id,
          profiles: profileMap[m.profile_id],
          stats: [
            { label: 'Duration', value: `${m.duration} min` },
            { label: 'Calmness', value: `${m.calmness_level}/10` }
          ],
          kudos: kudosMap[m.id] || [],
          hasKudoed: (kudosMap[m.id] || []).some(k => k.user_id === currentUser?.id)
        })),
        ...filteredRuns.map(r => ({
          ...r,
          type: 'run',
          targetId: r.id,
          profiles: profileMap[r.user_id],
          stats: [
            { label: 'Distance', value: `${r.distance_meters / 1000} km` },
            { label: r.activity_type === 'bike' ? 'Avg Speed' : 'Pace', value: `${r.average_pace_minutes_per_km} min/km` }
          ],
          kudos: kudosMap[r.id] || [],
          hasKudoed: (kudosMap[r.id] || []).some(k => k.user_id === currentUser?.id),
          runData: {
            path: r.path,
            distance_meters: r.distance_meters,
            duration_seconds: r.duration_seconds,
            start_time: r.start_time,
            end_time: r.end_time
          },
          showMapToOthers: r.show_map_to_others !== false
        })),
        ...filteredPRs.map(p => ({
          ...p,
          type: 'pr',
          targetId: p.id,
          profiles: profileMap[p.user_id],
          stats: [
            { label: 'Weight', value: `${p.weight_current} kg` },
            { label: 'Target', value: `${p.weight_target} kg` }
          ],
          kudos: [],
          hasKudoed: false
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setFeed(allActivities);
    } catch (error) {
      console.error('Error fetching group feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = (userId) => {
    router.push(`/profile/${userId}`);
  };

  const handleEditWorkout = (workoutId) => {
    router.push(`/edit-workout/${workoutId}`);
  };

  const handleEditMental = (sessionId) => {
    router.push(`/edit-mental/${sessionId}`);
  };

  const handleEditRun = (runId) => {
    router.push(`/edit-run/${runId}`);
  };

  const renderFeedItem = ({ item }) => {
    const profile = item.profiles || {};
    const kudosCount = item.kudos?.length || 0;
    const hasKudoed = item.hasKudoed || false;
    const commentCount = item.comments?.length || 0;

    const isOwnActivity = item.user_id === currentUserId || item.profile_id === currentUserId;
    
    const getEditHandler = () => {
      if (!isOwnActivity) return undefined;
      switch (item.type) {
        case 'workout':
          return () => handleEditWorkout(item.targetId);
        case 'mental':
          return () => handleEditMental(item.targetId);
        case 'run':
          return () => handleEditRun(item.targetId);
        default:
          return undefined;
      }
    };

    return (
      <FeedCard
        avatarUrl={profile.avatar_url}
        name={profile.full_name || 'User'}
        date={item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
        title={item.type === 'workout' ? (item.workout_name || 'Workout') : 
               item.type === 'mental' ? (item.session_name || 'Mental Session') :
               item.type === 'run' ? (item.activity_type === 'run' ? 'Run' : item.activity_type === 'walk' ? 'Walk' : 'Bike') :
               item.type === 'pr' ? (item.exercise || 'Personal Record') : 'Activity'}
        description={item.description || ''}
        stats={item.stats || []}
        type={item.type}
        targetId={item.targetId}
        isOwner={isOwnActivity}
        onEdit={getEditHandler()}
        userId={item.user_id || item.profile_id}
        photoUrl={item.photo_url}
        initialKudosCount={kudosCount}
        initialHasKudoed={hasKudoed}
        initialCommentCount={commentCount}
        username={profile.username}
        runData={item.runData}
        showMapToOthers={item.showMapToOthers}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#00ffff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{name} Feed</Text>
          <Text style={styles.subtitle}>See all group activities</Text>
        </View>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderFeedItem}
        contentContainerStyle={styles.feedList}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchGroupFeed}
            tintColor="#00ffff"
            colors={["#00ffff"]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    marginLeft: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  feedList: {
    padding: 20,
  },
}); 