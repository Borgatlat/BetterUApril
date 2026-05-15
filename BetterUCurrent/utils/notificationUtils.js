import { useNotifications } from '../context/NotificationContext';

// Helper function to create notifications with consistent formatting
export const createNotificationHelper = (notificationContext, notificationData) => {
  return notificationContext.createNotification({
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    data: notificationData.data || {},
    is_actionable: notificationData.is_actionable !== false,
    action_type: notificationData.action_type || null,
    action_data: notificationData.action_data || {},
    priority: notificationData.priority || 1,
    expires_at: notificationData.expires_at || null
  });
};

// Predefined notification creators for common scenarios
export const notificationCreators = {
  // Friend-related notifications
  friendRequest: (senderName) => ({
    type: 'friend_request',
    title: 'New Friend Request',
    message: `${senderName} wants to be your friend!`,
    data: { sender_name: senderName },
    action_type: 'navigate',
    action_data: { screen: '/(tabs)/community', params: { tab: 'friends' } },
    priority: 2
  }),

  friendRequestAccepted: (friendName) => ({
    type: 'friend_request_accepted',
    title: 'Friend Request Accepted',
    message: `${friendName} accepted your friend request!`,
    data: { friend_name: friendName },
    action_type: 'navigate',
    action_data: { screen: '/(tabs)/community', params: { tab: 'friends' } },
    priority: 1
  }),

  // Comment notifications
  commentOnPost: (commenterName, postType) => ({
    type: 'comment',
    title: 'New Comment',
    message: `${commenterName} commented on your ${postType}`,
    data: { commenter_name: commenterName, post_type: postType },
    action_type: 'navigate',
    action_data: { screen: '/(modals)/CommentsScreen' },
    priority: 2
  }),

  // Group notifications
  groupInvitation: (groupName, inviterName) => ({
    type: 'group_invitation',
    title: 'Group Invitation',
    message: `${inviterName} invited you to join "${groupName}"`,
    data: { group_name: groupName, inviter_name: inviterName },
    action_type: 'navigate',
    action_data: { screen: '/(tabs)/community', params: { tab: 'groups' } },
    priority: 2
  }),

  // Goal completion notifications
  goalCompletion: (goalType, value) => ({
    type: 'goal_completion',
    title: 'Goal Achieved! 🎉',
    message: `Congratulations! You've reached your daily ${goalType} goal of ${value}`,
    data: { goal_type: goalType, value },
    priority: 3
  }),

  // Streak notifications
  streakMilestone: (days, type = 'workout') => ({
    type: 'streak_milestone',
    title: 'Streak Milestone! 🔥',
    message: `Amazing! You've completed ${days} days of ${type} in a row!`,
    data: { days, type },
    priority: 3
  }),

  // Achievement notifications
  achievement: (achievementName, description) => ({
    type: 'achievement',
    title: 'Achievement Unlocked! 🏆',
    message: `${achievementName}: ${description}`,
    data: { achievement_name: achievementName, description },
    priority: 3
  }),

  // Personal record notifications
  personalRecord: (exercise, weight, reps) => ({
    type: 'personal_record',
    title: 'New Personal Record! 💪',
    message: `New PR: ${weight}lbs x ${reps} reps on ${exercise}`,
    data: { exercise, weight, reps },
    priority: 3
  }),

  // Reminder notifications
  workoutReminder: () => ({
    type: 'workout_reminder',
    title: 'Workout Time! 💪',
    message: "It's time for your daily workout. Let's crush those goals!",
    action_type: 'navigate',
    action_data: { screen: '/(tabs)/workout' },
    priority: 2
  }),

  mentalReminder: () => ({
    type: 'mental_reminder',
    title: 'Mental Wellness Check 🧘‍♀️',
    message: 'Take a moment to check in with yourself. How are you feeling today?',
    action_type: 'navigate',
    action_data: { screen: '/(tabs)/mental' },
    priority: 2
  }),

  hydrationReminder: () => ({
    type: 'hydration_reminder',
    title: 'Stay Hydrated! 💧',
    message: "Don't forget to drink water. Your body needs it!",
    priority: 1
  }),

  // Progress notifications
  weeklyProgress: (workouts, minutes) => ({
    type: 'weekly_progress',
    title: 'Weekly Progress Report 📊',
    message: `Great week! You completed ${workouts} workouts and logged ${minutes} minutes of activity.`,
    data: { workouts, minutes },
    priority: 1
  }),

  // AI recommendation notifications
  aiRecommendation: (type, description) => ({
    type: 'ai_recommendation',
    title: 'AI Recommendation 🤖',
    message: description,
    data: { recommendation_type: type },
    priority: 1
  }),

  // Motivational notifications
  motivationalQuote: (quote, author) => ({
    type: 'motivational_quote',
    title: 'Daily Motivation 💫',
    message: `"${quote}" - ${author}`,
    data: { quote, author },
    priority: 1
  }),

  // Community notifications
  communityHighlight: (highlight) => ({
    type: 'community_highlight',
    title: 'Community Highlight 🌟',
    message: highlight,
    priority: 1
  }),

  // Challenge notifications
  challengeInvitation: (challengeName, challengerName) => ({
    type: 'challenge_invitation',
    title: 'Challenge Invitation! 🏆',
    message: `${challengerName} has challenged you to "${challengeName}"`,
    data: { challenge_name: challengeName, challenger_name: challengerName },
    priority: 2
  }),

  // Leaderboard notifications
  leaderboardUpdate: (position, category) => ({
    type: 'leaderboard_update',
    title: 'Leaderboard Update 📈',
    message: `You're now #${position} in ${category}! Keep up the great work!`,
    data: { position, category },
    priority: 1
  }),

  // Points and rewards
  pointsEarned: (points, reason) => ({
    type: 'points_earned',
    title: 'Points Earned! 🎁',
    message: `You earned ${points} points for ${reason}`,
    data: { points, reason },
    priority: 1
  }),

  levelUp: (newLevel) => ({
    type: 'level_up',
    title: 'Level Up! ⬆️',
    message: `Congratulations! You've reached level ${newLevel}`,
    data: { new_level: newLevel },
    priority: 2
  }),

  // System notifications
  syncStatus: (status) => ({
    type: 'sync_status',
    title: 'Sync Status',
    message: `Your data has been ${status}`,
    data: { status },
    priority: 1
  }),

  appUpdate: (version) => ({
    type: 'app_update',
    title: 'App Update Available',
    message: `Version ${version} is now available with new features!`,
    data: { version },
    priority: 1
  }),

  premiumFeature: (featureName) => ({
    type: 'premium_feature',
    title: 'Premium Feature Available',
    message: `Try ${featureName} with Premium!`,
    data: { feature_name: featureName },
    action_type: 'navigate',
    action_data: { screen: '/(tabs)/settings' },
    priority: 2
  })
};

