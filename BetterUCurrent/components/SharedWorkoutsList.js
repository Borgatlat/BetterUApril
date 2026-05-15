import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

/**
 * SharedWorkoutsList Component
 * 
 * This component displays workouts that have been shared with the current user.
 * It shows both pending workout shares (that need to be accepted/declined) and
 * accepted shared workouts that are now available in the user's feed.
 * 
 * Key Features:
 * - Shows pending workout shares with accept/decline options
 * - Displays accepted shared workouts
 * - Allows users to delete shared workouts from their feed
 * - Real-time updates when shares are accepted/declined
 */
export const SharedWorkoutsList = ({ onWorkoutSelect }) => {
  const [pendingShares, setPendingShares] = useState([]);
  const [sharedWorkouts, setSharedWorkouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userProfile } = useUser();

  // Fetch data when component mounts
  useEffect(() => {
    fetchSharedWorkoutsData();
  }, []);

  /**
   * Fetches both pending workout shares and accepted shared workouts
   * This function combines data from two tables to show the complete picture
   */
  const fetchSharedWorkoutsData = async () => {
    if (!userProfile?.id) {
      console.log('No userProfile.id, skipping fetch');
      return;
    }

    console.log('Fetching shared workouts for user:', userProfile.id);
    setIsLoading(true);
    try {
      // Fetch pending workout shares
      const { data: shares, error: sharesError } = await supabase
        .from('workout_shares')
        .select(`
          *,
          profiles!workout_shares_sender_id_fkey (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          )
        `)
        .eq('recipient_id', userProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (sharesError) {
        console.error('Error fetching pending shares:', sharesError);
        throw sharesError;
      }

      // Transform shares to include workout data from stored columns
      const sharesWithWorkouts = (shares || []).map((share, index) => ({
        ...share,
        uniqueKey: `pending-${share.id}-${index}`,
        workouts: {
          id: share.workout_id,
          workout_name: share.workout_name,
          exercises: share.workout_exercises,
          created_at: share.created_at
        }
      }));

      // Fetch accepted shared workouts
      const { data: workouts, error: workoutsError } = await supabase
        .from('shared_workouts')
        .select(`
          *,
          profiles!original_sender_id (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          )
        `)
        .eq('recipient_id', userProfile.id)
        .eq('is_active', true)
        .order('shared_at', { ascending: false });

      if (workoutsError) {
        console.error('Error fetching shared workouts:', workoutsError);
        throw workoutsError;
      }

      // Transform shared workouts to include sender data
      const workoutsWithSenders = (workouts || []).map((workout, index) => ({
        ...workout,
        uniqueKey: `shared-${workout.id}-${index}`,
        type: 'shared'
      }));

      console.log('Fetched pending shares:', sharesWithWorkouts?.length || 0);
      console.log('Fetched shared workouts:', workoutsWithSenders?.length || 0);
      console.log('Pending shares data:', sharesWithWorkouts);
      console.log('Shared workouts data:', workoutsWithSenders);
      setPendingShares(sharesWithWorkouts || []);
      setSharedWorkouts(workoutsWithSenders || []);
    } catch (error) {
      console.error('Error fetching shared workouts:', error);
      Alert.alert('Error', 'Failed to load shared workouts');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles refresh when user pulls down to refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSharedWorkoutsData();
    setRefreshing(false);
  };

  /**
   * Handles accepting or declining a workout share
   * @param {string} shareId - The ID of the workout share
   * @param {string} action - 'accept' or 'decline'
   */
  const handleShareResponse = async (shareId, action) => {
    try {
      if (action === 'accept') {
        // Get the share details first
        const share = pendingShares.find(s => s.id === shareId);
        if (!share) return;

        // Create a copy in shared_workouts table
        const { error: insertError } = await supabase
          .from('shared_workouts')
          .insert({
            original_workout_id: share.workout_id,
            original_sender_id: share.sender_id,
            recipient_id: userProfile.id,
            workout_name: share.workouts?.workout_name || 'Unknown Workout',
            exercises: share.workouts?.exercises || []
          });

        if (insertError) throw insertError;
      }

      // Update the share status
      const { error: updateError } = await supabase
        .from('workout_shares')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', shareId);

      if (updateError) throw updateError;

      // Refresh the data
      await fetchSharedWorkoutsData();

      Alert.alert(
        'Success',
        `Workout ${action === 'accept' ? 'accepted' : 'declined'} successfully!`
      );
    } catch (error) {
      console.error('Error handling share response:', error);
      Alert.alert('Error', 'Failed to process request. Please try again.');
    }
  };

  /**
   * Handles deleting a shared workout from the user's feed
   * This is a soft delete - sets is_active to false
   * @param {string} workoutId - The ID of the shared workout to delete
   */
  const handleDeleteSharedWorkout = async (workoutId) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to remove this workout from your feed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('shared_workouts')
                .update({ is_active: false })
                .eq('id', workoutId);

              if (error) throw error;

              // Remove from local state
              setSharedWorkouts(prev => 
                prev.filter(workout => workout.id !== workoutId)
              );

              Alert.alert('Success', 'Workout removed from your feed');
            } catch (error) {
              console.error('Error deleting shared workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          }
        }
      ]
    );
  };

  /**
   * Renders a pending workout share item
   * Shows accept/decline buttons and workout preview
   */
  const renderPendingShare = ({ item }) => (
    <View style={styles.pendingShareCard}>
      <View style={styles.shareHeader}>
        <View style={styles.senderInfo}>
          <View style={[styles.avatar, item.profiles?.is_premium && styles.premiumAvatar]}>
            <Text style={styles.avatarText}>
              {(item.profiles?.username || item.profiles?.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.senderName}>
              {item.profiles?.username || item.profiles?.full_name || 'Unknown User'}
            </Text>
            <Text style={styles.shareDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Text style={styles.shareLabel}>Shared with you</Text>
      </View>

      <View style={styles.workoutPreview}>
        <Text style={styles.workoutName}>{item.workouts?.workout_name || 'Unknown Workout'}</Text>
        <Text style={styles.exerciseCount}>
          {item.workouts?.exercises?.length || 0} exercises
        </Text>
        {item.message && (
          <Text style={styles.personalMessage}>"{item.message}"</Text>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => handleShareResponse(item.id, 'decline')}
        >
          <Ionicons name="close" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleShareResponse(item.id, 'accept')}
        >
          <Ionicons name="checkmark" size={16} color="#000" />
          <Text style={[styles.actionButtonText, styles.acceptButtonText]}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * Renders an accepted shared workout item
   * Shows workout details and delete option
   */
  const renderSharedWorkout = ({ item }) => (
    <TouchableOpacity
      style={styles.sharedWorkoutCard}
      onPress={() => onWorkoutSelect?.(item)}
      activeOpacity={0.7}
    >
      <View style={styles.workoutHeader}>
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutName}>{item.workout_name}</Text>
          <Text style={styles.exerciseCount}>
            {item.exercises?.length || 0} exercises
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSharedWorkout(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#ff4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.sharedByInfo}>
        <Text style={styles.sharedByText}>
          Shared by {item.profiles?.username || item.profiles?.full_name || 'Unknown User'}
        </Text>
        <Text style={styles.sharedDate}>
          {new Date(item.shared_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ffff" />
        <Text style={styles.loadingText}>Loading shared workouts...</Text>
      </View>
    );
  }

  const allData = [
    ...pendingShares.map((item, index) => ({ ...item, type: 'pending', uniqueKey: `pending-${item.id}-${index}` })),
    ...sharedWorkouts.map((item, index) => ({ ...item, type: 'shared', uniqueKey: `shared-${item.id}-${index}` }))
  ];

  if (allData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="fitness-outline" size={64} color="#666" />
        <Text style={styles.emptyTitle}>No Shared Workouts</Text>
        <Text style={styles.emptySubtitle}>
          Workouts shared with you will appear here
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={allData}
      keyExtractor={(item) => item.uniqueKey}
      renderItem={({ item }) => 
        item.type === 'pending' ? renderPendingShare({ item }) : renderSharedWorkout({ item })
      }
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#00ffff"
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  pendingShareCard: {
    backgroundColor: '#1a1a1a',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  premiumAvatar: {
    backgroundColor: '#ffd700',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  senderName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareDate: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  shareLabel: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  workoutPreview: {
    marginBottom: 15,
  },
  workoutName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  exerciseCount: {
    color: '#666',
    fontSize: 14,
  },
  personalMessage: {
    color: '#00ffff',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 5,
  },
  declineButton: {
    backgroundColor: '#ff4444',
  },
  acceptButton: {
    backgroundColor: '#00ffff',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  acceptButtonText: {
    color: '#000',
  },
  sharedWorkoutCard: {
    backgroundColor: '#1a1a1a',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  workoutInfo: {
    flex: 1,
  },
  deleteButton: {
    padding: 5,
  },
  sharedByInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sharedByText: {
    color: '#666',
    fontSize: 14,
  },
  sharedDate: {
    color: '#666',
    fontSize: 12,
  },
});
