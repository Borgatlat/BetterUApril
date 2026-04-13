import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { analyzeFoodPhoto } from '../utils/foodPhotoAnalyzer';
import { useTracking } from '../context/TrackingContext';

/**
 * Food Photo Scanner Component
 * 
 * This modal component allows users to:
 * 1. Take or select a photo of food
 * 2. Analyze it with Cal AI API (via Edge Function)
 * 3. View nutrition information
 * 4. Add to their daily tracker
 */
const FoodPhotoScanner = ({ visible, onClose }) => {
  const { addCalories, addProtein } = useTracking();
  const insets = useSafeAreaInsets();
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [nutrition, setNutrition] = useState(null);
  const [error, setError] = useState(null);
  const [showImagePickerOptions, setShowImagePickerOptions] = useState(false);

  /**
   * Handle taking a new photo with camera
   * Requests camera permission and opens camera
   */
  const handleTakePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Camera access is required to take food photos.'
        );
        return;
      }

      // Open camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Good balance of quality and file size
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setNutrition(null);
        setError(null);
        setShowImagePickerOptions(false); // Close the options modal after selecting
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      setShowImagePickerOptions(false); // Close on error too
    }
  };

  /**
   * Handle selecting photo from gallery
   */
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setNutrition(null);
        setError(null);
        setShowImagePickerOptions(false); // Close the options modal after selecting
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
      setShowImagePickerOptions(false); // Close on error too
    }
  };

  /**
   * Analyze the selected image
   * Calls the Edge Function which securely calls Cal AI API
   */
  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeFoodPhoto(selectedImage);

      if (result.success) {
        setNutrition(result.nutrition);
      } else {
        setError(result.error || 'Failed to analyze food');
        Alert.alert('Analysis Failed', result.error || 'Could not analyze food photo');
      }
    } catch (error) {
      console.error('Error in handleAnalyze:', error);
      const errorMessage = error.message || 'Failed to analyze food photo';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Add nutrition values to the tracker
   * Uses existing TrackingContext methods
   */
  const handleAddToTracker = () => {
    if (!nutrition) return;

    // Add calories and protein to tracker
    addCalories(Math.round(nutrition.calories));
    addProtein(Math.round(nutrition.protein_g));

    Alert.alert(
      'Added! ✅',
      `Added ${Math.round(nutrition.calories)} calories and ${Math.round(nutrition.protein_g)}g protein to your tracker.`,
      [
        {
          text: 'OK',
          onPress: () => {
            // Reset and close
            setSelectedImage(null);
            setNutrition(null);
            onClose();
          }
        }
      ]
    );
  };

  /**
   * Reset everything when modal closes
   */
  const handleClose = () => {
    setSelectedImage(null);
    setNutrition(null);
    setError(null);
    setShowImagePickerOptions(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="camera" size={28} color="#00ffff" />
              <Text style={styles.headerTitle}>Scan Food</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
            nestedScrollEnabled={true}
          >
            {/* Step 1: Image Selection */}
            {!selectedImage ? (
              <View style={styles.imageSelectionContainer}>
                <Text style={styles.instructionText}>
                  Scan your food to get nutrition info
                </Text>
                
                {/* Action Buttons Row */}
                <View style={styles.actionButtonsRow}>
                  {/* Take Photo Button */}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleTakePhoto}
                    activeOpacity={0.7}
                  >
                    <View style={styles.actionButtonIconContainer}>
                      <Ionicons name="camera" size={32} color="#00ffff" />
                    </View>
                    <Text style={styles.actionButtonText}>Take Photo</Text>
                    <Text style={styles.actionButtonSubtext}>Use camera</Text>
                  </TouchableOpacity>

                  {/* Choose from Gallery Button */}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={handlePickPhoto}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionButtonIconContainer, styles.actionButtonIconContainerSecondary]}>
                      <Ionicons name="images" size={32} color="#8b5cf6" />
                    </View>
                    <Text style={styles.actionButtonText}>Choose Photo</Text>
                    <Text style={styles.actionButtonSubtext}>From gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Step 2: Show Selected Image */}
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.selectedImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImage(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={24} color="#ff4444" />
                  </TouchableOpacity>
                </View>

                {/* Step 3: Analyze Button */}
                {!nutrition && !analyzing && (
                  <TouchableOpacity
                    style={styles.analyzeButton}
                    onPress={handleAnalyze}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="scan" size={20} color="#000" />
                    <Text style={styles.analyzeButtonText}>Analyze Food</Text>
                  </TouchableOpacity>
                )}

                {/* Step 4: Loading State */}
                {analyzing && (
                  <View style={styles.analyzingContainer}>
                    <ActivityIndicator size="large" color="#00ffff" />
                    <Text style={styles.analyzingText}>
                      Analyzing food... This may take a few seconds
                    </Text>
                  </View>
                )}

                {/* Step 5: Show Results */}
                {nutrition && (
                  <View style={styles.resultsContainer}>
                    <Text style={styles.foodName}>{nutrition.food_name}</Text>
                    
                    {/* Main Nutrients Grid */}
                    <View style={styles.nutrientGrid}>
                      <NutrientCard
                        label="Calories"
                        value={Math.round(nutrition.calories)}
                        unit="cal"
                        color="#ff4444"
                      />
                      <NutrientCard
                        label="Protein"
                        value={Math.round(nutrition.protein_g)}
                        unit="g"
                        color="#00ff00"
                      />
                      <NutrientCard
                        label="Carbs"
                        value={Math.round(nutrition.carbs_g)}
                        unit="g"
                        color="#00aaff"
                      />
                      <NutrientCard
                        label="Fats"
                        value={Math.round(nutrition.fats_g)}
                        unit="g"
                        color="#ffaa00"
                      />
                    </View>

                    {/* Micronutrients Section */}
                    {(nutrition.fiber_g > 0 || nutrition.sodium_mg > 0) && (
                      <View style={styles.microNutrientsContainer}>
                        <Text style={styles.sectionTitle}>Micronutrients</Text>
                        <View style={styles.microNutrientsList}>
                          {nutrition.fiber_g > 0 && (
                            <MicroNutrientItem
                              label="Fiber"
                              value={nutrition.fiber_g}
                              unit="g"
                            />
                          )}
                          {nutrition.sugar_g > 0 && (
                            <MicroNutrientItem
                              label="Sugar"
                              value={nutrition.sugar_g}
                              unit="g"
                            />
                          )}
                          {nutrition.sodium_mg > 0 && (
                            <MicroNutrientItem
                              label="Sodium"
                              value={nutrition.sodium_mg}
                              unit="mg"
                            />
                          )}
                          {nutrition.calcium_mg > 0 && (
                            <MicroNutrientItem
                              label="Calcium"
                              value={nutrition.calcium_mg}
                              unit="mg"
                            />
                          )}
                          {nutrition.iron_mg > 0 && (
                            <MicroNutrientItem
                              label="Iron"
                              value={nutrition.iron_mg}
                              unit="mg"
                            />
                          )}
                          {nutrition.vitamin_c_mg > 0 && (
                            <MicroNutrientItem
                              label="Vitamin C"
                              value={nutrition.vitamin_c_mg}
                              unit="mg"
                            />
                          )}
                        </View>
                      </View>
                    )}

                    {/* Confidence Indicator */}
                    <View style={styles.confidenceContainer}>
                      <Ionicons 
                        name={nutrition.confidence === 'high' ? 'checkmark-circle' : 'information-circle'} 
                        size={16} 
                        color="#666" 
                      />
                      <Text style={styles.confidenceText}>
                        Confidence: {nutrition.confidence}
                      </Text>
                    </View>

                    {/* Add to Tracker Button */}
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={handleAddToTracker}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle" size={20} color="#000" />
                      <Text style={styles.addButtonText}>
                        Add to Tracker
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Error Display */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={24} color="#ff4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Image Picker Options Modal */}
      <Modal
        visible={showImagePickerOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImagePickerOptions(false)}
      >
        <TouchableOpacity
          style={styles.optionsOverlay}
          activeOpacity={1}
          onPress={() => setShowImagePickerOptions(false)}
        >
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setShowImagePickerOptions(false);
                handleTakePhoto();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="camera" size={32} color="#00ffff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionButtonText}>Take Photo</Text>
                <Text style={styles.optionButtonSubtext}>Capture with camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonSecondary]}
              onPress={() => {
                setShowImagePickerOptions(false);
                handlePickPhoto();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, styles.optionIconContainerSecondary]}>
                <Ionicons name="images" size={32} color="#8b5cf6" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionButtonText}>Choose from Gallery</Text>
                <Text style={styles.optionButtonSubtext}>Select existing photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelOptionButton}
              onPress={() => setShowImagePickerOptions(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelOptionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

/**
 * Nutrient Card Component
 * Displays a single nutrient with value and unit
 */
const NutrientCard = ({ label, value, unit, color }) => (
  <View style={[styles.nutrientCard, { borderLeftColor: color }]}>
    <Text style={styles.nutrientValue}>{value}</Text>
    <Text style={styles.nutrientUnit}>{unit}</Text>
    <Text style={styles.nutrientLabel}>{label}</Text>
  </View>
);

/**
 * Micronutrient Item Component
 * Displays a single micronutrient in the list
 */
const MicroNutrientItem = ({ label, value, unit }) => (
  <View style={styles.microNutrientItem}>
    <Text style={styles.microNutrientLabel}>{label}</Text>
    <Text style={styles.microNutrientValue}>
      {value ? `${value.toFixed(1)} ${unit}` : 'N/A'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
    height: '75%',
    paddingTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    flex: 1,
    minHeight: 300,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 30,
    minHeight: 250,
  },
  imageSelectionContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
    minHeight: 250,
  },
  instructionText: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#00ffff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  actionButtonSecondary: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  actionButtonIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  actionButtonIconContainerSecondary: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionButtonSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#00ffff',
    borderRadius: 15,
    padding: 18,
    marginBottom: 15,
  },
  optionButtonSecondary: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionIconContainerSecondary: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionButtonSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  cancelOptionButton: {
    marginTop: 10,
    padding: 15,
    alignItems: 'center',
  },
  cancelOptionButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  selectedImage: {
    width: '100%',
    height: 250,
    borderRadius: 15,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  analyzeButton: {
    backgroundColor: '#00ffff',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  analyzeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  analyzingText: {
    color: '#aaa',
    marginTop: 15,
    textAlign: 'center',
  },
  resultsContainer: {
    marginTop: 10,
  },
  foodName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  nutrientCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    width: '48%',
    borderLeftWidth: 4,
  },
  nutrientValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  nutrientUnit: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  nutrientLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
  },
  microNutrientsContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  microNutrientsList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
  },
  microNutrientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  microNutrientLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  microNutrientValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    justifyContent: 'center',
  },
  confidenceText: {
    color: '#666',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#00ffff',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  errorText: {
    color: '#ff4444',
    flex: 1,
  },
});

export default FoodPhotoScanner;

