import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateAIMeal, saveGeneratedMeal } from '../utils/aiMealGenerator';
import { useAuth } from '../context/AuthContext';
import { useAIConsent } from '../context/AIConsentContext';

const { width } = Dimensions.get('window');

export const AIMealGenerator = ({ onMealGenerated, onClose, isInModal = false }) => {
  const { user } = useAuth();
  const { requestAIConsent } = useAIConsent();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // State for meal preferences
  const [preferences, setPreferences] = useState({
    calorieRange: { min: 400, max: 600 },
    mealType: 'lunch',
    cuisineType: 'any',
    dietaryRestrictions: [],
    notes: '',
    customCalories: false
  });

  // Available options for meal types and cuisines
  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { value: 'lunch', label: 'Lunch', icon: '☀️' },
    { value: 'dinner', label: 'Dinner', icon: '🌙' },
    { value: 'snack', label: 'Snack', icon: '🍎' },
    { value: 'other', label: 'Other', icon: '🍽️' }
  ];

  const cuisineTypes = [
    { value: 'any', label: 'Any Cuisine' },
    { value: 'italian', label: 'Italian' },
    { value: 'mexican', label: 'Mexican' },
    { value: 'asian', label: 'Asian' },
    { value: 'mediterranean', label: 'Mediterranean' },
    { value: 'american', label: 'American' },
    { value: 'indian', label: 'Indian' },
    { value: 'french', label: 'French' }
  ];

  const dietaryRestrictions = [
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'gluten-free', label: 'Gluten-Free' },
    { value: 'dairy-free', label: 'Dairy-Free' },
    { value: 'low-carb', label: 'Low-Carb' },
    { value: 'keto', label: 'Keto' },
    { value: 'paleo', label: 'Paleo' }
  ];

  // Function to get calorie range based on meal type
  const getCalorieRange = (mealType) => {
    switch(mealType) {
      case 'breakfast': return { min: 300, max: 500 };
      case 'lunch': return { min: 400, max: 700 };
      case 'dinner': return { min: 400, max: 700 };
      case 'snack': return { min: 100, max: 300 };
      case 'other': return { min: 200, max: 800 };
      default: return { min: 300, max: 600 };
    }
  };

  // Update calorie range when meal type changes
  const handleMealTypeChange = (mealType) => {
    const newCalorieRange = getCalorieRange(mealType);
    setPreferences(prev => ({
      ...prev,
      mealType,
      calorieRange: newCalorieRange
    }));
  };

  // Handle dietary restriction toggle
  const toggleDietaryRestriction = (restriction) => {
    setPreferences(prev => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(restriction)
        ? prev.dietaryRestrictions.filter(r => r !== restriction)
        : [...prev.dietaryRestrictions, restriction]
    }));
  };

  // Generate meal using AI
  const handleGenerateMeal = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to generate meals');
      return;
    }

    // Gate all AI calls behind explicit user consent for third-party processing.
    const allowed = await requestAIConsent();
    if (!allowed) return;

    setIsGenerating(true);
    try {
      console.log('Generating meal with preferences:', preferences);
      
      // Generate meal using AI
      const mealData = await generateAIMeal(preferences);
      
      // Save meal to Supabase
      const savedMeal = await saveGeneratedMeal(mealData, user.id);
      
      console.log('Meal generated and saved:', savedMeal);
      
      // Call the callback to update parent component
      if (onMealGenerated) {
        onMealGenerated(savedMeal);
      }
      
      setShowModal(false);
      Alert.alert('Success', 'Your AI meal has been generated!');
      
    } catch (error) {
      console.error('Error generating meal:', error);
      Alert.alert('Error', 'Failed to generate meal. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Render the modal content
  const renderModalContent = () => (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
            {/* Modern Header */}
            <View style={styles.modernHeader}>
              <View style={styles.headerContent}>
                <View style={styles.headerIconContainer}>
                  <Text style={styles.headerIcon}>🤖</Text>
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modernTitle}>AI Meal Generator</Text>
                  <Text style={styles.modernSubtitle}>Create personalized meals with AI</Text>
                </View>
                <TouchableOpacity
            onPress={isInModal ? onClose : () => setShowModal(false)}
                  style={styles.modernCloseButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Disclaimer Section */}
            <View style={styles.disclaimerSection}>
              <Text style={styles.disclaimerText}>
                ⚠️ This AI meal plan is for general wellness only and is not medical or dietary advice.
              </Text>
              <Text style={styles.disclaimerText}>
                Consult a healthcare professional before making dietary changes.
              </Text>
            </View>

            {/* Meal Type Selection */}
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>Choose Meal Type</Text>
              <View style={styles.modernOptionsGrid}>
                {mealTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.modernOptionButton,
                      preferences.mealType === type.value && styles.modernSelectedOption
                    ]}
                    onPress={() => handleMealTypeChange(type.value)}
                  >
                    <View style={styles.modernOptionContent}>
                      <Text style={styles.modernOptionIcon}>{type.icon}</Text>
                      <Text style={[
                        styles.modernOptionText,
                        preferences.mealType === type.value && styles.modernSelectedOptionText
                      ]}>
                        {type.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Calorie Range */}
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>Calorie Range</Text>
              <Text style={styles.modernSectionSubtitle}>
                Based on {preferences.mealType} recommendations
              </Text>
              
              {preferences.customCalories ? (
                <View style={styles.modernCustomCalorieContainer}>
                  <View style={styles.modernCustomCalorieInputs}>
                    <View style={styles.modernCalorieInputGroup}>
                      <Text style={styles.modernCalorieInputLabel}>Min Calories</Text>
                      <TextInput
                        style={styles.modernCalorieInput}
                        value={preferences.calorieRange.min.toString()}
                        onChangeText={(text) => {
                          const min = parseInt(text) || 0;
                          setPreferences(prev => ({
                            ...prev,
                            calorieRange: { ...prev.calorieRange, min }
                          }));
                        }}
                        keyboardType="numeric"
                        placeholder="300"
                        placeholderTextColor="#666"
                      />
                    </View>
                    <View style={styles.modernCalorieInputGroup}>
                      <Text style={styles.modernCalorieInputLabel}>Max Calories</Text>
                      <TextInput
                        style={styles.modernCalorieInput}
                        value={preferences.calorieRange.max.toString()}
                        onChangeText={(text) => {
                          const max = parseInt(text) || 0;
                          setPreferences(prev => ({
                            ...prev,
                            calorieRange: { ...prev.calorieRange, max }
                          }));
                        }}
                        keyboardType="numeric"
                        placeholder="600"
                        placeholderTextColor="#666"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modernToggleCustomButton}
                    onPress={() => setPreferences(prev => ({ ...prev, customCalories: false }))}
                  >
                    <Text style={styles.modernToggleCustomButtonText}>Use Recommended</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.modernCalorieDisplayContainer}>
                  <View style={styles.modernCalorieDisplay}>
                    <Text style={styles.modernCalorieDisplayText}>
                      {preferences.calorieRange.min}-{preferences.calorieRange.max}
                    </Text>
                    <Text style={styles.modernCalorieDisplayUnit}>calories</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modernToggleCustomButton}
                    onPress={() => setPreferences(prev => ({ ...prev, customCalories: true }))}
                  >
                    <Text style={styles.modernToggleCustomButtonText}>Custom Range</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Cuisine Type */}
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>Cuisine Type</Text>
              <View style={styles.modernCuisineGrid}>
                {cuisineTypes.map(cuisine => (
                  <TouchableOpacity
                    key={cuisine.value}
                    style={[
                      styles.modernCuisineButton,
                      preferences.cuisineType === cuisine.value && styles.modernSelectedCuisine
                    ]}
                    onPress={() => setPreferences(prev => ({ ...prev, cuisineType: cuisine.value }))}
                  >
                    <Text style={[
                      styles.modernCuisineText,
                      preferences.cuisineType === cuisine.value && styles.modernSelectedCuisineText
                    ]}>
                      {cuisine.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Dietary Restrictions */}
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>Dietary Restrictions</Text>
              <Text style={styles.modernSectionSubtitle}>Select all that apply</Text>
              <View style={styles.modernRestrictionsGrid}>
                {dietaryRestrictions.map(restriction => (
                  <TouchableOpacity
                    key={restriction.value}
                    style={[
                      styles.modernRestrictionButton,
                      preferences.dietaryRestrictions.includes(restriction.value) && styles.modernSelectedRestriction
                    ]}
                    onPress={() => toggleDietaryRestriction(restriction.value)}
                  >
                    <Text style={[
                      styles.modernRestrictionText,
                      preferences.dietaryRestrictions.includes(restriction.value) && styles.modernSelectedRestrictionText
                    ]}>
                      {restriction.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Additional Notes */}
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>Additional Notes</Text>
        <Text style={styles.modernSectionSubtitle}>
          Any special requests or preferences for the AI to consider
        </Text>
              <TextInput
                style={styles.modernNotesInput}
                placeholder="e.g., I love spicy food, prefer quick recipes, avoid onions, etc."
                placeholderTextColor="#666"
                value={preferences.notes}
                onChangeText={(text) => setPreferences(prev => ({ ...prev, notes: text }))}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Generate Button */}
            <View style={styles.modernGenerateButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.modernGenerateButton,
                  isGenerating && styles.modernDisabledButton
                ]}
                onPress={handleGenerateMeal}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <View style={styles.modernLoadingContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.modernGenerateButtonText}>Generating...</Text>
                  </View>
                ) : (
                  <View style={styles.modernGenerateButtonContent}>
                    <Text style={styles.modernGenerateButtonIcon}>✨</Text>
                    <Text style={styles.modernGenerateButtonText}>Generate My Meal</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
  );

  return (
    <>
      {/* If component is used inside a modal, show preferences directly */}
      {isInModal ? (
        renderModalContent()
      ) : (
        <View style={styles.container}>
          {/* Main Generate Button */}
          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.generateButtonText}>🤖 Generate AI Meal</Text>
          </TouchableOpacity>

          {/* Preferences Modal */}
          <Modal
            visible={showModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {renderModalContent()}
              </View>
            </View>
          </Modal>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  generateButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  generateButtonText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
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
    padding: 25,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  singleModalContent: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    minHeight: 600,
  },
  scrollContent: {
    paddingBottom: 20,
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
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
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
    color: '#00ffff',
    fontWeight: 'bold',
  },
  
  // Modern Cuisine Styles
  modernCuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modernCuisineButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modernSelectedCuisine: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  modernCuisineText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  modernSelectedCuisineText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  
  // Modern Restrictions Styles
  modernRestrictionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modernRestrictionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modernSelectedRestriction: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  modernRestrictionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  modernSelectedRestrictionText: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  
  // Modern Calorie Styles
  modernCustomCalorieContainer: {
    marginTop: 10,
  },
  modernCustomCalorieInputs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modernCalorieInputGroup: {
    flex: 1,
  },
  modernCalorieInputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  modernCalorieInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  modernCalorieDisplayContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  modernCalorieDisplay: {
    alignItems: 'center',
    marginBottom: 10,
  },
  modernCalorieDisplayText: {
    fontSize: 24,
    color: '#00ffff',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  modernCalorieDisplayUnit: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  modernToggleCustomButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  modernToggleCustomButtonText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#00ffff',
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
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modernLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Disclaimer Section Styles
  disclaimerSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#ffc107',
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '500',
  },
}); 