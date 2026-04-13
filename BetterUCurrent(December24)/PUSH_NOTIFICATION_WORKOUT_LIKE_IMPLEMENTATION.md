# Push Notification Implementation for Workout Likes - Technical Rundown

## Overview
This document explains the complete flow of how push notifications are sent when someone likes a workout (or any other activity type: run, mental session, PR).

---

## Complete Flow Diagram

```
User A clicks "Like" on User B's workout
    ↓
FeedCard.handleKudos() called
    ↓
Insert into workout_kudos table
    ↓
Check if User A ≠ User B (don't notify self)
    ↓
Fetch User A's profile (username/full_name)
    ↓
Call createLikeNotification()
    ↓
┌─────────────────────────────────────┐
│ Step 1: Create notification in DB   │
│ via create_notification RPC         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Step 2: Send push notification      │
│ via sendPushNotificationDirectly()  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Step 3: Edge Function sends to Expo │
│ via send-push-notification function │
└─────────────────────────────────────┘
    ↓
Expo Push Service → APNs/FCM → User B's Device
```

---

## Step-by-Step Implementation Details

### STEP 1: User Likes a Workout (Frontend)

**File:** `app/components/FeedCard.js`

**Function:** `handleKudos()` (lines 178-273)

**What happens:**
1. User clicks the heart/kudos button on a workout card
2. Optimistic UI update (immediately shows liked state)
3. Checks if kudos already exists in `workout_kudos` table
4. If exists: Deletes it (unlike)
5. If not exists: Inserts new row into `workout_kudos` table

**Key Code:**
```javascript
// Insert kudos into database
const { error: insertError } = await supabase
  .from('workout_kudos')  // Table name
  .insert([{
    workout_id: targetId,  // The workout being liked
    user_id: currentUserId  // The user who liked it
  }]);
```

**Important Check:**
```javascript
// Only send notification if user is not liking their own post
if (currentUserId !== userId) {
  // Continue with notification...
}
```

---

### STEP 2: Fetch User Profile for Notification

**File:** `app/components/FeedCard.js` (lines 239-244)

**What happens:**
- Fetches the liker's (User A's) profile to get their display name
- Used in the notification message: "John liked your workout!"

**Key Code:**
```javascript
const { data: currentUserProfile } = await supabase
  .from('profiles')
  .select('username, full_name')
  .eq('id', currentUserId)
  .single();

const kudosGiverName = currentUserProfile.username || currentUserProfile.full_name;
```

---

### STEP 3: Create Notification in Database

**File:** `utils/notificationHelpers.js`

**Function:** `createLikeNotification()` (lines 195-259)

**What happens:**
1. Calls Supabase RPC function `create_notification` to insert notification record
2. This function has `SECURITY DEFINER` so it bypasses RLS
3. Returns the notification ID (UUID)

**Key Code:**
```javascript
const { data, error } = await supabase.rpc('create_notification', {
  p_user_id: toUserId,  // User B (workout owner) - receives notification
  p_type: 'like',
  p_title: 'Someone liked your post! ❤️',
  p_message: `${fromUserName} liked your ${itemType}!`,  // e.g., "John liked your workout!"
  p_data: {
    from_user_id: fromUserId,
    from_user_name: fromUserName,
    item_type: itemType,  // 'workout', 'run', 'mental', 'pr'
    item_id: itemId,
    action_type: 'like'
  },
  p_is_actionable: true,
  p_action_type: 'navigate',
  p_action_data: {
    screen: 'activity',
    item_id: itemId
  },
  p_priority: 1  // Low priority (1-3 scale)
});
```

**Database Function:**
- **File:** `supabase/migrations/202403220000XX_create_notifications_table.sql`
- **Function:** `create_notification()` (lines 170-213)
- **Returns:** UUID of the created notification
- **Security:** Uses `SECURITY DEFINER` to bypass RLS policies

---

### STEP 4: Send Push Notification

**File:** `utils/notificationHelpers.js`

**Function:** `sendPushNotificationDirectly()` (lines 18-91)

**What happens:**
1. Fetches User B's profile to get their push token and preferences
2. Validates user has push notifications enabled
3. Validates user hasn't disabled "like" notifications
4. Calls Supabase Edge Function `send-push-notification`

**Validation Checks:**
```javascript
// Check 1: User has push notifications enabled
if (!profile.push_notifications_enabled || !profile.push_token) {
  return false;  // Abort if disabled or no token
}

// Check 2: User hasn't disabled this notification type
const notificationTypeEnabled = profile.notification_preferences?.['like'] !== false;
if (!notificationTypeEnabled) {
  return false;  // Abort if user disabled like notifications
}
```

**Edge Function Call:**
```javascript
const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    token: profile.push_token,  // User B's Expo push token
    title: 'Someone liked your post! ❤️',
    body: `${fromUserName} liked your ${itemType}!`,
    data: {
      from_user_id: fromUserId,
      from_user_name: fromUserName,
      item_type: itemType,
      item_id: itemId,
      action_type: 'like',
      notification_id: data,  // The UUID from step 3
      is_test: itemId.startsWith('test-')
    },
    type: 'like',
    priority: 1,
    notification_id: data,
    user_id: userId
  }
});
```

---

### STEP 5: Edge Function Processes Push Notification

**File:** `supabase/functions/send-push-notification/index.ts`

