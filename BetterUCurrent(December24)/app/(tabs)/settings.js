import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, TextInput, Modal, Linking, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUnits } from '../../context/UnitsContext';
import { useTracking } from '../../context/TrackingContext';
import { useUser } from '../../context/UserContext';
import PremiumFeature from '../components/PremiumFeature';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage, SUPPORTED_LOCALES } from '../../context/LanguageContext';
import { createDailyReminderNotification } from '../../utils/notificationHelpers';
import { getStreakStatus } from '../../utils/streakHelpers';
import { getEngagementLevel } from '../../utils/engagementService';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Settings always uses the app’s default dark theme (matches useHomeTheme defaults in homePageCustomization).
 * Home tab can still use custom accent/background; this screen stays consistent and “product” branded.
 */
const SETTINGS_APP_THEME = {
  accentColor: '#00ffff',
  backgroundColor: '#000000',
  textColor: '#ffffff',
  textSecondary: '#999999',
  cardBg: 'rgba(0, 255, 255, 0.08)',
  cardBorder: 'rgba(0, 255, 255, 0.3)',
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DAILY_REMINDER_NOTIFICATION_ID_KEY = 'dailyReminderNotificationId';
const DAILY_REMINDER_TIME_KEY = 'dailyReminderTime';

const SettingsScreen = () => {
  const router = useRouter();
  const { signOut, user, updatePassword } = useAuth();
  const { accentColor, backgroundColor, textColor, textSecondary, cardBg, cardBorder } = SETTINGS_APP_THEME;
  const { isPremium, userProfile, updateProfile } = useUser();
  const { useImperial, toggleUnits } = useUnits();
  const { calories, water, protein, updateGoal } = useTracking();
  const { settings, updateSettings } = useSettings();
  const { locale, setLocale, t } = useLanguage();
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date(0, 0, 0, 8, 0)); // 8:00 am default
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [restTimeSeconds, setRestTimeSeconds] = useState(60);
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [spotifyEnabled, setSpotifyEnabled] = useState(false);
  const [showStrideModal, setShowStrideModal] = useState(false);
  const [strideLengthInput, setStrideLengthInput] = useState('0.75');

  console.warn('[SettingsScreen] isPremium:', isPremium);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      try {
        const reminders = await AsyncStorage.getItem('daily_reminders');
        if (reminders !== null) setNotificationsEnabled(JSON.parse(reminders));
        const rest = await AsyncStorage.getItem('rest_time_seconds');
        if (rest !== null) setRestTimeSeconds(Number(rest));
        const savedReminderTime = await AsyncStorage.getItem(DAILY_REMINDER_TIME_KEY);
        if (savedReminderTime) {
          const parsedTime = new Date(savedReminderTime);
          if (!isNaN(parsedTime.getTime())) {
            setReminderTime(parsedTime);
          }
        }
      } catch (e) {}
    })();
  }, []);

  // Load Spotify setting from SettingsContext
  useEffect(() => {
    if (settings?.spotify_enabled !== undefined) {
      setSpotifyEnabled(settings.spotify_enabled);
    }
  }, [settings?.spotify_enabled]);

  // Sync stride length from settings (used for indoor/treadmill timed distance)
  useEffect(() => {
    if (settings?.indoor_stride_length_meters != null) {
      setStrideLengthInput(String(settings.indoor_stride_length_meters));
    }
  }, [settings?.indoor_stride_length_meters]);

  // Keep toggle in sync with profile-level preference (authoritative when available)
  useEffect(() => {
    if (userProfile?.notification_preferences) {
      const preference = userProfile.notification_preferences.daily_reminder;
      if (preference === false) {
        setNotificationsEnabled(false);
      } else if (preference === true) {
        setNotificationsEnabled(true);
      }
    }
  }, [userProfile?.notification_preferences?.daily_reminder]);

  /**
   * Load the latest active subscription row for the settings card (end date + Manage).
   * Uses the same filters as UserContext: user_id OR profile_id, status active, not past end_date.
   */
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: subscriptions, error } = await supabase
          .from('subscriptions')
          .select('*')
          .or(`user_id.eq.${user?.id},profile_id.eq.${user?.id}`)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error loading subscription:', error);
          setSubscription(null);
          return;
        }

        if (subscriptions && subscriptions.length > 0) {
          const now = new Date();
          const row = subscriptions.find((s) => {
            const end = s.end_date ? new Date(s.end_date) : null;
            const start = s.start_date ? new Date(s.start_date) : null;
            return end && end > now && (!start || start <= now);
          });
          setSubscription(row || null);
        } else {
          setSubscription(null);
        }
      } catch (error) {
        console.error('Error in loadSubscription:', error);
        setSubscription(null);
      }
    };

    if (user?.id) {
      loadSubscription();
    }
  }, [user?.id]);

  // Save settings when changed
  const handleSettingsChange = async (key, value) => {
    try {
      if (key === 'daily_reminders') {
        setNotificationsEnabled(value);
        await AsyncStorage.setItem('daily_reminders', JSON.stringify(value));
      } else if (key === 'rest_time_seconds') {
        setRestTimeSeconds(value);
        await AsyncStorage.setItem('rest_time_seconds', value.toString());
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  // Handle rest time change
  const handleRestTimeChange = async (seconds) => {
    try {
      setRestTimeSeconds(seconds);
      // Update in settings context
      const settingsResult = await updateSettings({ rest_time_seconds: seconds });
      if (!settingsResult.success) {
        throw new Error(settingsResult.error || 'Failed to update settings');
      }
      // Also save to AsyncStorage directly as backup
      await AsyncStorage.setItem('rest_time_seconds', seconds.toString());
    } catch (error) {
      console.error('Error updating rest time:', error);
      Alert.alert('Error', 'Failed to update rest time. Please try again.');
    }
  };

  // Handle notifications toggle
  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Enable notifications in your device settings.');
        return;
      }
      setNotificationsEnabled(true);
      await handleSettingsChange('daily_reminders', true);
      await updateDailyReminderPreference(true);
      await scheduleDailyReminderNotification(reminderTime, true);
      await createDailyReminderEnabledNotification(true);
    } else {
      setNotificationsEnabled(false);
      await handleSettingsChange('daily_reminders', false);
      await updateDailyReminderPreference(false);
      // Cancel streak notification when disabling
      const existingId = await AsyncStorage.getItem(DAILY_REMINDER_NOTIFICATION_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      }
      await AsyncStorage.removeItem(DAILY_REMINDER_NOTIFICATION_ID_KEY);
    }
  };

  // Handle units toggle
  const handleToggleUnits = async () => {
    const newValue = !useImperial;
    await toggleUnits(newValue);
  };

  // Handle Spotify toggle
  const handleToggleSpotify = async () => {
    const newValue = !spotifyEnabled;
    setSpotifyEnabled(newValue);
    await updateSettings({ spotify_enabled: newValue });
  };

  const handleBackToProfile = () => {
    router.replace('/(tabs)/profile');
  };

  const handleSubscriptionManagement = async () => {
    if (isPremium) {
      // For premium users, open Apple's subscription management page
      try {
        const supported = await Linking.canOpenURL('https://apps.apple.com/account/subscriptions');
        if (supported) {
          await Linking.openURL('https://apps.apple.com/account/subscriptions');
        } else {
          Alert.alert(
            'Subscription Management',
            'To manage your subscription:\n\n1. Open the App Store\n2. Tap your profile icon\n3. Tap "Subscriptions"\n4. Find BetterU and manage your subscription',
            [
              { text: 'Open App Store', onPress: () => Linking.openURL('https://apps.apple.com') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      } catch (error) {
        console.error('Error opening subscription management:', error);
        Alert.alert(
          'Subscription Management',
          'To manage your subscription:\n\n1. Open the App Store\n2. Tap your profile icon\n3. Tap "Subscriptions"\n4. Find BetterU and manage your subscription',
          [{ text: 'OK' }]
        );
      }
    } else {
      // For non-premium users, go to purchase screen
      router.push('/purchase-subscription');
    }
  };

  // Handle password change
  const handleChangePassword = async () => {
    // Validation: Check if all fields are filled
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validation: Check if new password matches confirmation
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    // Validation: Check password length (Supabase requires at least 6 characters)
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    // Validation: Check if new password is different from current
    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from your current password');
      return;
    }

    setIsChangingPassword(true);

    try {
      console.log('🔐 Verifying current password...');
      
      // First, verify the current password by attempting to sign in
      // This ensures the user knows their current password before changing it
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        console.error('❌ Current password verification failed:', signInError);
        Alert.alert('Error', 'Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }

      console.log('✅ Current password verified, updating to new password...');
      
      // Wait a brief moment to ensure session is established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Standard approach: await updateUser with timeout wrapper
      const updatePasswordPromise = updatePassword(newPassword);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password update timed out. Please try again.')), 10000)
      );
      
      let updateResult;
      try {
        updateResult = await Promise.race([
          updatePasswordPromise,
          timeoutPromise
        ]);
      } catch (error) {
        // Handle timeout or other errors
        console.error('❌ Password update promise error:', error);
        updateResult = { error: error.message || 'An error occurred' };
      }
      
      const { data: updateData, error: updateError } = updateResult || {};

      if (updateError) {
        console.error('❌ Password update failed:', updateError);
        
        // Provide helpful error message for password requirements
        let errorMessage = typeof updateError === 'string' ? updateError : (updateError.message || 'Failed to update password. Please try again.');
        if (updateError.message && updateError.message.includes('Password should contain')) {
          errorMessage = 'Password must be at least 6 characters long. For stronger security, include both letters and numbers.';
        }
        
        Alert.alert('Error', errorMessage);
        setIsChangingPassword(false);
      } else {
        console.log('✅ Password updated successfully');
        Alert.alert(
          'Success',
          'Your password has been updated successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear all password fields and close modal
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setShowChangePasswordModal(false);
                setIsChangingPassword(false);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Unexpected error changing password:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleGoalEdit = async (type, value) => {
    try {
      // For water, allow up to 1 decimal place and convert to proper units
      const numValue = type === 'water' 
        ? parseFloat(parseFloat(value).toFixed(1))
        : parseFloat(value);
        
      if (isNaN(numValue) || numValue <= 0) {
        Alert.alert('Invalid Value', 'Please enter a valid number greater than 0');
        return;
      }

      // Update in tracking context (this handles AsyncStorage persistence)
      const result = await updateGoal(type, numValue);
      if (!result) {
        throw new Error('Failed to update goal in tracking context');
      }

      // Update in settings context with proper unit conversion
      let settingKey;
      let settingsValue;
      
      if (type === 'calories') {
        settingKey = 'calorie_goal';
        settingsValue = numValue;
      } else if (type === 'water') {
        settingKey = 'water_goal_ml';
        settingsValue = numValue * 1000; // Convert liters to milliliters for settings context
      } else if (type === 'protein') {
        settingKey = 'protein_goal';
        settingsValue = numValue;
      }
      
      const settingsResult = await updateSettings({ [settingKey]: settingsValue });
      
      if (!settingsResult.success) {
        throw new Error(settingsResult.error || 'Failed to update settings');
      }
      
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating goal:', error);
      Alert.alert('Error', 'Failed to update goal. Please try again.');
    }
  };

  // Helper to format rest time
  const formatRestTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Schedules a daily reminder; uses streak/engagement for supportive message when available
  const scheduleDailyReminderNotification = async (time = reminderTime, enabledOverride = notificationsEnabled) => {
    try {
      const existingId = await AsyncStorage.getItem(DAILY_REMINDER_NOTIFICATION_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      }

      if (!enabledOverride) return;

      const scheduleDate = time instanceof Date ? time : new Date(time);
      if (Number.isNaN(scheduleDate.getTime())) {
        console.warn('Invalid reminder time provided, skipping scheduling.');
        return;
      }

      let title = 'BetterU Daily Reminder';
      let body = 'Time for your daily workout and mental check-in.';
      if (user?.id) {
        try {
          const [streakStatus, engagement] = await Promise.all([
            getStreakStatus(user.id).catch(() => null),
            getEngagementLevel(user.id).catch(() => ({ level: 'high' })),
          ]);
          const isAtRisk = streakStatus?.isAtRisk === true;
          const justReset = (streakStatus?.currentStreak === 0 || streakStatus?.currentStreak === 1) && (streakStatus?.longestStreak ?? 0) > 0;
          if (justReset && streakStatus?.longestStreak) {
            title = 'Fresh start today';
            body = `You did ${streakStatus.longestStreak} day${streakStatus.longestStreak === 1 ? '' : 's'} in a row — that's real progress. One short session counts.`;
          } else if (isAtRisk || engagement?.level === 'low') {
            title = 'Your streak is still alive';
            body = 'One activity today keeps it going — a quick workout or 5-min mental session is enough.';
          }
        } catch (_) {}
      }

      const trigger = {
        hour: scheduleDate.getHours(),
        minute: scheduleDate.getMinutes(),
        repeats: true,
      };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });
      await AsyncStorage.setItem(DAILY_REMINDER_NOTIFICATION_ID_KEY, id);
      console.log('Scheduled daily reminder notification with ID:', id);
    } catch (error) {
      console.error('Error scheduling daily reminder notification:', error);
    }
  };

  const updateDailyReminderPreference = async (enabled) => {
    try {
      if (!userProfile?.id || typeof updateProfile !== 'function') return;
      const currentPrefs = userProfile.notification_preferences || {};
      const updatedPrefs = {
        ...currentPrefs,
        daily_reminder: enabled,
      };
      const result = await updateProfile({ notification_preferences: updatedPrefs });
      if (!result?.success && result?.error) {
        console.error('Error updating daily reminder preference:', result.error);
      }
    } catch (error) {
      console.error('Error updating daily reminder preference:', error);
    }
  };

  const createDailyReminderEnabledNotification = async (enabled) => {
    try {
      if (!user?.id) return;
      const displayName = userProfile?.full_name || userProfile?.username || user?.email?.split('@')[0] || 'friend';
      if (enabled) {
        await createDailyReminderNotification(user.id, displayName, {
          title: 'Daily Reminders Enabled',
          message: `We will remind you every day at ${reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          reminderTime: reminderTime.toISOString(),
        });
      }
    } catch (error) {
      console.error('Error sending daily reminder enable/disable notification:', error);
    }
  };

  const handleReminderTimeChange = async (selectedDate) => {
    if (!selectedDate) return;
    setReminderTime(selectedDate);
    try {
      await AsyncStorage.setItem(DAILY_REMINDER_TIME_KEY, selectedDate.toISOString());
      if (notificationsEnabled) {
        await scheduleDailyReminderNotification(selectedDate, true);
        await createDailyReminderEnabledNotification(true);
      }
    } catch (error) {
      console.error('Error saving reminder time:', error);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={[styles.header, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity 
          style={[styles.backButton, { borderColor: cardBorder }]} 
          onPress={handleBackToProfile}
        >
          <Ionicons name="chevron-back" size={24} color={accentColor} />
          <Text style={[styles.backButtonText, { color: accentColor }]}>{t('settings.backToProfile')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>{t('settings.title')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.subscription')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {isPremium ? (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.premiumStatusContainer}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.premiumMember')}</Text>
                </View>
                <Text style={[styles.settingValue, { color: textSecondary }]}>
                  {subscription?.end_date
                    ? `${t('settings.activeUntilLabel')} ${new Date(subscription.end_date).toLocaleDateString()}`
                    : t('settings.subscriptionActiveGeneric')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.subscriptionManageButton, { borderColor: accentColor }]}
                onPress={handleSubscriptionManagement}
              >
                <Ionicons name="settings-outline" size={18} color={accentColor} />
                <Text style={[styles.subscriptionManageButtonText, { color: accentColor }]}>
                  {t('settings.manageSubscription')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.premiumUpgradeCard}>
              <View style={styles.premiumUpgradeContent}>
                <View style={[styles.premiumUpgradeBadge, { backgroundColor: `${accentColor}1f` }]}>
                  <Ionicons name="diamond" size={20} color={accentColor} />
                </View>
                <Text style={[styles.premiumUpgradeTitle, { color: textColor }]}>{t('settings.upgradeToPremium')}</Text>
                <Text style={[styles.premiumUpgradeSubtitle, { color: textSecondary }]}>
                  {t('settings.upgradeSubtitle')}
                </Text>
              </View>
              <TouchableOpacity style={styles.premiumUpgradeButton} onPress={handleSubscriptionManagement} activeOpacity={0.88}>
                <LinearGradient
                  colors={['#00ffff', '#00ccdd', '#0088aa']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.premiumUpgradeButtonGradient}
                >
                  <Ionicons name="sparkles" size={20} color="#000" />
                  <Text style={styles.premiumUpgradeButtonText}>{t('settings.upgradeToPremium')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.preferences')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowWithBorder, { borderBottomColor: cardBorder }]}
            onPress={() => {
              Alert.alert(
                t('settings.language'),
                null,
                [
                  ...SUPPORTED_LOCALES.map((code) => ({
                    text: t(`languages.${code}`),
                    onPress: () => setLocale(code),
                  })),
                  { text: t('common.cancel'), style: 'cancel' },
                ]
              );
            }}
          >
            <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.language')}</Text>
            <Text style={[styles.settingValue, { color: textSecondary }]}>{t(`languages.${locale}`)}</Text>
          </TouchableOpacity>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.useImperialUnits')}</Text>
            <Switch
              value={useImperial}
              onValueChange={handleToggleUnits}
              trackColor={{ false: '#333', true: `${accentColor}50` }}
              thumbColor={useImperial ? accentColor : '#666'}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowWithBorder, { borderBottomColor: cardBorder }]}> 
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.calorieGoal')}</Text>
              <Text style={[styles.settingValue, { color: textSecondary }]}>{calories.goal} cal</Text>
            </View>
            <View style={styles.editButtonContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  if (isPremium) {
                    setEditingField('calorie_goal');
                    setEditValue(calories.goal.toString());
                  }
                }}
                disabled={!isPremium}
              >
                <Ionicons name="pencil" size={20} color={accentColor} />
              </TouchableOpacity>
              {!isPremium && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={28} color={textColor} style={{ opacity: 0.85 }} />
                </View>
              )}
            </View>
          </View>

          <View style={[styles.settingRow, styles.settingRowWithBorder, { borderBottomColor: cardBorder }]}> 
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.waterGoal')}</Text>
              <Text style={[styles.settingValue, { color: textSecondary }]}>{water.goal} L</Text>
            </View>
            <View style={styles.editButtonContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  if (isPremium) {
                    setEditingField('water_goal');
                    setEditValue(water.goal.toString());
                  }
                }}
                disabled={!isPremium}
              >
                <Ionicons name="pencil" size={20} color={accentColor} />
              </TouchableOpacity>
              {!isPremium && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={28} color={textColor} style={{ opacity: 0.85 }} />
                </View>
              )}
            </View>
          </View>

          <View style={[styles.settingRow, styles.settingRowWithBorder, { borderBottomColor: cardBorder }]}> 
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.proteinGoal')}</Text>
              <Text style={[styles.settingValue, { color: textSecondary }]}>{protein.goal} g</Text>
            </View>
            <View style={styles.editButtonContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  if (isPremium) {
                    setEditingField('protein_goal');
                    setEditValue(protein.goal.toString());
                  }
                }}
                disabled={!isPremium}
              >
                <Ionicons name="pencil" size={20} color={accentColor} />
              </TouchableOpacity>
              {!isPremium && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={28} color={textColor} style={{ opacity: 0.85 }} />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.reminders')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: textColor }]}>{t('settings.dailyReminder')}</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#333', true: `${accentColor}50` }}
              thumbColor={notificationsEnabled ? accentColor : '#666'}
            />
          </View>
          {notificationsEnabled && (
            <>
              <TouchableOpacity
                style={{ marginTop: 10, alignItems: 'center' }}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={{ color: '#00ffff', fontWeight: 'bold', fontSize: 16 }}>
                  {t('settings.reminderTime')}: {reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  marginTop: 16,
                  backgroundColor: '#00ffff',
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#00ffff',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={async () => {
                  if (!user?.id) {
                    Alert.alert('Error', 'You need to be signed in to send a test notification.');
                    return;
                  }

                  try {
                    const displayName = userProfile?.full_name || userProfile?.username || user?.email?.split('@')[0] || 'friend';
                    await createDailyReminderNotification(user.id, displayName, {
                      title: 'Test Notification',
                      message: 'This is a test notification from BetterU!',
                      reminderTime: reminderTime.toISOString(),
                    });
                    Alert.alert('Notification Sent', 'Check your device notifications.');
                  } catch (error) {
                    console.error('Error sending test notification:', error);
                    Alert.alert('Error', 'Failed to send test notification. Please try again.');
                  }
                }}
              >
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>{t('settings.testSendNotification')}</Text>
              </TouchableOpacity>
            </>
          )}
          {showTimePicker && (
            <DateTimePicker
              value={reminderTime}
              mode="time"
              is24Hour={false}
              display="spinner"
              textColor="#fff"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                const isDismissed = event?.type === 'dismissed' || event?.type === 'neutralButtonPressed';
                if (!isDismissed && selectedDate) {
                  handleReminderTimeChange(selectedDate);
                }
              }}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.workoutPreferences')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.modernSettingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('settings.restTimeBetweenSets')}</Text>
              <View style={styles.modernValueContainer}>
                <Ionicons name="timer-outline" size={16} color="#00ffff" style={{ marginRight: 8 }} />
                <Text style={styles.modernSettingValue}>{formatRestTime(restTimeSeconds)}</Text>
              </View>
            </View>
            <View style={styles.modernEditButtonContainer}>
              <TouchableOpacity
                style={styles.modernEditButton}
                onPress={() => {
                  if (!isPremium) {
                    Alert.alert(
                      'Premium Feature',
                      'Upgrade to Premium to customize your rest timer!',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  setShowRestPicker(true);
                }}
                disabled={!isPremium}
              >
                <Ionicons name="pencil" size={18} color="#00ffff" />
              </TouchableOpacity>
              {!isPremium && (
                <View style={styles.modernLockOverlay}>
                  <View style={styles.modernLockContainer}>
                    <Ionicons name="lock-closed" size={20} color="#fff" />
                  </View>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.settingValue}>
            {isPremium 
              ? "This rest time will be used for all workouts."
              : "Upgrade to Premium to customize your rest timer."
            }
          </Text>
        </View>

        {/* Indoor / Treadmill stride length (timed distance) */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, marginTop: 12 }]}>
          <View style={styles.modernSettingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('settings.indoorStrideLength')}</Text>
              <View style={styles.modernValueContainer}>
                <Ionicons name="footsteps-outline" size={16} color="#00ffff" style={{ marginRight: 8 }} />
                <Text style={styles.modernSettingValue}>
                  {(settings?.indoor_stride_length_meters ?? 0.75).toFixed(2)} m
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modernEditButton}
              onPress={() => {
                setStrideLengthInput(String(settings?.indoor_stride_length_meters ?? 0.75));
                setShowStrideModal(true);
              }}
            >
              <Ionicons name="pencil" size={18} color="#00ffff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.settingValue}>
            Used for Timed Distance in Indoor / Treadmill mode. Average is ~0.75 m; adjust for your height.
          </Text>
        </View>
      </View>

      {/* Stride length edit modal */}
      <Modal visible={showStrideModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStrideModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContentWrap}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.strideModalCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Text style={[styles.strideModalTitle, { color: textColor }]}>Stride length (meters)</Text>
                <Text style={[styles.strideModalHint, { color: textSecondary }]}>Typical range 0.5 – 1.2 m. Affects indoor/treadmill distance.</Text>
                <TextInput
                  style={[styles.strideInput, { backgroundColor: cardBorder, color: textColor }]}
                  value={strideLengthInput}
                  onChangeText={setStrideLengthInput}
                  keyboardType="decimal-pad"
                  placeholder="0.75"
                  placeholderTextColor="#666"
                />
                <View style={styles.strideModalButtons}>
                  <TouchableOpacity style={styles.strideModalCancel} onPress={() => setShowStrideModal(false)}>
                    <Text style={styles.strideModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.strideModalSave}
                    onPress={async () => {
                      const v = parseFloat(strideLengthInput);
                      if (isNaN(v) || v < 0.5 || v > 1.2) {
                        Alert.alert('Invalid value', 'Enter a number between 0.5 and 1.2 meters.');
                        return;
                      }
                      await updateSettings({ indoor_stride_length_meters: v });
                      setShowStrideModal(false);
                    }}
                  >
                    <Text style={styles.strideModalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Music Integration - Only show for admins */}
      {userProfile?.is_admin && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.musicIntegration')}</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Spotify</Text>
                <Text style={styles.settingValue}>
                  {spotifyEnabled 
                    ? "Music integration button is visible on your profile"
                    : "Music integration button is hidden on your profile"
                  }
                </Text>
              </View>
              <Switch
                value={spotifyEnabled}
                onValueChange={handleToggleSpotify}
                trackColor={{ false: '#333', true: '#00ffff50' }}
                thumbColor={spotifyEnabled ? '#00ffff' : '#666'}
              />
            </View>
          </View>
        </View>
      )}

      {/* Privacy & Blocking Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.privacyBlocking')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {/* Public Profile Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.privacyInfo}>
              <View style={styles.privacyHeader}>
                <Ionicons 
                  name={userProfile?.is_profile_public === true ? "earth-outline" : "lock-closed-outline"} 
                  size={20} 
                  color="#00ffff" 
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.settingLabel}>Public Profile</Text>
              </View>
              <Text style={styles.privacyDescription}>
                {userProfile?.is_profile_public === true 
                  ? 'Others can see your stats and activities' 
                  : 'Your stats and activities are hidden'}
              </Text>
            </View>
            <Switch
              value={userProfile?.is_profile_public === true}
              onValueChange={async (value) => {
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ is_profile_public: value })
                    .eq('id', user?.id);
                  if (error) throw error;
                  if (updateProfile) {
                    updateProfile({ is_profile_public: value });
                  }
                } catch (error) {
                  console.error('Error updating privacy:', error);
                  Alert.alert('Error', 'Failed to update privacy setting');
                }
              }}
              trackColor={{ false: '#333', true: 'rgba(0, 255, 255, 0.4)' }}
              thumbColor={userProfile?.is_profile_public === true ? '#00ffff' : '#888'}
            />
          </View>

          <View style={[styles.settingRowWithBorder, { marginTop: 15 }]}>
          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => router.push('/blocked-users')}
          >
            <View style={styles.legalLinkContent}>
              <Ionicons name="ban-outline" size={20} color="#00ffff" />
              <Text style={styles.legalLinkText}>Blocked Users</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.account')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {/* Change Password Button */}
          <TouchableOpacity 
            style={[styles.settingButton, { backgroundColor: '#00ffff20' }]}
            onPress={() => setShowChangePasswordModal(true)}
          >
            <View style={styles.settingButtonContent}>
              <Ionicons name="lock-closed-outline" size={20} color="#00ffff" />
              <Text style={[styles.settingButtonText, { color: '#00ffff' }]}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingButton, { marginTop: 16 }]}
            onPress={handleSignOut}
          >
            <Text style={styles.dangerText}>Sign Out</Text>
            <Ionicons name="log-out-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingButton, { marginTop: 16, backgroundColor: 'rgba(255, 68, 68, 0.1)' }]}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => setShowPasswordModal(true)
                  }
                ]
              );
            }}
          >
            <Text style={[styles.dangerText, { color: '#ff4444' }]}>Delete Account</Text>
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
          
          {/* Feedback Button */}
          <TouchableOpacity
            style={[styles.settingButton, { marginTop: 16, backgroundColor: '#00ffff20', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
            onPress={() => Linking.openURL('https://docs.google.com/forms/d/e/1FAIpQLScqC-Un8Nisy7W1iGYTIvjUmMr4iZyEMLJ-hfv53OsNvzHmfg/viewform?usp=dialog')}
          >
            <Ionicons name="chatbox-ellipses-outline" size={20} color="#00ffff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#00ffff', fontWeight: 'bold', fontSize: 16 }}>Send Feedback</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legal Section - Separate from Account */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{t('settings.legal')}</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.legalLinksContainer}>
            <TouchableOpacity 
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://www.betteruai.com/terms-of-service')}
            >
              <View style={styles.legalLinkContent}>
                <Ionicons name="document-text-outline" size={20} color="#00ffff" />
                <Text style={styles.legalLinkText}>Terms of Service</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://www.betteruai.com/privacy-policy')}
            >
              <View style={styles.legalLinkContent}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#00ffff" />
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {editingField && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditingField(null)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { alignItems: 'center', padding: 20 }]}>
              <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingField === 'calorie_goal' ? 'Edit Calorie Goal' : 
                 editingField === 'water_goal' ? 'Edit Water Goal' : 'Edit Protein Goal'}
              </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setEditingField(null)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={parseInt(editValue)}
                  onValueChange={(value) => setEditValue(value.toString())}
                  style={{ width: 200, color: '#fff', backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#222' }}
                  itemStyle={{ color: '#fff', fontSize: 22 }}
                >
                  {editingField === 'calorie_goal' ? (
                    // Calorie options from 1000 to 5000 in steps of 100
                    [...Array(41)].map((_, i) => {
                      const value = 1000 + (i * 100);
                      return <Picker.Item key={value} label={`${value} cal`} value={value} />;
                    })
                  ) : editingField === 'water_goal' ? (
                    // Water options from 1L to 5L in steps of 0.5L
                    [...Array(9)].map((_, i) => {
                      const value = 1 + (i * 0.5);
                      return <Picker.Item key={value} label={`${value} L`} value={value} />;
                    })
                  ) : (
                    // Protein options from 50g to 300g in steps of 10g
                    [...Array(26)].map((_, i) => {
                      const value = 50 + (i * 10);
                      return <Picker.Item key={value} label={`${value} g`} value={value} />;
                    })
                  )}
                </Picker>
              </View>
                <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { marginTop: 20, width: '100%' }]} 
                onPress={() => {
                  let goalType;
                  if (editingField === 'calorie_goal') {
                    goalType = 'calories';
                  } else if (editingField === 'water_goal') {
                    goalType = 'water';
                  } else if (editingField === 'protein_goal') {
                    goalType = 'protein';
                  }
                  handleGoalEdit(goalType, editValue);
                  setEditingField(null);
                }}
                >
                <Text style={[styles.buttonText, { color: '#000' }]}>Save</Text>
                </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={showRestPicker} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { alignItems: 'center', padding: 20 }]}> 
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Rest Time</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowRestPicker(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={restTimeSeconds}
                onValueChange={handleRestTimeChange}
                style={{ width: 200, color: '#fff', backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#222' }}
                itemStyle={{ color: '#fff', fontSize: 22 }}
              >
                {[...Array(19)].map((_, i) => {
                  const val = 30 + i * 15;
                  return <Picker.Item key={val} label={formatRestTime(val)} value={val} />;
                })}
              </Picker>
            </View>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton, { marginTop: 20, width: '100%' }]} 
              onPress={() => setShowRestPicker(false)}
            >
              <Text style={[styles.buttonText, { color: '#000' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowChangePasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        }}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modernModalContent}>
            {/* Header */}
            <View style={styles.modernModalHeader}>
              <Text style={styles.modernModalTitle}>Change Password</Text>
              <TouchableOpacity
                style={styles.modernCloseButton}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Current Password Input */}
            <View style={styles.passwordSection}>
              <Text style={styles.passwordLabel}>Current Password</Text>
              <View style={styles.modernInputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.modernInput}
                  placeholder="Enter your current password"
                  placeholderTextColor="#666"
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isChangingPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={isChangingPassword}
                >
                  <Ionicons 
                    name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password Input */}
            <View style={styles.passwordSection}>
              <Text style={styles.passwordLabel}>New Password</Text>
              <View style={styles.modernInputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.modernInput}
                  placeholder="Enter your new password"
                  placeholderTextColor="#666"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isChangingPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  disabled={isChangingPassword}
                >
                  <Ionicons 
                    name={showNewPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm New Password Input */}
            <View style={styles.passwordSection}>
              <Text style={styles.passwordLabel}>Confirm New Password</Text>
              <View style={styles.modernInputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.modernInput}
                  placeholder="Confirm your new password"
                  placeholderTextColor="#666"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isChangingPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isChangingPassword}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.modernButtonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                disabled={isChangingPassword}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, isChangingPassword && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.saveButtonText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modern Password Confirmation Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPassword('');
        }}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modernModalContent}>
            {/* Warning Icon */}
            <View style={styles.warningIconContainer}>
              <Ionicons name="warning" size={32} color="#ff4444" />
            </View>
            
            {/* Header */}
            <View style={styles.modernModalHeader}>
              <Text style={styles.modernModalTitle}>Delete Account</Text>
              <TouchableOpacity
                style={styles.modernCloseButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Warning Message */}
            <View style={styles.warningMessage}>
              <Text style={styles.warningTitle}>This action cannot be undone</Text>
              <Text style={styles.warningText}>
                Deleting your account will permanently remove all your data, including:
              </Text>
              <View style={styles.warningList}>
                <View style={styles.warningItem}>
                  <Ionicons name="remove-circle" size={16} color="#ff4444" />
                  <Text style={styles.warningItemText}>Workout history and progress</Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="remove-circle" size={16} color="#ff4444" />
                  <Text style={styles.warningItemText}>Personal records and achievements</Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="remove-circle" size={16} color="#ff4444" />
                  <Text style={styles.warningItemText}>Profile and settings</Text>
                </View>
              </View>
            </View>
            
            {/* Password Input */}
            <View style={styles.passwordSection}>
              <Text style={styles.passwordLabel}>Enter your password to confirm</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Your password"
                placeholderTextColor="#666"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
            </View>
            
            {/* Action Buttons */}
            <View style={styles.modernButtonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  { opacity: isDeleting ? 0.7 : 1 }
                ]}
                onPress={async () => {
                  if (!password) {
                    Alert.alert('Error', 'Please enter your password');
                    return;
                  }
                  
                  setIsDeleting(true);
                  try {
                    // First verify the password
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                      email: user.email,
                      password: password
                    });
                    
                    if (signInError) {
                      throw new Error('Invalid password');
                    }
                    
                    // If password is correct, proceed with account deletion
                    const { error: deleteError } = await supabase.rpc('delete_user_account');
                    if (deleteError) throw deleteError;
                    
                    await signOut();
                    router.replace('/(auth)/login');
                  } catch (error) {
                    console.error('Error:', error);
                    Alert.alert(
                      'Error',
                      error.message === 'Invalid password' 
                        ? 'Incorrect password. Please try again.'
                        : 'Failed to delete account. Please try again later.'
                    );
                  } finally {
                    setIsDeleting(false);
                    setShowPasswordModal(false);
                    setPassword('');
                  }
                }}
                disabled={isDeleting}
              >
                <View style={styles.deleteButtonContent}>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="trash" size={18} color="#fff" />
                  )}
                  <Text style={styles.deleteButtonText}>
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 60,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  premiumButton: {
    backgroundColor: '#00ffff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  premiumButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  section: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  settingSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editButtonContainer: {
    position: 'relative',
    width: 35,
    height: 35,
  },
  editButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 17.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'auto',
  },
  settingRowWithBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 10,
    paddingTop: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentWrap: {
    width: '100%',
    maxWidth: 340,
  },
  strideModalCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  strideModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  strideModalHint: {
    fontSize: 13,
    marginBottom: 16,
  },
  strideInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    marginBottom: 20,
  },
  strideModalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  strideModalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  strideModalCancelText: {
    color: '#888',
    fontSize: 16,
  },
  strideModalSave: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#00ffff',
  },
  strideModalSaveText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 5,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  dangerText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    width: '100%',
    fontSize: 16,
  },
  modalText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  // Modern Modal Styles
  modernModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modernModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  modernCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  warningMessage: {
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  warningList: {
    gap: 8,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningItemText: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  passwordSection: {
    marginBottom: 24,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modernInput: {
    flex: 1,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  passwordToggle: {
    padding: 16,
  },
  modernButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  settingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Modern Legal Section Styles
  legalLinksContainer: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    gap: 12,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  legalLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legalLinkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  privacyInfo: {
    flex: 1,
    marginRight: 15,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginLeft: 30,
  },
  // Modern Rest Timer Styles
  modernSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    marginBottom: 12,
  },
  modernValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  modernSettingValue: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modernEditButtonContainer: {
    position: 'relative',
  },
  modernEditButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modernLockOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modernLockContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  premiumStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionManageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  subscriptionManageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  premiumUpgradeCard: {
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  premiumUpgradeContent: {
    marginBottom: 18,
  },
  premiumUpgradeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  premiumUpgradeTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  premiumUpgradeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  premiumUpgradeButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumUpgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  premiumUpgradeButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default SettingsScreen; 