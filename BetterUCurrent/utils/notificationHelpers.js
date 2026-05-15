/**
 * Notification Helpers
 * 
 * These functions make it easy to create different types of notifications
 * that will automatically trigger push notifications via our database trigger.
 * 
 * Think of these as "notification templates" - you just call the function
 * with the user ID and any additional data, and it handles creating the
 * notification in the database (which then triggers the push notification).
 */

import { supabase } from '../lib/supabase';
import { getStreakStatus } from './streakHelpers';
import { getEngagementLevel } from './engagementService';
import { getUserContext, getUserState } from './userStateMachine';
import { selectNotificationTemplate } from './notificationTemplateSelector';

/**
 * Send push notification directly via Edge Function
 * This function gets the user's push token and calls the Edge Function
 */
async function sendPushNotificationDirectly(userId, notificationData) {
  console.log('📤 ===== SENDING PUSH NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('📋 Notification data:', JSON.stringify(notificationData, null, 2));
  
  try {
    // Get user's push token and preferences
    console.log('🔍 Fetching user profile from database...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('push_token, push_notifications_enabled, notification_preferences')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Error fetching user profile:', profileError);
      console.error('❌ Profile data:', profile);
      return false;
    }

    console.log('✅ User profile fetched:', JSON.stringify(profile, null, 2));

    // Check if user has push notifications enabled
    if (!profile.push_notifications_enabled || !profile.push_token) {
      console.log('⚠️ User has push notifications disabled or no token');
      console.log('🔔 Push notifications enabled:', profile.push_notifications_enabled);
      console.log('🔑 Push token exists:', !!profile.push_token);
      console.log('🔑 Push token:', profile.push_token);
      return false;
    }

    // Check if this notification type is enabled for the user
    const notificationTypeEnabled = profile.notification_preferences?.[notificationData.type] !== false;
    if (!notificationTypeEnabled) {
      console.log(`⚠️ User has disabled ${notificationData.type} notifications`);
      console.log('⚙️ Notification preferences:', profile.notification_preferences);
      return false;
    }

    console.log('✅ All checks passed, calling Edge Function...');

    // Call the Edge Function to send push notification
    const edgeFunctionPayload = {
      token: profile.push_token,
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data,
      type: notificationData.type,
      priority: notificationData.priority,
      notification_id: notificationData.data?.notification_id,
      user_id: userId
    };

    console.log('📤 Edge Function payload:', JSON.stringify(edgeFunctionPayload, null, 2));

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: edgeFunctionPayload
    });

    if (error) {
      console.error('❌ Error sending push notification:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('✅ Push notification sent successfully!');
    console.log('📋 Edge Function response:', JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error in sendPushNotificationDirectly:', error);
    console.error('❌ Error stack:', error.stack);
    return false;
  }
}

export async function createAccountabilityPartnerNoti(recipientUserId, senderUserId, partnershipId) {
  const senderName = await getUserDisplayName(senderUserId, 'A friend');
  return createNotificationWithPush({
    toUserId: recipientUserId,
    type: 'accountability_partner_request',
    title: 'Accountability Partner Request',
    message: `${senderName} wants to be your accountability partner for weekly check-ins.`,
    data: { partnership_id: partnershipId, sender_id: senderUserId },
    priority: 3,
  });
}

export async function weeklyCheckInNoti(tUserId, PartnerName, weekStartDate) {
  return createNotificationWithPush({
    toUserId: tUserId,
    type: 'accountability_check_in_reminder',
    title: 'Accountability Partner Check-in',
    message: `Time for your weekly check-in with ${PartnerName}. How did working towards your goal go?`,
    data: { week_start_date: weekStartDate },
    priority: 3,
  });
}

export async function createAccountabilityCheckInReceivedNotification(userId, partnerName, weekStartDate) {
  return createNotificationWithPush({
    toUserId: userId,
    type: 'accountability_check_in_received',
    title: 'Check-in from your partner',
    message: `${partnerName} completed their weekly check-in. Tap to see how their week went.`,
    data: { week_start_date: weekStartDate },
    priority: 3,
  });
}
/**
 * Remove undefined values from plain objects so Supabase JSON columns
 * don't receive invalid keys. We keep null because null is a valid JSON value.
 */
function stripUndefined(input) {
  if (!input || typeof input !== 'object') return input;
  const cleaned = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

/**
 * Get the nicest display name for a user.
 * We prefer full_name, then username, and finally any caller provided fallback.
 */
async function getUserDisplayName(userId, fallbackName = 'Someone') {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('⚠️ Failed to load profile for display name, falling back:', error);
      return fallbackName;
    }

    return data?.full_name?.trim() || data?.username?.trim() || fallbackName;
  } catch (error) {
    console.warn('⚠️ Unexpected error getting display name, falling back:', error);
    return fallbackName;
  }
}