**What happens:**
1. Receives POST request with notification data
2. Validates required fields (token, title, body)
3. Determines notification priority based on database priority (1-3 scale)
4. Formats message for Expo Push Notification Service
5. Sends HTTP POST to Expo's API endpoint

**Key Code:**
```typescript
// Create Expo push message
const pushMessage: ExpoPushMessage = {
  to: notificationData.token,  // Expo push token
  title: notificationData.title,
  body: notificationData.body,
  data: {
    ...notificationData.data,
    notification_id: notificationData.notification_id,
    user_id: notificationData.user_id,
    type: notificationData.type
  },
  sound: 'default',
  priority: expoPriority,  // 'default', 'normal', or 'high'
  ttl: 86400  // 24 hours - how long to keep if device offline
};

// Send to Expo
const response = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(pushMessage),
});
```

**Priority Mapping:**
- Database priority 3+ → Expo priority 'high'
- Database priority 2 → Expo priority 'normal'
- Database priority 1 → Expo priority 'default'

---

### STEP 6: Expo Push Service → Device

**What happens:**
1. Expo receives the push notification request
2. Expo routes to appropriate service:
   - **iOS:** Apple Push Notification Service (APNs)
   - **Android:** Firebase Cloud Messaging (FCM)
3. Service delivers notification to user's device
4. Device displays notification

**Note:** This step is handled entirely by Expo's infrastructure. No custom code needed.

---

## Database Tables Involved

### 1. `workout_kudos` Table
- Stores which users liked which workouts
- Columns: `id`, `workout_id`, `user_id`, `created_at`
- Used to track likes and prevent duplicate notifications

### 2. `notifications` Table
- Stores all notifications (in-app notifications)
- Columns: `id`, `user_id`, `type`, `title`, `message`, `data`, `is_actionable`, `action_type`, `action_data`, `priority`, `read`, `created_at`
- Notification type for likes: `type = 'like'`

### 3. `profiles` Table
- Stores user push tokens and preferences
- Columns: `id`, `push_token`, `push_notifications_enabled`, `notification_preferences`
- `push_token`: Expo push token (e.g., "ExponentPushToken[...]")
- `push_notifications_enabled`: Boolean flag
- `notification_preferences`: JSONB object with per-type preferences (e.g., `{ "like": true, "comment": false }`)

---

## Push Token Management

**File:** `utils/pushNotifications.js`

**How tokens are stored:**
1. User opens app and grants notification permissions
2. App calls `Notifications.getExpoPushTokenAsync()` to get token
3. Token stored in `profiles.push_token` via `storePushToken()` function
4. Token format: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`

**Token Storage:**
```javascript
await supabase
  .from('profiles')
  .update({
    push_token: token,
    push_notifications_enabled: true
  })
  .eq('id', userId);
```

---

## Error Handling

### Notification Creation Errors
- If `create_notification` RPC fails → Logs error, returns `false`
- Notification is not created, but kudos insertion still succeeds

### Push Notification Errors
- If user has no push token → Returns `false`, no push sent
- If user disabled notifications → Returns `false`, no push sent
- If Edge Function call fails → Logs error, returns `false`
- If Expo API fails → Edge Function logs error, returns error response

**Important:** Push notification failures are logged but don't prevent the like from being saved or the in-app notification from being created.

---

## Notification Preferences

Users can disable specific notification types via `notification_preferences` JSONB field:

```json
{
  "like": true,
  "comment": true,
  "friend_request": true,
  "workout_share": false
}
```

If `notification_preferences.like === false`, push notifications for likes are not sent.

---

## Testing

To test push notifications for likes:

1. **Ensure both users have push tokens:**
   - Both users must have granted notification permissions
   - Both users must have `push_token` set in their profiles
   - Both users must have `push_notifications_enabled = true`

2. **Test the flow:**
   - User A likes User B's workout
   - Check console logs for notification creation
   - Check console logs for push notification sending
   - User B should receive push notification on their device

3. **Check notification in database:**
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'like' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

---

## Key Points for ChatGPT Verification

1. **Two-step process:** Notification is created in DB first, then push is sent separately
2. **Self-like prevention:** No notification if user likes their own post
3. **Token validation:** Checks for push token and enabled status before sending
4. **Preference checking:** Respects user's notification preferences
5. **Error resilience:** Push failures don't break the like functionality
6. **RPC function:** Uses `create_notification` RPC with `SECURITY DEFINER` to bypass RLS
7. **Edge Function:** Uses Supabase Edge Function to call Expo's API
8. **Expo service:** Expo handles delivery to iOS/Android via APNs/FCM
9. **Priority system:** Database priority (1-3) maps to Expo priority levels
10. **Data payload:** Notification includes metadata for deep linking (item_id, item_type, etc.)

---

## Files Involved

1. **Frontend:**
   - `app/components/FeedCard.js` - Handles like button click and calls notification
   - `utils/notificationHelpers.js` - Creates notification and sends push
   - `utils/pushNotifications.js` - Manages push token registration

2. **Backend:**
   - `supabase/functions/send-push-notification/index.ts` - Edge Function that sends to Expo
   - `supabase/migrations/202403220000XX_create_notifications_table.sql` - Database schema and RPC function

3. **Database Tables:**
   - `workout_kudos` - Stores likes
   - `notifications` - Stores in-app notifications
   - `profiles` - Stores push tokens and preferences

