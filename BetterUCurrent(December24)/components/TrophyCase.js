import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import BadgeDisplay from './BadgeDisplay';
import BadgeModal from './BadgeModal';

/**
 * TrophyCase Component
 * 
 * Displays a horizontal scrollable list of all badges a user has earned.
 * This is a compact view that shows all badges in a trophy case format.
 * 
 * Props:
 * - userId: UUID of the user whose badges to display
 * - onBadgePress: Optional callback when a badge is pressed
 * - onViewAll: Optional callback to view full badge collection
 * - isOwnProfile: Boolean to enable "Set as Display" functionality
 * - onSetAsDisplay: Callback when user sets a badge as their display badge
 */
const TrophyCase = ({ userId, onBadgePress, onViewAll, isOwnProfile = false, onSetAsDisplay }) => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Fetch user's badges from database
  const fetchBadges = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Use the database function to get all badges with full details
      const { data, error } = await supabase
        .rpc('get_user_badges', { p_user_id: userId });

      if (error) {
        console.error('Error fetching badges:', error);
        return;
      }

      // Sort badges: displayed first, then by earned date (newest first)
      const sortedBadges = (data || []).sort((a, b) => {
        if (a.is_displayed && !b.is_displayed) return -1;
        if (!a.is_displayed && b.is_displayed) return 1;
        return new Date(b.earned_at) - new Date(a.earned_at);
      });

      setBadges(sortedBadges);
    } catch (error) {
      console.error('Error in fetchBadges:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load badges on mount and when userId changes
  useEffect(() => {
    fetchBadges();
  }, [userId]);

  // Handle badge press - open modal
  const handleBadgePress = (badge) => {
    // Normalize badge data to ensure all fields are present
    const normalizedBadge = {
      ...badge,
      id: badge.badge_id || badge.id,
      name: badge.badge_name || badge.name,
      description: badge.badge_description || badge.description,
    };
    
    setSelectedBadge(normalizedBadge);
    setModalVisible(true);
    
    // Call optional callback
    if (onBadgePress) {
      onBadgePress(normalizedBadge);
    }
  };

  // Don't render if no badges
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Trophy Case</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#00ffff" />
        </View>
      </View>
    );
  }

  if (!badges || badges.length === 0) {
    return null; // Don't show trophy case if user has no badges
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Trophy Case</Text>
          <Text style={styles.count}>{badges.length}</Text>
        </View>
        {/* View Trophy Case button - links to full badge collection */}
        {onViewAll && (
          <TouchableOpacity style={styles.viewButton} onPress={onViewAll}>
            <Text style={styles.viewButtonText}>View</Text>
            <Ionicons name="chevron-forward" size={14} color="#00ffff" />
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.badgeList}
      >
        {badges.map((badge) => {
          // Normalize badge data for BadgeDisplay component
          const normalizedBadge = {
            ...badge,
            id: badge.badge_id || badge.id,
            name: badge.badge_name || badge.name,
            description: badge.badge_description || badge.description,
          };

          return (
            <TouchableOpacity
              key={badge.badge_id || badge.id}
              style={[
                styles.badgeItem,
                badge.is_displayed && styles.badgeItemDisplayed,
              ]}
              onPress={() => handleBadgePress(normalizedBadge)}
              activeOpacity={0.7}
            >
              <BadgeDisplay
                badge={normalizedBadge}
                size="medium"
                showLabel={true}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Badge Detail Modal */}
      <BadgeModal
        visible={modalVisible}
        badge={selectedBadge}
        onClose={() => {
          setModalVisible(false);
          setSelectedBadge(null);
        }}
        isOwnBadge={isOwnProfile} // Allow "Set as Display" on own profile
        onSetAsDisplay={isOwnProfile ? async (badgeId) => {
          // Call the parent callback if provided
          if (onSetAsDisplay) {
            await onSetAsDisplay(badgeId);
          }
          // Refresh badges to show updated display status
          fetchBadges();
        } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20, // Slightly bigger title
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  count: {
    fontSize: 15,
    color: '#00ffff',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#00ffff',
    fontWeight: '500',
    marginRight: 2,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  badgeList: {
    paddingRight: 16,
    paddingVertical: 4, // Add some vertical padding
  },
  badgeItem: {
    marginRight: 16, // More spacing between badges
    alignItems: 'center',
    width: 100, // Bigger width for larger badges
  },
  badgeItemDisplayed: {
    // Visual indicator for displayed badge
    opacity: 1,
  },
});

export default TrophyCase;

