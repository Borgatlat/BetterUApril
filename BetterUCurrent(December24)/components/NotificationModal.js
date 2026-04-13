import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

// Notification type icons mapping
const getNotificationIcon = (type) => {
  const iconMap = {
    friend_request: 'person-add',
    friend_request_accepted: 'checkmark-circle',
    comment: 'chatbubble',
    like: 'heart',
    mention: 'at',
    group_invitation: 'people',
    group_join_request: 'person-add',
    group_activity: 'fitness',
    goal_completion: 'trophy',
    streak_milestone: 'flame',
    achievement: 'star',
    personal_record: 'medal',
    workout_reminder: 'fitness',
    mental_reminder: 'leaf',
    hydration_reminder: 'water',
    weekly_progress: 'trending-up',
    monthly_stats: 'bar-chart',
    ai_recommendation: 'sparkles',
    motivational_quote: 'quote',
    community_highlight: 'people-circle',
    challenge_invitation: 'trophy',
    leaderboard_update: 'podium',
    points_earned: 'gift',
    level_up: 'arrow-up',
    reward_unlocked: 'gift',
    sync_status: 'sync',
    app_update: 'refresh',
    app_message: 'megaphone', // Admin messages to all users
    premium_feature: 'diamond',
    local_event: 'calendar',
    virtual_meetup: 'videocam',
    community_challenge: 'trophy',
    nudge_workout: 'megaphone',
    nudge_run: 'megaphone',
    nudge_mental: 'leaf',
    daily_reminder: 'alarm'
  };
  return iconMap[type] || 'notifications';
};

// Priority colors
const getPriorityColor = (priority) => {
  switch (priority) {
    case 3: return '#ff4444'; // High - Red
    case 2: return '#ff8800'; // Medium - Orange
    case 1: return '#00ffff'; // Low - Cyan
    default: return '#00ffff';
  }
};

// Format time ago
const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now - notificationTime) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return notificationTime.toLocaleDateString();
};

const NotificationItem = React.memo(({ notification, onPress, onDelete, onMarkAsRead }) => {
  const router = useRouter();
  
  const handlePress = useCallback(() => {
    // Mark as read if not already read
    if (!notification.is_read) {
      onMarkAsRead([notification.id]);
    }

    // Handle navigation based on action_type
    if (notification.action_type === 'navigate' && notification.action_data?.screen) {
      const { screen, params } = notification.action_data;
      if (params) {
        router.push({ pathname: screen, params });
      } else {
        router.push(screen);
      }
    }
    
    onPress?.(notification);
  }, [notification, onPress, onMarkAsRead, router]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(notification.id) }
      ]
    );
  }, [notification.id, onDelete]);

  const iconName = getNotificationIcon(notification.type);
  const priorityColor = getPriorityColor(notification.priority);
  const timeAgo = formatTimeAgo(notification.created_at);

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.is_read && styles.unreadNotification
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={[styles.iconContainer, { backgroundColor: priorityColor + '20' }]}>
          <Ionicons name={iconName} size={20} color={priorityColor} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[
            styles.notificationTitle,
            !notification.is_read && styles.unreadTitle
          ]}>
            {notification.title}
          </Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {notification.message}
          </Text>
          <Text style={styles.notificationTime}>
            {timeAgo}
          </Text>
        </View>

        <View style={styles.actionContainer}>
          {notification.is_actionable && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePress}
            >
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons name="close" size={16} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const NotificationModal = ({ visible, onClose }) => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    refreshNotifications
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Track initial load
  useEffect(() => {
    if (!isLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [isLoading, hasInitiallyLoaded]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    
    Alert.alert(
      'Mark All as Read',
      'Mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark All', onPress: markAllAsRead }
      ]
    );
  }, [unreadCount, markAllAsRead]);

  const handleClearAll = useCallback(async () => {
    if (notifications.length === 0) return;
    
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: clearNotifications 
        }
      ]
    );
  }, [notifications.length, clearNotifications]);



  const handleMarkAsRead = useCallback((notificationIds) => {
    markAsRead(notificationIds);
  }, [markAsRead]);

  const handleDelete = useCallback((notificationId) => {
    deleteNotification(notificationId);
  }, [deleteNotification]);

  const handleNotificationPress = useCallback((notification) => {
    // Additional handling if needed
    console.log('Notification pressed:', notification);
  }, []);

  const renderNotification = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
      onDelete={handleDelete}
      onMarkAsRead={handleMarkAsRead}
    />
  ), [handleNotificationPress, handleDelete, handleMarkAsRead]);

  const keyExtractor = useCallback((item) => item.id, []);

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyMessage}>
        You're all caught up! New notifications will appear here.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
             <TouchableOpacity 
         style={styles.modalOverlay} 
         activeOpacity={1} 
         onPress={onClose}
       >
                   <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Swipe Handle */}
            <View style={styles.swipeHandle}>
              <View style={styles.swipeHandleBar} />
            </View>
            
            {/* Header */}
            <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.headerActions}>
              {notifications.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={handleClearAll}
                >
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
              
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllButton}
                  onPress={handleMarkAllAsRead}
                >
                  <Text style={styles.markAllText}>Mark All</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications List */}
          {isLoading && !hasInitiallyLoaded ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00ffff" />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={keyExtractor}
              style={styles.notificationsList}
              contentContainerStyle={[
                styles.notificationsContent,
                notifications.length === 0 && styles.emptyContent
              ]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#00ffff"
                  colors={['#00ffff']}
                />
              }
              ListEmptyComponent={EmptyState}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={10}
            />
          )}
          
          {/* Bottom Close Button */}
          <View style={styles.bottomCloseContainer}>
            <TouchableOpacity
              style={styles.bottomCloseButton}
              onPress={onClose}
            >
              <Text style={styles.bottomCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.8,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  swipeHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  swipeHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  clearAllText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  markAllText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  bottomCloseContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bottomCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
  },
  notificationsContent: {
    paddingBottom: 20,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  notificationItem: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  unreadNotification: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#ccc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NotificationModal; 