import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeShape } from './BadgeShape';

/**
 * BadgeModal Component
 * 
 * Displays detailed information about a badge when clicked.
 * Shows badge icon, name, description, how to earn, and when it was earned.
 * Can be opened by clicking any badge (yours or someone else's).
 * 
 * Props:
 * - visible: Boolean to show/hide modal
 * - badge: Object containing badge data (id, name, description, how_to_earn, icon_url, earned_at)
 * - onClose: Function called when modal is closed
 * - isOwnBadge: Boolean indicating if this is the current user's badge (for "Set as Display" button)
 * - onSetAsDisplay: Function to set this badge as displayed (only shown if isOwnBadge is true)
 */
export const BadgeModal = ({ visible, badge, onClose, isOwnBadge = false, onSetAsDisplay }) => {
  // Format the earned date for display
  const formatEarnedDate = (earnedAt) => {
    if (!earnedAt) return null;
    try {
      const date = new Date(earnedAt);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return null;
    }
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
          {/* Header with close button */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Badge Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {badge ? (
              <>
                {/* Badge Icon - Large display with Shield Shape */}
                {/* Normalize badge data: get_user_badges returns badge_name, badge_description, etc. */}
                <View style={styles.badgeIconContainer}>
                  <BadgeShape 
                    size={120}
                    imageUri={badge.icon_url && badge.icon_url.trim() !== '' ? badge.icon_url : null}
                  >
                    <View style={styles.badgeIconPlaceholder}>
                      <Ionicons name="trophy" size={80} color="#00ffff" />
                    </View>
                  </BadgeShape>
                </View>

                {/* Badge Name - handle both naming conventions */}
                <Text style={styles.badgeName}>
                  {badge.name || badge.badge_name || 'Unknown Badge'}
                </Text>

                {/* Badge Description - handle both naming conventions */}
                {(badge.description || badge.badge_description) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About This Badge</Text>
                    <Text style={styles.sectionText}>
                      {badge.description || badge.badge_description}
                    </Text>
                  </View>
                )}

                {/* How to Earn */}
                {badge.how_to_earn && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="trophy-outline" size={20} color="#00ffff" />
                      <Text style={styles.sectionTitle}>How to Earn</Text>
                    </View>
                    <Text style={styles.sectionText}>{badge.how_to_earn}</Text>
                  </View>
                )}

                {/* Earned Date (if badge has been earned) */}
                {badge.earned_at && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="calendar-outline" size={20} color="#00ffff" />
                      <Text style={styles.sectionTitle}>Earned On</Text>
                    </View>
                    <Text style={styles.sectionText}>
                      {formatEarnedDate(badge.earned_at) || 'Unknown date'}
                    </Text>
                  </View>
                )}

                {/* Set as Display Button (only for own badges) */}
                {isOwnBadge && onSetAsDisplay && !badge.is_displayed && (
                  <TouchableOpacity
                    style={styles.setDisplayButton}
                    onPress={() => {
                      onSetAsDisplay(badge.badge_id || badge.id);
                      onClose();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="star" size={20} color="#000" />
                    <Text style={styles.setDisplayButtonText}>Set as Display Badge</Text>
                  </TouchableOpacity>
                )}

                {/* Currently Displayed Indicator */}
                {badge.is_displayed && (
                  <View style={styles.displayedIndicator}>
                    <Ionicons name="checkmark-circle" size={20} color="#00ff00" />
                    <Text style={styles.displayedText}>Currently Displayed</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00ffff" />
                <Text style={styles.loadingText}>Loading badge details...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    borderWidth: 1,
    borderColor: '#222',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  badgeIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeIcon: {
    width: 120,
    height: 120,
    // No border radius - BadgeShape handles the shape clipping
  },
  badgeIconPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    // No border or border radius - BadgeShape handles the shape clipping
  },
  badgeName: {
    color: '#00ffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  sectionText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  setDisplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  setDisplayButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  displayedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
    gap: 8,
  },
  displayedText: {
    color: '#00ff00',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
});

export default BadgeModal;

