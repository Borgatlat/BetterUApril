import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeShape } from './BadgeShape';

/**
 * BadgeDisplay Component
 * 
 * Displays a user's currently displayed badge on their profile.
 * This component shows the badge icon and name, and is clickable to open the badge modal.
 * 
 * Props:
 * - badge: Object containing badge data (id, name, icon_url, etc.)
 * - onPress: Function called when badge is clicked (opens modal)
 * - size: 'small' | 'medium' | 'large' (default: 'medium')
 * - showLabel: Boolean to show/hide badge name (default: true)
 */
export const BadgeDisplay = ({ badge, onPress, size = 'medium', showLabel = true }) => {
  // If no badge, show placeholder or nothing
  if (!badge) {
    return null;
  }

  // Size configurations - determines icon and text sizes
  const sizeConfig = {
    small: { icon: 32, text: 12, container: 40 },
    medium: { icon: 48, text: 14, container: 60 },
    mediumLarge: { icon: 56, text: 15, container: 70 },
    large: { icon: 64, text: 16, container: 80 }
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        {/* Badge Icon with Shield Shape */}
        <BadgeShape 
          size={config.icon}
          imageUri={badge.icon_url && badge.icon_url.trim() !== '' ? badge.icon_url : null}
        >
          <View style={[styles.badgeIconPlaceholder, { width: config.icon, height: config.icon }]}>
            <Ionicons name="trophy" size={config.icon * 0.6} color="#00ffff" />
          </View>
        </BadgeShape>
      </TouchableOpacity>
      
      {/* Badge Name Label (optional) - outside container to allow full width */}
      {showLabel && (badge.name || badge.badge_name) && (
        <Text style={[styles.badgeLabel, { fontSize: config.text }]}>
          {badge.name || badge.badge_name}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    maxWidth: '100%',
    backgroundColor: 'transparent',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  badgeIcon: {
    // No border radius needed - BadgeShape handles clipping
  },
  badgeIconPlaceholder: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    // No border or border radius - BadgeShape handles the shape
  },
  badgeLabel: {
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: 200,
  },
});

export default BadgeDisplay;

