import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import BadgeModal from './BadgeModal';
import { BadgeShape } from './BadgeShape';

/**
 * BadgeCollection Component
 * 
 * Displays all badges a user has earned in a grid/list format.
 * Allows users to view their badge collection and change their displayed badge.
 * 
 * Props:
 * - userId: UUID of the user whose badges to display
 * - onBadgePress: Optional callback when a badge is pressed
 */
export const BadgeCollection = ({ userId, onBadgePress }) => {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reloadingBadges, setReloadingBadges] = useState(false);

  // Check if viewing own badges (to show "Set as Display" option)
  const isOwnBadges = user?.id === userId;

  // Fetch user's badges from database
  const fetchBadges = async () => {
    if (!userId) {
      console.warn('[BadgeCollection] No userId provided');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      
      console.log('[BadgeCollection] Fetching badges for user:', userId);
      
      // Use the database function to get all badges with full details
      const { data, error } = await supabase
        .rpc('get_user_badges', { p_user_id: userId });

      if (error) {
        console.error('[BadgeCollection] Error fetching badges:', error);
        Alert.alert('Error', `Failed to load badges: ${error.message}`);
        setBadges([]);
        return;
      }

      console.log('[BadgeCollection] Fetched badges:', data?.length || 0);

      // Sort badges: displayed first, then by earned date (newest first)
      const sortedBadges = (data || []).sort((a, b) => {
        if (a.is_displayed && !b.is_displayed) return -1;
        if (!a.is_displayed && b.is_displayed) return 1;
        return new Date(b.earned_at) - new Date(a.earned_at);
      });

      setBadges(sortedBadges);
    } catch (error) {
      console.error('[BadgeCollection] Error in fetchBadges:', error);
      Alert.alert('Error', `Failed to load badges: ${error.message}`);
      setBadges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load badges on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchBadges();
    }
  }, [userId]);

  // Handle badge press - open modal
  const handleBadgePress = (badge) => {
    // Normalize badge data structure for modal
    // The get_user_badges function returns badge_name, badge_description, etc.
    // but modal expects name, description, etc.
    const normalizedBadge = {
      ...badge,
      name: badge.badge_name || badge.name,
      description: badge.badge_description || badge.description,
      id: badge.badge_id || badge.id,
      // Ensure icon_url is preserved
      icon_url: badge.icon_url,
    };
    setSelectedBadge(normalizedBadge);
    setModalVisible(true);
    if (onBadgePress) {
      onBadgePress(normalizedBadge);
    }
  };

  // Set badge as displayed
  const handleSetAsDisplay = async (badgeId) => {
    try {
      const { error } = await supabase
        .rpc('set_displayed_badge', {
          p_user_id: user.id,
          p_badge_id: badgeId,
        });

      if (error) {
        console.error('Error setting displayed badge:', error);
        Alert.alert('Error', 'Failed to set displayed badge. Please try again.');
        return;
      }

      // Refresh badges to update display status
      await fetchBadges();
      
      // Call the onBadgePress callback if provided to notify parent component
      if (onBadgePress) {
        onBadgePress({ badge_id: badgeId, action: 'set_displayed' });
      }
    } catch (error) {
      console.error('Error in handleSetAsDisplay:', error);
      Alert.alert('Error', 'Failed to set displayed badge. Please try again.');
    }
  };

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchBadges();
  };

  // Function to manually reload/check badges
  const handleReloadBadges = async () => {
    if (!userId || reloadingBadges) return;
    
    try {
      setReloadingBadges(true);
      
      // Call the function to check and award all badges
      const { error } = await supabase
        .rpc('check_all_badges_for_user', {
          p_user_id: userId,
        });
      
      if (error) {
        console.error('Error reloading badges:', error);
        Alert.alert('Error', 'Failed to reload badges. Please try again.');
        return;
      }
      
      // Refresh the badge list after reloading
      await fetchBadges();
      
      Alert.alert('Success', 'Badges have been checked and updated!');
    } catch (error) {
      console.error('Error in handleReloadBadges:', error);
      Alert.alert('Error', 'Failed to reload badges. Please try again.');
    } finally {
      setReloadingBadges(false);
    }
  };

  // Render individual badge item
  const renderBadgeItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={[
          styles.badgeItem,
          item.is_displayed && styles.badgeItemDisplayed,
        ]}
        onPress={() => handleBadgePress(item)}
        activeOpacity={0.7}
      >
        {/* Badge Icon with Shield Shape */}
        <View style={styles.badgeIconContainer}>
          <BadgeShape 
            size={64}
            imageUri={item.icon_url && item.icon_url.trim() !== '' ? item.icon_url : null}
          >
            <View style={styles.badgeIconPlaceholder}>
              <Ionicons name="trophy" size={32} color="#00ffff" />
            </View>
          </BadgeShape>
          
          {/* Displayed Indicator */}
          {item.is_displayed && (
            <View style={styles.displayedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#00ff00" />
            </View>
          )}
        </View>

        {/* Badge Name */}
        <Text style={styles.badgeName}>
          {item.badge_name || item.name || 'Unknown Badge'}
        </Text>

        {/* Earned Date */}
        {item.earned_at && (
          <Text style={styles.earnedDate} numberOfLines={1}>
            {new Date(item.earned_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ffff" />
        <Text style={styles.loadingText}>Loading badges...</Text>
      </View>
    );
  }

  // Empty state
  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trophy-outline" size={64} color="#666" />
        <Text style={styles.emptyText}>No badges earned yet</Text>
        <Text style={styles.emptySubtext}>
          Complete activities to earn badges!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with count and reload button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Badge Collection</Text>
          <Text style={styles.badgeCount}>{badges.length} {badges.length === 1 ? 'badge' : 'badges'}</Text>
        </View>
        {isOwnBadges && (
          <TouchableOpacity
            style={[styles.reloadBadgesButton, reloadingBadges && styles.reloadBadgesButtonDisabled]}
            onPress={handleReloadBadges}
            disabled={reloadingBadges}
          >
            {reloadingBadges ? (
              <ActivityIndicator size="small" color="#00ffff" />
            ) : (
              <Ionicons name="refresh-outline" size={18} color="#00ffff" />
            )}
            <Text style={styles.reloadBadgesText}>
              {reloadingBadges ? 'Reloading...' : 'Reload'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Badge Grid */}
      <FlatList
        data={badges}
        renderItem={renderBadgeItem}
        keyExtractor={(item) => item.badge_id || item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00ffff"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No badges yet</Text>
          </View>
        }
      />

      {/* Badge Modal */}
      <BadgeModal
        visible={modalVisible}
        badge={selectedBadge}
        onClose={() => {
          setModalVisible(false);
          setSelectedBadge(null);
        }}
        isOwnBadge={isOwnBadges}
        onSetAsDisplay={handleSetAsDisplay}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  badgeCount: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  reloadBadgesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  reloadBadgesButtonDisabled: {
    opacity: 0.5,
  },
  reloadBadgesText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  listContent: {
    padding: 12,
  },
  badgeItem: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    margin: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    minHeight: 160,
    maxWidth: '48%',
  },
  badgeItemDisplayed: {
    borderColor: '#00ff00',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 255, 0, 0.05)',
  },
  badgeIconContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  badgeIcon: {
    width: 64,
    height: 64,
    // No border radius - BadgeShape handles the shape clipping
  },
  badgeIconPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    // No border or border radius - BadgeShape handles the shape clipping
  },
  displayedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  badgeName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
  earnedDate: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default BadgeCollection;

