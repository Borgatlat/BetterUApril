import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LogoImage } from '../../../utils/imageUtils';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';

export default function SubscriptionIntroScreen() {
  const router = useRouter();
  const { refetchProfile } = useAuth();

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  /**
   * Entry animation only. Do NOT auto-skip this screen — users choose trial (→ paywall) or free.
   * Trial eligibility and charging happen on /purchase-subscription via RevenueCat + App Store.
   */
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  /** Opens checkout UI; Apple applies free trial if eligible (see purchase-subscription + lib/purchases). */
  const handleSubscribe = async () => {
    try {
      router.push('/purchase-subscription');
    } catch (error) {
      console.error('Error navigating to purchase:', error);
      Alert.alert('Could not open subscription', 'Please try again or upgrade later from Settings.');
    }
  };

  const handleContinueFree = async () => {
    try {
      // Mark onboarding as completed
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', session.user.id);
      }

      // Delete the temporary onboarding data
      const { error: deleteError } = await supabase
        .from('onboarding_data')
        .delete()
        .eq('id', session.user.id);

      if (deleteError) {
        console.error('Error deleting onboarding data:', deleteError);
      }

      // Refetch profile to update context
      await refetchProfile();
      
      // Navigate to main app
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Something went wrong', 'Failed to complete onboarding. Please try again.');
    }
  };

  const PremiumFeature = ({ icon, title, description, isHighlighted = false }) => (
    <Animated.View 
      style={[
        styles.featureItem,
        isHighlighted && styles.highlightedFeature,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={[styles.featureIcon, isHighlighted && styles.highlightedIcon]}>
        <Ionicons name={icon} size={24} color={isHighlighted ? "#ffd93d" : "#00ffff"} />
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, isHighlighted && styles.highlightedText]}>
          {title}
        </Text>
        <Text style={[styles.featureDescription, isHighlighted && styles.highlightedText]}>
          {description}
        </Text>
      </View>
    </Animated.View>
  );



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <LogoImage size={100} style={styles.logo} />
            <Text style={styles.title}>Unlock Your Full Potential</Text>
            <Text style={styles.subtitle}>
              Get even better predictions and faster results with Premium
            </Text>
            <Text style={styles.trialBlurb}>
              7-day free trial on the next screen. After the trial, you will be charged unless you cancel
              in Subscriptions (Apple determines exact price and eligibility).
            </Text>
          </View>

          {/* Premium Features */}
          <View style={styles.featuresContainer}>
            <Text style={styles.sectionTitle}>Premium Features</Text>
            
            <PremiumFeature
              icon="trending-up"
              title="Enhanced AI Predictions"
              description="Get 40% more accurate predictions and faster progress tracking"
              isHighlighted={true}
            />
            
            <PremiumFeature
              icon="restaurant"
              title="AI Meal Generation"
              description="Get personalized meal plans and nutrition recommendations"
            />
            
            <PremiumFeature
              icon="fitness"
              title="AI-Generated Workouts"
              description="Personalized workouts that adapt to your progress"
            />
            
            <PremiumFeature
              icon="chatbubbles"
              title="100 Daily AI Messages"
              description="Get unlimited fitness guidance and motivation"
            />
            
            <PremiumFeature
              icon="list"
              title="Premium Workout Plans"
              description="Access exclusive, professionally designed programs"
            />
            
            <PremiumFeature
              icon="headset"
              title="Guided Audio Sessions"
              description="Calming guided content for mental wellness"
            />
            
            <PremiumFeature
              icon="infinite"
              title="Unlimited Custom Workouts"
              description="Create and save unlimited personalized routines"
            />
            
            <PremiumFeature
              icon="people"
              title="Create Community Groups"
              description="Build and manage your own fitness communities"
            />
          </View>



          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
              <LinearGradient
                colors={['#00ffff', '#0088ff']}
                style={styles.subscribeGradient}
              >
                <Text style={styles.subscribeButtonText}>Start your 7-day free trial</Text>
                <Ionicons name="star" size={20} color="#000000" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.freeButton} onPress={handleContinueFree}>
              <Text style={styles.freeButtonText}>Continue with Free Version</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              {`Tapping above opens the subscription screen — only Apple's payment sheet charges you. You can upgrade anytime from Settings.`}
            </Text>
            
            <Text style={styles.predictionNote}>
              💡 Premium users get enhanced AI predictions and faster progress tracking
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B3B3B3',
    textAlign: 'center',
    lineHeight: 22,
  },
  trialBlurb: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  highlightedFeature: {
    backgroundColor: 'rgba(255, 217, 61, 0.1)',
    borderColor: 'rgba(255, 217, 61, 0.3)',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  highlightedIcon: {
    backgroundColor: 'rgba(255, 217, 61, 0.2)',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  highlightedText: {
    color: '#ffd93d',
  },
  featureDescription: {
    fontSize: 14,
    color: '#B3B3B3',
    lineHeight: 20,
  },

  actionContainer: {
    gap: 15,
  },
  subscribeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  subscribeGradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  freeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  freeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 12,
    color: '#B3B3B3',
    textAlign: 'center',
    marginTop: 10,
  },
  predictionNote: {
    fontSize: 13,
    color: '#00ffff',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
}); 