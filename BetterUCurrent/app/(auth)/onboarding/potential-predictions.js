import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useUnits } from '../../../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

const calculateBMI = (weight, height) => {
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
};

const getBMICategory = (bmi) => {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
};

const generatePredictions = (userData) => {
  const { age, weight, height, fitness_goals, gender, training_level } = userData;
  const bmi = calculateBMI(weight, height);
  const bmiCategory = getBMICategory(bmi);
  
  // Create a seed based on user data for consistent but varied predictions
  const seed = (age * 1000) + (weight * 10) + (height * 0.1) + (gender === 'male' ? 1 : 0);
  const random = (min, max) => {
    const x = Math.sin(seed + Date.now()) * 10000;
    const normalized = x - Math.floor(x);
    return min + (normalized * (max - min));
  };
  
  const predictions = {
    strength: {
      current: 0,
      potential: 0,
      percentage: 0,
      timeframe: '',
      description: ''
    },
    weight: {
      current: weight,
      potential: weight,
      percentage: 0,
      timeframe: '',
      description: ''
    },
    mental: {
      current: 0,
      potential: 0,
      percentage: 0,
      timeframe: '',
      description: ''
    },
    overall: {
      percentage: 0,
      timeframe: '',
      description: ''
    }
  };

  // Strength predictions based on training level, age, and goals
  const strengthMultipliers = {
    beginner: { min: 1.25, max: 1.75 },
    intermediate: { min: 1.1, max: 1.35 },
    advanced: { min: 1.05, max: 1.2 }
  };

  const strengthMultiplier = strengthMultipliers[training_level];
  const strengthGain = random(strengthMultiplier.min, strengthMultiplier.max);
  
  // Age factor - younger people have higher potential
  const ageFactor = age < 25 ? 1.1 : age < 35 ? 1.0 : age < 45 ? 0.9 : 0.8;
  const adjustedStrengthGain = strengthGain * ageFactor;
  
  predictions.strength = {
    current: 100,
    potential: Math.round(100 * adjustedStrengthGain),
    percentage: Math.round((adjustedStrengthGain - 1) * 100),
    timeframe: training_level === 'beginner' ? '3-6 months' : training_level === 'intermediate' ? '6-12 months' : '12-18 months',
    description: `With consistent training, you could increase your strength by up to ${Math.round((adjustedStrengthGain - 1) * 100)}%`
  };

  // Weight predictions based on BMI, goals, and age
  if (fitness_goals && fitness_goals.includes('muscle_growth')) {
    const baseMuscleGain = training_level === 'beginner' ? 6 : training_level === 'intermediate' ? 4 : 2;
    const ageWeightFactor = age < 30 ? 1.2 : age < 40 ? 1.0 : 0.8;
    const muscleGain = Math.round(baseMuscleGain * ageWeightFactor * random(0.8, 1.2));
    
    predictions.weight = {
      current: weight,
      potential: weight + muscleGain,
      percentage: Math.round((muscleGain / weight) * 100),
      timeframe: '6-12 months',
      description: `You could gain ${muscleGain}kg of lean muscle mass`
    };
  } else if (bmiCategory === 'overweight' || bmiCategory === 'obese') {
    const baseWeightLoss = training_level === 'beginner' ? 10 : training_level === 'intermediate' ? 7 : 4;
    const bmiFactor = bmi > 35 ? 1.3 : bmi > 30 ? 1.1 : 1.0;
    const weightLoss = Math.round(baseWeightLoss * bmiFactor * random(0.8, 1.2));
    
    predictions.weight = {
      current: weight,
      potential: weight - weightLoss,
      percentage: Math.round((weightLoss / weight) * 100),
      timeframe: '6-12 months',
      description: `You could lose ${weightLoss}kg of body fat`
    };
  } else {
    // For normal weight, focus on body composition
    const bodyCompImprovement = Math.round(random(2, 5));
    predictions.weight = {
      current: weight,
      potential: weight,
      percentage: bodyCompImprovement,
      timeframe: '3-6 months',
      description: `Improve body composition by ${bodyCompImprovement}% while maintaining weight`
    };
  }

  // Mental health predictions based on age and training level
  const mentalImprovements = {
    beginner: { stress: 35, focus: 30, confidence: 40 },
    intermediate: { stress: 20, focus: 25, confidence: 30 },
    advanced: { stress: 10, focus: 15, confidence: 20 }
  };

  const mentalGains = mentalImprovements[training_level];
  const stressGain = Math.round(mentalGains.stress * random(0.8, 1.2));
  const focusGain = Math.round(mentalGains.focus * random(0.8, 1.2));
  const confidenceGain = Math.round(mentalGains.confidence * random(0.8, 1.2));
  
  const avgMentalGain = Math.round((stressGain + focusGain + confidenceGain) / 3);
  
  predictions.mental = {
    current: 100,
    potential: 100 + avgMentalGain,
    percentage: avgMentalGain,
    timeframe: '2-4 months',
    description: `Improve stress management by ${stressGain}%, focus by ${focusGain}%, and confidence by ${confidenceGain}%`
  };

  // Overall improvement with more variation
  const overallGain = Math.round((predictions.strength.percentage + predictions.mental.percentage + predictions.weight.percentage) / 3);
  predictions.overall = {
    percentage: overallGain,
    timeframe: '3-6 months',
    description: `Transform your life with ${overallGain}% overall improvement`
  };

  return predictions;
};

