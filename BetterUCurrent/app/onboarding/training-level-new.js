import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '../../context/UserContext';

export default function TrainingLevelScreen() {
  const [selectedLevel, setSelectedLevel] = useState('beginner');
  const router = useRouter();
  const { updateProfile } = useUser();

  const handleNext = async () => {
    try {
      console.log('Saving training level:', selectedLevel);
      
      // Update both training level and onboarding status in one operation
      const result = await updateProfile({
        training_level: selectedLevel,
        onboarding_completed: true
      });

      if (!result.success) {
        console.error('Error saving profile:', result.error);
        Alert.alert('Error', 'Failed to save your profile. Please try again.');
        return;
      }

      // If update succeeded, navigate to home
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Error in handleNext:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const levels = [
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'advanced', label: 'Advanced' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What's your training experience?</Text>
      <Text style={styles.subtitle}>This helps us personalize your workout plan</Text>
      
      <View style={styles.optionsContainer}>
        {levels.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.option,
              selectedLevel === level.id && styles.selectedOption
            ]}
            onPress={() => setSelectedLevel(level.id)}
          >
            <Text style={[
              styles.optionText,
              selectedLevel === level.id && styles.selectedOptionText
            ]}>
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleNext}
      >
        <Text style={styles.nextButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  optionsContainer: {
    marginBottom: 30,
  },
  option: {
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
  },
  selectedOption: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 