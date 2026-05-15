import { Slot } from 'expo-router';
import { View } from 'react-native';

/**
 * Nutrition tab - uses Slot for simple nested routing without Stack.
 * Routes: index (dashboard), saved-meals, weekly-stats, settings, create-meal
 */
export default function NutritionLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Slot />
    </View>
  );
}
