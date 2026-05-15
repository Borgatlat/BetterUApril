import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getBlockedUsers, unblockUser } from '../utils/blockingUtils';
import { clearFeedCache } from '../utils/feedPreloader';
import { PremiumAvatar } from './components/PremiumAvatar';

/**
 * BlockedUsersScreen Component
 * 
 * This screen displays all users that the current user has blocked.
 * Users can view blocked users and unblock them from this screen.
 * 
 * Features:
 * - Lists all blocked users with their profile information
 * - Shows when each user was blocked
 * - Allows unblocking users with confirmation
 * - Pull-to-refresh functionality
 * - Empty state when no users are blocked
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // Load blocked users when component mounts
  useEffect(() => {
    if (user?.id) {
      loadBlockedUsers();
    }
  }, [user?.id]);

  /**
   * Load the list of blocked users
   * This function fetches all users that the current user has blocked
   */
  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const users = await getBlockedUsers(user.id);
      setBlockedUsers(users);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      Alert.alert('Error', 'Failed to load blocked users. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Handle pull-to-refresh
   * Allows users to manually refresh the blocked users list
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBlockedUsers();
  };

  /**
   * Handle unblocking a user
   * Shows a confirmation dialog before unblocking
   * 
   * @param {object} blockedUser - The user to unblock
   */
  const handleUnblock = (blockedUser) => {
    const displayName = blockedUser.full_name || blockedUser.username || 'this user';
    
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${displayName}? You will be able to see each other again.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            await performUnblock(blockedUser.id);
          }
        }
      ]
    );
  };

  /**
   * Perform the actual unblock operation
   * Removes the block relationship from the database
   * 
   * @param {string} blockedUserId - The ID of the user to unblock
   */
  const performUnblock = async (blockedUserId) => {
    try {
      setUnblockingId(blockedUserId);
      const result = await unblockUser(blockedUserId, user.id);

      if (result.success) {
        // Remove the user from the local list
        setBlockedUsers(prev => prev.filter(u => u.id !== blockedUserId));
        // Clear feed cache so unblocked user's activities can appear again
        clearFeedCache();
        Alert.alert('Success', 'User has been unblocked. Their activities may appear in your feed.');
      } else {
        Alert.alert('Error', result.error || 'Failed to unblock user. Please try again.');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setUnblockingId(null);
    }
  };

  /**
   * Format the date when a user was blocked
   * Converts the timestamp to a readable format
   * 
   * @param {string} blockedAt - ISO timestamp string
   * @returns {string} - Formatted date string
   */
  const formatBlockedDate = (blockedAt) => {
    if (!blockedAt) return 'Unknown';
    
    try {
      const date = new Date(blockedAt);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  // Show loading indicator while fetching data
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#00ffff" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Blocked Users</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text style={styles.loadingText}>Loading blocked users...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#00ffff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Blocked Users</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00ffff"
          />
        }
      >
        {blockedUsers.length === 0 ? (
          // Empty state - no blocked users
          <View style={styles.emptyState}>
            <Ionicons name="ban-outline" size={64} color="#666" />
            <Text style={styles.emptyStateTitle}>No Blocked Users</Text>
            <Text style={styles.emptyStateText}>
              You haven't blocked any users yet. Blocked users won't be able to see your profile or interact with you.
            </Text>
          </View>
        ) : (
          // List of blocked users
          <>
            <Text style={styles.sectionDescription}>
              {blockedUsers.length} {blockedUsers.length === 1 ? 'user' : 'users'} blocked
            </Text>
            {blockedUsers.map((blockedUser) => (
              <View key={blockedUser.id} style={styles.userCard}>
                {/* User Avatar and Info */}
                <View style={styles.userInfo}>
                  <PremiumAvatar
                    userId={blockedUser.id}
                    source={blockedUser.avatar_url ? { uri: blockedUser.avatar_url } : null}
                    size={50}
                    style={styles.avatar}
                    isPremium={blockedUser.is_premium}
                    username={blockedUser.username}
                    fullName={blockedUser.full_name}
                  />
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>
                      {blockedUser.full_name || blockedUser.username || 'Unknown User'}
                    </Text>
                    <Text style={styles.userUsername}>
                      @{blockedUser.username || 'unknown'}
                    </Text>
                    <Text style={styles.blockedDate}>
                      Blocked {formatBlockedDate(blockedUser.blocked_at)}
                    </Text>
                  </View>
                </View>

                {/* Unblock Button */}
                <TouchableOpacity
                  style={[
                    styles.unblockButton,
                    unblockingId === blockedUser.id && styles.unblockButtonDisabled
                  ]}
                  onPress={() => handleUnblock(blockedUser)}
                  disabled={unblockingId === blockedUser.id}
                >
                  {unblockingId === blockedUser.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  sectionDescription: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 12,
    color: '#999',
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  unblockButtonDisabled: {
    opacity: 0.6,
  },
  unblockButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});

