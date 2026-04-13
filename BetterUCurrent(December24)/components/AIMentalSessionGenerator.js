import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateMentalSession } from '../utils/aiUtils';
import { getEngagementLevel } from '../utils/engagementService';
import { useAIConsent } from '../context/AIConsentContext';

const { width } = Dimensions.get('window');

/**
 * AI Mental Session Generator Component
 * 
 * This component provides a modern modal interface for users to generate personalized mental sessions
 * using AI. It includes form fields for session preferences and handles the AI generation process.
 * 
 * Key Features:
 * - Session type selection (meditation, breathing, mindfulness, etc.)
 * - Difficulty level selection (beginner, intermediate, advanced)
 * - Duration selection (5-30 minutes)
 * - Custom prompt input for specific needs
 * - Premium feature validation
 * - Loading states and error handling
 * 
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onSessionGenerated - Callback when session is successfully generated (session, preferences)
 * @param {boolean} isPremium - User's premium status
 */
export const AIMentalSessionGenerator = ({ 
  visible, 
  onClose, 
  onSessionGenerated,
  isPremium = false,
  userId = null
}) => {
  const { requestAIConsent } = useAIConsent();
  // State for form inputs
  const [preferences, setPreferences] = useState({
    sessionType: 'meditation',
    difficulty: 'beginner',
    duration: '15',
    customPrompt: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Available session types with icons
  const sessionTypes = [
    { key: 'meditation', label: 'Meditation', icon: '🧘‍♀️' },
    { key: 'breathing', label: 'Breathing', icon: '🫁' },
    { key: 'mindfulness', label: 'Mindfulness', icon: '🌱' },
    { key: 'relaxation', label: 'Relaxation', icon: '🌸' },
    { key: 'sleep', label: 'Sleep', icon: '🌙' },
    { key: 'anxiety', label: 'Anxiety Relief', icon: '💚' }
  ];

  // Difficulty levels with icons
  const difficultyLevels = [
    { key: 'beginner', label: 'Beginner', icon: '🌱' },
    { key: 'intermediate', label: 'Intermediate', icon: '🌿' },
    { key: 'advanced', label: 'Advanced', icon: '🌳' }
  ];

  // Duration options
  const durationOptions = [
    { key: '5', label: '5 min', icon: '⏱️' },
    { key: '10', label: '10 min', icon: '⏰' },
    { key: '15', label: '15 min', icon: '⏳' },
    { key: '20', label: '20 min', icon: '🕐' },
    { key: '30', label: '30 min', icon: '🕕' }
  ];

  /**
   * Handles the AI generation process
   * 
   * This function:
   * 1. Validates premium status
   * 2. Constructs the generation prompt
   * 3. Calls the AI generation API
   * 4. Handles success/error responses
   * 5. Calls the onSessionGenerated callback with the result
   */
  const handleGenerateSession = async () => {
    // Check premium status first
    if (!isPremium) {
      Alert.alert(
        'Premium Feature',
        'AI-generated mental sessions are a premium feature. Please upgrade to access this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => {
            // Navigate to subscription screen
            console.log('Navigate to subscription screen');
          }}
        ]
      );
      return;
    }

    // Require consent before sending wellness/session data to the AI provider.
    const allowed = await requestAIConsent();
    if (!allowed) return;

    setIsGenerating(true);
    
    try {
      // Construct the generation prompt from user preferences
      const prompt = constructSessionPrompt(preferences);
      
      // Optional: pass engagement so we can suggest shorter sessions when user is getting back on track
      let engagementContext = { level: 'high', reasons: [] };
      if (userId) {
        engagementContext = await getEngagementLevel(userId).catch(() => engagementContext);
      }

      // Prepare user data for AI generation
      const userData = {
        ...preferences,
        custom_prompt: prompt,
        engagementContext
      };
      
      // Call the AI generation function
      const result = await generateMentalSession(userData);
      
      if (result.success && result.session) {
        // Success - pass the generated session and user preferences to the parent component
        onSessionGenerated?.(result.session, preferences);
        onClose?.();
        
        Alert.alert(
          'Session Generated!',
          'Your personalized mental session has been created successfully.'
        );
      } else {
        // Error in generation
        Alert.alert(
          'Generation Failed',
          result.error || 'Failed to generate mental session. Please try again.'
        );
      }
    } catch (error) {
      console.error('Error generating mental session:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Constructs a detailed prompt for AI generation based on user preferences
   * 
   * @param {object} prefs - User preferences object
   * @returns {string} - Formatted prompt string
   */
  const constructSessionPrompt = (prefs) => {
    const { sessionType, difficulty, duration, customPrompt } = prefs;
    
    const typeText = sessionTypes.find(t => t.key === sessionType)?.label || sessionType;
    const difficultyText = difficultyLevels.find(d => d.key === difficulty)?.label || difficulty;
    
    let prompt = `Create a ${typeText} session with the following specifications:
- Difficulty Level: ${difficultyText}
- Duration: ${duration} minutes`;

    if (customPrompt && customPrompt.trim()) {
      prompt += `\n- Specific needs: ${customPrompt.trim()}`;
    }

    return prompt;
  };

  /**
   * Renders a modern option button grid
   * 
   * @param {array} options - Array of option objects with key, label, and icon
   * @param {string} selectedKey - Currently selected option key
   * @param {function} onSelect - Callback when option is selected
   * @param {string} title - Title for the option group
   * @returns {JSX.Element} - Rendered option buttons
   */
  const renderModernOptionGrid = (options, selectedKey, onSelect, title) => (
    <View style={styles.modernSection}>
      <Text style={styles.modernSectionTitle}>{title}</Text>
      <View style={styles.modernOptionsGrid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.modernOptionButton,
              selectedKey === option.key && styles.modernSelectedOption
            ]}
            onPress={() => onSelect(option.key)}
          >
            <View style={styles.modernOptionContent}>
              <Text style={styles.modernOptionIcon}>{option.icon}</Text>
              <Text style={[
                styles.modernOptionText,
                selectedKey === option.key && styles.modernSelectedOptionText
              ]}>
                {option.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalContent}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
          >
            {/* Modern Header */}
            <View style={styles.modernHeader}>
              <View style={styles.headerContent}>
                <View style={styles.headerIconContainer}>
                  <Text style={styles.headerIcon}>🧠</Text>
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modernTitle}>AI Mental Session</Text>
                  <Text style={styles.modernSubtitle}>Create personalized wellness sessions</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.modernCloseButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Premium Badge */}
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.premiumText}>Premium Feature</Text>
            </View>

            {/* Disclaimer */}
            <View style={styles.disclaimerContainer}>
              <Ionicons name="information-circle-outline" size={10} color="#888" />
              <Text style={styles.disclaimerText}>
                AI-generated support only. Not a replacement for professional mental health care. 
                Verify with licensed therapists. For emergencies, contact crisis services. 
                We are not liable for any damages.
              </Text>
            </View>

            {/* Session Type Selection */}
            {renderModernOptionGrid(
              sessionTypes,
              preferences.sessionType,
              (value) => setPreferences(prev => ({ ...prev, sessionType: value })),
              'Session Type'
            )}

            {/* Difficulty Selection */}
            {renderModernOptionGrid(
              difficultyLevels,
              preferences.difficulty,
              (value) => setPreferences(prev => ({ ...prev, difficulty: value })),
              'Difficulty Level'
            )}

            {/* Duration Selection */}
            {renderModernOptionGrid(
              durationOptions,
              preferences.duration,
              (value) => setPreferences(prev => ({ ...prev, duration: value })),
              'Duration'
            )}

            {/* Custom Prompt Input */}
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>Specific Needs (Optional)</Text>
              <Text style={styles.modernSectionSubtitle}>
                Describe what you need help with or want to focus on
              </Text>
              <TextInput
                style={styles.modernNotesInput}
                placeholder="e.g., help with anxiety, better sleep, stress relief, focus improvement, etc."
                placeholderTextColor="#666"
                value={preferences.customPrompt}
                onChangeText={(text) => setPreferences(prev => ({ ...prev, customPrompt: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </View>

            {/* Generate Button */}
            <View style={styles.modernGenerateButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.modernGenerateButton,
                  (!isPremium || isGenerating) && styles.modernDisabledButton
                ]}
                onPress={handleGenerateSession}
                disabled={isGenerating || !isPremium}
              >
                {isGenerating ? (
                  <View style={styles.modernLoadingContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.modernGenerateButtonText}>Generating...</Text>
                  </View>
                ) : (
                  <View style={styles.modernGenerateButtonContent}>
                    <Text style={styles.modernGenerateButtonIcon}>✨</Text>
                    <Text style={styles.modernGenerateButtonText}>
                      {isPremium ? 'Generate My Session' : 'Premium Required'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Info Text */}
            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                Our AI will create a personalized session tailored to your preferences and needs.
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#121212',
    borderRadius: 20,
    width: '98%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
    minHeight: 500,
  },
  scrollView: {
    maxHeight: '100%',
  },
  scrollContent: {
    padding: 25,
    paddingBottom: 30,
  },
  
  // Modern Header Styles
  modernHeader: {
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  modernTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  modernSubtitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  modernCloseButton: {
    padding: 5,
  },
  
  // Premium Badge
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    alignSelf: 'flex-start',
    marginBottom: 20,
    gap: 4,
  },
  premiumText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
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
  
  // Modern Section Styles
  modernSection: {
    marginBottom: 20,
  },
  modernSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modernSectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 15,
    fontWeight: '500',
  },
  
  // Modern Option Styles
  modernOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modernOptionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modernSelectedOption: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  modernOptionContent: {
    alignItems: 'center',
  },
  modernOptionIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  modernOptionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  modernSelectedOptionText: {
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
  
  // Modern Notes Styles
  modernNotesInput: {
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
  
  // Modern Generate Button Styles
  modernGenerateButtonContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  modernGenerateButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modernDisabledButton: {
    backgroundColor: '#333',
  },
  modernGenerateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernGenerateButtonIcon: {
    fontSize: 18,
  },
  modernGenerateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modernLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // Info Section
  infoSection: {
    marginTop: 10,
    padding: 15,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  infoText: {
    color: '#ccc',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AIMentalSessionGenerator;