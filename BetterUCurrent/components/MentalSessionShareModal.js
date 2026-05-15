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
 * MentalSessionShareModal Component
 * 
 * This component allows users to share mental sessions with their friends.
 * It displays a list of friends and allows the user to select multiple friends
 * and add an optional personal message.
 * 
 * Key Features:
 * - Multi-select friend list
 * - Optional personal message
 * - Sends notifications to selected friends
 * - Prevents duplicate shares
 */
export const MentalSessionShareModal = ({ 
  visible, 
  onClose, 
  mentalSession, 
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
    if (visible && userProfile?.id) {
      fetchFriends();
    }
  }, [visible, userProfile?.id]);

  /**
   * Fetches the user's friends list for sharing
   * Gets friends from the friends table with profile information
   */
  const fetchFriends = async () => {
    if (!userProfile?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch friends where user is the requester
      const { data: friendsData1, error: error1 } = await supabase
        .from('friends')
        .select(`
          *,
          friend:profiles!friends_friend_id_fkey (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          )
        `)
        .eq('user_id', userProfile.id)
        .eq('status', 'accepted');

      // Fetch friends where user is the friend (reverse relationship)
      const { data: friendsData2, error: error2 } = await supabase
        .from('friends')
        .select(`
          *,
          user:profiles!friends_user_id_fkey (
            id,
            username,
            full_name,
            avatar_url,
            is_premium
          )
        `)
        .eq('friend_id', userProfile.id)
        .eq('status', 'accepted');

      if (error1 || error2) {
        console.error('Error fetching friends:', error1 || error2);
        throw error1 || error2;
      }

      // Transform both datasets
      const friendsList1 = friendsData1?.map(friendship => friendship.friend).filter(Boolean) || [];
      const friendsList2 = friendsData2?.map(friendship => friendship.user).filter(Boolean) || [];
      
      // Combine and deduplicate friends
      const allFriends = [...friendsList1, ...friendsList2];
      const uniqueFriends = allFriends.filter((friend, index, self) => 
        index === self.findIndex(f => f.id === friend.id)
      );
      
      setFriends(uniqueFriends);
      console.log('Fetched friends for mental session sharing:', uniqueFriends.length);
    } catch (error) {
      console.error('Error in fetchFriends:', error);
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
   * Handles the mental session sharing process
   * Creates mental session share records and sends notifications to selected friends
   */
  const handleShareMentalSession = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend to share with.');
      return;
    }

    setIsSharing(true);
    try {
      // Check for existing shares first to avoid duplicates
      const { data: existingShares } = await supabase
        .from('mental_session_shares')
        .select('recipient_id')
        .eq('mental_session_id', mentalSession.id)
        .eq('sender_id', userProfile.id)
        .in('recipient_id', selectedFriends);

      const existingRecipients = new Set(existingShares?.map(s => s.recipient_id) || []);
      const newRecipients = selectedFriends.filter(friendId => !existingRecipients.has(friendId));

      if (newRecipients.length === 0) {
        Alert.alert('Already Shared', 'This mental session has already been shared with all selected friends.');
        return;
      }

      // Create mental session share records with session data (only for new recipients)
      const shares = newRecipients.map(friendId => ({
        mental_session_id: mentalSession.id, // This can be either mental_session_logs.id or custom_mental_sessions.id
        sender_id: userProfile.id,
        recipient_id: friendId,
        message: message.trim() || null,
        session_name: mentalSession.session_name || mentalSession.title || 'Mental Session',
        session_type: mentalSession.session_type || 'meditation',
        session_description: mentalSession.description || mentalSession.session_description || '',
        duration: mentalSession.duration || mentalSession.duration_minutes || 0,
        steps: mentalSession.steps || null, // Include the actual steps from the custom session
        calmness_level: mentalSession.calmness_level || null,
        notes: mentalSession.notes || null,
        photo_url: mentalSession.photo_url || null
      }));

      const { error: shareError } = await supabase
        .from('mental_session_shares')
        .insert(shares);

      if (shareError) {
        console.error('Error creating mental session shares:', shareError);
        throw shareError;
      }

      // Send notifications to each new friend
      for (const friendId of newRecipients) {
        try {
          await createNotification({
            user_id: friendId,
            type: 'mental_session_share',
            title: 'New Mental Session Shared',
            message: `${userProfile.full_name || userProfile.username} shared a mental session with you!`,
            data: {
              mental_session_id: mentalSession.id,
              sender_id: userProfile.id,
              session_name: mentalSession.session_name || mentalSession.title || 'Mental Session',
              session_type: mentalSession.session_type || 'meditation'
            },
            is_actionable: true,
            action_type: 'navigate',
            action_data: { 
              screen: '/(tabs)/mental',
              mental_session_id: mentalSession.id 
            },
            priority: 2
          });
        } catch (notificationError) {
          console.error('Error sending notification to friend:', friendId, notificationError);
          // Continue with other notifications even if one fails
        }
      }

      Alert.alert(
        'Success!',
        `Mental session shared with ${newRecipients.length} friend${newRecipients.length > 1 ? 's' : ''}!`,
        [{ text: 'OK', onPress: () => {
          setSelectedFriends([]);
          setMessage('');
          onShareSuccess?.();
        }}]
      );
    } catch (error) {
      console.error('Error sharing mental session:', error);
      Alert.alert('Error', 'Failed to share mental session. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * Renders a friend item in the selection list
   * @param {Object} friend - The friend object to render
   */
  const renderFriend = ({ item: friend }) => {
    const isSelected = selectedFriends.includes(friend.id);
    
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.selectedFriendItem]}
        onPress={() => toggleFriendSelection(friend.id)}
      >
        <View style={styles.friendInfo}>
          <Image
            source={{ 
              uri: friend.avatar_url || 'https://via.placeholder.com/50x50/8b5cf6/ffffff?text=' + (friend.username?.[0] || 'U')
            }}
            style={styles.friendAvatar}
          />
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>
              {friend.full_name || friend.username || 'Unknown User'}
            </Text>
            <Text style={styles.friendUsername}>@{friend.username}</Text>
          </View>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
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
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Share Mental Session</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Session Info */}
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionName}>
              {mentalSession?.session_name || 'Mental Session'}
            </Text>
            <Text style={styles.sessionDetails}>
              {mentalSession?.session_type || 'meditation'} • {mentalSession?.duration || 0} minutes
            </Text>
            {mentalSession?.description && (
              <Text style={styles.sessionDescription} numberOfLines={2}>
                {mentalSession.description}
              </Text>
            )}
          </View>

          {/* Message Input */}
          <View style={styles.messageSection}>
            <Text style={styles.sectionTitle}>Personal Message (Optional)</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Add a personal message..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Text style={styles.characterCount}>{message.length}/200</Text>
          </View>

          {/* Friends List */}
          <View style={styles.friendsSection}>
            <Text style={styles.sectionTitle}>
              Select Friends ({selectedFriends.length} selected)
            </Text>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>No friends found</Text>
                <Text style={styles.emptySubtext}>Add friends to share mental sessions with them</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                renderItem={renderFriend}
                style={styles.friendsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          {/* Share Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.shareButton,
                (selectedFriends.length === 0 || isSharing) && styles.disabledButton
              ]}
              onPress={handleShareMentalSession}
              disabled={selectedFriends.length === 0 || isSharing}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color="#fff" />
                  <Text style={styles.shareButtonText}>
                    Share with {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  sessionInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sessionName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sessionDetails: {
    fontSize: 14,
    color: '#8b5cf6',
    marginBottom: 8,
  },
  sessionDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  messageSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  messageInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  friendsSection: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
    paddingVertical: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedFriendItem: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8b5cf6',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 14,
    color: '#8b5cf6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  shareButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MentalSessionShareModal;