/**
 * Pull a friendly title for feed activities so notifications feel personal.
 */
async function getActivityDetails(itemType, itemId) {
  const defaultDetails = {
    label: itemType === 'mental' ? 'mental session' : itemType === 'run' ? 'run' : 'workout',
    title: null,
  };

  if (!itemId || typeof itemId !== 'string' || itemId.startsWith('test-')) {
    return defaultDetails;
  }

  try {
    if (itemType === 'workout') {
      const { data, error } = await supabase
        .from('user_workout_logs')
        .select('workout_name')
        .eq('id', itemId)
        .single();

      if (error) {
        console.warn('⚠️ Workout title lookup failed, using default:', error);
        return defaultDetails;
      }

      return {
        label: 'workout',
        title: data?.workout_name?.trim() || null,
      };
    }

    if (itemType === 'mental') {
      const { data, error } = await supabase
        .from('mental_session_logs')
        .select('session_name, session_type')
        .eq('id', itemId)
        .single();

      if (error) {
        console.warn('⚠️ Mental session title lookup failed, using default:', error);
        return defaultDetails;
      }

      return {
        label: 'mental session',
        title: data?.session_name?.trim() || data?.session_type?.trim() || null,
      };
    }

    if (itemType === 'run') {
      const { data, error } = await supabase
        .from('runs')
        .select('title, activity_type')
        .eq('id', itemId)
        .single();

      if (error) {
        console.warn('⚠️ Run title lookup failed, using default:', error);
        return defaultDetails;
      }

      return {
        label: data?.activity_type?.trim()?.toLowerCase() || 'run',
        title: data?.title?.trim() || null,
      };
    }
  } catch (error) {
    console.warn('⚠️ Unexpected error while loading activity details:', error);
  }

  return defaultDetails;
}

/**
 * Frequency caps & quiet hours (simple MVP)
 *
 * Why this is in code:
 * - If you notify too often, users disable notifications (retention drops).
 * - If you notify during sleep, users feel punished and churn.
 *
 * This function is intentionally conservative. It avoids sending low-priority pushes
 * when the user has already received several notifications today.
 *
 * If you change the caps:
 * - Higher caps = more messages (might help some users, but risks spam/churn).
 * - Lower caps = fewer messages (safer but might reduce re-engagement).
 */
async function shouldSendPushNotification({ toUserId, priority }) {
  try {
    // Quiet hours: 22:00 → 07:00 local device time.
    // Note: this is imperfect for server-triggered pushes (server doesn't know local time),
    // but it's still helpful for client-triggered pushes and general suppression.
    const hour = new Date().getHours();
    const inQuietHours = hour >= 22 || hour < 7;
    if (inQuietHours && (priority ?? 1) < 3) {
      return { ok: false, reason: 'quiet_hours' };
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', toUserId)
      .gte('created_at', startOfDay);

    if (error) {
      // If counting fails, fail open (don't block notifications).
      return { ok: true, reason: null };
    }

    const dailyCount = count ?? 0;
    const DAILY_CAP_LOW_PRIORITY = 3;
    const DAILY_CAP_HIGH_PRIORITY = 6;

    if ((priority ?? 1) >= 3) {
      if (dailyCount >= DAILY_CAP_HIGH_PRIORITY) return { ok: false, reason: 'daily_cap_high_priority' };
      return { ok: true, reason: null };
    }

    if (dailyCount >= DAILY_CAP_LOW_PRIORITY) return { ok: false, reason: 'daily_cap_low_priority' };
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: true, reason: null };
  }
}

/**
 * Create a notification row and immediately send the paired push.
 * All notification creators should use this so behaviour stays consistent.
 */
