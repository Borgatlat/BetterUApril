// Test Friend Request and Comment Notifications
// This file documents how to test the notifications

// FRIEND REQUEST NOTIFICATIONS:
// 1. Log in as user A (e.g., donald)
// 2. Go to Suggested Friends
// 3. Find user B (e.g., goggins) in the list
// 4. Tap the "Add Friend" button
// 5. Check that user B receives a notification: "donald wants to be your friend!"
// 6. The notification should navigate to Community → Friends tab when tapped

// COMMENT NOTIFICATIONS:
// 1. Log in as user A (e.g., donald)
// 2. Go to Community → Feed
// 3. Find a post from user B (e.g., goggins)
// 4. Tap the comment button on the post
// 5. Add a comment
// 6. Check that user B receives a notification: "donald commented on your workout!"
// 7. The notification should navigate to the CommentsScreen when tapped

// NOTIFICATION FEATURES:
// - Both notifications use the correct user_id to send to the right person
// - Friend requests have priority 2 (medium)
// - Comments have priority 1 (low)
// - Both include action data for navigation
// - Both include relevant data in the notification payload

// TESTING TIPS:
// - Use different users to test cross-user notifications
// - Check that notifications don't appear when commenting on your own posts
// - Verify the notification modal shows the correct icons and colors
// - Test that tapping notifications navigates to the correct screens 