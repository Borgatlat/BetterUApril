import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { navigateFromNotification } from '../utils/notificationNavigation';
import { recordNotificationOpen } from '../utils/notificationOpenTracking';
import { 
  initializePushNotifications, 
  addNotificationReceivedListener, 
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  clearAllNotifications 
} from '../utils/pushNotifications';
import { createNotificationWithPush } from '../utils/notificationHelpers';

// Create notification context with default values
const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  createNotification: async () => {},
  deleteNotification: async () => {},
  refreshNotifications: async () => {},
  clearNotifications: async () => {}
});

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const subscriptionRef = useRef(null);

  // Fetch notifications from Supabase
  const fetchNotifications = useCallback(async (forceRefresh = false) => {
    if (!user?.id) {
      return;
    }

    // Prevent excessive API calls - only fetch if forced or if last fetch was > 30 seconds ago
    if (!forceRefresh && lastFetch && (Date.now() - lastFetch) < 30000) {
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to prevent performance issues

      if (error) {
        console.error('[NotificationContext] Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
      setLastFetch(Date.now());

      // Update unread count
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);

    } catch (error) {
      console.error('[NotificationContext] Error in fetchNotifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, lastFetch]);

  // Mark specific notifications as read
  const markAsRead = useCallback(async (notificationIds) => {
    if (!user?.id || !notificationIds || notificationIds.length === 0) return;

    try {
      const { error } = await supabase.rpc('mark_notifications_read', {
        notification_ids: notificationIds
      });

      if (error) {
        console.error('[NotificationContext] Error marking notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notificationIds.includes(notification.id) 
            ? { ...notification, is_read: true }
            : notification
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));

    } catch (error) {
      console.error('[NotificationContext] Error in markAsRead:', error);
    }
  }, [user?.id]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');

      if (error) {
        console.error('[NotificationContext] Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );

      // Reset unread count
      setUnreadCount(0);

    } catch (error) {
      console.error('[NotificationContext] Error in markAllAsRead:', error);
    }
  }, [user?.id]);

  // Create a new notification
  const createNotification = useCallback(async (notificationData) => {
    if (!user?.id && !notificationData?.user_id) return null;

    try {
      const targetUserId = notificationData.user_id || user.id;

      const result = await createNotificationWithPush({
        toUserId: targetUserId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        isActionable: notificationData.is_actionable !== false,
        actionType: notificationData.action_type || null,
        actionData: notificationData.action_data || null,
        priority: notificationData.priority || 1,
        expiresAt: notificationData.expires_at || null,
      });

      if (targetUserId === user?.id) {
        await fetchNotifications(true);
      }

      return result;
    } catch (error) {
      console.error('[NotificationContext] Error in createNotification:', error);
      return null;
    }
  }, [user?.id, fetchNotifications]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId) => {
    if (!user?.id || !notificationId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('[NotificationContext] Error deleting notification:', error);
        return;
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

    } catch (error) {
      console.error('[NotificationContext] Error in deleteNotification:', error);
    }
  }, [user?.id, notifications]);

  // Clear all notifications
  const clearNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('[NotificationContext] Error clearing notifications:', error);
        return;
      }

      // Reset local state
      setNotifications([]);
      setUnreadCount(0);

    } catch (error) {
      console.error('[NotificationContext] Error in clearNotifications:', error);
    }
  }, [user?.id]);

  // Refresh notifications (alias for fetchNotifications with force refresh)
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications(true);
  }, [fetchNotifications]);

  // Get unread notification count
  const getUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count');

      if (error) {
        console.error('[NotificationContext] Error getting unread count:', error);
        return;
      }

      setUnreadCount(data || 0);

    } catch (error) {
      console.error('[NotificationContext] Error in getUnreadCount:', error);
    }
  }, [user?.id]);

  // Initialize push notifications and set up real-time subscription
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Initialize push notifications for this user
    const initPushNotifications = async () => {
      try {
        const token = await initializePushNotifications(user.id);
        if (token) {
          console.log('Push notifications initialized for user:', user.id);
        }
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    };

    // Initialize push notifications
    initPushNotifications();

    // Initial fetch
    fetchNotifications(true);
    getUnreadCount();

    // Set up real-time subscription
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New notification
            setNotifications(prev => [payload.new, ...prev]);
            if (!payload.new.is_read) {
              setUnreadCount(prev => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Updated notification
            setNotifications(prev => 
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );
            // Recalculate unread count
            getUnreadCount();
          } else if (payload.eventType === 'DELETE') {
            // Deleted notification
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            // Recalculate unread count
            getUnreadCount();
          }
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [user?.id]); // Removed fetchNotifications and getUnreadCount from dependencies

  // Handle notification responses (when user taps on notifications)
  useEffect(() => {
    const handleNotificationResponse = async (response) => {
      const contentData = response?.notification?.request?.content?.data || {};

      if (contentData.notification_id) {
        await markAsRead([contentData.notification_id]);
      }

      await recordNotificationOpen();

      let payload = contentData;

      // Enrich from DB when push payload lacks action_data (older notifications).
      if (contentData.notification_id && !contentData.action_data && !payload.screen) {
        try {
          const { data: row } = await supabase
            .from('notifications')
            .select('type, action_type, action_data, data')
            .eq('id', contentData.notification_id)
            .maybeSingle();
          if (row) {
            payload = {
              ...contentData,
              type: row.type || contentData.type,
              action_type: row.action_type,
              action_data: row.action_data,
              data: row.data,
            };
          }
        } catch (e) {
          console.warn('[NotificationContext] Could not load notification row:', e?.message);
        }
      }

      const navigated = navigateFromNotification(router, payload);
      if (!navigated) {
        console.log('[NotificationContext] No deep link for notification type:', payload?.type);
      }
    };

    const responseSubscription = addNotificationResponseReceivedListener(handleNotificationResponse);

    getLastNotificationResponse().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, [markAsRead, router]);

  // Refresh notifications when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        fetchNotifications(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [fetchNotifications]);

  // Auto-refresh notifications every 5 minutes when app is active
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteNotification,
    refreshNotifications,
    clearNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 