export async function createNotificationWithPush({
  toUserId,
  type,
  title,
  message,
  data = {},
  isActionable = true,
  actionType = null,
  actionData = null,
  priority = 1,
  expiresAt = null,
}) {
  if (!toUserId) {
    console.error('❌ Missing target user for notification');
    return { notificationId: null, pushSent: false };
  }

  try {
    const gate = await shouldSendPushNotification({ toUserId, priority });
    if (!gate.ok) {
      console.log('🔕 Notification suppressed by rules:', gate.reason);
      return { notificationId: null, pushSent: false, suppressed: true, reason: gate.reason };
    }

    const payloadData = stripUndefined({
      ...data,
      action_type: actionType,
      action_data: actionData,
    });

    const { data: notificationId, error } = await supabase.rpc('create_notification', {
      p_user_id: toUserId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_data: payloadData,
      p_is_actionable: isActionable,
      p_action_type: actionType,
      p_action_data: stripUndefined(actionData) || null,
      p_priority: priority,
      p_expires_at: expiresAt,
    });

    if (error) {
      console.error('❌ Error creating notification row:', error);
      return { notificationId: null, pushSent: false, error };
    }

    const pushSent = await sendPushNotificationDirectly(toUserId, {
      title,
      body: message,
      data: stripUndefined({
        ...payloadData,
        type,
        notification_id: notificationId,
      }),
      type,
      priority,
    });

    return { notificationId, pushSent };
  } catch (error) {
    console.error('❌ Error in createNotificationWithPush:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a friend request notification
 * This is called when someone sends a friend request
 */
export async function createFriendRequestNotification(fromUserId, toUserId, fromUserName) {
  console.log('👥 ===== CREATING FRIEND REQUEST NOTIFICATION =====');
  console.log('👤 From User ID:', fromUserId);
  console.log('👤 To User ID:', toUserId);
  console.log('📝 From User Name (fallback):', fromUserName);
  
  try {
    const displayName = await getUserDisplayName(fromUserId, fromUserName);
    const title = `${displayName} sent you a friend request`;
    const message = `${displayName} wants to be your friend!`;

    const result = await createNotificationWithPush({
      toUserId,
      type: 'friend_request',
      title,
      message,
      data: {
        from_user_id: fromUserId,
        from_user_name: displayName,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/community',
        params: { tab: 'friends' },
      },
      priority: 2,
    });

    console.log('✅ Friend request notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createFriendRequestNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a friend request accepted notification
 * This is called when someone accepts a friend request
 */
export async function createFriendRequestAcceptedNotification(fromUserId, toUserId, fromUserName) {
  try {
    const displayName = await getUserDisplayName(toUserId, fromUserName);
    const title = `${displayName} accepted your friend request`;
    const message = `You and ${displayName} are friends now!`;

    const result = await createNotificationWithPush({
      toUserId: fromUserId,
      type: 'friend_request_accepted',
      title,
      message,
      data: {
        from_user_id: toUserId,
        from_user_name: displayName,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/community',
        params: { tab: 'friends' },
      },
      priority: 2,
    });

    console.log('✅ Friend request accepted notification created:', result);
    return result;
  } catch (error) {
    console.error('Error in createFriendRequestAcceptedNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a like notification
 * This is called when someone likes a user's run, workout, or mental session
 */
export async function createLikeNotification(fromUserId, toUserId, fromUserName, itemType, itemId) {
  console.log('❤️ ===== CREATING LIKE NOTIFICATION =====');
  console.log('👤 From User ID:', fromUserId);
  console.log('👤 To User ID:', toUserId);
  console.log('🏃 Item Type:', itemType);
  console.log('🆔 Item ID:', itemId);
  
  try {
    const displayName = await getUserDisplayName(fromUserId, fromUserName);
    const { label, title: activityTitle } = await getActivityDetails(itemType, itemId);

    const title = `${displayName} liked your ${label}`;
    const message = activityTitle
      ? `${activityTitle} was liked`
      : `Tap to see your ${label}`;

    const actionData = itemId && typeof itemId === 'string' && !itemId.startsWith('test-')
      ? { screen: `/activity/${itemId}` }
      : null;

    const result = await createNotificationWithPush({
      toUserId,
      type: 'like',
      title,
      message,
      data: {
        from_user_id: fromUserId,
        from_user_name: displayName,
        item_type: itemType,
        item_id: itemId,
        activity_title: activityTitle,
        activity_label: label,
        is_test: itemId?.startsWith?.('test-') || false,
      },
      isActionable: !!actionData,
      actionType: actionData ? 'navigate' : null,
      actionData,
      priority: 1,
    });

    console.log('✅ Like notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createLikeNotification:', error);
    console.error('❌ Error stack:', error.stack);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a workout share notification
 * This is called when someone shares a workout with friends
 */
export async function createWorkoutShareNotification(fromUserId, toUserId, fromUserName, workoutName) {
  console.log('💪 ===== CREATING WORKOUT SHARE NOTIFICATION =====');
  console.log('👤 From User ID:', fromUserId);
  console.log('👤 To User ID:', toUserId);
  console.log('📝 From User Name:', fromUserName);
  console.log('🏋️ Workout Name:', workoutName);
  
  try {
    const displayName = await getUserDisplayName(fromUserId, fromUserName);
    const safeWorkoutName = workoutName?.trim() || 'a workout';
    const title = `${displayName} shared a workout with you`;
    const message = `${safeWorkoutName} was shared`;

    const result = await createNotificationWithPush({
      toUserId,
      type: 'workout_share',
      title,
      message,
      data: {
        from_user_id: fromUserId,
        from_user_name: displayName,
        workout_name: safeWorkoutName,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/workout',
        params: { tab: 'workout' },
      },
      priority: 2,
    });

    console.log('✅ Workout share notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createWorkoutShareNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a mental session share notification
 * This is called when someone shares a mental session with friends
 */
export async function createMentalSessionShareNotification(fromUserId, toUserId, fromUserName, sessionTitle) {
  console.log('🧘‍♀️ ===== CREATING MENTAL SESSION SHARE NOTIFICATION =====');
  console.log('👤 From User ID:', fromUserId);
  console.log('👤 To User ID:', toUserId);
  console.log('📝 From User Name:', fromUserName);
  console.log('🧠 Session Title:', sessionTitle);
  
  try {
    const displayName = await getUserDisplayName(fromUserId, fromUserName);
    const safeSessionTitle = sessionTitle?.trim() || 'a mental session';
    const title = `${displayName} shared a mental session`;
    const message = `${safeSessionTitle} was shared`;

    const result = await createNotificationWithPush({
      toUserId,
      type: 'mental_session_share',
      title,
      message,
      data: {
        from_user_id: fromUserId,
        from_user_name: displayName,
        session_title: safeSessionTitle,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/mental',
      },
      priority: 2,
    });

    console.log('✅ Mental session share notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createMentalSessionShareNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create an achievement notification
 * This is called when a user achieves a milestone
 */
export async function createAchievementNotification(userId, achievementTitle, achievementDescription) {
  console.log('🏆 ===== CREATING ACHIEVEMENT NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('🏆 Achievement Title:', achievementTitle);
  console.log('📝 Achievement Description:', achievementDescription);
  
  try {
    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'achievement',
      title: 'Achievement Unlocked! 🎉',
      message: `You've earned: ${achievementTitle}`,
      data: {
        achievement_title: achievementTitle,
        achievement_description: achievementDescription,
      },
      isActionable: false,
      actionType: null,
      actionData: null,
      priority: 3,
    });

    console.log('✅ Achievement notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createAchievementNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a personal record notification
 * This is called when a user sets a new personal record
 */
export async function createPersonalRecordNotification(userId, recordType, recordValue) {
  console.log('🏆 ===== CREATING PERSONAL RECORD NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('📊 Record Type:', recordType);
  console.log('📈 Record Value:', recordValue);
  
  try {
    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'personal_record',
      title: 'New Personal Record! 🏆',
      message: `You set a new ${recordType} record: ${recordValue}`,
      data: {
        record_type: recordType,
        record_value: recordValue,
      },
      isActionable: false,
      actionType: null,
      actionData: null,
      priority: 3,
    });

    console.log('✅ Personal record notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createPersonalRecordNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a workout reminder notification
 * This is called to remind users to workout
 */
export async function createWorkoutReminderNotification(userId, userName) {
  console.log('💪 ===== CREATING WORKOUT REMINDER NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('👤 User Name:', userName);
  
  try {
    const displayName = userName?.trim() || 'friend';
    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'workout_reminder',
      title: 'Time to Workout! 💪',
      message: `Hey ${displayName}, ready to crush your fitness goals today?`,
      data: {
        reminder_type: 'workout',
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/workout',
        params: { tab: 'workout' },
      },
      priority: 2,
    });

    console.log('✅ Workout reminder notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createWorkoutReminderNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a mental session reminder notification
 * This is called to remind users to do mental exercises
 */
export async function createMentalReminderNotification(userId, userName) {
  console.log('🧘‍♀️ ===== CREATING MENTAL REMINDER NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('👤 User Name:', userName);
  
  try {
    const displayName = userName?.trim() || 'friend';
    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'mental_reminder',
      title: 'Mindful Moment 🧘‍♀️',
      message: `Hey ${displayName}, take a moment for your mental wellness today.`,
      data: {
        reminder_type: 'mental',
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/mental',
      },
      priority: 2,
    });

    console.log('✅ Mental reminder notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createMentalReminderNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a combined daily reminder notification for both workout and mental check-ins
 */
export async function createDailyReminderNotification(userId, userName, options = {}) {
  console.log('🗓️ ===== CREATING DAILY REMINDER NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('👤 User Name:', userName);
  console.log('🕒 Reminder Options:', options);

  try {
    const displayName = userName?.trim() || 'friend';
    const reminderTime = options.reminderTime || null;
    const formattedTime = reminderTime
      ? new Date(reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    const title = options.title || 'Daily BetterU Reminder';
    const message = options.message || (
      formattedTime
        ? `Hey ${displayName}, it's ${formattedTime}! Time for your daily workout and mental check-in.`
        : `Hey ${displayName}, it's time for your daily workout and mental check-in.`
    );

    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'daily_reminder',
      title,
      message,
      data: stripUndefined({
        reminder_time: reminderTime,
      }),
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/workout',
        params: { tab: 'workout' },
      },
      priority: 2,
    });

    console.log('✅ Daily reminder notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createDailyReminderNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a daily reminder notification that is motivation-aware.
 * Uses streak status and engagement level to choose a supportive message
 * (e.g. streak at risk → "Your streak is still alive — one activity today keeps it going").
 * Use this whenever you send a daily reminder (e.g. from a cron or when triggering a push).
 */
export async function createMotivationAwareDailyReminderNotification(userId, userName, options = {}) {
  console.log('🗓️ ===== CREATING MOTIVATION-AWARE DAILY REMINDER =====');
  console.log('👤 User ID:', userId);

  try {
    const displayName = userName?.trim() || 'friend';
    const reminderTime = options.reminderTime || null;
    let title = options.title || 'Daily BetterU Reminder';
    let message = options.message;
    let templateId = options.templateId || null;
    let state = options.state || null;

    // If caller didn't force a message, compute user state and pick a template.
    if (message == null) {
      const context = await getUserContext(userId);
      state = getUserState(context);
      const picked = selectNotificationTemplate({
        state,
        channel: 'push',
        displayName,
        streakStatus: context?.streakStatus,
        engagement: context?.engagement,
        progress: context?.progress,
      });
      templateId = picked.templateId;
      title = options.title || picked.title;
      message = picked.message;
    }

    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'daily_reminder',
      title,
      message,
      data: stripUndefined({
        reminder_time: reminderTime,
        // Analytics hooks:
        // - If you remove these, you lose the ability to measure which "state" messages improve retention.
        notification_state: state,
        notification_template_id: templateId,
        channel: 'push',
      }),
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/workout',
        params: { tab: 'workout' },
      },
      priority: 2,
    });

    console.log('✅ Motivation-aware daily reminder - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createMotivationAwareDailyReminderNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

export async function createMotivationAfterStreakFailureNotification(userId, userName) {
  console.log('💪 ===== CREATING MOTIVATION AFTER STREAK FAILURE NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('👤 User Name:', userName);

  try {
    const displayName = userName?.trim() || 'friend';
    const context = await getUserContext(userId);
    // A streak failure is, by definition, at least "offTrack_recent".
    const state = 'offTrack_recent';
    const picked = selectNotificationTemplate({
      state,
      channel: 'push',
      displayName,
      streakStatus: context?.streakStatus,
      engagement: context?.engagement,
      progress: context?.progress,
    });
    const title = picked.title;
    const message = picked.message;

    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'motivation_after_streak_failure',
      title,
      message,
      data: stripUndefined({
        notification_state: state,
        notification_template_id: picked.templateId,
        channel: 'push',
      }),
    });

    console.log('✅ Motivation after streak failure - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createMotivationAfterStreakFailureNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Send a gentle nudge notification (workout or run) from one user to another.
 */
export async function createNudgeNotification(fromUserId, toUserId, nudgeType = 'workout', fromUserName) {
  console.log('👊 ===== CREATING NUDGE NOTIFICATION =====');
  console.log('👤 From User ID:', fromUserId);
  console.log('👤 To User ID:', toUserId);
  console.log('🏷️ Nudge Type:', nudgeType);

  const normalizedType = ['run', 'mental'].includes(nudgeType) ? nudgeType : 'workout';
  const notificationType = normalizedType === 'run'
    ? 'nudge_run'
    : normalizedType === 'mental'
      ? 'nudge_mental'
      : 'nudge_workout';

  try {
    const displayName = await getUserDisplayName(fromUserId, fromUserName);

    const title = normalizedType === 'mental'
      ? `${displayName} wants a mental reset with you`
      : `${displayName} wants you to ${normalizedType}`;

    const message =
      normalizedType === 'run'
        ? 'Lace up! Your friend is ready for a run.'
        : normalizedType === 'mental'
          ? 'Take a breather together and recharge your mind.'
          : 'Time to get moving together!';

    const actionData = normalizedType === 'mental'
      ? { screen: '/(tabs)/mental' }
      : {
          screen: '/(tabs)/workout',
          params: { tab: normalizedType === 'run' ? 'run' : 'workout' },
        };

    const result = await createNotificationWithPush({
      toUserId,
      type: notificationType,
      title,
      message,
      data: {
        from_user_id: fromUserId,
        from_user_name: displayName,
        nudge_type: normalizedType,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData,
      priority: 2,
    });

    console.log('✅ Nudge notification completed - Notification ID:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('❌ Error in createNudgeNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a team join request notification
 * This is called when someone requests to join a team
 * Sends notification to team owners/admins
 */
export async function createTeamJoinRequestNotification(
  toUserId, // Team owner/admin to notify
  requesterId, // User who requested to join
  teamId,
  teamName,
  requesterName
) {
  console.log('👥 ===== CREATING TEAM JOIN REQUEST NOTIFICATION =====');
  console.log('👤 To User ID (owner/admin):', toUserId);
  console.log('👤 Requester ID:', requesterId);
  console.log('🏆 Team ID:', teamId);
  console.log('📝 Team Name:', teamName);
  
  try {
    const displayName = await getUserDisplayName(requesterId, requesterName);
    const title = 'New Join Request';
    const message = `${displayName} wants to join ${teamName || 'your team'}`;

    const result = await createNotificationWithPush({
      toUserId, // Send to team owner/admin
      type: 'team_join_request',
      title,
      message,
      data: {
        team_id: teamId,
        team_name: teamName,
        requester_id: requesterId,
        requester_name: displayName,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/league/manage-team/' + teamId,
        params: { tab: 'requests' },
      },
      priority: 2,
    });

    console.log('✅ Team join request notification completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in createTeamJoinRequestNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a team join request accepted notification
 * This is called when a team accepts a join request
 * Note: Database trigger handles this automatically
 */
export async function createTeamJoinRequestAcceptedNotification(userId, teamId, teamName) {
  console.log('🎉 ===== CREATING TEAM JOIN REQUEST ACCEPTED NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('🏆 Team ID:', teamId);
  console.log('📝 Team Name:', teamName);
  
  try {
    const title = 'Join Request Accepted! 🎉';
    const message = `${teamName || 'A team'} has accepted your join request!`;

    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'team_join_request_accepted',
      title,
      message,
      data: {
        team_id: teamId,
        team_name: teamName,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/league/team/' + teamId,
      },
      priority: 2,
    });

    console.log('✅ Team join request accepted notification completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in createTeamJoinRequestAcceptedNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a team trophy awarded notification
 * This is called when a team wins trophies in a challenge
 * Note: Database trigger handles this automatically when award_challenge_trophies is called
 */
export async function createTeamTrophyAwardedNotification(
  userId, 
  teamId, 
  teamName, 
  challengeName, 
  rank, 
  trophiesEarned
) {
  console.log('🏆 ===== CREATING TEAM TROPHY AWARDED NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('🏆 Team ID:', teamId);
  console.log('📊 Rank:', rank);
  console.log('🏅 Trophies:', trophiesEarned);
  
  try {
    const rankText = rank === 1 ? '1st place' : 
                     rank === 2 ? '2nd place' : 
                     rank === 3 ? '3rd place' : 
                     rank + 'th place';
    
    const title = rank === 1 ? '🏆 Your Team Won!' :
                  rank <= 3 ? '🎉 Your Team Placed!' :
                  '🏅 Challenge Complete!';
    
    const message = `${teamName || 'Your team'} finished ${rankText} in ${challengeName || 'the challenge'} and earned ${trophiesEarned} trophies!`;

    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'team_trophy_awarded',
      title,
      message,
      data: {
        team_id: teamId,
        team_name: teamName,
        challenge_name: challengeName,
        rank: rank,
        trophies_earned: trophiesEarned,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/league/team/' + teamId,
      },
      priority: 3, // High priority for trophy awards
    });

    console.log('✅ Team trophy awarded notification completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in createTeamTrophyAwardedNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Create a team challenge started notification
 * This is called when a new challenge begins
 * Note: Database trigger handles this automatically
 */
export async function createTeamChallengeStartedNotification(
  userId, 
  challengeId, 
  challengeName, 
  challengeType
) {
  console.log('🎯 ===== CREATING TEAM CHALLENGE STARTED NOTIFICATION =====');
  console.log('👤 User ID:', userId);
  console.log('🎯 Challenge ID:', challengeId);
  console.log('📝 Challenge Name:', challengeName);
  
  try {
    const title = 'New Challenge Started! 🎯';
    const message = `${challengeName || 'A new challenge'} has begun! Start working out to earn trophies for your team.`;

    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'team_challenge_started',
      title,
      message,
      data: {
        challenge_id: challengeId,
        challenge_name: challengeName,
        challenge_type: challengeType,
      },
      isActionable: true,
      actionType: 'navigate',
      actionData: {
        screen: '/(tabs)/community',
        params: { tab: 'league' },
      },
      priority: 2,
    });

    console.log('✅ Team challenge started notification completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in createTeamChallengeStartedNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/**
 * Test push notification function
 * Use this to test if push notifications are working
 */
export async function testPushNotification(userId, message = 'Test notification from BetterU!') {
  console.log('🧪 ===== TEST PUSH NOTIFICATION FUNCTION STARTED =====');
  console.log('👤 User ID:', userId);
  console.log('💬 Message:', message);
  
  try {
    const result = await createNotificationWithPush({
      toUserId: userId,
      type: 'like',
      title: 'Test Notification',
      message,
      data: {
        test: true,
      },
      isActionable: false,
      actionType: null,
      actionData: null,
      priority: 1,
    });

    console.log('Test notification created:', result.notificationId, 'Push sent:', result.pushSent);
    return result;
  } catch (error) {
    console.error('Error in testPushNotification:', error);
    return { notificationId: null, pushSent: false, error };
  }
}

/* 
 * HOW TO USE THESE FUNCTIONS:
 * 
 * 1. Import the function you need:
 *    import { createLikeNotification } from '../utils/notificationHelpers';
 * 
 * 2. Call it with the required parameters:
 *    await createLikeNotification(fromUserId, toUserId, fromUserName, 'run', runId);
 * 
 * 3. The function will:
 *    - Create the notification in your database
 *    - The database trigger will automatically send a push notification
 *    - The user will receive the notification on their device
 * 
 * EXAMPLE USAGE:
 * 
 * // When someone likes a run:
 * await createLikeNotification(
 *   currentUser.id,           // Who liked it
 *   runOwner.id,             // Who owns the run
 *   currentUser.username,    // Display name
 *   'run',                   // Type of item
 *   runId                    // ID of the run
 * );
 * 
 * // When someone shares a workout:
 * await createWorkoutShareNotification(
 *   currentUser.id,          // Who shared it
 *   friend.id,               // Who to notify
 *   currentUser.username,    // Display name
 *   workout.name             // Workout name
 * );
 */
