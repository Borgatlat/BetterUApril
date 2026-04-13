/**
 * Push Notifications Service
 * 
 * This service handles:
 * - Registering for push notifications
 * - Getting device tokens
 * - Storing tokens in Supabase
 * - Handling notification responses
 * 
 * Think of this like a "notification manager" that talks to both
 * your device and your Supabase database to make push notifications work.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications should behave when the app is in different states.
// expo-notifications native APIs (setNotificationHandler, getLastNotificationResponse, etc.)
// are not available on web and will throw if called.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,        // Show notification popup
      shouldPlaySound: true,        // Play notification sound
      shouldSetBadge: true,         // Update app badge number
    }),
  });
}

/**
 * Register for push notifications and get device token
 * This is like asking the device "Hey, can you give me a unique ID 
 * so I can send you notifications later?"
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // Check if we're running on a physical device (not simulator)
  // We'll assume it's a device if we can get a push token
  try {
    // Check if we have permission to send notifications
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // If we don't have permission, ask for it
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // If permission was denied, we can't send notifications
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    // Get the device token (this is the unique ID for this device)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '57d27416-420d-4d92-8d6d-d1365c22f311', // Your Expo project ID from app.config.js
    });
    token = tokenData.data;
    console.log('Push notification token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
    console.log('This might be because you\'re running on a simulator. Push notifications require a physical device.');
    return null;
  }

  // Configure notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,  // High priority
      vibrationPattern: [0, 250, 250, 250],             // Vibration pattern
      lightColor: '#00ffff',                            // LED color (matches your app theme)
    });
  }

  return token;
}

/**
 * Store the device token in Supabase user profile
 * This tells Supabase "Hey, this user's device can receive notifications 
 * at this token address"
 */
export async function storePushToken(token, userId) {
  console.log('💾 ===== STORING PUSH TOKEN =====');
  console.log('🔑 Token:', token);
  console.log('👤 User ID:', userId);
  
  try {
    const updateData = { 
      push_token: token,
      push_notifications_enabled: true,
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 Update data:', JSON.stringify(updateData, null, 2));
    
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('❌ Error storing push token:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('✅ Push token stored successfully in database');
    return true;
  } catch (error) {
    console.error('❌ Error storing push token:', error);
    console.error('❌ Error stack:', error.stack);
    return false;
  }
}

/**
 * Remove push token when user logs out or disables notifications
 * This tells Supabase "This user no longer wants notifications"
 */
export async function removePushToken(userId) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        push_token: null,
        push_notifications_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error removing push token:', error);
      return false;
    }

    console.log('Push token removed successfully');
    return true;
  } catch (error) {
    console.error('Error removing push token:', error);
    return false;
  }
}

/**
 * Handle when user taps on a notification
 * This determines what happens when they tap the notification
 * (like opening a specific screen)
 */
export function addNotificationReceivedListener(listener) {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Handle when user taps on a notification
 * This is different from received - this is when they actually tap it
 */
export function addNotificationResponseReceivedListener(listener) {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Get the last notification the user interacted with
 * Useful for deep linking when app opens from a notification.
 * Not available on web - returns null so callers don't crash.
 */
export async function getLastNotificationResponse() {
  if (Platform.OS === 'web') return null;
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Clear all notifications from the device
 * Useful when user logs out or wants to clear notification history.
 * No-op on web (native API not available).
 */
export async function clearAllNotifications() {
  if (Platform.OS === 'web') return;
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Initialize push notifications for the app
 * This is the main function you'll call when the app starts
 */
export async function initializePushNotifications(userId) {
  try {
    // Register for push notifications
    const token = await registerForPushNotificationsAsync();
    
    if (token && userId) {
      // Store the token in Supabase
      const success = await storePushToken(token, userId);
      if (success) {
        console.log('Push notifications initialized successfully');
        return token;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return null;
  }
}
