import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useUnits } from '../../../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';

export default function HeightScreen() {
  const [height, setHeight] = useState('');      // Used for metric (cm)
  const [feet, setFeet] = useState('');          // Imperial: feet (shown first)
  const [inches, setInches] = useState('');      // Imperial: inches (shown second)
  const [error, setError] = useState('');
  const { useImperial, toggleUnits, convertHeightBack, getHeightUnit } = useUnits();
  const router = useRouter();

  const validateHeight = (value) => {
    const heightNum = parseFloat(value);
    if (useImperial) {
      return !isNaN(heightNum) && heightNum <= 98; // inches upper bound only
    }
    return !isNaN(heightNum) && heightNum <= 250; // cm upper bound only
  };

  // Validate feet (typically 2-8) and inches (0-11) for imperial
  const validateFeetInches = (ft, inVal) => {
    const ftNum = parseInt(ft, 10);
    const inNum = parseInt(inVal, 10);
    if (isNaN(ftNum) || ftNum < 1 || ftNum > 8) return false;
    if (isNaN(inNum) || inNum < 0 || inNum > 11) return false;
    return true;
  };

  const handleNext = async () => {
    if (useImperial) {
      if (!feet || !inches) {
        setError('Please enter both feet and inches');
        return;
      }
      if (!validateFeetInches(feet, inches)) {
        setError('Please enter valid height (e.g. 5 ft, 10 in)');
        return;
      }
    } else {
      if (!height) {
        setError('Please enter your height');
        return;
      }
      if (!validateHeight(height)) {
        setError('Please enter a valid height under 250 cm');
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }

      // Imperial: feet * 12 + inches = total inches, then convert to cm
      // Metric: value is already in cm
      const heightInCm = useImperial
        ? convertHeightBack(String(parseInt(feet, 10) * 12 + parseInt(inches, 10)))
        : convertHeightBack(height);
      
      // Debug logging
      console.log('Original height input:', useImperial ? `${feet}ft ${inches}in` : height);
      console.log('Converted height to cm:', heightInCm);
      console.log('Final height for storage:', parseFloat(heightInCm));

      const { error: storageError } = await supabase
        .from('onboarding_data')
        .update({
          height: parseFloat(heightInCm),
        })
        .eq('id', session.user.id);

      if (storageError) {
        setError('Failed to save data. Please try again.');
        return;
      }

      router.push('/(auth)/onboarding/summary');
    } catch (error) {
      console.error('Error in handleNext:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

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
                <Text style={styles.title}>Your Height</Text>
                <Text style={styles.subtitle}>This helps us calculate your BMI and track progress</Text>

                <View style={styles.unitToggle}>
                  <Text style={styles.unitText}>cm</Text>
                  <Switch
                    value={useImperial}
                    onValueChange={toggleUnits}
                    trackColor={{ false: '#333', true: '#00ffff50' }}
                    thumbColor={useImperial ? '#00ffff' : '#666'}
                  />
                  <Text style={styles.unitText}>ft/in</Text>
                </View>

                {useImperial ? (
                  <>
                    {/* Feet first, then inches - order matters for natural flow */}
                    <View style={styles.inputContainer}>
                      <Ionicons name="body-outline" size={24} color="#00ffff" style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        value={feet}
                        onChangeText={(t) => setFeet(t.replace(/[^0-9]/g, ''))}
                        placeholder="Feet"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        returnKeyType="next"
                        maxLength={2}
                      />
                      <Text style={styles.unitLabel}>ft</Text>
                    </View>
                    <View style={styles.inputContainer}>
                      <Ionicons name="resize-outline" size={24} color="#00ffff" style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        value={inches}
                        onChangeText={(t) => setInches(t.replace(/[^0-9]/g, '').slice(0, 2))}
                        placeholder="Inches"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        returnKeyType="done"
                        maxLength={2}
                        onSubmitEditing={handleNext}
                      />
                      <Text style={styles.unitLabel}>in</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.inputContainer}>
                    <Ionicons name="body-outline" size={24} color="#00ffff" style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      value={height}
                      onChangeText={setHeight}
                      placeholder={`Enter your height in ${getHeightUnit()}`}
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      onSubmitEditing={handleNext}
                    />
                  </View>
                )}

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
  unitLabel: {
    color: '#666',
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 15,
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