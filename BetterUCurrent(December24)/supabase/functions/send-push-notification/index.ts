/**
 * Supabase Edge Function: Send Push Notification
 * 
 * This function receives notification data from our database trigger
 * and sends actual push notifications to user devices.
 * 
 * Think of this as a "notification delivery service" that takes
 * the notification from your database and delivers it to the user's phone.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Expo's push notification service endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// Define the structure of our notification data
interface NotificationData {
  token: string
  title: string
  body: string
  data?: any
  type: string
  priority: number
  notification_id: string
  user_id: string
}

// Define the Expo push notification payload structure
interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: any
  sound?: string
  badge?: number
  priority?: 'default' | 'normal' | 'high'
  ttl?: number
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse the notification data from the request
    const notificationData: NotificationData = await req.json()
    
    console.log('Received push notification request:', notificationData)

    // Validate required fields
    if (!notificationData.token || !notificationData.title || !notificationData.body) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: token, title, or body' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Determine notification priority based on database priority
    let expoPriority: 'default' | 'normal' | 'high' = 'default'
    if (notificationData.priority >= 3) {
      expoPriority = 'high'
    } else if (notificationData.priority >= 2) {
      expoPriority = 'normal'
    }

    // Determine sound based on notification type
    let sound = 'default'
    switch (notificationData.type) {
      case 'friend_request':
      case 'friend_request_accepted':
        sound = 'default' // Social notifications
        break
      case 'like':
      case 'comment':
        sound = 'default' // Engagement notifications
        break
      case 'achievement':
      case 'personal_record':
        sound = 'default' // Achievement notifications
        break
      case 'workout_reminder':
      case 'mental_reminder':
        sound = 'default' // Reminder notifications
        break
      case 'team_join_request':
      case 'team_join_request_accepted':
      case 'team_invitation':
      case 'team_invitation_accepted':
        sound = 'default' // Team social notifications
        break
      case 'team_trophy_awarded':
        sound = 'default' // Trophy awards (high priority)
        break
      case 'team_challenge_started':
      case 'team_rank_changed':
        sound = 'default' // Challenge updates
        break
      case 'app_message':
        sound = 'default' // Admin messages (important)
        break
      default:
        sound = 'default'
    }

    // Create the Expo push message
    const pushMessage: ExpoPushMessage = {
      to: notificationData.token,
      title: notificationData.title,
      body: notificationData.body,
      data: {
        ...notificationData.data,
        notification_id: notificationData.notification_id,
        user_id: notificationData.user_id,
        type: notificationData.type
      },
      sound,
      priority: expoPriority,
      ttl: 86400, // 24 hours - how long the notification should be kept if device is offline
    }

    console.log('Sending push notification:', pushMessage)

    // Send the push notification via Expo's service
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessage),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Failed to send push notification:', responseData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send push notification',
          details: responseData
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Push notification sent successfully:', responseData)

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Push notification sent successfully',
        receipt_id: responseData.data?.[0]?.id
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

/* 
 * EXPLANATION OF HOW THIS WORKS:
 * 
 * 1. Database Trigger: When a new notification is created in your database,
 *    the trigger calls this Edge Function
 * 
 * 2. Edge Function: This function receives the notification data and
 *    formats it into the correct structure for Expo's push service
 * 
 * 3. Expo Service: Expo's servers handle the actual delivery to
 *    iOS/Android devices using Apple Push Notification Service (APNs)
 *    and Firebase Cloud Messaging (FCM)
 * 
 * 4. Device: The user's device receives and displays the notification
 * 
 * This creates a complete push notification pipeline from your database
 * to the user's device!
 */
