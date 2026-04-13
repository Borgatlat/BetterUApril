import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';

const { width, height } = Dimensions.get('window');

/**
 * WorkoutShareModal Component
 * 
 * This component allows users to share workouts with their friends.
 * It displays a list of friends and allows the user to select multiple friends
 * and add an optional personal message.
 * 
 * Key Features:
 * - Multi-select friend list
 * - Optional personal message
 * - Sends notifications to selected friends
 * - Prevents duplicate shares
 */
export const WorkoutShareModal = ({ 
  visible, 
  onClose, 
  workout, 
  onShareSuccess 
}) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { userProfile } = useUser();
  const { createNotification } = useNotifications();

  // Fetch friends when modal opens
  useEffect(() => {
    if (visible) {
      fetchFriends();
    }
  }, [visible]);

  /**
   * Fetches the user's accepted friends for sharing
   * Uses the friends table to get all accepted friendships
   * and transforms the data to show the other person's profile
   */
  const fetchFriends = async () => {
    if (!userProfile?.id) return;
    
    setIsLoading(true);
    try {
      const { data: friendships, error } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          ),
          user:user_id (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          )
        `)
        .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      // Transform data to get friend profiles (the other person in the friendship)
      const friendProfiles = friendships.map(f => {
        const friend = f.user_id === userProfile.id ? f.friend : f.user;
        return {
          ...friend,
          friendship_id: f.id
        };
      });

      setFriends(friendProfiles);
    } catch (error) {
      console.error('Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggles friend selection in the multi-select list
   * @param {string} friendId - The ID of the friend to toggle
   */
  const toggleFriendSelection = (friendId) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  /**
   * Handles the workout sharing process
   * Creates workout share records and sends notifications to selected friends
   */
  const handleShareWorkout = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend to share with.');
      return;
    }

    setIsSharing(true);
    try {
      // Check for existing shares first to avoid duplicates
      const { data: existingShares } = await supabase
        .from('workout_shares')
        .select('recipient_id')
        .eq('workout_id', workout.id)
        .eq('sender_id', userProfile.id)
        .in('recipient_id', selectedFriends);

      const existingRecipients = new Set(existingShares?.map(s => s.recipient_id) || []);
      const newRecipients = selectedFriends.filter(friendId => !existingRecipients.has(friendId));

      if (newRecipients.length === 0) {
        Alert.alert('Already Shared', 'This workout has already been shared with all selected friends.');
        return;
      }

      // Create workout share records with workout data (only for new recipients)
      const shares = newRecipients.map(friendId => ({
        workout_id: workout.id,
        sender_id: userProfile.id,
        recipient_id: friendId,
        message: message.trim() || null,
        workout_name: workout.workout_name,
        workout_exercises: workout.exercises
      }));

      const { error: shareError } = await supabase
        .from('workout_shares')
        .insert(shares);

      if (shareError) {
        console.error('Error creating workout shares:', shareError);
        throw shareError;
      }

      // Send notifications to each new friend
      for (const friendId of newRecipients) {
        const friend = friends.find(f => f.id === friendId);
        await createNotification({
          type: 'workout_share',
          title: 'New Workout Shared! 💪',
          message: `${userProfile.username || userProfile.full_name} shared "${workout.workout_name}" with you`,
          data: { 
            workout_id: workout.id, 
            sender_id: userProfile.id,
            sender_name: userProfile.username || userProfile.full_name
          },
          action_type: 'navigate',
          action_data: { 
            screen: '/(tabs)/workout', 
            params: { tab: 'shared' } 
          },
          priority: 2,
          user_id: friendId
        });
      }

      Alert.alert(
        'Workout Shared!',
        `Successfully shared "${workout.workout_name}" with ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}.`
      );

      // Reset form and close modal
      setSelectedFriends([]);
      setMessage('');
      onShareSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error sharing workout:', error);
      Alert.alert('Error', 'Failed to share workout. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * Renders each friend item in the selection list
   * Shows friend's avatar, name, and selection state
   */
  const renderFriendItem = ({ item, index }) => {
    const isSelected = selectedFriends.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.friendCard, isSelected && styles.selectedFriendCard]}
        onPress={() => toggleFriendSelection(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.friendInfo}>
          <View style={styles.avatarContainer}>
            {item.avatar_url ? (
              <Image 
                source={{ uri: item.avatar_url }} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {(item.username || item.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.username}>@{item.username || 'unknown'}</Text>
            <Text style={styles.name}>{item.full_name || 'Unknown User'}</Text>
            {item.is_premium && (
              <View style={styles.premiumBadgeContainer}>
                <Ionicons name="star" size={12} color="#ffd700" />
                <Text style={styles.premiumBadge}>Premium</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.selectionButton, isSelected && styles.selectedButton]}>
          {isSelected ? (
            <Ionicons name="checkmark" size={20} color="#000" />
          ) : (
            <Ionicons name="add" size={20} color="#00ffff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#000000', '#111111', '#000000']}
          style={styles.gradient}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <View style={styles.closeButtonBackground}>
                  <Ionicons name="close" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Share Workout</Text>
                <Text style={styles.headerSubtitle}>Send to your friends</Text>
              </View>
              <TouchableOpacity 
                onPress={handleShareWorkout}
                disabled={selectedFriends.length === 0 || isSharing}
                style={[
                  styles.shareButton,
                  (selectedFriends.length === 0 || isSharing) && styles.disabledButton
                ]}
              >
                <LinearGradient
                  colors={selectedFriends.length === 0 || isSharing ? ['#333', '#444'] : ['#00ffff', '#00cccc']}
                  style={styles.shareButtonGradient}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#000" style={{ marginRight: 6 }} />
                      <Text style={styles.shareButtonText}>Share</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Workout Info Card */}
              <View style={styles.workoutCard}>
                <LinearGradient
                  colors={['rgba(0, 255, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
                  style={styles.workoutCardGradient}
                >
                  <View style={styles.workoutInfo}>
                    <View style={styles.workoutHeader}>
                      <Ionicons name="barbell" size={24} color="#00ffff" />
                      <Text style={styles.workoutName}>{workout?.workout_name}</Text>
                    </View>
                    <View style={styles.workoutStats}>
                      <View style={styles.statItem}>
                        <Ionicons name="list" size={16} color="#00ffff" />
                        <Text style={styles.statText}>
                          {workout?.exercises?.length || 0} exercises
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="time" size={16} color="#00ffff" />
                        <Text style={styles.statText}>Custom workout</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* Personal Message Section */}
              <View style={styles.messageSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="chatbubble" size={20} color="#00ffff" />
                  <Text style={styles.sectionTitle}>Personal Message</Text>
                  <Text style={styles.optionalText}>(Optional)</Text>
                </View>
                <View style={styles.messageInputContainer}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Add a personal message to your friends..."
                    placeholderTextColor="#666"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={200}
                  />
                  <View style={styles.characterCountContainer}>
                    <Text style={styles.characterCount}>{message.length}/200</Text>
                  </View>
                </View>
              </View>

              {/* Friends List Section */}
              <View style={styles.friendsSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={20} color="#00ffff" />
                  <Text style={styles.sectionTitle}>Select Friends</Text>
                  <View style={styles.selectionBadge}>
                    <Text style={styles.selectionCount}>{selectedFriends.length}</Text>
                  </View>
                </View>
                
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00ffff" />
                    <Text style={styles.loadingText}>Loading friends...</Text>
                  </View>
                ) : friends.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color="#666" />
                    <Text style={styles.emptyStateTitle}>No Friends Yet</Text>
                    <Text style={styles.emptyStateText}>
                      Add friends to share workouts with them
                    </Text>
                  </View>
                ) : (
                  <View style={styles.friendsListContainer}>
                    {friends.map((friend, index) => (
                      <View key={friend.id} style={styles.friendItemWrapper}>
                        {renderFriendItem({ item: friend, index })}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  shareButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  shareButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Workout Card Styles
  workoutCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  workoutCardGradient: {
    padding: 20,
  },
  workoutInfo: {
    // Container for workout info
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  workoutStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Message Section Styles
  messageSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  optionalText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  messageInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  messageInput: {
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCountContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
  },

  // Friends Section Styles
  friendsSection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  selectionBadge: {
    backgroundColor: '#00ffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  selectionCount: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  friendsListContainer: {
    gap: 8,
  },
  friendItemWrapper: {
    marginBottom: 8,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedFriendCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  friendDetails: {
    flex: 1,
  },
  username: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  name: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  premiumBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  premiumBadge: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '600',
  },
  selectionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  selectedButton: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },

  // Loading and Empty States
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});