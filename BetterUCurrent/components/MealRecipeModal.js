import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NutritionTheme as T } from '../config/NutritionTheme';

const { width, height } = Dimensions.get('window');

/**
 * Helper to safely get macro value from nutrition object
 */
function getMacroVal(nutrition, key) {
  if (!nutrition) return 0;
  const v = nutrition[key];
  return typeof v === 'object' && v?.value != null ? v.value : (typeof v === 'number' ? v : 0);
}

/**
 * MealRecipeModal - Displays full recipe data (ingredients, instructions, nutrition)
 * Used when tapping a meal card in Today's Meals or Saved Meals
 */
export const MealRecipeModal = ({ meal, visible, onClose, onAddToToday }) => {
  if (!meal) return null;

  const nut = meal.nutrition || {};
  const cal = meal.calories ?? getMacroVal(nut, 'calories');
  const p = getMacroVal(nut, 'protein');
  const c = getMacroVal(nut, 'carbs');
  const f = getMacroVal(nut, 'fat');
  const ingredients = meal.ingredients || [];
  const instructions = meal.instructions || '';
  const icon = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }[meal.meal_type] || '🍽️';

  const formatTime = (minutes) => {
    if (minutes == null || minutes === 0) return '—';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleOpenSource = async (url) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (e) {
      console.error('Open URL error:', e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Recipe</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealIcon}>{icon}</Text>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>{meal.name || 'Meal'}</Text>
                  {meal.description ? (
                    <Text style={styles.mealDesc}>{meal.description}</Text>
                  ) : null}
                  {meal.is_ai_generated && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.nutritionRow}>
                <View style={styles.nutItem}>
                  <Text style={[styles.nutVal, { color: T.calorie }]}>{Math.round(cal)}</Text>
                  <Text style={styles.nutLabel}>cal</Text>
                </View>
                <View style={styles.nutItem}>
                  <Text style={[styles.nutVal, { color: T.protein }]}>{Math.round(p)}g</Text>
                  <Text style={styles.nutLabel}>protein</Text>
                </View>
                <View style={styles.nutItem}>
                  <Text style={[styles.nutVal, { color: T.carbs }]}>{Math.round(c)}g</Text>
                  <Text style={styles.nutLabel}>carbs</Text>
                </View>
                <View style={styles.nutItem}>
                  <Text style={[styles.nutVal, { color: T.fat }]}>{Math.round(f)}g</Text>
                  <Text style={styles.nutLabel}>fat</Text>
                </View>
              </View>

              {ingredients.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ingredients</Text>
                  {ingredients.map((ing, i) => {
                    const amt = ing.amount != null ? ing.amount : '';
                    const u = ing.unit || '';
                    const nm = ing.name || (typeof ing === 'string' ? ing : '');
                    const txt = [amt, u, nm].filter(Boolean).join(' ');
                    return (
                      <Text key={i} style={styles.ingredient}>
                        • {txt || '—'}
                      </Text>
                    );
                  })}
                </View>
              )}

              {instructions ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Instructions</Text>
                  <Text style={styles.instructions}>{instructions}</Text>
                </View>
              ) : null}

              {(meal.prep_time || meal.cook_time || meal.cuisine_type) && (
                <View style={styles.metaRow}>
                  {meal.prep_time != null && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Prep</Text>
                      <Text style={styles.metaVal}>{formatTime(meal.prep_time)}</Text>
                    </View>
                  )}
                  {meal.cook_time != null && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Cook</Text>
                      <Text style={styles.metaVal}>{formatTime(meal.cook_time)}</Text>
                    </View>
                  )}
                  {meal.cuisine_type && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Cuisine</Text>
                      <Text style={styles.metaVal}>{meal.cuisine_type}</Text>
                    </View>
                  )}
                </View>
              )}

              {meal.is_ai_generated && meal.sources && meal.sources.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sources</Text>
                  {meal.sources.map((url, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.sourceLink}
                      onPress={() => handleOpenSource(url)}
                    >
                      <Ionicons name="link" size={14} color={T.primary} />
                      <Text style={styles.sourceText} numberOfLines={1}>{url}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {onAddToToday && (
                <TouchableOpacity style={styles.addBtn} onPress={() => onAddToToday(meal)}>
                  <Ionicons name="add-circle" size={22} color="#000" />
                  <Text style={styles.addBtnText}>Add to Today</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: height * 0.9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: T.cardBorder,
  },
  title: { fontSize: 20, fontWeight: '700', color: T.text },
  closeBtn: { padding: 4 },
  scroll: { flex: 1, minHeight: 200 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  mealHeader: { flexDirection: 'row', marginBottom: 16 },
  mealIcon: { fontSize: 28, marginRight: 14 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 20, fontWeight: '700', color: T.text },
  mealDesc: { fontSize: 14, color: T.textMuted, marginTop: 4 },
  aiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  aiBadgeText: { color: T.primary, fontSize: 12, fontWeight: '700' },
  nutritionRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  nutItem: { alignItems: 'center' },
  nutVal: { fontSize: 18, fontWeight: '800' },
  nutLabel: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  section: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 10 },
  ingredient: { fontSize: 15, color: T.text, marginBottom: 6, lineHeight: 22 },
  instructions: { fontSize: 15, color: T.text, lineHeight: 24 },
  metaRow: { flexDirection: 'row', gap: 20, marginTop: 16 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 12, color: T.textMuted },
  metaVal: { fontSize: 14, fontWeight: '600', color: T.text },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
  },
  sourceText: { fontSize: 13, color: T.primary, flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: T.primary,
  },
  addBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
});
