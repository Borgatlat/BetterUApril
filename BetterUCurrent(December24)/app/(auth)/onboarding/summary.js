import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useUnits } from '../../../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import { formatBMI } from '../../../utils/formatUtils';
import { useAuth } from '../../../context/AuthContext';

const calculateBMI = (weight, height) => {
  // Convert height from cm to m
  const heightInMeters = height / 100;
  return formatBMI(weight / (heightInMeters * heightInMeters));
};

const getBMICategory = (bmi) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

export default function SummaryScreen() {
  const [onboardingData, setOnboardingData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { useImperial, convertWeight, convertHeight } = useUnits();
  const router = useRouter();
  const { refetchProfile } = useAuth();

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const fetchOnboardingData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }

      // Get user metadata from auth
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Fetch onboarding data
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('onboarding_data')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // Handle PGRST116 error silently (no rows found)
      if (onboardingError && onboardingError.code !== 'PGRST116') {
        throw onboardingError;
      }

      // Combine the data, using auth data as fallback
      const combinedData = {
        ...onboardingData,
        id: session.user.id,
        full_name: onboardingData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0],
        email: user.email,
        training_level: onboardingData?.training_level || 'beginner',
        age: onboardingData?.age,
        weight: onboardingData?.weight,
        height: onboardingData?.height,
        fitness_goals: onboardingData?.fitness_goals,
        gender: onboardingData?.gender,
        username: onboardingData?.username
      };

      console.log('Combined data:', combinedData);
      setOnboardingData(combinedData);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Only show error if it's not a PGRST116 error
      if (error.code !== 'PGRST116') {
        setError('Failed to load your data. Please try again.');
      }
    }
  };

  const handleSubmit = async () => {
    if (!onboardingData) return;

    setIsSubmitting(true);
    try {
      // Get the first fitness goal from the array
      const fitnessGoal = Array.isArray(onboardingData.fitness_goals) 
        ? onboardingData.fitness_goals[0] 
        : onboardingData.fitness_goals;

      // Create new profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: onboardingData.id,
          full_name: onboardingData.full_name,
          email: onboardingData.email,
          age: onboardingData.age,
          weight: onboardingData.weight,
          height: onboardingData.height,
          fitness_goal: fitnessGoal,
          gender: onboardingData.gender,
          username: onboardingData.username,
          training_level: onboardingData.training_level,
          bio: onboardingData.bio || "",
          onboarding_completed: false // Keep false until after predictions
        }, {
          onConflict: 'id'
        });

      if (profileError) throw profileError;

      // Navigate to predictions screen instead of completing onboarding
      router.push('/(auth)/onboarding/potential-predictions');
    } catch (error) {
      console.error('Error submitting profile:', error);
      setError('Failed to save your profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!onboardingData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  const bmi = calculateBMI(onboardingData.weight, onboardingData.height);
  const bmiCategory = getBMICategory(bmi);
  const displayWeight = useImperial ? convertWeight(onboardingData.weight) : onboardingData.weight;
  const displayHeight = useImperial ? convertHeight(onboardingData.height) : onboardingData.height;

  // Debug logging
  console.log('Weight data:', onboardingData.weight);
  console.log('Height data:', onboardingData.height);
  console.log('Display weight:', displayWeight);
  console.log('Display height:', displayHeight);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Profile Summary</Text>
            <Text style={styles.subtitle}>Review your information before we get started</Text>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{onboardingData.full_name}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="at-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Username</Text>
                  <Text style={styles.infoValue}>{onboardingData.username}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{onboardingData.email}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Age</Text>
                  <Text style={styles.infoValue}>{onboardingData.age} years</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="body-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Height</Text>
                  <Text style={styles.infoValue}>
                    {displayHeight ? `${displayHeight} ${useImperial ? 'in' : 'cm'}` : 'Not set'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="scale-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Weight</Text>
                  <Text style={styles.infoValue}>
                    {displayWeight ? `${displayWeight} ${useImperial ? 'lbs' : 'kg'}` : 'Not set'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="trophy-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Goal</Text>
                  <Text style={styles.infoValue}>
                    {onboardingData.fitness_goals?.[0]?.replace('_', ' ') || 'Not set'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="barbell-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Training Level</Text>
                  <Text style={styles.infoValue}>
                    {onboardingData.training_level?.charAt(0).toUpperCase() + onboardingData.training_level?.slice(1) || 'Not set'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person-circle-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Gender</Text>
                  <Text style={styles.infoValue}>{onboardingData.gender}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Bio</Text>
                  <Text style={styles.infoValue}>{onboardingData.bio || 'No bio yet'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="speedometer-outline" size={24} color="#00ffff" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>BMI</Text>
                  <Text style={styles.infoValue}>{bmi} ({bmiCategory})</Text>
                </View>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Start Your Journey</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" style={styles.buttonIcon} />
                </>
              )}
            </TouchableOpacity>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
    textTransform: 'capitalize',
  },
  error: {
    color: '#ff4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
}); 