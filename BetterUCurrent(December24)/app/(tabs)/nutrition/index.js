"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  Alert,
  SafeAreaView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useTracking } from '../../../context/TrackingContext';
import { useUser } from '../../../context/UserContext';
import { useAuth } from '../../../context/AuthContext';
import { useAIConsent } from '../../../context/AIConsentContext';
import { getDailyNutrition, consumeMeal, analyzeFoodImage, saveGeneratedMeal } from '../../../utils/aiMealGenerator';
import { supabase } from '../../../lib/supabase';
import { NutritionTheme as T } from '../../../config/NutritionTheme';
import { AIMealGenerator } from '../../../components/AIMealGenerator';
import { MealRecipeModal } from '../../../components/MealRecipeModal';
import { getAIGenerationUsageInfo, incrementAIGenerationUsage, FEATURE_TYPES } from '../../../utils/aiGenerationLimits';
import { getLocalDateString } from '../../../utils/dateUtils';
import { presentPremiumPaywall } from '../../../lib/purchases';
import * as ImagePicker from 'expo-image-picker';

function TodayMealRow({ item, onDelete, onPress }) {
  const meal = item.meal || item;
  const cal = item.actual_calories ?? meal?.calories ?? 0;
  const nut = meal?.nutrition || {};
  const p = nut.protein?.value ?? nut.protein ?? 0;
  const c = nut.carbs?.value ?? nut.carbs ?? 0;
  const f = nut.fat?.value ?? nut.fat ?? 0;
  const icon = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }[meal?.meal_type] || '🍽️';
  const content = (
    <>
      <Text style={mealRowStyles.icon}>{icon}</Text>
      <View style={mealRowStyles.content}>
        <Text style={mealRowStyles.name}>{meal?.name || 'Meal'}</Text>
        <Text style={mealRowStyles.macros}>{cal} cal · P:{p}g C:{c}g F:{f}g</Text>
      </View>
      {onDelete && (
        <TouchableOpacity
          onPress={(e) => {
            e?.stopPropagation?.();
            Alert.alert('Remove', `Remove "${meal?.name}" from today?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onDelete(item.consumption_id || item.id) },
            ]);
          }}
          style={mealRowStyles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={18} color={T.error} />
        </TouchableOpacity>
      )}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={mealRowStyles.row} onPress={() => onPress(meal)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={mealRowStyles.row}>{content}</View>;
}

const mealRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  icon: { fontSize: 20, marginRight: 12 },
  content: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: T.text },
  macros: { fontSize: 13, color: T.textMuted, marginTop: 2 },
  deleteBtn: { padding: 8 },
});

// Step sizes for manual adjustments (same water step as “Quick Add” pills)
const CAL_STEP = 50;
const WATER_STEP_ML = 250;
const MACRO_PROTEIN_CARBS_STEP = 5;
const MACRO_FAT_STEP = 2;

/** Maps each tracker type to modal copy (title + short hint for the text field). */
const ADJUST_MODAL_META = {
  calories: { title: 'Calories', hint: 'Whole calories (e.g. 150).' },
  water: { title: 'Water', hint: 'Milliliters — 1000 ml = 1 liter.' },
  protein: { title: 'Protein', hint: 'Grams of protein.' },
  carbs: { title: 'Carbs', hint: 'Grams of carbohydrates.' },
  fat: { title: 'Fat', hint: 'Grams of fat.' },
};

const ADJUST_MODAL_ACCENT = {
  calories: T.calorie,
  water: T.water,
  protein: T.protein,
  carbs: T.carbs,
  fat: T.fat,
};

function defaultAmountForMetric(metricType) {
  switch (metricType) {
    case 'calories':
      return String(CAL_STEP);
    case 'water':
      return String(WATER_STEP_ML);
    case 'protein':
    case 'carbs':
      return String(MACRO_PROTEIN_CARBS_STEP);
    case 'fat':
      return String(MACRO_FAT_STEP);
    default:
      return '1';
  }
}

/**
 * Modal: pick Add vs Remove, type any positive amount, then apply (signed number goes to `addCalories` / `addWater` / etc.).
 * `onApply` receives a signed number (+ add, − subtract); parent runs `runNutritionDelta` and persistence.
 */
function NutritionAdjustModal({ visible, metricType, accentColor, applying, onClose, onApply }) {
  const [mode, setMode] = useState('add');
  const [amountText, setAmountText] = useState('');

  // When the sheet opens (or metric changes), reset fields so you always start from the default step size.
  useEffect(() => {
    if (visible && metricType) {
      setMode('add');
      setAmountText(defaultAmountForMetric(metricType));
    }
  }, [visible, metricType]);

  const meta = ADJUST_MODAL_META[metricType] || ADJUST_MODAL_META.calories;

  const submit = () => {
    Keyboard.dismiss();
    const n = parseFloat(String(amountText).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number (for example 50 or 12.5).');
      return;
    }
    const signed = mode === 'add' ? n : -n;
    onApply(signed);
  };

  if (!metricType) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Full-screen tap target behind the card — closes the modal (common overlay pattern). */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.adjustModalKbWrap}
        >
          <View style={styles.adjustModalCard}>
            <Text style={styles.adjustModalTitle}>{meta.title}</Text>
            <Text style={styles.adjustModalHint}>{meta.hint}</Text>

            <View style={styles.adjustModeRow}>
              {['add', 'remove'].map((m) => {
                const selected = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.adjustModeBtn,
                      selected && { borderColor: accentColor, backgroundColor: `${accentColor}22` },
                    ]}
                    onPress={() => setMode(m)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.adjustModeBtnText, selected && { color: accentColor }]}>
                      {m === 'add' ? 'Add' : 'Remove'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.adjustInputLabel}>Amount</Text>
            <TextInput
              style={styles.adjustInput}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={T.textMuted}
              editable={!applying}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose} disabled={applying}>
                <Text style={[styles.modalBtnText, { color: T.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: accentColor }]}
                onPress={submit}
                disabled={applying}
              >
                <Text style={styles.modalBtnText}>{applying ? 'Saving…' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * A compact − / + row used on the Nutrition dashboard.
 * - `onMinus` / `onPlus`: parent passes async functions so we can save to TrackingContext + reload.
 * - `disabled`: blocks both taps while a save is in flight (prevents double-submits).
 * - `minusDisabled`: extra guard so we do not spam “subtract” when the value is already zero.
 */
function TrackerStepper({ accentColor, stepLabel, onMinus, onPlus, disabled, minusDisabled, compact, onCustomPress }) {
  const minusSize = compact ? 18 : 20;
  const plusSize = compact ? 20 : 22;
  return (
    <View style={stepperStyles.wrap}>
      <View style={[stepperStyles.row, compact && stepperStyles.rowCompact]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Decrease amount"
          style={[
            stepperStyles.btn,
            compact && stepperStyles.btnCompact,
            (disabled || minusDisabled) && stepperStyles.btnMuted,
          ]}
          onPress={onMinus}
          disabled={disabled || minusDisabled}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={minusSize} color={accentColor} />
        </TouchableOpacity>
        <Text style={[stepperStyles.hint, compact && stepperStyles.hintCompact]} numberOfLines={1}>
          {stepLabel}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Increase amount"
          style={[stepperStyles.btn, compact && stepperStyles.btnCompact, disabled && stepperStyles.btnMuted]}
          onPress={onPlus}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={plusSize} color={accentColor} />
        </TouchableOpacity>
      </View>
      {onCustomPress ? (
        <TouchableOpacity
          onPress={onCustomPress}
          disabled={disabled}
          style={[stepperStyles.customLink, compact && stepperStyles.customLinkCompact]}
          hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
        >
          <Ionicons name="options-outline" size={compact ? 12 : 14} color={T.primary} style={{ marginRight: 4 }} />
          <Text style={[stepperStyles.customLinkText, compact && stepperStyles.customLinkTextCompact]}>Custom amount</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  /** Narrow columns (macro cards): slightly smaller tap targets so three columns fit on small phones. */
  rowCompact: { marginTop: 8, paddingTop: 8, gap: 4 },
  btn: {
    flex: 1,
    maxWidth: 48,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: { maxWidth: 40, height: 30 },
  btnMuted: { opacity: 0.35 },
  hint: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: '600', color: T.textMuted, textAlign: 'center' },
  hintCompact: { fontSize: 10 },
  customLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  customLinkCompact: { marginTop: 4 },
  customLinkText: { fontSize: 12, fontWeight: '600', color: T.primary },
  customLinkTextCompact: { fontSize: 10 },
});

function calculateDayScore(cal, prot, carbs, fat, wat, dailyNutr) {
  let score = 0;
  const protConsumed = dailyNutr?.total_protein ?? prot?.consumed ?? 0;
  const carbsConsumed = dailyNutr?.total_carbs ?? 0;
  const fatConsumed = dailyNutr?.total_fat ?? 0;
  const waterGoalMl = (wat?.goal || 0) * 1000;
  if (cal?.goal > 0) score += Math.min((cal.consumed || 0) / cal.goal, 1) * 25;
  if (prot?.goal > 0) score += Math.min(protConsumed / prot.goal, 1) * 25;
  if (carbs?.goal > 0) score += Math.min(carbsConsumed / carbs.goal, 1) * 20;
  if (fat?.goal > 0) score += Math.min(fatConsumed / fat.goal, 1) * 15;
  if (waterGoalMl > 0) score += Math.min((wat?.consumed || 0) / waterGoalMl, 1) * 15;
  return Math.min(Math.round(score), 100);
}

function CalorieRing({ progress, size = 100, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 1));
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#1a1a1a" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={T.calorie}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference},${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.ringValue, { color: T.calorie }]}>{Math.round((progress || 0) * 100)}%</Text>
      </View>
    </View>
  );
}

function WaterRing({ progress, size = 80, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 1));
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#1a1a1a" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={T.water}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference},${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.ringValueSmall, { color: T.water }]}>{Math.round((progress || 0) * 100)}%</Text>
      </View>
    </View>
  );
}

export default function NutritionDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { userProfile, isPremium } = useUser();
  const { requestAIConsent } = useAIConsent();
  const tracking = useTracking();

  const calories = tracking?.calories ?? { consumed: 0, goal: 2000 };
  const water = tracking?.water ?? { consumed: 0, goal: 2 };
  const protein = tracking?.protein ?? { consumed: 0, goal: 100 };
  const carbs = tracking?.carbs ?? { goal: 250 };
  const fat = tracking?.fat ?? { goal: 65 };
  const addCalories = tracking?.addCalories ?? (() => {});
  const addWater = tracking?.addWater ?? (() => {});
  const addProtein = tracking?.addProtein ?? (() => {});
  const addCarbs = tracking?.addCarbs ?? (() => {});
  const addFat = tracking?.addFat ?? (() => {});
  const setCalories = tracking?.setCalories ?? (() => {});
  const syncProteinTracker = tracking?.syncProteinTracker ?? (() => Promise.resolve());
  const checkMidnightReset = tracking?.checkMidnightReset ?? (() => Promise.resolve());

  const [dailyNutrition, setDailyNutrition] = useState({ total_protein: 0, total_carbs: 0, total_fat: 0 });
  /** True while a manual +/− is writing to Supabase + `loadData` runs — keeps taps from stacking. */
  const [nutritionAdjusting, setNutritionAdjusting] = useState(false);
  /** Which metric the “Custom amount” modal is editing (`null` = closed). */
  const [adjustModalType, setAdjustModalType] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAIMealModal, setShowAIMealModal] = useState(false);
  const [mealUsage, setMealUsage] = useState({ currentUsage: 0, limit: 1, remaining: 1 });
  const [photoMealUsage, setPhotoMealUsage] = useState({ currentUsage: 0, limit: 5, remaining: 5 });
  const [recipeModalMeal, setRecipeModalMeal] = useState(null);
  const [recipeModalShowAddToToday, setRecipeModalShowAddToToday] = useState(false);
  const [photoMealLoading, setPhotoMealLoading] = useState(false);

  const userId = user?.id || userProfile?.id;
  const profileId = userId;

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      await checkMidnightReset();
      const d = new Date();
      const today = getLocalDateString(d);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const [nutr, mealsRes] = await Promise.all([
        getDailyNutrition(userId, today),
        supabase
          .from('meal_consumptions')
          .select('id, consumed_at, serving_size, actual_calories, meal:meals(id, name, meal_type, calories, nutrition, ingredients, instructions, description, prep_time, cook_time, cuisine_type, is_ai_generated, sources)')
          .eq('user_id', userId)
          .gte('consumed_at', dayStart.toISOString())
          .lte('consumed_at', dayEnd.toISOString())
          .order('consumed_at', { ascending: false }),
      ]);
      setDailyNutrition(nutr || { total_protein: 0, total_carbs: 0, total_fat: 0 });
      await syncProteinTracker();
      const withMeal = (mealsRes?.data || []).filter((m) => m.meal);
      setTodayMeals(
        withMeal.map((m) => ({
          ...m.meal,
          consumption_id: m.id,
          serving_size: m.serving_size,
          actual_calories: m.actual_calories,
        }))
      );
      if (isPremium !== undefined) {
        const [mealInfo, photoInfo] = await Promise.all([
          getAIGenerationUsageInfo(FEATURE_TYPES.MEAL, isPremium),
          getAIGenerationUsageInfo(FEATURE_TYPES.PHOTO_MEAL, isPremium)
        ]);
        setMealUsage(mealInfo || { currentUsage: 0, limit: 1, remaining: 1 });
        setPhotoMealUsage(photoInfo || { currentUsage: 0, limit: 5, remaining: 5 });
      }
    } catch (e) {
      console.error('Nutrition load error:', e);
    }
  }, [userId, isPremium]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when tab is focused (e.g. next day, returning from another screen)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const fetchUsage = async () => {
      if (isPremium !== undefined) {
        try {
          const info = await getAIGenerationUsageInfo(FEATURE_TYPES.MEAL, isPremium);
          setMealUsage(info || { currentUsage: 0, limit: 1, remaining: 1 });
        } catch (e) {
          console.error('Fetch meal usage error:', e);
        }
      }
    };
    fetchUsage();
  }, [isPremium, showAIMealModal]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  /**
   * Runs one tracking mutation then reloads this screen’s Supabase-backed totals.
   * If you removed `await loadData()`, the macro bars could stay stale because they read `dailyNutrition` state.
   */
  /** Returns `false` if another adjustment was already running (so callers do not clear UI state by mistake). */
  const runNutritionDelta = async (fn) => {
    if (nutritionAdjusting) return false;
    setNutritionAdjusting(true);
    try {
      await fn();
      await loadData();
      return true;
    } finally {
      setNutritionAdjusting(false);
    }
  };

  /** Called from `NutritionAdjustModal` with a signed delta (+ add, − remove). */
  const applyAdjustModal = async (signed) => {
    const t = adjustModalType;
    if (!t) return;
    try {
      const ok = await runNutritionDelta(async () => {
        if (t === 'calories') await addCalories(Math.round(signed));
        else if (t === 'water') await addWater(Math.round(signed));
        else if (t === 'protein') await addProtein(Math.round(signed));
        else if (t === 'carbs') await addCarbs(Math.round(signed * 100) / 100);
        else if (t === 'fat') await addFat(Math.round(signed * 100) / 100);
      });
      if (ok) setAdjustModalType(null);
    } catch (e) {
      console.error('applyAdjustModal', e);
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  const processPhotoAndLog = async (base64) => {
    if (!base64 || !userId) return;
    const allowed = await requestAIConsent();
    if (!allowed) return;
    setPhotoMealLoading(true);
    try {
      const mealData = await analyzeFoodImage(base64);
      const saved = await saveGeneratedMeal(mealData, userId);
      await consumeMeal(saved.id, userId, 1);
      addCalories(Math.round(saved.calories || mealData.nutrition?.calories?.value || 0));
      await incrementAIGenerationUsage(FEATURE_TYPES.PHOTO_MEAL);
      await loadData();
      Alert.alert('Logged!', `"${saved.name}" added to today.`);
    } catch (e) {
      console.error('Photo meal error:', e);
      Alert.alert('Error', e?.message || 'Could not analyze or log meal.');
    } finally {
      setPhotoMealLoading(false);
    }
  };

  const handlePhotoMeal = () => {
    if (!userId) return;
    // Non-premium users: show paywall directly instead of an alert
    if (!isPremium || photoMealUsage.limit === 0) {
      presentPremiumPaywall();
      return;
    }
    if (photoMealUsage.currentUsage >= photoMealUsage.limit) {
      Alert.alert('Daily Limit Reached', `You've used all ${photoMealUsage.limit} photo logs for today. Resets tomorrow.`);
      return;
    }
    Alert.alert('Log meal from photo', 'Take a new photo or choose one from your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow camera access to take photos of your meals.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true
          });
          if (result.canceled || !result.assets?.[0]?.base64) return;
          await processPhotoAndLog(result.assets[0].base64);
        }
      },
      {
        text: 'Choose Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow photo access to log meals from images.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true
          });
          if (result.canceled || !result.assets?.[0]?.base64) return;
          await processPhotoAndLog(result.assets[0].base64);
        }
      }
    ]);
  };

  // When navigated with ?openScan=1 (e.g. from Home Quick Action), auto-open scan flow
  useEffect(() => {
    const openScan = Array.isArray(params?.openScan) ? params.openScan[0] : params?.openScan;
    if (openScan === '1' || openScan === true) {
      handlePhotoMeal();
      router.setParams({ openScan: undefined });
    }
  }, [params?.openScan]);

  const handleMealConsumed = async (meal, servingSize) => {
    if (!userId || !meal?.id) return;
    try {
      await consumeMeal(meal.id, userId, servingSize || 1);
      addCalories(Math.round((meal.calories || 0) * (servingSize || 1)));
      await loadData();
    } catch (e) {
      console.error('Consume meal error:', e);
      Alert.alert('Error', 'Could not add meal to today.');
    }
  };

  const handleMealDeleted = async (mealId) => {
    if (!userId) return;
    try {
      await supabase.from('meals').delete().eq('id', mealId).eq('user_id', userId);
      await loadData();
    } catch (e) {
      console.error('Delete meal error:', e);
    }
  };

  const handleRemoveConsumption = async (consumptionId, actualCalories) => {
    if (!userId) return;
    try {
      await supabase.from('meal_consumptions').delete().eq('id', consumptionId).eq('user_id', userId);
      if (actualCalories > 0 && profileId) {
        const today = getLocalDateString();
        const { data: ct } = await supabase
          .from('calorie_tracking')
          .select('consumed')
          .eq('profile_id', profileId)
          .eq('date', today)
          .single();
        const newConsumed = Math.max(0, (ct?.consumed || calories?.consumed || 0) - actualCalories);
        await supabase
          .from('calorie_tracking')
          .upsert(
            { profile_id: profileId, date: today, consumed: newConsumed, updated_at: new Date().toISOString() },
            { onConflict: 'profile_id,date' }
          );
        setCalories({ ...calories, consumed: newConsumed });
      }
      await loadData();
    } catch (e) {
      console.error('Remove consumption error:', e);
    }
  };

  const dayScore = calculateDayScore(calories, protein, carbs, fat, water, dailyNutrition);
  const calGoal = calories?.goal || 2000;
  const calConsumed = calories?.consumed || 0;
  const calorieProgress = calGoal > 0 ? Math.min(calConsumed / calGoal, 1.2) : 0;
  const waterGoalMl = (water?.goal || 0) * 1000;
  const waterProgress = waterGoalMl > 0 ? Math.min((water?.consumed || 0) / waterGoalMl, 1.2) : 0;
  // Macro progress: consumed vs goal (capped at 100%) - NOT the ratio of macros to each other
  const proteinConsumed = dailyNutrition.total_protein ?? protein?.consumed ?? 0;
  const carbsConsumed = dailyNutrition.total_carbs ?? 0;
  const fatConsumed = dailyNutrition.total_fat ?? 0;
  const proteinGoal = protein?.goal || 100;
  const carbsGoal = carbs?.goal || 250;
  const fatGoal = fat?.goal || 65;
  const proteinPct = proteinGoal > 0 ? Math.min((proteinConsumed / proteinGoal) * 100, 100) : 0;
  const carbsPct = carbsGoal > 0 ? Math.min((carbsConsumed / carbsGoal) * 100, 100) : 0;
  const fatPct = fatGoal > 0 ? Math.min((fatConsumed / fatGoal) * 100, 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition</Text>
          <Text style={styles.subtitle}>Track your daily intake</Text>
        </View>

        <View style={[styles.card, styles.scoreCard]}>
          <View style={styles.scoreRow}>
            <View>
              <Text style={styles.scoreLabel}>Today&apos;s Score</Text>
              <Text
                style={[
                  styles.scoreValue,
                  { color: dayScore >= 80 ? T.success : dayScore >= 50 ? T.primary : T.textMuted },
                ]}
              >
                {dayScore}
              </Text>
            </View>
            <CalorieRing progress={calorieProgress} size={90} strokeWidth={10} />
            <WaterRing progress={waterProgress} size={70} strokeWidth={8} />
          </View>
        </View>

        {/* Calories & Water trackers side by side */}
        <View style={styles.trackerRow}>
          <View style={[styles.card, styles.trackerCard]}>
            <View style={styles.trackerHeader}>
              <Ionicons name="flame" size={20} color={T.calorie} />
              <Text style={styles.cardTitle}>Calories</Text>
            </View>
            <Text style={styles.trackerValue}>
              {calConsumed} / {calGoal}
            </Text>
            <Text style={styles.trackerRemaining}>{Math.max(0, calGoal - calConsumed)} left</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${calGoal > 0 ? Math.min((calConsumed / calGoal) * 100, 100) : 0}%`,
                    backgroundColor: T.calorie,
                  },
                ]}
              />
            </View>
            <TrackerStepper
              accentColor={T.calorie}
              stepLabel={`±${CAL_STEP} cal`}
              disabled={nutritionAdjusting}
              minusDisabled={calConsumed <= 0}
              onMinus={() => runNutritionDelta(() => addCalories(-CAL_STEP))}
              onPlus={() => runNutritionDelta(() => addCalories(CAL_STEP))}
              onCustomPress={() => setAdjustModalType('calories')}
            />
          </View>
          <View style={[styles.card, styles.trackerCard]}>
            <View style={styles.trackerHeader}>
              <Ionicons name="water" size={20} color={T.water} />
              <Text style={styles.cardTitle}>Water</Text>
            </View>
            <Text style={styles.trackerValue}>
              {((water?.consumed || 0) / 1000).toFixed(1)} / {(water?.goal || 0)} L
            </Text>
            <Text style={styles.trackerRemaining}>
              {(Math.max(0, waterGoalMl - (water?.consumed || 0)) / 1000).toFixed(1)} L left
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${waterGoalMl > 0 ? Math.min(((water?.consumed || 0) / waterGoalMl) * 100, 100) : 0}%`,
                    backgroundColor: T.water,
                  },
                ]}
              />
            </View>
            <TrackerStepper
              accentColor={T.water}
              stepLabel={`±${WATER_STEP_ML} ml`}
              disabled={nutritionAdjusting}
              minusDisabled={(water?.consumed || 0) <= 0}
              onMinus={() => runNutritionDelta(() => addWater(-WATER_STEP_ML))}
              onPlus={() => runNutritionDelta(() => addWater(WATER_STEP_ML))}
              onCustomPress={() => setAdjustModalType('water')}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Macros</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroBarBg, { backgroundColor: 'rgba(0,255,0,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: `${proteinPct}%`, backgroundColor: T.protein }]} />
              </View>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroVal}>{proteinConsumed.toFixed(0)}g / {proteinGoal}g</Text>
              <TrackerStepper
                compact
                accentColor={T.protein}
                stepLabel={`±${MACRO_PROTEIN_CARBS_STEP}g`}
                disabled={nutritionAdjusting}
                minusDisabled={proteinConsumed <= 0}
                onMinus={() => runNutritionDelta(() => addProtein(-MACRO_PROTEIN_CARBS_STEP))}
                onPlus={() => runNutritionDelta(() => addProtein(MACRO_PROTEIN_CARBS_STEP))}
                onCustomPress={() => setAdjustModalType('protein')}
              />
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroBarBg, { backgroundColor: 'rgba(78,205,196,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: `${carbsPct}%`, backgroundColor: T.carbs }]} />
              </View>
              <Text style={styles.macroLabel}>Carbs</Text>
              <Text style={styles.macroVal}>{carbsConsumed.toFixed(0)}g / {carbsGoal}g</Text>
              <TrackerStepper
                compact
                accentColor={T.carbs}
                stepLabel={`±${MACRO_PROTEIN_CARBS_STEP}g`}
                disabled={nutritionAdjusting}
                minusDisabled={carbsConsumed <= 0}
                onMinus={() => runNutritionDelta(() => addCarbs(-MACRO_PROTEIN_CARBS_STEP))}
                onPlus={() => runNutritionDelta(() => addCarbs(MACRO_PROTEIN_CARBS_STEP))}
                onCustomPress={() => setAdjustModalType('carbs')}
              />
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroBarBg, { backgroundColor: 'rgba(69,183,209,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: `${fatPct}%`, backgroundColor: T.fat }]} />
              </View>
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroVal}>{fatConsumed.toFixed(0)}g / {fatGoal}g</Text>
              <TrackerStepper
                compact
                accentColor={T.fat}
                stepLabel={`±${MACRO_FAT_STEP}g`}
                disabled={nutritionAdjusting}
                minusDisabled={fatConsumed <= 0}
                onMinus={() => runNutritionDelta(() => addFat(-MACRO_FAT_STEP))}
                onPlus={() => runNutritionDelta(() => addFat(MACRO_FAT_STEP))}
                onCustomPress={() => setAdjustModalType('fat')}
              />
            </View>
          </View>
        </View>

        {/* Quick Add - three equal buttons */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Quick Add</Text>
          <View style={styles.quickAddGrid}>
            <View style={styles.quickAddRow}>
              <TouchableOpacity
                style={[styles.quickAddPill, styles.quickAddPillFeatured]}
                onPress={handlePhotoMeal}
                disabled={photoMealLoading}
              >
                <View style={[styles.quickAddIconWrap, { backgroundColor: 'rgba(0,255,255,0.2)' }]}>
                  <Ionicons name="camera" size={24} color={T.primary} />
                </View>
                <Text style={[styles.quickAddLabel, { color: T.primary }]}>{photoMealLoading ? 'Analyzing…' : 'Scan Meal'}</Text>
                <Text style={styles.quickAddHint}>
                  {photoMealUsage.limit === 0 ? 'Premium' : `${photoMealUsage.currentUsage}/${photoMealUsage.limit} today`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAddPill, styles.quickAddPillFeatured]}
                onPress={() => {
                  if (mealUsage.currentUsage >= mealUsage.limit) {
                    if (isPremium) {
                      Alert.alert('Daily Limit Reached', 'Your limit resets tomorrow.');
                    } else {
                      Alert.alert('Daily Limit Reached', 'Upgrade to Premium for more generations!', [
                        { text: 'OK' },
                        { text: 'Upgrade', onPress: () => presentPremiumPaywall() },
                      ]);
                    }
                    return;
                  }
                  setShowAIMealModal(true);
                }}
              >
                <View style={[styles.quickAddIconWrap, { backgroundColor: 'rgba(0,255,255,0.2)' }]}>
                  <Ionicons name="sparkles" size={24} color={T.primary} />
                </View>
                <Text style={[styles.quickAddLabel, { color: T.primary }]}>AI Meal</Text>
                <Text style={styles.quickAddHint}>{mealUsage.currentUsage}/{mealUsage.limit} today</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.quickAddRow}>
              <TouchableOpacity style={styles.quickAddPill} onPress={() => router.push('/nutrition/saved-meals')}>
                <View style={[styles.quickAddIconWrap, styles.quickAddIconMuted]}>
                  <Ionicons name="restaurant" size={22} color={T.primary} />
                </View>
                <Text style={styles.quickAddLabel}>Log Food</Text>
                <Text style={styles.quickAddHint}>Meals & macros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAddPill} onPress={() => router.push('/nutrition/create-meal')}>
                <View style={[styles.quickAddIconWrap, styles.quickAddIconMuted]}>
                  <Ionicons name="create" size={22} color={T.primary} />
                </View>
                <Text style={styles.quickAddLabel}>Create</Text>
                <Text style={styles.quickAddHint}>Custom meal</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.waterSection}>
            <Text style={styles.waterLabel}>Add water</Text>
            <View style={styles.waterPillsRow}>
              {[250, 500, 750].map((ml) => (
                <TouchableOpacity key={ml} style={styles.waterPill} onPress={() => addWater(ml)}>
                  <Ionicons name="water" size={16} color={T.water} />
                  <Text style={styles.waterPillText} numberOfLines={1}>+{ml}ml</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.mealHeader}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Today&apos;s Meals</Text>
            <TouchableOpacity onPress={() => router.push('/nutrition/saved-meals')}>
              <Text style={styles.linkText}>Saved Meals</Text>
            </TouchableOpacity>
          </View>
          {todayMeals.length === 0 ? (
            <Text style={styles.emptyText}>No meals logged yet</Text>
          ) : (
            todayMeals.map((item) => (
              <TodayMealRow
                key={item.consumption_id || item.id}
                item={item}
                onDelete={(id) => handleRemoveConsumption(id, item.actual_calories)}
                onPress={(meal) => {
                setRecipeModalShowAddToToday(false);
                setRecipeModalMeal(meal);
              }}
              />
            ))
          )}
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/nutrition/weekly-stats')}>
            <Ionicons name="stats-chart" size={22} color={T.primary} />
            <Text style={styles.navBtnText}>Weekly Stats</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              if (!isPremium) {
                presentPremiumPaywall();
                return;
              }
              router.push('/nutrition/settings');
            }}
          >
            <Ionicons name="settings-outline" size={22} color={T.primary} />
            <Text style={styles.navBtnText}>Macro Goals</Text>
          </TouchableOpacity>
        </View>

        <NutritionAdjustModal
          visible={!!adjustModalType}
          metricType={adjustModalType}
          accentColor={adjustModalType ? ADJUST_MODAL_ACCENT[adjustModalType] : T.primary}
          applying={nutritionAdjusting}
          onClose={() => {
            Keyboard.dismiss();
            setAdjustModalType(null);
          }}
          onApply={applyAdjustModal}
        />

        <Modal visible={showAIMealModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.aiModalContent}>
              <AIMealGenerator
                isInModal
                isPremium={isPremium}
                skipSuccessAlert
                onMealGenerated={async (savedMeal) => {
                  setShowAIMealModal(false);
                  await loadData();
                  try {
                    const info = await getAIGenerationUsageInfo(FEATURE_TYPES.MEAL, isPremium);
                    setMealUsage(info || { currentUsage: 0, limit: 1, remaining: 1 });
                  } catch (e) {}
                  // Show the generated meal in the recipe modal so user can view and add to today
                  if (savedMeal) {
                    setRecipeModalShowAddToToday(true);
                    setRecipeModalMeal(savedMeal);
                  }
                }}
                onClose={() => setShowAIMealModal(false)}
              />
            </View>
          </View>
        </Modal>

        <MealRecipeModal
          meal={recipeModalMeal}
          visible={!!recipeModalMeal}
          onClose={() => {
            setRecipeModalMeal(null);
            setRecipeModalShowAddToToday(false);
          }}
          onAddToToday={
            recipeModalShowAddToToday
              ? async (meal) => {
                  await handleMealConsumed(meal, 1);
                  setRecipeModalMeal(null);
                  setRecipeModalShowAddToToday(false);
                  await loadData();
                }
              : undefined
          }
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: T.screenPadding, paddingTop: 20 },
  header: { marginBottom: T.sectionGap },
  title: { fontSize: 28, fontWeight: '700', color: T.text },
  subtitle: { fontSize: T.subtitleSize, color: T.textMuted, marginTop: 4 },
  card: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: T.sectionGap,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  scoreCard: { ...T.glowCard },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { fontSize: T.labelSize, color: T.textMuted, marginBottom: 4 },
  scoreValue: { fontSize: 42, fontWeight: '800' },
  ringValue: { fontSize: 14, fontWeight: '700' },
  ringValueSmall: { fontSize: 12, fontWeight: '600' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: T.text, marginBottom: 0 },
  trackerRow: { flexDirection: 'row', gap: 12, marginBottom: T.sectionGap },
  trackerCard: { flex: 1 },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  trackerValue: { fontSize: 20, fontWeight: '700', color: T.text },
  trackerRemaining: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  macroItem: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  macroBarBg: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  macroBarFill: { height: '100%', borderRadius: 3 },
  macroLabel: { fontSize: 12, color: T.textMuted, textAlign: 'center', width: '100%' },
  macroVal: { fontSize: 14, fontWeight: '600', color: T.text, textAlign: 'center', width: '100%' },
  quickAddGrid: { gap: 12, marginBottom: 16 },
  quickAddRow: { flexDirection: 'row', gap: 12 },
  quickAddPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickAddPillFeatured: {
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderColor: 'rgba(0,255,255,0.3)',
    borderWidth: 1.5,
    paddingVertical: 18,
    ...T.glowCard,
  },
  quickAddIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickAddIconMuted: { backgroundColor: 'rgba(255,255,255,0.06)' },
  quickAddLabel: { fontSize: 14, fontWeight: '700', color: T.text },
  quickAddHint: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  waterSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 4 },
  waterLabel: { fontSize: 12, color: T.textMuted, marginBottom: 10 },
  waterPillsRow: { flexDirection: 'row', gap: 10 },
  waterPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.15)',
  },
  waterPillText: { color: T.water, fontSize: 14, fontWeight: '600' },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  linkText: { color: T.primary, fontSize: 14, fontWeight: '600' },
  emptyText: { color: T.textMuted, fontSize: 15, textAlign: 'center', paddingVertical: 20 },
  navRow: { flexDirection: 'row', gap: 12 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: T.primaryDark,
    borderRadius: T.buttonRadius,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
  },
  navBtnText: { color: T.primary, fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: T.text, marginBottom: 16 },
  picker: { width: '100%', color: '#fff', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  modalBtnPrimary: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: T.primary, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  aiModalContent: {
    backgroundColor: T.background,
    borderRadius: 24,
    width: '100%',
    height: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  adjustModalKbWrap: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 8,
    zIndex: 2,
  },
  adjustModalCard: {
    backgroundColor: T.cardBg,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  adjustModalTitle: { fontSize: 20, fontWeight: '700', color: T.text, marginBottom: 6 },
  adjustModalHint: { fontSize: 13, color: T.textMuted, marginBottom: 16 },
  adjustModeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  adjustModeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  adjustModeBtnText: { fontSize: 15, fontWeight: '700', color: T.textMuted },
  adjustInputLabel: { fontSize: 12, color: T.textMuted, marginBottom: 8 },
  adjustInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: T.text,
    marginBottom: 20,
  },
});
