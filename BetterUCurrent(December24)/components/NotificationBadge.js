import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';

const NotificationBadge = ({ onPress, size = 'medium', showCount = true, style, iconColor = '#00ffff' }) => {
  const { unreadCount } = useNotifications();

  // Don't render if no unread notifications
  if (unreadCount === 0) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.emptyContainer, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Ionicons 
          name="notifications-outline" 
          size={getIconSize(size)} 
          color={iconColor}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="notifications" 
        size={getIconSize(size)} 
        color={iconColor}
      />
      
      {showCount && unreadCount > 0 && (
        <View style={[styles.badge, getBadgeSize(size)]}>
          <Text style={[styles.badgeText, getBadgeTextSize(size)]}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const getIconSize = (size) => {
  switch (size) {
    case 'small': return 20;
    case 'large': return 28;
    default: return 24; // medium
  }
};

const getBadgeSize = (size) => {
  switch (size) {
    case 'small': return { width: 16, height: 16, borderRadius: 8 };
    case 'large': return { width: 24, height: 24, borderRadius: 12 };
    default: return { width: 20, height: 20, borderRadius: 10 }; // medium
  }
};

const getBadgeTextSize = (size) => {
  switch (size) {
    case 'small': return { fontSize: 10 };
    case 'large': return { fontSize: 14 };
    default: return { fontSize: 12 }; // medium
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  emptyContainer: {
    opacity: 0.9,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
    borderWidth: 2,
    borderColor: '#121212',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBadge; 