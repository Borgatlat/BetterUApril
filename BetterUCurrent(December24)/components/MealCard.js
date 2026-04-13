import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Dimensions,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { consumeMeal } from '../utils/aiMealGenerator';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';

const { width } = Dimensions.get('window');

export const MealCard = ({ meal, onMealConsumed }) => {
  const { user } = useAuth();
  const { syncProteinTracker } = useTracking();
  const [isConsuming, setIsConsuming] = useState(false);
  const [servingSize, setServingSize] = useState(1.0);

  // Helper function to get meal type icon
  const getMealTypeIcon = (mealType) => {
    switch(mealType) {
      case 'breakfast': return '🌅';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  };

  // Helper function to format time
  const formatTime = (minutes) => {
    if (minutes === 0) return 'No cooking';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Handle meal consumption
  const handleConsumeMeal = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to track meals');
      return;
    }

    setIsConsuming(true);
    try {
      await consumeMeal(meal.id, user.id, servingSize);
      
      // Sync protein tracker with database after consuming meal
      await syncProteinTracker();
      
      // Alert removed to avoid duplicate confirmation

      // Call the callback to update parent component
      if (onMealConsumed) {
        onMealConsumed(meal, servingSize);
      }
      
    } catch (error) {
      console.error('Error consuming meal:', error);
      Alert.alert('Error', 'Failed to track meal consumption. Please try again.');
    } finally {
      setIsConsuming(false);
    }
  };

  // Calculate actual nutrition based on serving size
  const getActualNutrition = (nutritionValue) => {
    return Math.round(nutritionValue * servingSize);
  };

  // Handle opening source URL
  // This function uses React Native's Linking API to open URLs in the device's default browser
  // The Linking.openURL() method is async and returns a Promise
  const handleOpenSource = async (url) => {
    try {
      // Check if the URL can be opened
      // Linking.canOpenURL() checks if the device can handle this URL scheme (http, https, etc.)
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        // Open the URL in the default browser
        await Linking.openURL(url);
      } else {
        // If the URL can't be opened, show an error alert
        Alert.alert('Error', 'Unable to open this URL');
      }
    } catch (error) {
      // Catch any errors that occur during the URL opening process
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open the link. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Meal Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.mealTypeIcon}>{getMealTypeIcon(meal.meal_type)}</Text>
          <View style={styles.titleTextContainer}>
            <Text style={styles.mealName}>{meal.name}</Text>
            <Text style={styles.mealDescription}>{meal.description}</Text>
          </View>
        </View>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* Nutrition Facts */}
      <View style={styles.nutritionSection}>
        <Text style={styles.sectionTitle}>Nutrition Facts</Text>
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {getActualNutrition(meal.nutrition.calories.value)}
            </Text>
            <Text style={styles.nutritionLabel}>Calories</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {getActualNutrition(meal.nutrition.protein.value)}g
            </Text>
            <Text style={styles.nutritionLabel}>Protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {getActualNutrition(meal.nutrition.carbs.value)}g
            </Text>
            <Text style={styles.nutritionLabel}>Carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {getActualNutrition(meal.nutrition.fat.value)}g
            </Text>
            <Text style={styles.nutritionLabel}>Fat</Text>
          </View>
        </View>
      </View>

      {/* Ingredients */}
      <View style={styles.section}>
        <View style={styles.ingredientsHeader}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.scrollHint}>
            <Text style={styles.scrollHintText}>Scroll to see all</Text>
            <Text style={styles.scrollHintIcon}>⬇️</Text>
          </View>
        </View>
        <View style={styles.ingredientsContainer}>
          <ScrollView 
            style={styles.ingredientsList} 
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            contentContainerStyle={styles.ingredientsContent}
          >
            {meal.ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <Text style={styles.ingredientText}>
                  • {ingredient.amount} {ingredient.unit} {ingredient.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instructionsText}>{meal.instructions}</Text>
      </View>

      {/* Time and Cuisine Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Prep Time:</Text>
          <Text style={styles.infoValue}>{formatTime(meal.prep_time)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Cook Time:</Text>
          <Text style={styles.infoValue}>{formatTime(meal.cook_time)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Cuisine:</Text>
          <Text style={styles.infoValue}>{meal.cuisine_type}</Text>
        </View>
      </View>

      {/* Sources Section - Only show for AI-generated meals */}
      {meal.is_ai_generated && meal.sources && meal.sources.length > 0 && (
        <View style={styles.sourcesSection}>
          <Text style={styles.sectionTitle}>Sources</Text>
          <Text style={styles.sourcesDescription}>
            This meal was generated using information from the following approved health sources:
          </Text>
          <View style={styles.sourcesList}>
            {meal.sources.map((source, index) => (
              <TouchableOpacity
                key={index}
                style={styles.sourceItem}
                onPress={() => handleOpenSource(source)}
                activeOpacity={0.7}
              >
                <View style={styles.sourceContent}>
                  <Ionicons name="link" size={14} color="#00ffff" style={styles.sourceIcon} />
                  <Text style={styles.sourceText} numberOfLines={1}>{source}</Text>
                  <Ionicons name="open-outline" size={14} color="#00ffff" style={styles.sourceArrow} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Disclaimer Section - Only show for AI-generated meals */}
      {meal.is_ai_generated && (
        <View style={styles.disclaimerSection}>
          <Text style={styles.disclaimerText}>
            ⚠️ This AI meal plan is for general wellness only and is not medical or dietary advice.
          </Text>
          <Text style={styles.disclaimerText}>
            Consult a healthcare professional before making dietary changes.
          </Text>
        </View>
      )}

      {/* Serving Size and Consume Button */}
      <View style={styles.consumptionSection}>
        <View style={styles.servingSizeContainer}>
          <Text style={styles.servingSizeLabel}>Serving Size:</Text>
          <View style={styles.servingSizeButtons}>
            {[0.5, 0.75, 1.0, 1.25, 1.5].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.servingSizeButton,
                  servingSize === size && styles.selectedServingSize
                ]}
                onPress={() => setServingSize(size)}
              >
                <Text style={[
                  styles.servingSizeText,
                  servingSize === size && styles.selectedServingSizeText
                ]}>
                  {size === 1.0 ? '1x' : `${size}x`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.consumeButton,
            isConsuming && styles.disabledButton
          ]}
          onPress={handleConsumeMeal}
          disabled={isConsuming}
        >
          <Text style={styles.consumeButtonText}>
            {isConsuming ? 'Adding to Tracker...' : `Consume Meal (${Math.round(meal.calories * servingSize)} cal)`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  mealTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  mealName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  aiBadge: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  nutritionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  scrollHintText: {
    fontSize: 10,
    color: '#00ffff',
    marginRight: 4,
    fontWeight: '500',
  },
  scrollHintIcon: {
    fontSize: 10,
  },
  ingredientsContainer: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
  },
  ingredientsList: {
    maxHeight: 120,
  },
  ingredientsContent: {
    padding: 12,
  },
  ingredientItem: {
    marginBottom: 6,
  },
  ingredientText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  instructionsText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  consumptionSection: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 15,
  },
  servingSizeContainer: {
    marginBottom: 15,
  },
  servingSizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  servingSizeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  servingSizeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#111',
  },
  selectedServingSize: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  servingSizeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  selectedServingSizeText: {
    color: '#fff',
  },
  consumeButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  consumeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  // Sources Section Styles
  sourcesSection: {
    marginBottom: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  sourcesDescription: {
    fontSize: 13,
    color: '#999',
    marginBottom: 10,
    lineHeight: 18,
  },
  sourcesList: {
    marginTop: 8,
  },
  sourceItem: {
    marginBottom: 8,
    padding: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  sourceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sourceIcon: {
    marginRight: 8,
  },
  sourceText: {
    fontSize: 12,
    color: '#00ffff',
    lineHeight: 18,
    flex: 1,
    textDecorationLine: 'underline',
  },
  sourceArrow: {
    marginLeft: 8,
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