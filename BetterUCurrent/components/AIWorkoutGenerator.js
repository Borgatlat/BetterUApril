import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export const AIWorkoutGenerator = ({
  isInModal = false,
  onClose,
  onWorkoutGenerated,
  usageInfo = { currentUsage: 0, limit: 1, remaining: 1 },
  isPremium = false,
}) => {
  const [preferences, setPreferences] = useState({
    workoutType: 'strength',
    intensity: 'moderate',
    focusArea: 'full_body',
    duration: '45',
    notes: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const workoutTypes = [
    { key: 'strength', label: 'Strength Training', icon: '💪' },
    { key: 'cardio', label: 'Cardio', icon: '❤️' },
    { key: 'hiit', label: 'HIIT', icon: '⚡' },
    { key: 'flexibility', label: 'Flexibility', icon: '🧘' },
    { key: 'endurance', label: 'Endurance', icon: '🏃' },
    { key: 'other', label: 'Other', icon: '🎯' }
  ];

  const intensityLevels = [
    { key: 'beginner', label: 'Beginner', icon: '🌱' },
    { key: 'moderate', label: 'Moderate', icon: '🔥' },
    { key: 'advanced', label: 'Advanced', icon: '💪' },
    { key: 'elite', label: 'Elite', icon: '⚡' }
  ];

  const focusAreas = [
    { key: 'full_body', label: 'Full Body', icon: '👤' },
    { key: 'upper_body', label: 'Upper Body', icon: '💪' },
    { key: 'lower_body', label: 'Lower Body', icon: '🦵' },
    { key: 'core', label: 'Core', icon: '🎯' },
    { key: 'cardio', label: 'Cardio', icon: '❤️' },
    { key: 'strength', label: 'Strength', icon: '🏋️' }
  ];

  const durationOptions = [
    { key: '30', label: '30 min' },
    { key: '45', label: '45 min' },
    { key: '60', label: '60 min' },
    { key: '75', label: '75 min' },
    { key: '90', label: '90 min' }
  ];

  const handleGenerateWorkout = async () => {
    if (!preferences.workoutType || !preferences.intensity || !preferences.focusArea) {
      Alert.alert('Error', 'Please select all required options');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Construct the workout prompt
      const prompt = constructWorkoutPrompt(preferences);
      
      // Call the callback to generate the workout
      if (onWorkoutGenerated) {
        await onWorkoutGenerated(prompt, preferences);
      }
      
      // Close the modal
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error generating workout:', error);
      Alert.alert('Error', 'Failed to generate workout. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const constructWorkoutPrompt = (prefs) => {
    const { workoutType, intensity, focusArea, duration, notes } = prefs;
    
    const typeText = workoutTypes.find(t => t.key === workoutType)?.label || workoutType;
    const intensityText = intensityLevels.find(i => i.key === intensity)?.label || intensity;
    const focusText = focusAreas.find(f => f.key === focusArea)?.label || focusArea;
    
    let prompt = `Create a ${typeText} workout with the following specifications:
- Intensity Level: ${intensityText}
- Focus Area: ${focusText}
- Duration: ${duration} minutes`;

    if (notes && notes.trim()) {
      prompt += `\n- Additional notes: ${notes.trim()}`;
    }

    return prompt;
  };

  const renderOptionButton = (options, selectedKey, onSelect, title) => (
    <View style={styles.optionSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.optionsGrid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              selectedKey === option.key && styles.selectedOption
            ]}
            onPress={() => onSelect(option.key)}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <Text style={[
              styles.optionLabel,
              selectedKey === option.key && styles.selectedOptionText
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const content = (
    <ScrollView 
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.modernHeader}>
        <Text style={styles.modernTitle}>🤖 Generate AI Workout</Text>
        <Text style={styles.modernSubtitle}>Create a personalized workout tailored to your needs</Text>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerContainer}>
        <Ionicons name="information-circle-outline" size={10} color="#888" />
        <Text style={styles.disclaimerText}>
          AI-generated workouts only. Verify with professionals. Not a substitute for medical/fitness consultation. 
          We are not liable for any damages.
        </Text>
      </View>

      {/* Workout Type */}
      {renderOptionButton(
        workoutTypes,
        preferences.workoutType,
        (type) => setPreferences(prev => ({ ...prev, workoutType: type })),
        'Workout Type'
      )}

      {/* Intensity Level */}
      {renderOptionButton(
        intensityLevels,
        preferences.intensity,
        (intensity) => setPreferences(prev => ({ ...prev, intensity })),
        'Intensity Level'
      )}

      {/* Focus Area */}
      {renderOptionButton(
        focusAreas,
        preferences.focusArea,
        (focus) => setPreferences(prev => ({ ...prev, focusArea: focus })),
        'Focus Area'
      )}

      {/* Duration */}
      <View style={styles.optionSection}>
        <Text style={styles.sectionTitle}>Duration</Text>
        <View style={styles.optionsGrid}>
          {durationOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.optionButton,
                preferences.duration === option.key && styles.selectedOption
              ]}
              onPress={() => setPreferences(prev => ({ ...prev, duration: option.key }))}
            >
              <Text style={[
                styles.optionLabel,
                preferences.duration === option.key && styles.selectedOptionText
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notes */}
      <View style={styles.optionSection}>
        <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any specific requirements or preferences..."
          placeholderTextColor="#666"
          value={preferences.notes}
          onChangeText={(text) => setPreferences(prev => ({ ...prev, notes: text }))}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Generate Button with usage badge */}
      <View style={styles.generateButtonWrapper}>
        <TouchableOpacity
          style={[styles.modernGenerateButton, isGenerating && styles.disabledButton]}
          onPress={handleGenerateWorkout}
          disabled={isGenerating}
        >
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating...' : 'Generate Workout'}
          </Text>
          <View
            style={[
              styles.usageCounterBadge,
              {
                backgroundColor: isPremium ? '#00ffff' : '#222',
                borderColor: isPremium ? '#00ffff' : '#666',
              },
            ]}
          >
            <Text
              style={[
                styles.usageCounterBadgeText,
                { color: isPremium ? '#000' : '#fff' },
              ]}
            >
              {usageInfo.currentUsage}/{usageInfo.limit}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.contentWrapper}>
      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
      >
        <Ionicons name="close" size={24} color="#666" />
      </TouchableOpacity>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  // Content wrapper styles
  contentWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 20, // Space for close button
  },
  
  // Header styles
  modernHeader: {
    marginBottom: 20,
  },
  modernTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
    textAlign: 'center',
  },
  modernSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  disclaimerText: {
    flex: 1,
    color: '#888',
    fontSize: 9,
    lineHeight: 13,
    marginLeft: 6,
    fontWeight: '400',
  },

  // Option section styles
  optionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedOption: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  optionIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectedOptionText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },

  // Notes input styles
  notesInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    fontWeight: '500',
  },

  // Generate button styles
  modernGenerateButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  generateButtonWrapper: {
    position: 'relative',
    marginTop: 20,
  },
  usageCounterBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  usageCounterBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#333',
  },
  generateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },


  // Close button for modal
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 5,
  },
}); 