import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * GroupAvatar Component
 * 
 * Displays an avatar for a group with the following features:
 * - Shows group image if provided via `source` prop
 * - Falls back to group name initials if no image
 * - Falls back to people icon if no name
 * - Supports custom size via `size` prop
 * 
 * Props:
 * - groupName: string - Name of the group (used for initials)
 * - size: number - Size of the avatar in pixels (default: 60)
 * - source: object - Image source object (e.g., { uri: '...' })
 * - style: object - Additional styles to apply
 */
const GroupAvatar = ({ 
  groupName = '', 
  size = 60, 
  source = null, 
  style = {} 
}) => {
  // Get initials from group name (first letter of first word)
  // Example: "BetterU Fitness" -> "BF", "Team Alpha" -> "TA"
  const getInitials = (name) => {
    if (!name || name.trim().length === 0) return '';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      // Take first letter of first two words
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    // Single word: take first 2 letters
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(groupName);
  const avatarSize = size;
  const borderRadius = avatarSize / 2; // Make it circular

  // If image source is provided, show image
  if (source && source.uri) {
    return (
      <View style={[styles.container, { width: avatarSize, height: avatarSize, borderRadius }, style]}>
        <Image
          source={source}
          style={[styles.image, { width: avatarSize, height: avatarSize, borderRadius }]}
          resizeMode="cover"
        />
      </View>
    );
  }

  // If we have initials, show them
  if (initials) {
    return (
      <View 
        style={[
          styles.initialsContainer, 
          { 
            width: avatarSize, 
            height: avatarSize, 
            borderRadius,
            backgroundColor: '#00ffff' // Cyan background
          }, 
          style
        ]}
      >
        <Text 
          style={[
            styles.initialsText, 
            { fontSize: avatarSize * 0.35 } // Responsive font size
          ]}
        >
          {initials}
        </Text>
      </View>
    );
  }

  // Fallback: show people icon
  return (
    <View 
      style={[
        styles.iconContainer, 
        { 
          width: avatarSize, 
          height: avatarSize, 
          borderRadius,
          backgroundColor: 'rgba(0, 255, 255, 0.2)'
        }, 
        style
      ]}
    >
      <Ionicons 
        name="people" 
        size={avatarSize * 0.5} 
        color="#00ffff" 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.5)',
  },
  initialsText: {
    color: '#000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
});

export { GroupAvatar };
export default GroupAvatar;
