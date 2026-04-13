import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import {
  addScheduledWorkout,
  updateScheduledWorkout,
  deleteScheduledWorkout,
  addRestDay,
} from '../utils/scheduledWorkoutHelpers';

/**
 * ScheduledWorkoutModal Component
 * Enhanced modal for managing scheduled workouts with improved UI/UX
 */
const ScheduledWorkoutModal = ({ visible, onClose, selectedDate, existingWorkout, onWorkoutUpdated }) => {
  const router = useRouter();
  const { userProfile } = useUser();
  const [userWorkouts, setUserWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [viewMode, setViewMode] = useState('existing'); // 'existing', 'choose', or 'rest'

  /**
   * Format date for display
   */
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  /**
   * Get day of week color
   */
  const getDayColor = (date) => {
    const day = date?.getDay();
    if (day === 0 || day === 6) return '#00ffff'; // Weekend
    return '#fff'; // Weekday
  };

  /**
   * Fetch user's saved workouts
   */
  const fetchUserWorkouts = async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', userProfile.id)
        .single();

      const profileId = profile?.id || userProfile.id;

      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserWorkouts(data || []);
    } catch (error) {
      console.error('Error fetching user workouts:', error);
      Alert.alert('Error', 'Failed to load your workouts');
    } finally {
      setLoading(false);
    }
  };

  // Load workouts when modal opens
  useEffect(() => {
    if (visible) {
      fetchUserWorkouts();
      // Set view mode based on what exists
      if (existingWorkout?.is_rest_day) {
        setViewMode('rest');
      } else if (existingWorkout) {
        setViewMode('existing');
      } else {
        setViewMode('choose');
      }
    }
  }, [visible, existingWorkout]);

  /**
   * Handle scheduling a workout
   */
  const handleScheduleWorkout = async (workout) => {
    if (!selectedDate || !userProfile?.id) return;

    setSavingWorkout(true);
    try {
      const workoutData = {
        workout_name: workout.workout_name || workout.name,
        workout_exercises: workout.exercises || [],
        notes: '',
        is_rest_day: false, // Explicitly set to false when scheduling a workout
      };

      if (existingWorkout) {
        // If changing from rest day to workout, delete and recreate to avoid constraint issues
        if (existingWorkout.is_rest_day) {
          await deleteScheduledWorkout(existingWorkout.id);
          const { data, error } = await addScheduledWorkout(
            userProfile.id,
            selectedDate,
            workoutData
          );
          if (error) throw error;
        } else {
          // Just update if it's already a workout
          const { data, error } = await updateScheduledWorkout(
            existingWorkout.id,
            workoutData
          );
          if (error) throw error;
        }
        Alert.alert('✅ Success', 'Workout updated successfully!');
      } else {
        const { data, error } = await addScheduledWorkout(
          userProfile.id,
          selectedDate,
          workoutData
        );
        if (error) throw error;
        Alert.alert('✅ Success', 'Workout scheduled successfully!');
      }

      if (onWorkoutUpdated) onWorkoutUpdated();
      onClose();
    } catch (error) {
      console.error('Error scheduling workout:', error);
      
      if (error.code === '23505') {
        Alert.alert(
          'Workout Already Scheduled',
          'You already have a workout for this day. Replace it?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              onPress: async () => {
                try {
                  await deleteScheduledWorkout(existingWorkout.id);
                  await handleScheduleWorkout(workout);
                } catch (err) {
                  Alert.alert('Error', 'Failed to replace workout');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to schedule workout');
      }
    } finally {
      setSavingWorkout(false);
    }
  };

  /**
   * Handle marking day as rest day
   */
  const handleMarkRestDay = async () => {
    if (!selectedDate || !userProfile?.id) return;

    setSavingWorkout(true);
    try {
      if (existingWorkout) {
        // Always delete and recreate to avoid constraint issues
        await deleteScheduledWorkout(existingWorkout.id);
      }

      const { data, error } = await addRestDay(userProfile.id, selectedDate);
      if (error) throw error;

      Alert.alert('✅ Rest Day', 'Day marked as rest day');
      if (onWorkoutUpdated) onWorkoutUpdated();
      onClose();
    } catch (error) {
      console.error('Error marking rest day:', error);
      Alert.alert('Error', 'Failed to mark as rest day');
    } finally {
      setSavingWorkout(false);
    }
  };

  /**
   * Handle deleting scheduled workout
   */
  const handleDeleteScheduledWorkout = async () => {
    if (!existingWorkout) return;

    Alert.alert(
      '🗑️ Delete Scheduled Workout',
      'Remove this workout from your schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteScheduledWorkout(existingWorkout.id);
              if (error) throw error;

              Alert.alert('✅ Deleted', 'Workout removed from schedule');
              if (onWorkoutUpdated) onWorkoutUpdated();
              onClose();
            } catch (error) {
              console.error('Error deleting scheduled workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          }
        }
      ]
    );
  };

  /**
   * Handle starting workout
   */
  const handleStartWorkout = () => {
    if (!existingWorkout) return;

    router.push({
      pathname: '/active-workout',
      params: {
        custom: 'true',
        workout: JSON.stringify({
          id: existingWorkout.id,
          name: existingWorkout.workout_name,
          workout_name: existingWorkout.workout_name,
          exercises: existingWorkout.workout_exercises,
          isScheduled: true
        })
      }
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.dateIconContainer}>
                <Ionicons name="calendar" size={28} color="#00ffff" />
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{selectedDate?.getDate()}</Text>
                </View>
              </View>
              <View style={styles.dateTextContainer}>
                <Text style={[styles.modalTitle, { color: getDayColor(selectedDate) }]}>
                  {selectedDate?.toLocaleDateString('en-US', { weekday: 'long' })}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close-circle" size={32} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
          >
            {/* Rest day view */}
            {existingWorkout && viewMode === 'rest' && (
              <View style={styles.restDayContainer}>
                <View style={styles.sectionHeaderContainer}>
                  <Ionicons name="bed" size={20} color="#ffa500" />
                  <Text style={styles.sectionTitle}>Rest Day</Text>
                </View>
                
                <View style={styles.restDayCard}>
                  <View style={styles.restDayIcon}>
                    <Ionicons name="bed-outline" size={48} color="#ffa500" />
                  </View>
                  <Text style={styles.restDayTitle}>Recovery Day</Text>
                  <Text style={styles.restDayDescription}>
                    Taking a rest day is important for muscle recovery and preventing injury.
                  </Text>
                  {existingWorkout.notes && existingWorkout.notes !== 'Rest day' && (
                    <View style={styles.restDayNotes}>
                      <Text style={styles.restDayNotesText}>{existingWorkout.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Action buttons */}
                <View style={styles.actionButtonsGrid}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => setViewMode('choose')}
                  >
                    <Ionicons name="barbell" size={24} color="#000" />
                    <Text style={styles.primaryButtonText}>Schedule Workout Instead</Text>
                  </TouchableOpacity>

                  <View style={styles.secondaryButtonsRow}>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDeleteScheduledWorkout}
                    >
                      <Ionicons name="trash" size={20} color="#ff4444" />
                      <Text style={styles.deleteButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Existing workout view */}
            {existingWorkout && viewMode === 'existing' && (
              <View style={styles.existingWorkoutContainer}>
                <View style={styles.sectionHeaderContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#00ff00" />
                  <Text style={styles.sectionTitle}>Scheduled Workout</Text>
                </View>
                
                <View style={styles.workoutCard}>
                  <View style={styles.workoutCardHeader}>
                    <Ionicons name="barbell" size={24} color="#00ffff" />
                    <Text style={styles.workoutName}>{existingWorkout.workout_name}</Text>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.exerciseList}>
                    <View style={styles.exerciseHeaderRow}>
                      <Ionicons name="list" size={16} color="#00ffff" />
                      <Text style={styles.exerciseListTitle}>
                        {existingWorkout.workout_exercises?.length || 0} Exercises
                      </Text>
                    </View>
                    {existingWorkout.workout_exercises && existingWorkout.workout_exercises.map((exercise, index) => (
                      <View key={index} style={styles.exerciseItemContainer}>
                        <View style={styles.exerciseNumber}>
                          <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.exerciseDetails}>
                          <Text style={styles.exerciseName}>
                            {typeof exercise === 'string' ? exercise : exercise.name}
                          </Text>
                          {exercise.sets && exercise.reps && (
                            <Text style={styles.exerciseSets}>
                              {exercise.sets} sets × {exercise.reps} reps
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>

                  {existingWorkout.notes && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.notesContainer}>
                        <Ionicons name="document-text" size={16} color="#00ffff" />
                        <Text style={styles.notesText}>{existingWorkout.notes}</Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Action buttons */}
                <View style={styles.actionButtonsGrid}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleStartWorkout}
                  >
                    <Ionicons name="play-circle" size={24} color="#000" />
                    <Text style={styles.primaryButtonText}>Start Workout</Text>
                  </TouchableOpacity>

                  <View style={styles.secondaryButtonsRow}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setViewMode('choose')}
                    >
                      <Ionicons name="swap-horizontal" size={20} color="#00ffff" />
                      <Text style={styles.secondaryButtonText}>Change</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.restDayButton}
                      onPress={handleMarkRestDay}
                    >
                      <Ionicons name="bed" size={20} color="#ffa500" />
                      <Text style={styles.restDayButtonText}>Rest Day</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDeleteScheduledWorkout}
                    >
                      <Ionicons name="trash" size={20} color="#ff4444" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Choose workout view */}
            {viewMode === 'choose' && (
              <View style={styles.chooseWorkoutContainer}>
                {existingWorkout && (
                  <>
                    <View style={styles.sectionHeaderContainer}>
                      <Ionicons name="fitness" size={20} color="#00ffff" />
                      <Text style={styles.sectionTitle}>Choose Different Workout</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => setViewMode(existingWorkout?.is_rest_day ? 'rest' : 'existing')}
                    >
                      <Ionicons name="arrow-back" size={16} color="#00ffff" />
                      <Text style={styles.backButtonText}>
                        {existingWorkout?.is_rest_day ? 'Back to Rest Day' : 'Back to Scheduled Workout'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00ffff" />
                    <Text style={styles.loadingText}>Loading your workouts...</Text>
                  </View>
                ) : userWorkouts.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="barbell-outline" size={64} color="#444" />
                    <Text style={styles.emptyText}>No Workouts Created Yet</Text>
                    <Text style={styles.emptySubtext}>Create a workout first to schedule it</Text>
                  </View>
                ) : (
                  <>
                    {/* Rest Day Option - Moved to top */}
                    <View style={styles.restDayOptionTop}>
                      <TouchableOpacity
                        style={styles.restDayOptionButton}
                        onPress={handleMarkRestDay}
                        disabled={savingWorkout}
                      >
                        <Ionicons name="bed" size={24} color="#ffa500" />
                        <Text style={styles.restDayOptionText}>Mark as Rest Day</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={styles.dividerContainer}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR CHOOSE WORKOUT</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* Workouts List */}
                    <View style={styles.workoutList}>
                      {userWorkouts.map((workout, index) => (
                        <TouchableOpacity
                          key={workout.id}
                          style={styles.workoutListItem}
                          onPress={() => handleScheduleWorkout(workout)}
                          disabled={savingWorkout}
                        >
                          <View style={styles.workoutListNumber}>
                            <Text style={styles.workoutListNumberText}>{index + 1}</Text>
                          </View>
                          <View style={styles.workoutListContent}>
                            <Text style={styles.workoutListName}>
                              {workout.workout_name || workout.name}
                            </Text>
                            <View style={styles.workoutListMeta}>
                              <Ionicons name="barbell" size={14} color="#666" />
                              <Text style={styles.workoutListExercises}>
                                {workout.exercises?.length || 0} exercises
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward-circle" size={24} color="#00ffff" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {savingWorkout && (
            <View style={styles.savingOverlay}>
              <View style={styles.savingCard}>
                <ActivityIndicator size="large" color="#00ffff" />
                <Text style={styles.savingText}>Scheduling workout...</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '85%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.15)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  dateBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00ffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dateBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  existingWorkoutContainer: {
    gap: 16,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  workoutCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  workoutName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  exerciseList: {
    gap: 12,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  exerciseListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffff',
  },
  exerciseItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 10,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseSets: {
    fontSize: 13,
    color: '#888',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 10,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  actionButtonsGrid: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#00ffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: 'bold',
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: '600',
  },
  restDayButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.4)',
    gap: 8,
  },
  restDayButtonText: {
    color: '#ffa500',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.4)',
    gap: 8,
  },
  deleteButtonText: {
    color: '#ff4444',
    fontSize: 15,
    fontWeight: '600',
  },
  chooseWorkoutContainer: {
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    color: '#666',
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
  },
  workoutList: {
    gap: 12,
  },
  workoutListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 14,
  },
  workoutListNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutListNumberText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  workoutListContent: {
    flex: 1,
    gap: 6,
  },
  workoutListName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  workoutListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutListExercises: {
    fontSize: 13,
    color: '#666',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  savingCard: {
    backgroundColor: '#1a1a1a',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  savingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Rest Day Styles
  restDayContainer: {
    gap: 16,
  },
  restDayCard: {
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.25)',
    alignItems: 'center',
  },
  restDayIcon: {
    marginBottom: 16,
  },
  restDayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffa500',
    marginBottom: 12,
  },
  restDayDescription: {
    fontSize: 15,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 22,
  },
  restDayNotes: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 165, 0, 0.2)',
    width: '100%',
  },
  restDayNotesText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  restDayOptionTop: {
    marginBottom: 20,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 1.5,
  },
  restDayOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ffa500',
    gap: 10,
    width: '100%',
  },
  restDayOptionText: {
    color: '#ffa500',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default ScheduledWorkoutModal;
