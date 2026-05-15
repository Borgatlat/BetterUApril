"use client";

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTracking } from '../../../context/TrackingContext';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useUser } from '../../../context/UserContext';
import { presentPremiumPaywall } from '../../../lib/purchases';
import { NutritionTheme as T } from '../../../config/NutritionTheme';

/**
 * Macro Goals settings: daily calorie, protein, water goals.
 * Premium only - non-premium users are redirected to paywall.
 */
export default function NutritionSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useUser();

  useEffect(() => {
    if (isPremium === false) {
      (async () => {
        await presentPremiumPaywall();
        router.back();
      })();
    }
  }, [isPremium]);

  useEffect(() => {
    if (calories?.goal != null) setCalorieGoal(calories.goal);
    if (protein?.goal != null) setProteinGoal(protein.goal);
    if (water?.goal != null) setWaterGoal(water.goal);
    if (carbs?.goal != null) setCarbGoal(carbs.goal);
    if (fat?.goal != null) setFatGoal(fat.goal);
  }, [calories?.goal, protein?.goal, water?.goal, carbs?.goal, fat?.goal]);
  const { calories, water, protein, carbs, fat, updateGoal } = useTracking();
  const profileId = user?.id;

  const [calorieGoal, setCalorieGoal] = useState(calories?.goal ?? 2000);
  const [proteinGoal, setProteinGoal] = useState(protein?.goal ?? 100);
  const [waterGoal, setWaterGoal] = useState(water?.goal ?? 2);
  const [carbGoal, setCarbGoal] = useState(carbs?.goal ?? 250);
  const [fatGoal, setFatGoal] = useState(fat?.goal ?? 65);
  const [editingGoal, setEditingGoal] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGoal('calories', calorieGoal);
      await updateGoal('protein', proteinGoal);
      await updateGoal('water', waterGoal);
      await updateGoal('carbs', carbGoal);
      await updateGoal('fat', fatGoal);

      try {
        await supabase
          .from('profiles')
          .update({
            calorie_goal: calorieGoal,
            water_goal_ml: Math.round(waterGoal * 1000),
            protein_goal: proteinGoal,
            carb_goal: carbGoal,
            fat_goal: fatGoal,
          })
          .eq('id', profileId);
      } catch (e) {
        console.warn('Profiles update (some columns may not exist):', e);
      }
      Alert.alert('Saved', 'Your goals have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error('Save goals error:', e);
      Alert.alert('Error', 'Could not save goals.');
    } finally {
      setSaving(false);
    }
  };

  if (isPremium === false) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={T.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Macro Goals</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Targets</Text>
        <Text style={styles.hint}>Tap to scroll and select your goals.</Text>

        <TouchableOpacity style={styles.pickerRow} onPress={() => setEditingGoal('calories')}>
          <Text style={styles.pickerLabel}>Calories</Text>
          <View style={styles.pickerValueRow}>
            <Text style={styles.pickerValue}>{calorieGoal} cal</Text>
            <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pickerRow} onPress={() => setEditingGoal('protein')}>
          <Text style={styles.pickerLabel}>Protein</Text>
          <View style={styles.pickerValueRow}>
            <Text style={styles.pickerValue}>{proteinGoal} g</Text>
            <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pickerRow} onPress={() => setEditingGoal('water')}>
          <Text style={styles.pickerLabel}>Water</Text>
          <View style={styles.pickerValueRow}>
            <Text style={styles.pickerValue}>{waterGoal} L</Text>
            <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pickerRow} onPress={() => setEditingGoal('carbs')}>
          <Text style={styles.pickerLabel}>Carbs</Text>
          <View style={styles.pickerValueRow}>
            <Text style={styles.pickerValue}>{carbGoal} g</Text>
            <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pickerRow} onPress={() => setEditingGoal('fat')}>
          <Text style={styles.pickerLabel}>Fat</Text>
          <View style={styles.pickerValueRow}>
            <Text style={styles.pickerValue}>{fatGoal} g</Text>
            <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>Save Goals</Text>
        </TouchableOpacity>
      </View>

      {editingGoal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>
                  {editingGoal === 'calories' && 'Calories'}
                  {editingGoal === 'protein' && 'Protein'}
                  {editingGoal === 'water' && 'Water'}
                  {editingGoal === 'carbs' && 'Carbs'}
                  {editingGoal === 'fat' && 'Fat'}
                </Text>
                <TouchableOpacity onPress={() => setEditingGoal(null)}>
                  <Text style={styles.pickerModalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerWrap}>
                {editingGoal === 'calories' && (
                  <Picker
                    selectedValue={calorieGoal}
                    onValueChange={setCalorieGoal}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {[...Array(46)].map((_, i) => {
                      const v = 1000 + i * 100;
                      return <Picker.Item key={v} label={`${v} cal`} value={v} />;
                    })}
                  </Picker>
                )}
                {editingGoal === 'protein' && (
                  <Picker
                    selectedValue={proteinGoal}
                    onValueChange={setProteinGoal}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {[...Array(46)].map((_, i) => {
                      const v = 50 + i * 10;
                      return <Picker.Item key={v} label={`${v} g`} value={v} />;
                    })}
                  </Picker>
                )}
                {editingGoal === 'water' && (
                  <Picker
                    selectedValue={waterGoal}
                    onValueChange={setWaterGoal}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {[...Array(24)].map((_, i) => {
                      const v = 0.5 + i * 0.5;
                      return <Picker.Item key={v} label={`${v} L`} value={v} />;
                    })}
                  </Picker>
                )}
                {editingGoal === 'carbs' && (
                  <Picker
                    selectedValue={carbGoal}
                    onValueChange={setCarbGoal}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {[...Array(56)].map((_, i) => {
                      const v = 50 + i * 10;
                      return <Picker.Item key={v} label={`${v} g`} value={v} />;
                    })}
                  </Picker>
                )}
                {editingGoal === 'fat' && (
                  <Picker
                    selectedValue={fatGoal}
                    onValueChange={setFatGoal}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {[...Array(27)].map((_, i) => {
                      const v = 20 + i * 5;
                      return <Picker.Item key={v} label={`${v} g`} value={v} />;
                    })}
                  </Picker>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  scrollContent: { padding: T.screenPadding },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingTop: 56, paddingBottom: 20 },
  backBtn: { marginRight: 12 },
  title: { fontSize: 22, fontWeight: '700', color: T.text },
  card: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: T.text, marginBottom: 8 },
  hint: { fontSize: 14, color: T.textMuted, marginBottom: 20 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerLabel: { fontSize: 16, color: T.text },
  pickerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerValue: { fontSize: 16, fontWeight: '600', color: T.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: T.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerModalTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  pickerModalDone: { fontSize: 17, fontWeight: '600', color: T.primary },
  pickerWrap: { paddingHorizontal: 20, paddingVertical: 8 },
  picker: {
    width: '100%',
    color: T.text,
    ...(Platform.OS === 'android' && { backgroundColor: T.cardBg }),
  },
  pickerItem: { color: T.text, fontSize: 20 },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: T.buttonRadius,
    backgroundColor: T.primary,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
});
