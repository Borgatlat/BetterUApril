# Push Notifications Setup Guide 📱

This guide will walk you through setting up push notifications for your BetterU app using Expo and Supabase.

## Overview

Your push notification system works like this:
1. **User grants permission** → App gets device token
2. **Token stored** in Supabase user profile  
3. **New notification created** in database → **Trigger fires**
4. **Supabase Edge Function** sends push notification
5. **User receives notification** on device

## Prerequisites

- ✅ Expo project with `expo-notifications` installed
- ✅ Supabase project set up
- ✅ Physical device for testing (push notifications don't work on simulators)

## Step 1: Update Your Supabase Database

Run the SQL file to add push notification support to your database:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase_push_notifications_setup.sql
```

This will:
- Add `push_token` and `push_notifications_enabled` columns to your profiles table
- Create notification preferences structure
- Set up database triggers to automatically send push notifications
- Create helper functions for managing notification preferences

## Step 2: Deploy Supabase Edge Function

1. **Create the Edge Function directory structure:**
   ```
   supabase/
   └── functions/
       └── send-push-notification/
           └── index.ts
   ```

2. **Deploy the Edge Function:**
   ```bash
   # Install Supabase CLI if you haven't already
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link your project
   supabase link --project-ref your-project-id

   # Deploy the function
   supabase functions deploy send-push-notification
   ```

3. **Update the SQL trigger with your actual Supabase URL:**
   - Replace `your-project-url` in `supabase_push_notifications_setup.sql` with your actual Supabase URL
   - Run the updated SQL in your Supabase SQL Editor

## Step 3: Update Your App Configuration

Your `app.config.js` has been updated to include the expo-notifications plugin:

```javascript
plugins: [
  // ... other plugins
  [
    "expo-notifications",
    {
      "icon": "./assets/images/betterumobile.png",
      "color": "#00ffff",
      "defaultChannel": "default"
    }
  ],
  // ... other plugins
]
```

## Step 4: Test Push Notifications

### Option 1: Test with Notification Helpers

Use the helper functions to create test notifications:

```javascript
import { createLikeNotification } from '../utils/notificationHelpers';

// Test like notification
await createLikeNotification(
  currentUser.id,           // Who liked it
  targetUser.id,           // Who owns the item
  currentUser.username,    // Display name
  'run',                   // Type of item
  runId                    // ID of the item
);
```

### Option 2: Test Directly in Supabase

Create a test notification directly in your Supabase dashboard:

```sql
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  data,
  priority
) VALUES (
  'your-user-id-here',
  'like',
  'Test Notification',
  'This is a test push notification!',
  '{"test": true}',
  2
);
```

## Step 5: Handle Notification Responses

When users tap on notifications, you can handle the response in your app:

```javascript
// In your NotificationContext, the response handler is already set up
// You can extend it to navigate to specific screens:

const handleNotificationResponse = async (response) => {
  const notificationType = response?.notification?.request?.content?.data?.type;
  
  switch (notificationType) {
    case 'friend_request':
      router.push('/friends');
      break;
    case 'like':
      router.push(`/activity/${response.notification.request.content.data.item_id}`);
      break;
    case 'workout_share':
      router.push('/shared-workouts');
      break;
    // Add more cases as needed
  }
};
```

## Step 6: Customize Notification Preferences

Users can customize which notifications they receive:

```javascript
// Update user's notification preferences
const { error } = await supabase.rpc('update_notification_preferences', {
  user_id: userId,
  preferences: {
    friend_requests: true,
    likes: false,  // User doesn't want like notifications
    comments: true,
    workout_shares: true,
    // ... other preferences
  }
});
```

## Troubleshooting

### Push notifications not working?

1. **Check device permissions:** Make sure the user granted notification permissions
2. **Verify token storage:** Check that the push token is stored in the user's profile
3. **Check Edge Function logs:** Look at Supabase Edge Function logs for errors
4. **Test on physical device:** Push notifications don't work on simulators
5. **Verify project ID:** Make sure your Expo project ID is correct in `pushNotifications.js`

### Common Issues

**"Failed to get push token"**
- Make sure you're testing on a physical device
- Check that notification permissions are granted
- Verify your Expo project ID is correct

**"Edge Function not found"**
- Make sure you deployed the Edge Function correctly
- Check that the URL in the database trigger matches your Supabase URL

**"Notifications not triggering"**
- Check that the database trigger is created
- Verify that the Edge Function is deployed
- Look at database logs for trigger execution

## Notification Types Available

Your app supports these notification types:

- `friend_request` - When someone sends a friend request
- `friend_request_accepted` - When a friend request is accepted  
- `like` - When someone likes your content
- `comment` - When someone comments on your content
- `workout_share` - When someone shares a workout
- `mental_session_share` - When someone shares a mental session
- `achievement` - When you unlock an achievement
- `personal_record` - When you set a new personal record
- `workout_reminder` - Reminder to workout
- `mental_reminder` - Reminder for mental wellness

## Next Steps

1. **Deploy the Edge Function** to your Supabase project
2. **Run the SQL setup** in your Supabase database
3. **Test with a physical device** to verify everything works
4. **Integrate notification helpers** into your existing features (likes, shares, etc.)
5. **Add notification preferences** to your settings screen

## Files Created/Modified

- ✅ `utils/pushNotifications.js` - Push notification service
- ✅ `utils/notificationHelpers.js` - Helper functions for different notification types
- ✅ `context/NotificationContext.js` - Updated to initialize push notifications
- ✅ `app.config.js` - Added expo-notifications plugin
- ✅ `supabase/functions/send-push-notification/index.ts` - Edge Function
- ✅ `supabase_push_notifications_setup.sql` - Database setup

Your push notification system is now ready! 🎉