export default function PotentialPredictionsScreen() {
  const [onboardingData, setOnboardingData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPredictions, setShowPredictions] = useState(false);
  const { useImperial, convertWeight } = useUnits();
  const router = useRouter();
  const { refetchProfile } = useAuth();

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  useEffect(() => {
    if (predictions) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [predictions]);

  const fetchOnboardingData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: onboardingData, error: onboardingError } = await supabase
        .from('onboarding_data')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (onboardingError && onboardingError.code !== 'PGRST116') {
        throw onboardingError;
      }

      setOnboardingData(onboardingData);
      
      // Generate predictions
      const generatedPredictions = generatePredictions(onboardingData);
      setPredictions(generatedPredictions);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load your data. Please try again.');
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    try {
      // Mark onboarding as completed and navigate directly to home
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        // Mark onboarding as completed
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', session.user.id);

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
      }
      
      // Navigate directly to main app (skipping subscription screen)
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError('Failed to complete onboarding. Please try again.');
    }
  };

  const PredictionCard = ({ title, icon, current, potential, percentage, timeframe, description, color }) => (
    <Animated.View style={[styles.predictionCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons name={icon} size={24} color="#ffffff" />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      
      <View style={styles.predictionContent}>
        <View style={styles.percentageContainer}>
          <Text style={styles.percentageText}>+{percentage}%</Text>
          <Text style={styles.timeframeText}>in {timeframe}</Text>
        </View>
        
        <Text style={styles.descriptionText}>{description}</Text>
        
        {title === 'Weight' && (
          <View style={styles.weightComparison}>
            <Text style={styles.weightText}>
              {useImperial ? convertWeight(current) : current} {useImperial ? 'lbs' : 'kg'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#00ffff" />
            <Text style={styles.weightText}>
              {useImperial ? convertWeight(potential) : potential} {useImperial ? 'lbs' : 'kg'}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text style={styles.loadingText}>Analyzing your potential...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOnboardingData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Potential</Text>
            <Text style={styles.subtitle}>AI-powered predictions based on your profile</Text>
          </View>

          {predictions && (
            <View style={styles.predictionsContainer}>
              <PredictionCard
                title="Strength"
                icon="barbell"
                current={predictions.strength.current}
                potential={predictions.strength.potential}
                percentage={predictions.strength.percentage}
                timeframe={predictions.strength.timeframe}
                description={predictions.strength.description}
                color="#ff6b6b"
              />

              <PredictionCard
                title="Weight"
                icon="scale"
                current={predictions.weight.current}
                potential={predictions.weight.potential}
                percentage={predictions.weight.percentage}
                timeframe={predictions.weight.timeframe}
                description={predictions.weight.description}
                color="#4ecdc4"
              />

                             <PredictionCard
                 title="Mental Health"
                 icon="happy"
                 current={predictions.mental.current}
                 potential={predictions.mental.potential}
                 percentage={predictions.mental.percentage}
                 timeframe={predictions.mental.timeframe}
                 description={predictions.mental.description}
                 color="#45b7d1"
               />

              <View style={styles.overallCard}>
                <View style={styles.overallHeader}>
                  <Ionicons name="trophy" size={32} color="#ffd93d" />
                  <Text style={styles.overallTitle}>Overall Transformation</Text>
                </View>
                <Text style={styles.overallPercentage}>+{predictions.overall.percentage}%</Text>
                <Text style={styles.overallDescription}>{predictions.overall.description}</Text>
                <Text style={styles.overallTimeframe}>in {predictions.overall.timeframe}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Start My Journey</Text>
            <Ionicons name="rocket" size={20} color="#000000" />
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
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
  title: {
    fontSize: 32,
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
  predictionsContainer: {
    flex: 1,
    gap: 20,
  },
  predictionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  predictionContent: {
    gap: 10,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  percentageText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  timeframeText: {
    fontSize: 16,
    color: '#B3B3B3',
  },
  descriptionText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  weightComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 5,
  },
  weightText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  overallCard: {
    backgroundColor: 'rgba(255, 217, 61, 0.1)',
    borderRadius: 16,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 217, 61, 0.3)',
    alignItems: 'center',
  },
  overallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  overallTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 15,
  },
  overallPercentage: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffd93d',
    marginBottom: 10,
  },
  overallDescription: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 5,
  },
  overallTimeframe: {
    fontSize: 14,
    color: '#B3B3B3',
  },
  continueButton: {
    backgroundColor: '#00ffff',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  continueButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
}); 