import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const BanScreen = () => {
  const { banStatus, signOut } = useAuth();
  const { isPremium } = useUser();
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [hoursRemaining, setHoursRemaining] = useState(null);

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // Calculate days and hours remaining for temporary bans
  useEffect(() => {
    if (banStatus?.endsAt && !banStatus?.permanent) {
      const updateCountdown = () => {
        const now = new Date();
        const endDate = new Date(banStatus.endsAt);
        const diffMs = endDate - now;
        
        if (diffMs <= 0) {
          setDaysRemaining(0);
          setHoursRemaining(0);
          return;
        }
        
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        setDaysRemaining(days);
        setHoursRemaining(hours);
      };
      
      // Update immediately
      updateCountdown();
      
      // Update every hour
      const interval = setInterval(updateCountdown, 60 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [banStatus?.endsAt, banStatus?.permanent]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubscriptionManagement = async () => {
    if (isPremium) {
      // For premium users, open Apple's subscription management page
      try {
        const url = Platform.OS === 'ios' 
          ? 'https://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions';
        
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'Subscription Management',
            Platform.OS === 'ios'
              ? 'To manage your subscription:\n\n1. Open the App Store\n2. Tap your profile icon\n3. Tap "Subscriptions"\n4. Find BetterU and manage your subscription'
              : 'To manage your subscription:\n\n1. Open Google Play Store\n2. Tap Menu → Subscriptions\n3. Find BetterU and manage your subscription',
            [
              { 
                text: Platform.OS === 'ios' ? 'Open App Store' : 'Open Play Store', 
                onPress: () => Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com' : 'https://play.google.com') 
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      } catch (error) {
        console.error('Error opening subscription management:', error);
        Alert.alert(
          'Subscription Management',
          Platform.OS === 'ios'
            ? 'To manage your subscription:\n\n1. Open the App Store\n2. Tap your profile icon\n3. Tap "Subscriptions"\n4. Find BetterU and manage your subscription'
            : 'To manage your subscription:\n\n1. Open Google Play Store\n2. Tap Menu → Subscriptions\n3. Find BetterU and manage your subscription',
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        'No Active Subscription',
        'You do not have an active subscription to manage.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleContactSupport = async () => {
    try {
      const url = 'https://betteruai.com';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Contact Support',
          'Please visit betteruai.com to contact support if you believe this suspension was a mistake.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening support website:', error);
      Alert.alert(
        'Contact Support',
        'Please visit betteruai.com to contact support if you believe this suspension was a mistake.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="ban" size={80} color="#ff0055" style={styles.icon} />
        
        <Text style={styles.title}>Account Suspended</Text>
        
        <Text style={styles.message}>
          {banStatus?.permanent
            ? "Your account has been permanently suspended for violating our community guidelines."
            : `Your account has been temporarily suspended until ${formatDate(banStatus?.endsAt)}.`
          }
        </Text>

        {/* Days Remaining Countdown for Temporary Bans */}
        {!banStatus?.permanent && banStatus?.endsAt && daysRemaining !== null && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Time Remaining:</Text>
            <View style={styles.countdownContent}>
              {daysRemaining > 0 ? (
                <>
                  <View style={styles.countdownItem}>
                    <Text style={styles.countdownNumber}>{daysRemaining}</Text>
                    <Text style={styles.countdownUnit}>{daysRemaining === 1 ? 'Day' : 'Days'}</Text>
                  </View>
                  {hoursRemaining > 0 && (
                    <>
                      <Text style={styles.countdownSeparator}>:</Text>
                      <View style={styles.countdownItem}>
                        <Text style={styles.countdownNumber}>{hoursRemaining}</Text>
                        <Text style={styles.countdownUnit}>{hoursRemaining === 1 ? 'Hour' : 'Hours'}</Text>
                      </View>
                    </>
                  )}
                </>
              ) : (
                <Text style={styles.countdownExpired}>Suspension has ended</Text>
              )}
            </View>
          </View>
        )}

        {banStatus?.reason && (
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{banStatus.reason}</Text>
          </View>
        )}

        {/* Contact Support Section */}
        <View style={styles.contactContainer}>
          <Ionicons name="help-circle-outline" size={18} color="#00ffff" style={styles.contactIcon} />
          <Text style={styles.contactText}>
            Think this was a mistake?{' '}
            <Text style={styles.contactLink} onPress={handleContactSupport}>
              Contact us at betteruai.com
            </Text>
          </Text>
        </View>

        {/* Subscription Management Button */}
        <TouchableOpacity 
          style={styles.subscriptionButton} 
          onPress={handleSubscriptionManagement}
        >
          <Ionicons name="card-outline" size={20} color="#00ffff" style={styles.subscriptionIcon} />
          <Text style={styles.subscriptionText}>
            {isPremium ? 'Manage Subscription' : 'View Subscription'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: '#18191b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 85, 0.2)',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff0055',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  reasonContainer: {
    backgroundColor: 'rgba(255, 0, 85, 0.1)',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
  },
  reasonLabel: {
    fontSize: 14,
    color: '#ff0055',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  reasonText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  countdownContainer: {
    backgroundColor: 'rgba(255, 0, 85, 0.15)',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 85, 0.3)',
  },
  countdownLabel: {
    fontSize: 14,
    color: '#ff0055',
    marginBottom: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  countdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  countdownItem: {
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  countdownUnit: {
    fontSize: 12,
    color: '#ff0055',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  countdownSeparator: {
    fontSize: 24,
    color: '#ff0055',
    fontWeight: 'bold',
  },
  countdownExpired: {
    fontSize: 16,
    color: '#00ffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  contactIcon: {
    marginRight: 10,
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  contactLink: {
    color: '#00ffff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  subscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  subscriptionIcon: {
    marginRight: 8,
  },
  subscriptionText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#ff0055',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default BanScreen;
