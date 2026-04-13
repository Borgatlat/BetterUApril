import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';
import { createNotificationWithPush } from '../../utils/notificationHelpers';

const AdminScreen = () => {
  const [reports, setReports] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [appMessages, setAppMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('reports');
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // Add search state
  const [searchResults, setSearchResults] = useState([]); // Add search results
  const [searching, setSearching] = useState(false); // Add searching state
  
  // App Messages state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messagePriority, setMessagePriority] = useState('normal');
  const [messageTarget, setMessageTarget] = useState('all');
  const [savingMessage, setSavingMessage] = useState(false);
  
  // App-wide push notification state
  const [showPushNotificationModal, setShowPushNotificationModal] = useState(false);
  const [pushNotificationTitle, setPushNotificationTitle] = useState('');
  const [pushNotificationBody, setPushNotificationBody] = useState('');
  const [pushNotificationPriority, setPushNotificationPriority] = useState(2); // 1=low, 2=normal, 3=high
  const [sendingPushNotifications, setSendingPushNotifications] = useState(false);
  const [pushNotificationProgress, setPushNotificationProgress] = useState({ sent: 0, total: 0 });
  
  const router = useRouter();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(tabs)/home');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (!profile?.is_admin) {
        // If not admin, redirect to home
        router.replace('/(tabs)/home');
        return;
      }

      setIsAdmin(true);
      loadData();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.replace('/(tabs)/home');
    }
  };

  const loadData = async () => {
    await Promise.all([
      loadReports(),
      loadBannedUsers(),
      loadAppMessages()
    ]);
  };

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*, reporter:reporter_id(username, avatar_url), reported_user:reported_user_id(username, avatar_url, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const loadBannedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('bans')
        .select('*, user:user_id(username, avatar_url, email), admin:created_by(username)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBannedUsers(data || []);
    } catch (error) {
      console.error('Error loading banned users:', error);
    }
  };

  // Load app messages
  const loadAppMessages = async () => {
    try {
      // First, get all app messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('app_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Then fetch admin usernames for each message
      // created_by references auth.users(id), so we need to join with profiles
      const messagesWithAdmin = await Promise.all(
        (messagesData || []).map(async (message) => {
          if (message.created_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', message.created_by)
              .single();
            
            return {
              ...message,
              admin: profile ? { username: profile.username } : { username: 'Admin' }
            };
          }
          return { ...message, admin: { username: 'Admin' } };
        })
      );

      setAppMessages(messagesWithAdmin);
    } catch (error) {
      console.error('Error loading app messages:', error);
      // Set empty array on error so UI doesn't break
      setAppMessages([]);
    }
  };

  // Open modal to create/edit message
  const openMessageModal = (message = null) => {
    if (message) {
      // Editing existing message
      setEditingMessage(message);
      setMessageTitle(message.title);
      setMessageText(message.message);
      setMessagePriority(message.priority || 'normal');
      setMessageTarget(message.target_audience || 'all');
    } else {
      // Creating new message
      setEditingMessage(null);
      setMessageTitle('');
      setMessageText('');
      setMessagePriority('normal');
      setMessageTarget('all');
    }
    setShowMessageModal(true);
  };

  // Save message (create or update)
  const saveMessage = async () => {
    if (!messageTitle.trim() || !messageText.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    setSavingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      if (editingMessage) {
        // Update existing message
        const { error } = await supabase
          .from('app_messages')
          .update({
            title: messageTitle.trim(),
            message: messageText.trim(),
            priority: messagePriority,
            target_audience: messageTarget
          })
          .eq('id', editingMessage.id);

        if (error) throw error;
        Alert.alert('Success', 'Message updated successfully');
      } else {
        // Create new message
        const { error } = await supabase
          .from('app_messages')
          .insert({
            title: messageTitle.trim(),
            message: messageText.trim(),
            priority: messagePriority,
            target_audience: messageTarget,
            created_by: user.id
          });

        if (error) throw error;
        Alert.alert('Success', 'Message sent to all users!');
      }

      setShowMessageModal(false);
      loadAppMessages();
    } catch (error) {
      console.error('Error saving message:', error);
      Alert.alert('Error', 'Failed to save message');
    } finally {
      setSavingMessage(false);
    }
  };

  // Toggle message active status
  const toggleMessageActive = async (messageId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('app_messages')
        .update({ is_active: !currentStatus })
        .eq('id', messageId);

      if (error) throw error;
      loadAppMessages();
    } catch (error) {
      console.error('Error toggling message:', error);
      Alert.alert('Error', 'Failed to update message');
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_messages')
                .delete()
                .eq('id', messageId);

              if (error) throw error;
              Alert.alert('Success', 'Message deleted');
              loadAppMessages();
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  };

  // Send push notification to all users
  // This function gets all users and sends them a notification that appears in the notification modal
  const sendPushNotificationToAllUsers = async () => {
    if (!pushNotificationTitle.trim() || !pushNotificationBody.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    // Confirm before sending to all users
    Alert.alert(
      'Send to All Users?',
      `This will send a push notification to ALL users in the app. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'default',
          onPress: async () => {
            setSendingPushNotifications(true);
            setPushNotificationProgress({ sent: 0, total: 0 });

            try {
              // Get all users from profiles table
              // We'll fetch in batches to avoid overwhelming the system
              const { data: allUsers, error: usersError } = await supabase
                .from('profiles')
                .select('id')
                .not('id', 'is', null);

              if (usersError) throw usersError;

              const totalUsers = allUsers?.length || 0;
              setPushNotificationProgress({ sent: 0, total: totalUsers });

              if (totalUsers === 0) {
                Alert.alert('Info', 'No users found to send notifications to');
                setSendingPushNotifications(false);
                return;
              }

              // Send notifications to all users
              // We'll do this in batches to avoid rate limiting
              const batchSize = 10;
              let sentCount = 0;
              let successCount = 0;
              let errorCount = 0;

              for (let i = 0; i < allUsers.length; i += batchSize) {
                const batch = allUsers.slice(i, i + batchSize);
                
                // Process batch in parallel
                const batchPromises = batch.map(async (user) => {
                  try {
                    // Create notification for each user
                    // This will automatically send push notification if user has push_token
                    const result = await createNotificationWithPush({
                      toUserId: user.id,
                      type: 'app_message', // New notification type for admin messages
                      title: pushNotificationTitle.trim(),
                      message: pushNotificationBody.trim(),
                      data: {
                        admin_message: true,
                        sent_at: new Date().toISOString()
                      },
                      isActionable: true,
                      actionType: null,
                      actionData: null,
                      priority: pushNotificationPriority, // 1=low, 2=normal, 3=high
                      expiresAt: null
                    });

                    return { success: true, userId: user.id };
                  } catch (error) {
                    console.error(`Error sending notification to user ${user.id}:`, error);
                    return { success: false, userId: user.id, error };
                  }
                });

                const batchResults = await Promise.all(batchPromises);
                
                // Update progress
                batchResults.forEach(result => {
                  sentCount++;
                  if (result.success) {
                    successCount++;
                  } else {
                    errorCount++;
                  }
                  setPushNotificationProgress({ sent: sentCount, total: totalUsers });
                });

                // Small delay between batches to avoid rate limiting
                if (i + batchSize < allUsers.length) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }

              // Show results
              Alert.alert(
                'Notifications Sent!',
                `Successfully sent to ${successCount} users.\n${errorCount > 0 ? `${errorCount} failed.` : ''}`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setShowPushNotificationModal(false);
                      setPushNotificationTitle('');
                      setPushNotificationBody('');
                      setPushNotificationPriority(2);
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error sending push notifications:', error);
              Alert.alert('Error', 'Failed to send notifications. Please try again.');
            } finally {
              setSendingPushNotifications(false);
              setPushNotificationProgress({ sent: 0, total: 0 });
            }
          }
        }
      ]
    );
  };

  const handleReportAction = async (reportId, action) => {
    try {
      if (action === 'dismiss') {
        const { error } = await supabase
          .from('reports')
          .update({ 
            status: 'dismissed',
            resolved_by: (await supabase.auth.getUser()).data.user.id,
            resolved_at: new Date().toISOString()
          })
          .eq('id', reportId);

        if (error) throw error;
        Alert.alert('Success', 'Report dismissed');
      } else if (action === 'ban') {
        const report = reports.find(r => r.id === reportId);
        if (!report) return;

        // Allow admin to add additional context to the ban reason
        Alert.prompt(
          'Ban User',
          `Additional context for banning ${report.reported_user?.username || 'this user'}? (Original report: "${report.reason}")`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue',
              onPress: (additionalContext) => {
                // Combine original report reason with admin's additional context
                const fullReason = additionalContext && additionalContext.trim() 
                  ? `${report.reason} - Admin note: ${additionalContext.trim()}`
                  : report.reason;
                
                showReportBanOptions(report, fullReason, reportId);
              }
            }
          ],
          'plain-text',
          'Additional admin context...'
        );
      }

      await loadReports();
    } catch (error) {
      Alert.alert('Error', 'Failed to process report');
      console.error('Report action error:', error);
    }
  };

  // Add search users function
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, avatar_url, is_admin, created_at')
        .or(`username.ilike.%${query}%, full_name.ilike.%${query}%, email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      // Check ban status for each user
      const usersWithBanStatus = await Promise.all(
        (data || []).map(async (user) => {
          const { data: bans } = await supabase
            .from('bans')
            .select('id, is_active, is_permanent, banned_until, reason')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1);
          
          return {
            ...user,
            banInfo: bans && bans.length > 0 ? bans[0] : null
          };
        })
      );

      setSearchResults(usersWithBanStatus);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Add ban user function
  const handleBanUser = async (userId, username) => {
    // Create a simple input for the ban reason
    Alert.prompt(
      'Ban User',
      `Enter reason for banning @${username}:`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Continue',
          onPress: (reason) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for the ban');
              return;
            }
            
            // Show ban options with the reason
            showBanOptions(userId, username, reason.trim());
          }
        }
      ],
      'plain-text',
      'Violation of community guidelines'
    );
  };

  // Show ban options after reason is provided
  const showBanOptions = (userId, username, reason) => {
    Alert.alert(
      'Ban User',
      `Ban @${username} for: "${reason}"`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Temporary Ban (7 days)',
          onPress: async () => {
            try {
              // Check if user is authenticated
              const { data: { user }, error: authError } = await supabase.auth.getUser();
              if (authError || !user) {
                Alert.alert('Error', 'You must be logged in to ban users');
                return;
              }

              const { error } = await supabase
                .from('bans')
                .insert({
                  user_id: userId,
                  reason: reason,
                  banned_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  is_permanent: false,
                  created_by: user.id
                });

              if (error) throw error;

              Alert.alert('Success', 'User has been temporarily banned for 7 days');
              setSearchQuery('');
              setSearchResults([]);
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            }
          }
        },
        {
          text: 'Permanent Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              // Check if user is authenticated
              const { data: { user }, error: authError } = await supabase.auth.getUser();
              if (authError || !user) {
                Alert.alert('Error', 'You must be logged in to ban users');
                return;
              }

              const { error } = await supabase
                .from('bans')
                .insert({
                  user_id: userId,
                  reason: reason,
                  is_permanent: true,
                  created_by: user.id
                });

              if (error) throw error;

              Alert.alert('Success', 'User has been permanently banned');
              setSearchQuery('');
              setSearchResults([]);
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            }
          }
        }
      ]
    );
  };

  // Show ban options for reports after admin provides additional context
  const showReportBanOptions = (report, fullReason, reportId) => {
    Alert.alert(
      'Ban User',
      `Ban ${report.reported_user?.username || 'this user'} for: "${fullReason}"`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Temporary Ban (7 days)',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bans')
                .insert({
                  user_id: report.reported_user_id,
                  reason: fullReason,
                  banned_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                  is_permanent: false,
                  created_by: (await supabase.auth.getUser()).data?.user?.id
                });

              if (error) throw error;

              // Update report status
              await supabase
                .from('reports')
                .update({ 
                  status: 'resolved',
                  resolved_by: (await supabase.auth.getUser()).data.user.id,
                  resolved_at: new Date().toISOString()
                })
                .eq('id', reportId);

              Alert.alert('Success', 'User has been temporarily banned for 7 days');
              loadData();
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            }
          }
        },
        {
          text: 'Permanent Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bans')
                .insert({
                  user_id: report.reported_user_id,
                  reason: fullReason,
                  is_permanent: true,
                  created_by: (await supabase.auth.getUser()).data?.user?.id
                });

              if (error) throw error;

              // Update report status
              await supabase
                .from('reports')
                .update({ 
                  status: 'resolved',
                  resolved_by: (await supabase.auth.getUser()).data.user.id,
                  resolved_at: new Date().toISOString()
                })
                .eq('id', reportId);

              Alert.alert('Success', 'User has been permanently banned');
              loadData();
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            }
          }
        }
      ]
    );
  };

  // Add unban user function
  const handleUnbanUser = async (banId, userId, username) => {
    Alert.alert(
      'Unban User',
      `Are you sure you want to unban @${username}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Unban User',
          style: 'default',
          onPress: async () => {
            try {
              // Deactivate the ban
              const { error } = await supabase
                .from('bans')
                .update({ is_active: false })
                .eq('id', banId);

              if (error) throw error;

              Alert.alert('Success', `@${username} has been unbanned`);
              loadBannedUsers(); // Refresh the list
            } catch (error) {
              console.error('Error unbanning user:', error);
              Alert.alert('Error', 'Failed to unban user');
            }
          }
        }
      ]
    );
  };

  // If not admin, don't render anything (we'll redirect)
  if (!isAdmin) {
    return null;
  }

  const renderReports = () => (
    <ScrollView style={styles.content}>
      {reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
          <Text style={styles.emptyStateText}>No pending reports</Text>
        </View>
      ) : (
        reports.map((report) => (
          <View key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.reportTitle}>
                <Text style={styles.reportLabel}>Report from </Text>
                <TouchableOpacity onPress={() => router.push(`/profile/${report.reporter_id}`)}>
                  <Text style={styles.userLink}>{report.reporter?.username || 'Unknown'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reportTime}>
                {new Date(report.created_at).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.reportedUserContainer}>
              <Text style={styles.reportLabel}>Reported: </Text>
              <TouchableOpacity onPress={() => router.push(`/profile/${report.reported_user_id}`)}>
                <Text style={[styles.userLink, styles.reportedUsername]}>{report.reported_user?.username || 'Unknown'}</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.reportReason}>
              Reason: {report.reason}
            </Text>
            
            {report.evidence && (
              <Text style={styles.evidence}>
                Evidence: {report.evidence}
              </Text>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.dismissButton]}
                onPress={() => handleReportAction(report.id, 'dismiss')}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.banButton]}
                onPress={() => handleReportAction(report.id, 'ban')}
              >
                <Text style={styles.banButtonText}>Ban User</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderBannedUsers = () => (
    <ScrollView style={styles.content}>
      {bannedUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark" size={50} color="#4CAF50" />
          <Text style={styles.emptyStateText}>No banned users</Text>
        </View>
      ) : (
        bannedUsers.map((ban) => (
          <View key={ban.id} style={styles.banCard}>
            <View style={styles.banHeader}>
              <TouchableOpacity onPress={() => router.push(`/profile/${ban.user_id}`)}>
                <Text style={[styles.banTitle, styles.userLink]}>
                  {ban.user?.username || 'Unknown User'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.banTime}>
                Banned: {new Date(ban.created_at).toLocaleDateString()}
              </Text>
            </View>
            
            <Text style={styles.banReason}>
              Reason: {ban.reason}
            </Text>
            
            <Text style={styles.banAdmin}>
              Banned by: {ban.admin?.username || 'Unknown'}
            </Text>
            
            {ban.banned_until && !ban.is_permanent && (
              <Text style={styles.banDuration}>
                Until: {new Date(ban.banned_until).toLocaleDateString()}
              </Text>
            )}
            
            {ban.is_permanent && (
              <Text style={styles.permanentBan}>Permanent Ban</Text>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.unbanButton]}
              onPress={() => handleUnbanUser(ban.id, ban.user_id, ban.user?.username)}
            >
              <Text style={styles.unbanButtonText}>Unban User</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );

  // Render app messages tab
  const renderAppMessages = () => (
    <ScrollView style={styles.content}>
      {/* Push Notification Section */}
      <View style={styles.pushNotificationSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications" size={24} color="#00ffff" />
          <Text style={styles.sectionTitle}>Send Push Notification to All Users</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Send a push notification that will appear in all users' notification modals. This will also send a push notification to their devices.
        </Text>
        <TouchableOpacity
          style={styles.sendPushButton}
          onPress={() => setShowPushNotificationModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={20} color="#fff" />
          <Text style={styles.sendPushButtonText}>Send Push Notification</Text>
        </TouchableOpacity>
      </View>

      {/* App Messages Section */}
      <View style={styles.appMessagesSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="megaphone" size={24} color="#00ffff" />
          <Text style={styles.sectionTitle}>App Messages (Legacy)</Text>
        </View>
      <TouchableOpacity
        style={styles.createMessageButton}
        onPress={() => openMessageModal()}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={24} color="#00ffff" />
        <Text style={styles.createMessageButtonText}>Create New Message</Text>
      </TouchableOpacity>

      {appMessages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="megaphone-outline" size={50} color="#666" />
          <Text style={styles.emptyStateText}>No messages yet</Text>
          <Text style={styles.emptyStateSubtext}>Create your first app-wide message</Text>
        </View>
      ) : (
        appMessages.map((message) => (
          <View key={message.id} style={[styles.messageCard, !message.is_active && styles.messageCardInactive]}>
            <View style={styles.messageHeader}>
              <View style={styles.messageTitleRow}>
                <Text style={styles.messageCardTitle}>{message.title}</Text>
                <View style={[styles.priorityBadge, styles[`priority${message.priority}`]]}>
                  <Text style={styles.priorityText}>{message.priority}</Text>
                </View>
              </View>
              <Text style={styles.messageTime}>
                {new Date(message.created_at).toLocaleDateString()}
              </Text>
            </View>
            
            <Text style={styles.messageCardText}>{message.message}</Text>
            
            <View style={styles.messageMeta}>
              <Text style={styles.messageMetaText}>
                Target: {message.target_audience || 'all'} • 
                By: {message.admin?.username || 'Admin'}
              </Text>
              {message.expires_at && (
                <Text style={styles.messageExpires}>
                  Expires: {new Date(message.expires_at).toLocaleDateString()}
                </Text>
              )}
            </View>

            <View style={styles.messageActions}>
              <TouchableOpacity
                style={[styles.messageActionButton, message.is_active ? styles.deactivateButton : styles.activateButton]}
                onPress={() => toggleMessageActive(message.id, message.is_active)}
              >
                <Ionicons 
                  name={message.is_active ? "eye-off-outline" : "eye-outline"} 
                  size={16} 
                  color={message.is_active ? "#ff6b6b" : "#4CAF50"} 
                />
                <Text style={[styles.messageActionText, message.is_active ? styles.deactivateText : styles.activateText]}>
                  {message.is_active ? 'Deactivate' : 'Activate'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.messageActionButton, styles.editButton]}
                onPress={() => openMessageModal(message)}
              >
                <Ionicons name="create-outline" size={16} color="#00ffff" />
                <Text style={[styles.messageActionText, styles.editText]}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.messageActionButton, styles.deleteButton]}
                onPress={() => deleteMessage(message.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#ff4444" />
                <Text style={[styles.messageActionText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      </View>

      {/* Create/Edit Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMessage ? 'Edit Message' : 'Create App Message'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowMessageModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter message title"
                placeholderTextColor="#666"
                value={messageTitle}
                onChangeText={setMessageTitle}
                maxLength={100}
              />

              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Enter message content"
                placeholderTextColor="#666"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                numberOfLines={6}
                maxLength={1000}
              />

              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityContainer}>
                {['low', 'normal', 'high', 'urgent'].map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityOption,
                      messagePriority === priority && styles.priorityOptionActive
                    ]}
                    onPress={() => setMessagePriority(priority)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      messagePriority === priority && styles.priorityOptionTextActive
                    ]}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Target Audience</Text>
              <View style={styles.targetContainer}>
                {['all', 'premium', 'free', 'new_users'].map((target) => (
                  <TouchableOpacity
                    key={target}
                    style={[
                      styles.targetOption,
                      messageTarget === target && styles.targetOptionActive
                    ]}
                    onPress={() => setMessageTarget(target)}
                  >
                    <Text style={[
                      styles.targetOptionText,
                      messageTarget === target && styles.targetOptionTextActive
                    ]}>
                      {target === 'all' ? 'All Users' : 
                       target === 'new_users' ? 'New Users' :
                       target.charAt(0).toUpperCase() + target.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowMessageModal(false)}
                disabled={savingMessage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveMessage}
                disabled={savingMessage}
              >
                {savingMessage ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingMessage ? 'Update' : 'Send Message'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Push Notification Modal */}
      <Modal
        visible={showPushNotificationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPushNotificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Push Notification to All Users</Text>
              <TouchableOpacity
                onPress={() => setShowPushNotificationModal(false)}
                style={styles.closeButton}
                disabled={sendingPushNotifications}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title (Header) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter notification title"
                placeholderTextColor="#666"
                value={pushNotificationTitle}
                onChangeText={setPushNotificationTitle}
                maxLength={100}
                editable={!sendingPushNotifications}
              />

              <Text style={styles.inputLabel}>Message (Body) *</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Enter notification message"
                placeholderTextColor="#666"
                value={pushNotificationBody}
                onChangeText={setPushNotificationBody}
                multiline
                numberOfLines={6}
                maxLength={500}
                editable={!sendingPushNotifications}
              />

              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityContainer}>
                {[
                  { value: 1, label: 'Low' },
                  { value: 2, label: 'Normal' },
                  { value: 3, label: 'High' }
                ].map((priority) => (
                  <TouchableOpacity
                    key={priority.value}
                    style={[
                      styles.priorityOption,
                      pushNotificationPriority === priority.value && styles.priorityOptionActive
                    ]}
                    onPress={() => setPushNotificationPriority(priority.value)}
                    disabled={sendingPushNotifications}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      pushNotificationPriority === priority.value && styles.priorityOptionTextActive
                    ]}>
                      {priority.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sendingPushNotifications && (
                <View style={styles.progressContainer}>
                  <ActivityIndicator size="small" color="#00ffff" style={{ marginBottom: 8 }} />
                  <Text style={styles.progressText}>
                    Sending... {pushNotificationProgress.sent} / {pushNotificationProgress.total}
                  </Text>
                  <Text style={styles.progressSubtext}>
                    This may take a few moments
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPushNotificationModal(false)}
                disabled={sendingPushNotifications}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={sendPushNotificationToAllUsers}
                disabled={sendingPushNotifications}
              >
                {sendingPushNotifications ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Send to All Users</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  const renderQuickBan = () => (
    <ScrollView style={styles.content}>
      <View style={styles.quickBanContainer}>
        <Text style={styles.quickBanTitle}>Quick Ban</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.quickBanInput}
            placeholder="Enter username or email"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => searchUsers(searchQuery)}
          />
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => searchUsers(searchQuery)}
          >
            <Ionicons name="search" size={20} color="#00ffff" />
          </TouchableOpacity>
        </View>
        {searching ? (
          <Text style={styles.searchingText}>Searching...</Text>
        ) : searchResults.length === 0 ? (
          <Text style={styles.noResultsText}>No users found.</Text>
        ) : (
          searchResults.map((user) => (
            <View key={user.id} style={styles.quickBanResultItem}>
              <Text style={styles.quickBanResultText}>
                {user.username} ({user.email})
              </Text>
              {user.banInfo ? (
                <View style={styles.banStatusContainer}>
                  <Text style={styles.banStatusText}>
                    {user.banInfo.is_permanent ? 'Permanently Banned' : 'Temporarily Banned'}
                  </Text>
                  <Text style={styles.banReasonText}>Reason: {user.banInfo.reason}</Text>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.unbanButton]}
                    onPress={() => handleUnbanUser(user.banInfo.id, user.id, user.username)}
                  >
                    <Text style={styles.unbanButtonText}>Unban User</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.banButton]}
                  onPress={() => handleBanUser(user.id, user.username)}
                >
                  <Text style={styles.banButtonText}>Ban User</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            Reports ({reports.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bans' && styles.activeTab]}
          onPress={() => setActiveTab('bans')}
        >
          <Text style={[styles.tabText, activeTab === 'bans' && styles.activeTabText]}>
            Banned Users ({bannedUsers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'quickban' && styles.activeTab]}
          onPress={() => setActiveTab('quickban')}
        >
          <Text style={[styles.tabText, activeTab === 'quickban' && styles.activeTabText]}>
            Quick Ban
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            App Messages ({appMessages.filter(m => m.is_active).length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'reports' ? renderReports() : 
       activeTab === 'bans' ? renderBannedUsers() : 
       activeTab === 'messages' ? renderAppMessages() :
       renderQuickBan()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#18191b',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#00ffff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
  },
  reportCard: {
    backgroundColor: '#18191b',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportLabel: {
    fontSize: 16,
    color: '#fff',
  },
  userLink: {
    fontSize: 16,
    color: '#00ffff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  reportedUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportedUsername: {
    fontSize: 18,
  },
  reportTime: {
    fontSize: 14,
    color: '#666',
  },
  reportedUser: {
    fontSize: 16,
    color: '#00ffff',
    marginBottom: 10,
  },
  reportReason: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  evidence: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  banButton: {
    backgroundColor: '#dc3545',
  },
  dismissButtonText: {
    color: '#00ffff',
    fontWeight: '600',
  },
  banButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  banCard: {
    backgroundColor: '#18191b',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(220, 53, 69, 0.2)',
  },
  banHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  banTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
  },
  banTime: {
    fontSize: 14,
    color: '#666',
  },
  banReason: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  banAdmin: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  banDuration: {
    fontSize: 14,
    color: '#00ffff',
  },
  permanentBan: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: 'bold',
  },
  unbanButton: {
    backgroundColor: '#4CAF50',
    marginTop: 10,
  },
  unbanButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  quickBanContainer: {
    backgroundColor: '#18191b',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  quickBanTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  quickBanInput: {
    flex: 1,
    height: 50,
    backgroundColor: 'transparent',
    color: '#fff',
    fontSize: 16,
    borderWidth: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282a2e',
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    marginBottom: 15,
  },
  searchButton: {
    padding: 10,
  },
  searchingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  quickBanResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.1)',
  },
  quickBanResultText: {
    fontSize: 16,
    color: '#fff',
  },
  banStatusContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  banStatusText: {
    fontSize: 14,
    color: '#00ffff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  banReasonText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  banButton: {
    backgroundColor: '#dc3545',
  },
  banButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  unbanButton: {
    backgroundColor: '#4CAF50',
  },
  unbanButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // App Messages Styles
  pushNotificationSection: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  appMessagesSection: {
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16,
    lineHeight: 20,
  },
  sendPushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sendPushButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    marginTop: 16,
  },
  progressText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressSubtext: {
    color: '#aaa',
    fontSize: 12,
  },
  createMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#00ffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  createMessageButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageCard: {
    backgroundColor: '#18191b',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  messageCardInactive: {
    opacity: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageHeader: {
    marginBottom: 12,
  },
  messageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  prioritylow: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  prioritynormal: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  priorityhigh: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  priorityurgent: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
  },
  messageCardText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 12,
  },
  messageMeta: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageMetaText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageExpires: {
    fontSize: 12,
    color: '#ff6b6b',
  },
  messageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  messageActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  activateButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  editButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  deleteButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  messageActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activateText: {
    color: '#4CAF50',
  },
  deactivateText: {
    color: '#ff6b6b',
  },
  editText: {
    color: '#00ffff',
  },
  deleteText: {
    color: '#ff4444',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#18191b',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffff',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#282a2e',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  modalTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
  },
  priorityOptionActive: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  priorityOptionText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  priorityOptionTextActive: {
    color: '#000',
  },
  targetContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  targetOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
  },
  targetOptionActive: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  targetOptionText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  targetOptionTextActive: {
    color: '#000',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveButton: {
    backgroundColor: '#00ffff',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});

export default AdminScreen;