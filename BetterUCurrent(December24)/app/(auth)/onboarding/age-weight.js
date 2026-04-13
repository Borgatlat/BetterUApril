import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useUnits } from '../../../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';

export default function AgeWeightScreen() {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { useImperial, toggleUnits, convertWeightBack, getWeightUnit } = useUnits();
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Session check error:', error);
      router.replace('/(auth)/login');
    }
  };

  const validateWeight = (value) => {
    const weightNum = parseFloat(value);
    if (useImperial) {
      return !isNaN(weightNum) && weightNum <= 1100; // lbs upper bound only
    }
    return !isNaN(weightNum) && weightNum <= 500; // kg upper bound only
  };

  const handleNext = async () => {
    if (!age || !weight) {
      setError('Please fill in all fields');
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      setError('Please enter a valid age between 13 and 120');
      return;
    }

    if (!validateWeight(weight)) {
      setError(useImperial 
        ? 'Please enter a valid weight under 1100 lbs'
        : 'Please enter a valid weight under 500 kg'
      );
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }

      // Convert weight to kg if using imperial
      const weightInKg = convertWeightBack(weight);
      
      // Debug logging
      console.log('Original weight input:', weight);
      console.log('Converted weight to kg:', weightInKg);
      console.log('Final weight for storage:', parseFloat(weightInKg));

      const { error: storageError } = await supabase
        .from('onboarding_data')
        .update({
          age: ageNum,
          weight: parseFloat(weightInKg),
        })
        .eq('id', session.user.id);

      if (storageError) {
        console.error('Storage error:', storageError);
        setError('Failed to save data. Please try again.');
        return;
      }

      router.push('/(auth)/onboarding/height');
    } catch (error) {
      console.error('Error in handleNext:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.card}>
                <Text style={styles.title}>Age & Weight</Text>
                <Text style={styles.subtitle}>This helps us create personalized workout plans</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={24} color="#00ffff" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    value={age}
                    onChangeText={setAge}
                    placeholder="Enter your age"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.unitToggle}>
                  <Text style={styles.unitText}>kg</Text>
                  <Switch
                    value={useImperial}
                    onValueChange={toggleUnits}
                    trackColor={{ false: '#333', true: '#00ffff50' }}
                    thumbColor={useImperial ? '#00ffff' : '#666'}
                  />
                  <Text style={styles.unitText}>lbs</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="scale-outline" size={24} color="#00ffff" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder={`Enter your weight in ${getWeightUnit()}`}
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleNext}
                  />
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity style={styles.button} onPress={handleNext}>
                  <Text style={styles.buttonText}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" style={styles.buttonIcon} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  icon: {
    padding: 15,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 15,
  },
  unitToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
  },
  unitText: {
    color: '#fff',
    fontSize: 16,
    marginHorizontal: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
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