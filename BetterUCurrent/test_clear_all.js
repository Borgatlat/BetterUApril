// Test the Clear All functionality
// This is just for reference - the actual implementation is in NotificationModal.js

// The Clear All button will:
// 1. Show only when there are notifications (notifications.length > 0)
// 2. Display a confirmation alert before clearing
// 3. Call clearNotifications() from the context
// 4. Clear all notifications from the database and local state

// Button appears in header with red text "Clear All"
// Alert shows: "Clear All Notifications" with message "Are you sure you want to delete all notifications? This action cannot be undone."
// Options: Cancel (cancel style) and Clear All (destructive style)

// The clearNotifications function in NotificationContext.js:
// - Deletes all notifications for the current user from the database
// - Resets local state (notifications array and unreadCount)
// - Handles errors gracefully 