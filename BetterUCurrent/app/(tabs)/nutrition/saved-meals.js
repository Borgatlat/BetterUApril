"use client";

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useTracking } from '../../../context/TrackingContext';
import { supabase } from '../../../lib/supabase';
import { consumeMeal } from '../../../utils/aiMealGenerator';
import { NutritionTheme as T } from '../../../config/NutritionTheme';
import { MealRecipeModal } from '../../../components/MealRecipeModal';

/**
 * Helper to safely get macro value - handles both { value: N } and plain N formats
 */
function getMacroVal(nutrition, key) {
  if (!nutrition) return 0;
  const v = nutrition[key];
  return typeof v === 'object' && v?.value != null ? v.value : (typeof v === 'number' ? v : 0);
}

/**
 * Saved Meals / Log Food screen:
 * - Quick Log: simple meal with name + calories + macros
 * - Saved meals library with add to today, duplicate, delete
 * - Create Meal link for full meal builder
 */
export default function SavedMealsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addCalories } = useTracking();
  const userId = user?.id;

  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickLogName, setQuickLogName] = useState('');
  const [quickLogCal, setQuickLogCal] = useState('');
  const [quickLogP, setQuickLogP] = useState('');
  const [quickLogC, setQuickLogC] = useState('');
  const [quickLogF, setQuickLogF] = useState('');
  const [saving, setSaving] = useState(false);
  const [recipeModalMeal, setRecipeModalMeal] = useState(null);

  const loadMeals = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeals(data || []);
    } catch (e) {
      console.error('Load meals error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  React.useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMeals();
  };

  const handleQuickLog = async () => {
    const name = quickLogName.trim() || 'Quick Log';
    const cal = parseInt(quickLogCal, 10) || 0;
    const p = parseInt(quickLogP, 10) || 0;
    const c = parseInt(quickLogC, 10) || 0;
    const f = parseInt(quickLogF, 10) || 0;

    if (cal <= 0) {
      Alert.alert('Missing info', 'Enter at least calories.');
      return;
    }

    setSaving(true);
    try {
      const nutrition = {
        calories: { value: cal, unit: 'kcal' },
        protein: { value: p, unit: 'g' },
        carbs: { value: c, unit: 'g' },
        fat: { value: f, unit: 'g' },
        fiber: { value: 0, unit: 'g' },
        sugar: { value: 0, unit: 'g' },
        sodium: { value: 0, unit: 'mg' },
      };

      const { data: meal, error } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          name,
          description: '',
          ingredients: [{ name: 'Quick log', amount: 1, unit: 'serving' }],
          instructions: '',
          nutrition,
          calories: cal,
          meal_type: 'snack',
          is_ai_generated: false,
        })
        .select()
        .single();

      if (error) throw error;

      await consumeMeal(meal.id, userId, 1);
      addCalories(cal);

      setQuickLogName('');
      setQuickLogCal('');
      setQuickLogP('');
      setQuickLogC('');
      setQuickLogF('');
      setShowQuickLog(false);
      Alert.alert('Logged!', `"${name}" added to today.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.error('Quick log error:', e);
      Alert.alert('Error', 'Could not log meal.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddToToday = async (meal) => {
    if (!userId) return;
    try {
      await consumeMeal(meal.id, userId, 1);
      addCalories(meal.calories || 0);
      Alert.alert('Added', `"${meal.name}" added to today!`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.error('Add to today error:', e);
      Alert.alert('Error', 'Could not add meal.');
    }
  };

  const handleDelete = (meal) => {
    Alert.alert('Delete Meal', `Delete "${meal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('meals').delete().eq('id', meal.id).eq('user_id', userId);
            setMeals((prev) => prev.filter((m) => m.id !== meal.id));
          } catch (e) {
            console.error('Delete error:', e);
          }
        },
      },
    ]);
  };

  const handleDuplicate = async (meal) => {
    try {
      const nutrition = meal.nutrition || {};
      const { data, error } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          name: `${meal.name} (Copy)`,
          description: meal.description,
          ingredients: meal.ingredients || [],
          instructions: meal.instructions || '',
          nutrition,
          calories: meal.calories || 0,
          meal_type: meal.meal_type || 'lunch',
          cuisine_type: meal.cuisine_type,
          prep_time: meal.prep_time,
          cook_time: meal.cook_time,
          is_ai_generated: false,
        })
        .select()
        .single();

      if (error) throw error;
      setMeals((prev) => [data, ...prev]);
      Alert.alert('Duplicated', `"${meal.name}" copied to your library.`);
    } catch (e) {
      console.error('Duplicate error:', e);
      Alert.alert('Error', 'Could not duplicate meal.');
    }
  };

  const renderMeal = ({ item }) => {
    const icon = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }[item.meal_type] || '🍽️';
    const cal = item.calories || 0;
    const p = getMacroVal(item.nutrition, 'protein');
    const c = getMacroVal(item.nutrition, 'carbs');
    const f = getMacroVal(item.nutrition, 'fat');

    return (
      <View style={styles.mealCard}>
        <TouchableOpacity
          style={styles.mealCardHeader}
          onPress={() => setRecipeModalMeal(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.mealIcon}>{icon}</Text>
          <View style={styles.mealCardContent}>
            <Text style={styles.mealName}>{item.name}</Text>
            <Text style={styles.mealMacros}>
              {cal} cal · P:{p}g C:{c}g F:{f}g
            </Text>
          </View>
          {item.is_ai_generated && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
        </TouchableOpacity>
        <View style={styles.mealActions}>
          <TouchableOpacity style={styles.mealActionBtn} onPress={() => handleAddToToday(item)}>
            <Ionicons name="add-circle" size={20} color={T.primary} />
            <Text style={styles.mealActionText}>Add to Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mealActionBtn} onPress={() => handleDuplicate(item)}>
            <Ionicons name="copy-outline" size={18} color={T.textMuted} />
            <Text style={[styles.mealActionText, { color: T.textMuted }]}>Duplicate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mealActionBtn}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color={T.error} />
            <Text style={[styles.mealActionText, { color: T.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={T.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Log Food</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Log options - consistent card style */}
      <View style={styles.optionsCard}>
        <TouchableOpacity style={styles.optionRow} onPress={() => setShowQuickLog(true)}>
          <View style={styles.optionIconWrap}>
            <Ionicons name="add" size={20} color={T.primary} />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Quick Log</Text>
            <Text style={styles.optionSubtitle}>Log calories & macros quickly</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
        </TouchableOpacity>
        <View style={styles.optionDivider} />
        <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/nutrition/create-meal')}>
          <View style={styles.optionIconWrap}>
            <Ionicons name="create-outline" size={20} color={T.primary} />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Create Meal</Text>
            <Text style={styles.optionSubtitle}>Build a meal with multiple items</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Saved Meals</Text>

      <MealRecipeModal
        meal={recipeModalMeal}
        visible={!!recipeModalMeal}
        onClose={() => setRecipeModalMeal(null)}
        onAddToToday={(m) => {
          setRecipeModalMeal(null);
          handleAddToToday(m);
        }}
      />

      <FlatList
        data={meals}
        keyExtractor={(m) => m.id}
        renderItem={renderMeal}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={48} color={T.textMuted} />
            <Text style={styles.emptyText}>No saved meals yet</Text>
            <Text style={styles.emptySubtext}>Use Quick Log or Create Meal to add meals to your library</Text>
          </View>
        }
      />

      {/* Quick Log Modal */}
      <Modal visible={showQuickLog} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Log</Text>
              <TouchableOpacity onPress={() => setShowQuickLog(false)}>
                <Ionicons name="close" size={28} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Food / meal name</Text>
              <TextInput
                style={styles.input}
                value={quickLogName}
                onChangeText={setQuickLogName}
                placeholder="e.g. Chicken salad"
                placeholderTextColor={T.textDim}
              />
              <Text style={styles.inputLabel}>Calories *</Text>
              <TextInput
                style={styles.input}
                value={quickLogCal}
                onChangeText={setQuickLogCal}
                placeholder="250"
                placeholderTextColor={T.textDim}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Protein (g)</Text>
              <TextInput
                style={styles.input}
                value={quickLogP}
                onChangeText={setQuickLogP}
                placeholder="20"
                placeholderTextColor={T.textDim}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Carbs (g)</Text>
              <TextInput
                style={styles.input}
                value={quickLogC}
                onChangeText={setQuickLogC}
                placeholder="15"
                placeholderTextColor={T.textDim}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Fat (g)</Text>
              <TextInput
                style={styles.input}
                value={quickLogF}
                onChangeText={setQuickLogF}
                placeholder="10"
                placeholderTextColor={T.textDim}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleQuickLog}
                disabled={saving}
              >
                <Text style={styles.submitBtnText}>{saving ? 'Logging...' : 'Add to Today'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: T.text },
  optionsCard: {
    marginHorizontal: T.screenPadding,
    marginBottom: 20,
    backgroundColor: T.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: T.text },
  optionSubtitle: { fontSize: 13, color: T.textMuted, marginTop: 2 },
  optionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 70 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: T.textMuted,
    marginHorizontal: T.screenPadding,
    marginBottom: 12,
  },
  listContent: { padding: T.screenPadding, paddingBottom: 100 },
  mealCard: {
    backgroundColor: T.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  mealCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  mealIcon: { fontSize: 24, marginRight: 14 },
  mealCardContent: { flex: 1 },
  mealName: { fontSize: 17, fontWeight: '700', color: T.text },
  mealMacros: { fontSize: 14, color: T.textMuted, marginTop: 4 },
  aiBadge: {
    backgroundColor: 'rgba(0,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBadgeText: { color: T.primary, fontSize: 11, fontWeight: '700' },
  mealActions: { flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  mealActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealActionText: { color: T.primary, fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 17, color: T.text, fontWeight: '600', marginTop: 14 },
  emptySubtext: { fontSize: 14, color: T.textMuted, marginTop: 8, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: T.text },
  inputLabel: { fontSize: 14, color: T.textMuted, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    color: T.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  submitBtn: {
    marginTop: 24,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: T.primary,
    alignItems: 'center',
  },
  submitBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
});
