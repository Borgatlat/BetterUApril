import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { useUnits } from '../../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import FeedCard from '../components/FeedCard';

const ActivityScreen = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user: currentUser, profile: userProfile } = useAuth();
  const { useImperial } = useUnits();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get userId from either profile or currentUser
  const userId = userProfile?.id || currentUser?.id;

  // Add useEffect to fetch activities when userId is available
  useEffect(() => {
    if (userId) {
      console.log('UserId available, fetching activities:', userId);
      fetchActivities();
    } else {
      console.log('Waiting for userId...');
    }
  }, [userId]);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      if (!userId) {
        console.log('No userId available');
        return;
      }
      console.log('Fetching activities for userId:', userId);

      // Fetch all activities
      const [workouts, mentalSessions, runs, prs] = await Promise.all([
        supabase
          .from('user_workout_logs')
          .select('*')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false }),
        supabase
          .from('mental_session_logs')
          .select('*')
          .eq('profile_id', userId)
          .order('completed_at', { ascending: false }),
        supabase
          .from('runs')
          .select('*')
          .eq('user_id', userId)
          .order('start_time', { ascending: false }),
        supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      console.log('Fetched data:', {
        workouts: workouts.data?.length || 0,
        mentalSessions: mentalSessions.data?.length || 0,
        runs: runs.data?.length || 0,
        prs: prs.data?.length || 0
      });

      if (workouts.error) throw workouts.error;
      if (mentalSessions.error) throw mentalSessions.error;
      if (runs.error) throw runs.error;
      if (prs.error) throw prs.error;

      // Fetch all kudos in bulk
      const [workoutKudos, mentalKudos, runKudos] = await Promise.all([
        supabase
          .from('workout_kudos')
          .select('*')
          .in('workout_id', workouts.data.map(w => w.id)),
        supabase
          .from('mental_session_kudos')
          .select('*')
          .in('session_id', mentalSessions.data.map(m => m.id)),
        supabase
          .from('run_kudos')
          .select('*')
          .in('run_id', runs.data.map(r => r.id))
      ]);

      // Fetch all comments in bulk
      const [workoutComments, mentalComments, runComments] = await Promise.all([
        supabase
          .from('workout_comments')
          .select('*')
          .in('workout_id', workouts.data.map(w => w.id)),
        supabase
          .from('mental_session_comments')
          .select('*')
          .in('session_id', mentalSessions.data.map(m => m.id)),
        supabase
          .from('run_comments')
          .select('*')
          .in('run_id', runs.data.map(r => r.id))
      ]);

      // Create lookup maps for kudos and comments
      const kudosMap = {};
      const commentsMap = {};

      // Process workout kudos
      (workoutKudos.data || []).forEach(k => {
        if (!kudosMap[k.workout_id]) kudosMap[k.workout_id] = [];
        kudosMap[k.workout_id].push(k);
      });

      // Process mental session kudos
      (mentalKudos.data || []).forEach(k => {
        if (!kudosMap[k.session_id]) kudosMap[k.session_id] = [];
        kudosMap[k.session_id].push(k);
      });

      // Process run kudos
      (runKudos.data || []).forEach(k => {
        if (!kudosMap[k.run_id]) kudosMap[k.run_id] = [];
        kudosMap[k.run_id].push(k);
      });

      // Process workout comments
      (workoutComments.data || []).forEach(c => {
        if (!commentsMap[c.workout_id]) commentsMap[c.workout_id] = [];
        commentsMap[c.workout_id].push(c);
      });

      // Process mental session comments
      (mentalComments.data || []).forEach(c => {
        if (!commentsMap[c.session_id]) commentsMap[c.session_id] = [];
        commentsMap[c.session_id].push(c);
      });

      // Process run comments
      (runComments.data || []).forEach(c => {
        if (!commentsMap[c.run_id]) commentsMap[c.run_id] = [];
        commentsMap[c.run_id].push(c);
      });

      // Combine all activities with their kudos and comments
      const allActivities = [
        ...workouts.data.map(w => ({
          ...w,
          _type: 'workout',
          kudos: kudosMap[w.id] || [],
          comments: commentsMap[w.id] || []
        })),
        ...mentalSessions.data.map(m => ({
          ...m,
          _type: 'mental',
          kudos: kudosMap[m.id] || [],
          comments: commentsMap[m.id] || []
        })),
        ...runs.data.map(r => ({
          ...r,
          _type: 'run',
          kudos: kudosMap[r.id] || [],
          comments: commentsMap[r.id] || []
        })),
        ...prs.data.map(p => ({
          ...p,
          _type: 'pr',
          kudos: [],
          comments: []
        }))
      ].sort((a, b) => new Date(b.created_at || b.completed_at || b.start_time) - new Date(a.created_at || a.completed_at || a.start_time));

      console.log('Combined activities:', allActivities.length);
      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivities();
  }, [fetchActivities]);

  const renderActivity = ({ item }) => {
    console.log('Rendering activity:', item._type, item.id);
    const avatarUrl = userProfile?.avatar_url || currentUser?.user_metadata?.avatar_url;
    const name = userProfile?.full_name || userProfile?.username || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.username || currentUser?.email || 'You';
    const kudosCount = item.kudos?.length || 0;
    const hasKudoed = item.kudos?.some(k => k.user_id === userId);
    const commentCount = item.comments?.length || 0;

    if (item._type === 'workout') {
      return (
        <FeedCard
          avatarUrl={avatarUrl}
          name={name}
          date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
          title={item.workout_name || 'Workout'}
          description={item.description || ''}
          stats={[
            { value: item.duration ? `${Math.floor(item.duration / 60)} min` : '-', label: 'Minutes', highlight: true },
            { value: item.exercise_count || '-', label: 'Exercises' },
          ]}
          type="workout"
          targetId={item.id}
          isOwner={true}
          onEdit={() => router.push(`/edit-workout/${item.id}`)}
          userId={userId}
          photoUrl={item.photo_url}
          initialKudosCount={kudosCount}
          initialHasKudoed={hasKudoed}
          initialCommentCount={commentCount}
        />
      );
    } else if (item._type === 'mental') {
      return (
        <FeedCard
          avatarUrl={avatarUrl}
          name={name}
          date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
          title={item.session_name || item.session_type || item.type || 'Session'}
          description={item.description || ''}
          stats={[
            { value: item.duration || '-', label: 'Minutes', highlight: true },
            { value: item.calmness_level || '-', label: 'Calmness' },
            { value: item.session_type || '-', label: 'Type', highlight: true },
          ]}
          type="mental"
          targetId={item.id}
          isOwner={true}
          onEdit={() => router.push(`/edit-mental/${item.id}`)}
          userId={userId}
          photoUrl={item.photo_url}
          initialKudosCount={kudosCount}
          initialHasKudoed={hasKudoed}
          initialCommentCount={commentCount}
        />
      );
    } else if (item._type === 'pr') {
      // Handle new PR table structure with exercise_type - matching feed structure
      let stats = [];
      let title = item.exercise_name || 'Personal Record';
      
      if (item.exercise_type === 'weight') {
        // Weight-based PRs - convert kg to lbs if using imperial
        const currentWeight = item.current_weight_kg;
        const targetWeight = item.target_weight_kg;
        
        if (currentWeight !== null && currentWeight !== undefined) {
          const displayCurrent = useImperial ? (currentWeight * 2.20462).toFixed(1) : currentWeight.toFixed(1);
          const currentUnit = useImperial ? 'lbs' : 'kg';
          stats.push({ value: `${displayCurrent} ${currentUnit}`, label: 'Current', highlight: true });
        } else {
          stats.push({ value: '-', label: 'Current', highlight: true });
        }
        
        if (targetWeight !== null && targetWeight !== undefined) {
          const displayTarget = useImperial ? (targetWeight * 2.20462).toFixed(1) : targetWeight.toFixed(1);
          const targetUnit = useImperial ? 'lbs' : 'kg';
          stats.push({ value: `${displayTarget} ${targetUnit}`, label: 'Target' });
        } else {
          stats.push({ value: '-', label: 'Target' });
        }
      } else if (item.exercise_type === 'running' || item.exercise_type === 'biking') {
        // Time-based PRs for running/biking
        const currentTime = item.current_time_minutes;
        const targetTime = item.target_time_minutes;
        
        if (currentTime !== null && currentTime !== undefined) {
          const minutes = Math.floor(currentTime);
          const seconds = Math.floor((currentTime % 1) * 60);
          stats.push({ value: `${minutes}:${seconds.toString().padStart(2, '0')}`, label: 'Current', highlight: true });
        } else {
          stats.push({ value: '-', label: 'Current', highlight: true });
        }
        
        if (targetTime !== null && targetTime !== undefined) {
          const minutes = Math.floor(targetTime);
          const seconds = Math.floor((targetTime % 1) * 60);
          stats.push({ value: `${minutes}:${seconds.toString().padStart(2, '0')}`, label: 'Target' });
        } else {
          stats.push({ value: '-', label: 'Target' });
        }
        
        // Add distance if available
        if (item.distance_meters) {
          const distanceKm = item.distance_meters / 1000;
          const distanceMiles = distanceKm * 0.621371;
          const displayDistance = useImperial ? distanceMiles.toFixed(2) : distanceKm.toFixed(2);
          const distanceUnit = useImperial ? 'mi' : 'km';
          title = `${item.exercise_name} (${displayDistance} ${distanceUnit})`;
        }
      }
      
      return (
        <FeedCard
          avatarUrl={avatarUrl}
          name={name}
          date={item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
          title={title}
          stats={stats.length > 0 ? stats : [{ value: '-', label: 'Current', highlight: true }, { value: '-', label: 'Target' }]}
          type="pr"
          targetId={item.id}
          isOwner={true}
          userId={userId}
        />
      );
    } else if (item._type === 'run') {
      // Match feed structure with imperial/metric conversion
      const distanceKm = item.distance_meters / 1000;
      const distanceMiles = distanceKm * 0.621371;
      const displayDistance = useImperial ? distanceMiles : distanceKm;
      const distanceUnit = useImperial ? 'mi' : 'km';
      
      const paceMinutes = item.average_pace_minutes_per_km;
      const paceFormatted = paceMinutes ? `${Math.floor(paceMinutes)}:${Math.floor((paceMinutes % 1) * 60).toString().padStart(2, '0')}` : '-';
      const paceUnit = useImperial ? '/mi' : '/km';
    
      return (
        <FeedCard
          avatarUrl={avatarUrl}
          name={name}
          date={item.start_time ? new Date(item.start_time).toLocaleDateString() : '-'}
          title={item.name || "Run"}
          description={item.notes || ""}
          stats={[
            { value: `${displayDistance.toFixed(2)} ${distanceUnit}`, label: 'Distance', highlight: true },
            { value: `${paceFormatted} ${paceUnit}`, label: 'Pace' },
            { value: `${Math.floor(item.duration_seconds / 60)} min`, label: 'Duration' },
          ]}
          type="run"
          targetId={item.id}
          isOwner={true}
          onEdit={() => router.push(`/edit-run/${item.id}`)}
          userId={userId}
          photoUrl={item.photo_url}
          initialKudosCount={kudosCount}
          initialHasKudoed={hasKudoed}
          initialCommentCount={commentCount}
          runData={{
            path: item.path,
            distance_meters: item.distance_meters,
            duration_seconds: item.duration_seconds,
            start_time: item.start_time,
            end_time: item.end_time
          }}
          showMapToOthers={item.show_map_to_others !== false}
        />
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)/home')}>
        <Ionicons name="chevron-back" size={22} color="#00ffff" />
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
      <Text style={styles.header}>All Activity</Text>
      <View style={styles.feedWrapper}>
        {loading ? (
          <ActivityIndicator color="#00ffff" style={{ marginTop: 32 }} />
        ) : activities.length === 0 ? (
          <Text style={styles.empty}>No activity found.</Text>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={item => `${item._type}_${item.id}`}
            renderItem={renderActivity}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#00ffff"
                colors={['#00ffff']}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 0,
    // paddingTop/paddingBottom applied via insets in component for safe area
  },
  feedWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 80,
    backgroundColor: '#000',
  },
  header: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 24,
    marginBottom: 10,
    alignSelf: 'center',
  },
  empty: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

export default ActivityScreen; 