// Hook to easily create notifications
export const useNotificationCreator = () => {
  const notificationContext = useNotifications();

  const createNotification = (notificationData) => {
    return createNotificationHelper(notificationContext, notificationData);
  };

  const createTypedNotification = (type, data) => {
    const creator = notificationCreators[type];
    if (!creator) {
      console.error(`Unknown notification type: ${type}`);
      return null;
    }

    const notificationData = creator(data);
    return createNotification(notificationData);
  };

  return {
    createNotification,
    createTypedNotification,
    notificationCreators
  };
};

// Utility function to create notifications for specific events
export const createEventNotifications = {
  // When a user completes a workout
  workoutCompleted: async (notificationContext, workoutData) => {
    const { duration, exercises } = workoutData;
    
    // Create workout completion notification
    await createNotificationHelper(notificationContext, {
      type: 'achievement',
      title: 'Workout Complete! 💪',
      message: `Great job! You completed a ${duration} minute workout with ${exercises.length} exercises.`,
      data: { duration, exercise_count: exercises.length },
      priority: 2
    });

    // Check for streak milestones
    // This would be called after updating user stats
  },

  // When a user reaches a goal
  goalReached: async (notificationContext, goalData) => {
    const { type, value, goal } = goalData;
    
    await createNotificationHelper(notificationContext, {
      type: 'goal_completion',
      title: 'Goal Achieved! 🎉',
      message: `Congratulations! You've reached your daily ${type} goal of ${value}/${goal}`,
      data: { goal_type: type, value, goal },
      priority: 3
    });
  },

  // When a user sets a new PR
  personalRecordSet: async (notificationContext, prData) => {
    const { exercise, weight, reps, previousPR } = prData;
    
    await createNotificationHelper(notificationContext, {
      type: 'personal_record',
      title: 'New Personal Record! 💪',
      message: `New PR: ${weight}lbs x ${reps} reps on ${exercise}`,
      data: { exercise, weight, reps, previous_pr: previousPR },
      priority: 3
    });
  },

  // When a user receives a friend request
  friendRequestReceived: async (notificationContext, requestData) => {
    const { senderName, senderId } = requestData;
    
    await createNotificationHelper(notificationContext, {
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${senderName} wants to be your friend!`,
      data: { sender_name: senderName, sender_id: senderId },
      action_type: 'navigate',
      action_data: { screen: '/(tabs)/community', params: { tab: 'friends' } },
      priority: 2
    });
  },

  // When a user's friend request is accepted
  friendRequestAccepted: async (notificationContext, acceptData) => {
    const { friendName, friendId } = acceptData;
    
    await createNotificationHelper(notificationContext, {
      type: 'friend_request_accepted',
      title: 'Friend Request Accepted',
      message: `${friendName} accepted your friend request!`,
      data: { friend_name: friendName, friend_id: friendId },
      action_type: 'navigate',
      action_data: { screen: '/(tabs)/community', params: { tab: 'friends' } },
      priority: 1
    });
  },

  // When someone comments on a user's post
  commentReceived: async (notificationContext, commentData) => {
    const { commenterName, postType, postId } = commentData;
    
    await createNotificationHelper(notificationContext, {
      type: 'comment',
      title: 'New Comment',
      message: `${commenterName} commented on your ${postType}`,
      data: { commenter_name: commenterName, post_type: postType, post_id: postId },
      action_type: 'navigate',
      action_data: { screen: '/(modals)/CommentsScreen', params: { postId, postType } },
      priority: 2
    });
  },

  // When a user is invited to a group
  groupInvitationReceived: async (notificationContext, invitationData) => {
    const { groupName, inviterName, groupId } = invitationData;
    
    await createNotificationHelper(notificationContext, {
      type: 'group_invitation',
      title: 'Group Invitation',
      message: `${inviterName} invited you to join "${groupName}"`,
      data: { group_name: groupName, inviter_name: inviterName, group_id: groupId },
      action_type: 'navigate',
      action_data: { screen: '/(tabs)/community', params: { tab: 'groups' } },
      priority: 2
    });
  }
}; 