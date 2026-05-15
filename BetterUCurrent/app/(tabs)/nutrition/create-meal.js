"use client";

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
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

/**
 * Create Meal - Step-by-step meal builder.
 * Step 1: Name your meal
 * Step 2: Add food items (one at a time, clear fields)
 * Step 3: Review totals and save
 */
export default function CreateMealScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addCalories } = useTracking();
  const userId = user?.id;

  const [step, setStep] = useState(1);
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [foodItems, setFoodItems] = useState([]);
  const [currentName, setCurrentName] = useState('');
  const [currentCal, setCurrentCal] = useState('');
  const [currentP, setCurrentP] = useState('');
  const [currentC, setCurrentC] = useState('');
  const [currentF, setCurrentF] = useState('');
  const [saving, setSaving] = useState(false);

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { value: 'lunch', label: 'Lunch', icon: '☀️' },
    { value: 'dinner', label: 'Dinner', icon: '🌙' },
    { value: 'snack', label: 'Snack', icon: '🍎' },
  ];

  const totalCal = foodItems.reduce((s, f) => s + (f.calories || 0), 0);
  const totalP = foodItems.reduce((s, f) => s + (f.protein || 0), 0);
  const totalC = foodItems.reduce((s, f) => s + (f.carbs || 0), 0);
  const totalF = foodItems.reduce((s, f) => s + (f.fat || 0), 0);

  const addCurrentItem = () => {
    const cal = parseInt(currentCal, 10) || 0;
    if (cal <= 0 && !currentName.trim()) return;
    setFoodItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: currentName.trim() || 'Food item',
        calories: cal,
        protein: parseInt(currentP, 10) || 0,
        carbs: parseInt(currentC, 10) || 0,
        fat: parseInt(currentF, 10) || 0,
      },
    ]);
    setCurrentName('');
    setCurrentCal('');
    setCurrentP('');
    setCurrentC('');
    setCurrentF('');
  };

  const removeItem = (id) => {
    setFoodItems((prev) => prev.filter((f) => f.id !== id));
  };

  const saveMeal = async (addToToday) => {
    const name = mealName.trim() || 'Custom Meal';
    if (totalCal <= 0 && totalP <= 0 && totalC <= 0 && totalF <= 0) {
      Alert.alert('Add items first', 'Add at least one food item with calories or macros.');
      return;
    }

    setSaving(true);
    try {
      const nutrition = {
        calories: { value: Math.round(totalCal), unit: 'kcal' },
        protein: { value: Math.round(totalP), unit: 'g' },
        carbs: { value: Math.round(totalC), unit: 'g' },
        fat: { value: Math.round(totalF), unit: 'g' },
        fiber: { value: 0, unit: 'g' },
        sugar: { value: 0, unit: 'g' },
        sodium: { value: 0, unit: 'mg' },
      };

      const ingredients = foodItems.map((f) => ({
        name: f.name,
        amount: 1,
        unit: 'serving',
      }));

      const { data: meal, error } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          name,
          description: '',
          ingredients,
          instructions: '',
          nutrition,
          calories: Math.round(totalCal),
          meal_type: mealType,
          is_ai_generated: false,
        })
        .select()
        .single();

      if (error) throw error;

      if (addToToday) {
        await consumeMeal(meal.id, userId, 1);
        addCalories(Math.round(totalCal));
      }

      Alert.alert('Saved', addToToday ? 'Meal added to today!' : 'Meal saved to library.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error('Save meal error:', e);
      Alert.alert('Error', 'Could not save meal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={T.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Meal</Text>
      </View>

      {/* Step indicator */}
      <View style={styles.stepBar}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
      </View>
      <Text style={styles.stepLabel}>
        {step === 1 ? 'Name & type' : step === 2 ? 'Add foods' : 'Review & save'}
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>What&apos;s the meal called?</Text>
            <TextInput
              style={styles.input}
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g. Post-workout lunch"
              placeholderTextColor={T.textDim}
            />
            <Text style={styles.sectionTitle}>Meal type</Text>
            <View style={styles.typeRow}>
              {mealTypes.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeBtn, mealType === t.value && styles.typeBtnActive]}
                  onPress={() => setMealType(t.value)}
                >
                  <Text style={styles.typeIcon}>{t.icon}</Text>
                  <Text style={[styles.typeLabel, mealType === t.value && styles.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)}>
              <Text style={styles.primaryBtnText}>Next: Add foods</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Add food items</Text>
            <Text style={styles.sectionHint}>Enter each food and its nutrition. At least calories required.</Text>

            <View style={styles.addCard}>
              <Text style={styles.addCardLabel}>New item</Text>
              <TextInput
                style={styles.input}
                value={currentName}
                onChangeText={setCurrentName}
                placeholder="Food name (e.g. Chicken breast)"
                placeholderTextColor={T.textDim}
              />
              <View style={styles.macroGrid}>
                <View style={styles.macroInputWrap}>
                  <Text style={styles.macroLabel}>Cal</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={currentCal}
                    onChangeText={setCurrentCal}
                    placeholder="0"
                    placeholderTextColor={T.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInputWrap}>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={currentP}
                    onChangeText={setCurrentP}
                    placeholder="0"
                    placeholderTextColor={T.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInputWrap}>
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={currentC}
                    onChangeText={setCurrentC}
                    placeholder="0"
                    placeholderTextColor={T.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInputWrap}>
                  <Text style={styles.macroLabel}>Fat</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={currentF}
                    onChangeText={setCurrentF}
                    placeholder="0"
                    placeholderTextColor={T.textDim}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.addItemBtn} onPress={addCurrentItem}>
                <Ionicons name="add" size={22} color={T.primary} />
                <Text style={styles.addItemBtnText}>Add to meal</Text>
              </TouchableOpacity>
            </View>

            {foodItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Added ({foodItems.length})</Text>
                {foodItems.map((f) => (
                  <View key={f.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{f.name}</Text>
                      <Text style={styles.itemMacros}>
                        {f.calories} cal · P:{f.protein}g C:{f.carbs}g F:{f.fat}g
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(f.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={24} color={T.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(3)}>
                  <Text style={styles.primaryBtnText}>Review totals</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryName}>{mealName || 'Custom Meal'}</Text>
              <Text style={styles.summaryType}>{mealTypes.find((t) => t.value === mealType)?.label}</Text>
              <View style={styles.summaryTotals}>
                <Text style={styles.summaryTotal}>{Math.round(totalCal)} cal</Text>
                <Text style={styles.summaryMacros}>
                  P: {Math.round(totalP)}g · C: {Math.round(totalC)}g · F: {Math.round(totalF)}g
                </Text>
              </View>
              <Text style={styles.summaryItems}>{foodItems.length} food item(s)</Text>
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(2)}>
              <Ionicons name="pencil" size={18} color={T.primary} />
              <Text style={styles.secondaryBtnText}>Edit items</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => saveMeal(true)} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Add to Today'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => saveMeal(false)} disabled={saving}>
              <Text style={styles.outlineBtnText}>Save to library only</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  backBtn: { marginRight: 12 },
  title: { fontSize: 22, fontWeight: '700', color: T.text },
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: T.screenPadding,
    marginBottom: 4,
  },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepDotActive: { backgroundColor: T.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: 'rgba(0,255,255,0.4)' },
  stepLabel: { fontSize: 12, color: T.textMuted, marginHorizontal: T.screenPadding, marginBottom: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: T.screenPadding },
  stepContent: {},
  sectionTitle: { fontSize: 17, fontWeight: '700', color: T.text, marginBottom: 8 },
  sectionHint: { fontSize: 14, color: T.textMuted, marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    color: T.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeBtnActive: { backgroundColor: 'rgba(0,255,255,0.1)', borderColor: 'rgba(0,255,255,0.3)' },
  typeIcon: { fontSize: 20, marginBottom: 4 },
  typeLabel: { fontSize: 13, color: T.textMuted, fontWeight: '600' },
  typeLabelActive: { color: T.primary },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: T.primary,
    marginTop: 8,
  },
  primaryBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
  addCard: {
    backgroundColor: T.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  addCardLabel: { fontSize: 14, color: T.textMuted, marginBottom: 12, fontWeight: '600' },
  macroGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  macroInputWrap: { flex: 1 },
  macroLabel: { fontSize: 11, color: T.textMuted, marginBottom: 6 },
  macroInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    color: T.text,
    fontSize: 15,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
  },
  addItemBtnText: { color: T.primary, fontSize: 15, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: T.text },
  itemMacros: { fontSize: 13, color: T.textMuted, marginTop: 2 },
  summaryCard: {
    backgroundColor: T.cardBg,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: T.cardBorder,
    alignItems: 'center',
  },
  summaryName: { fontSize: 22, fontWeight: '700', color: T.text, marginBottom: 4 },
  summaryType: { fontSize: 14, color: T.textMuted, marginBottom: 16 },
  summaryTotals: { alignItems: 'center', marginBottom: 8 },
  summaryTotal: { fontSize: 28, fontWeight: '800', color: T.primary },
  summaryMacros: { fontSize: 15, color: T.textMuted },
  summaryItems: { fontSize: 13, color: T.textDim },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  secondaryBtnText: { color: T.primary, fontSize: 16, fontWeight: '600' },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 8,
  },
  outlineBtnText: { color: T.textMuted, fontSize: 16, fontWeight: '600' },
});
