import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert
} from 'react-native';
import { MealCard } from './MealCard';

const { width } = Dimensions.get('window');

export const CompactMealCard = ({ meal, onMealConsumed, onMealDeleted }) => {
  const [showDetails, setShowDetails] = useState(false);

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

  return (
    <>
      {/* Compact Card */}
      <TouchableOpacity
        style={styles.compactCard}
        onPress={() => setShowDetails(true)}
      >
        <View style={styles.compactHeader}>
          <View style={styles.compactTitleContainer}>
            <Text style={styles.mealTypeIcon}>{getMealTypeIcon(meal.meal_type)}</Text>
            <View style={styles.compactTitleText}>
              <Text style={styles.compactMealName}>{meal.name}</Text>
              <Text style={styles.compactMealType}>{meal.meal_type}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onMealDeleted) {
                  Alert.alert(
                    'Delete Meal',
                    `Are you sure you want to delete "${meal.name}"? This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: () => onMealDeleted(meal.id)
                      }
                    ]
                  );
                }
              }}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.compactNutrition}>
          <View style={styles.compactNutritionItem}>
            <Text style={styles.compactNutritionValue}>{meal.calories}</Text>
            <Text style={styles.compactNutritionLabel}>cal</Text>
          </View>
          <View style={styles.compactNutritionItem}>
            <Text style={styles.compactNutritionValue}>{meal.nutrition.protein.value}g</Text>
            <Text style={styles.compactNutritionLabel}>protein</Text>
          </View>
          <View style={styles.compactNutritionItem}>
            <Text style={styles.compactNutritionValue}>{meal.nutrition.carbs.value}g</Text>
            <Text style={styles.compactNutritionLabel}>carbs</Text>
          </View>
          <View style={styles.compactNutritionItem}>
            <Text style={styles.compactNutritionValue}>{meal.nutrition.fat.value}g</Text>
            <Text style={styles.compactNutritionLabel}>fat</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Detailed Modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meal Details</Text>
              <TouchableOpacity
                onPress={() => setShowDetails(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <MealCard 
                meal={meal} 
                onMealConsumed={(meal, servingSize) => {
                  if (onMealConsumed) {
                    onMealConsumed(meal, servingSize);
                  }
                  setShowDetails(false);
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 15,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#222',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  mealTypeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  compactTitleText: {
    flex: 1,
  },
  compactMealName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  compactMealType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  aiBadge: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 5,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#ff4444',
  },
  compactNutrition: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactNutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  compactNutritionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  compactNutritionLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderRadius: 20,
    width: width * 0.95,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
}); 