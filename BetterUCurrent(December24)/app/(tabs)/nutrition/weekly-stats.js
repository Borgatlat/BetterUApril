"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useTracking } from '../../../context/TrackingContext';
import { supabase } from '../../../lib/supabase';
import { LineChart } from 'react-native-chart-kit';
import { NutritionTheme as T } from '../../../config/NutritionTheme';
import { getLocalDateString } from '../../../utils/dateUtils';

const { width } = Dimensions.get('window');
const chartWidth = Math.min(width - T.screenPadding * 2 - 24, 340);

function formatWeekRange(days) {
  if (!days || days.length < 2) return '';
  const start = new Date(days[0] + 'T12:00:00');
  const end = new Date(days[days.length - 1] + 'T12:00:00');
  const m = (d) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${m(start)} ${start.getDate()} – ${m(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

/**
 * Weekly Nutrition Stats - insights and trends from last 7 days
 */
/**
 * Simple custom macro bar chart - 7 stacked bars (protein, carbs, fat per day).
 * Avoids react-native-chart-kit layout issues.
 */
function MacroBarChart({ labels, protein, carbs, fat }) {
  const maxTotal = Math.max(
    1,
    ...(labels || []).map((_, i) => (protein?.[i] || 0) + (carbs?.[i] || 0) + (fat?.[i] || 0))
  );
  const barHeight = 100;
  return (
    <View style={macroChartStyles.container}>
      {(labels || []).map((label, i) => {
        const p = protein?.[i] || 0;
        const c = carbs?.[i] || 0;
        const f = fat?.[i] || 0;
        const total = p + c + f;
        const pPct = total > 0 ? p / total : 0;
        const cPct = total > 0 ? c / total : 0;
        const fPct = total > 0 ? f / total : 0;
        const barScale = total / maxTotal;
        const h = Math.max(4, barHeight * barScale);
        return (
          <View key={i} style={macroChartStyles.column}>
            <View style={[macroChartStyles.bar, { height: h }]}>
              {total > 0 && (
                <>
                  <View style={[macroChartStyles.segment, { height: `${pPct * 100}%`, backgroundColor: T.protein }]} />
                  <View style={[macroChartStyles.segment, { height: `${cPct * 100}%`, backgroundColor: T.carbs }]} />
                  <View style={[macroChartStyles.segment, { height: `${fPct * 100}%`, backgroundColor: T.fat }]} />
                </>
              )}
            </View>
            <Text style={macroChartStyles.total}>{total > 0 ? Math.round(total) : '—'}</Text>
            <Text style={macroChartStyles.label}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const macroChartStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 16, paddingHorizontal: 4 },
  column: { flex: 1, alignItems: 'center', minWidth: 36 },
  bar: {
    width: 28,
    minHeight: 4,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'column-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  segment: { width: '100%', minHeight: 2 },
  total: { fontSize: 11, fontWeight: '600', color: T.text, marginTop: 6 },
  label: { fontSize: 12, color: T.textMuted, marginTop: 2 },
});

/**
 * Compute nutrition score (0-100) from a day's consumed values and goals.
 * Same formula as NutritionDashboard: cal 25%, protein 25%, carbs 20%, fat 15%, water 15%.
 */
function computeDayScore(dayData) {
  const { calConsumed, calGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal, waterMl, waterGoalMl } = dayData;
  let score = 0;
  if (calGoal > 0) score += Math.min((calConsumed || 0) / calGoal, 1) * 25;
  if (proteinGoal > 0) score += Math.min((protein || 0) / proteinGoal, 1) * 25;
  if (carbsGoal > 0) score += Math.min((carbs || 0) / carbsGoal, 1) * 20;
  if (fatGoal > 0) score += Math.min((fat || 0) / fatGoal, 1) * 15;
  if (waterGoalMl > 0) score += Math.min((waterMl || 0) / waterGoalMl, 1) * 15;
  return Math.min(Math.round(score), 100);
}

export default function WeeklyStatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { calories, protein, carbs, fat, water } = useTracking();
  const profileId = user?.id;
  const calorieGoal = calories?.goal || 2000;
  const proteinGoal = protein?.goal || 100;
  const carbsGoal = carbs?.goal || 250;
  const fatGoal = fat?.goal || 65;
  const waterGoalMl = (water?.goal || 2) * 1000;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekData, setWeekData] = useState({ days: [], labels: [], calories: [], protein: [], water: [] });

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(getLocalDateString(d));
    }
    return days;
  };

  const loadData = useCallback(async () => {
    if (!profileId) return;
    try {
      const days = getLast7Days();
      const dayLabels = days.map((d) => {
        const date = new Date(d + 'T12:00:00');
        return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
      });

      const [calRes, waterRes, macroRes, mealsRes] = await Promise.all([
        supabase
          .from('calorie_tracking')
          .select('date, consumed, goal')
          .eq('profile_id', profileId)
          .in('date', days),
        supabase
          .from('water_tracking')
          .select('date, glasses, goal')
          .eq('profile_id', profileId)
          .in('date', days),
        supabase
          .from('daily_macronutrients')
          .select('date, protein, carbs, fat')
          .eq('user_id', profileId)
          .in('date', days),
        supabase
          .from('meal_consumptions')
          .select('consumed_at')
          .eq('user_id', profileId)
          .gte('consumed_at', `${days[0]}T00:00:00`)
          .lte('consumed_at', `${days[6]}T23:59:59`),
      ]);

      const calMap = {};
      (calRes.data || []).forEach((r) => {
        calMap[r.date] = { consumed: r.consumed || 0, goal: r.goal || calorieGoal };
      });
      const waterMap = {};
      (waterRes.data || []).forEach((r) => {
        waterMap[r.date] = (r.glasses || 0) * 250;
      });
      const macroMap = {};
      (macroRes.data || []).forEach((r) => {
        macroMap[r.date] = {
          protein: parseFloat(r.protein) || 0,
          carbs: parseFloat(r.carbs) || 0,
          fat: parseFloat(r.fat) || 0,
        };
      });

      const calValues = days.map((d) => calMap[d]?.consumed || 0);
      const proteinValues = days.map((d) => macroMap[d]?.protein || 0);
      const carbsValues = days.map((d) => macroMap[d]?.carbs || 0);
      const fatValues = days.map((d) => macroMap[d]?.fat || 0);
      const waterValues = days.map((d) => waterMap[d] || 0);
      const goals = days.map((d) => calMap[d]?.goal || calorieGoal);

      const avgCal = calValues.reduce((a, b) => a + b, 0) / 7;
      const avgProt = proteinValues.reduce((a, b) => a + b, 0) / 7;
      const avgWater = waterValues.reduce((a, b) => a + b, 0) / 7;

      const daysHitCalGoal = calValues.filter((c, i) => c >= goals[i] * 0.9 && goals[i] > 0).length;
      const daysHitProteinGoal = proteinValues.filter((p, i) => proteinGoal > 0 && p >= proteinGoal * 0.9).length;
      const daysHitCarbsGoal = carbsValues.filter((c, i) => carbsGoal > 0 && c >= carbsGoal * 0.9).length;
      const daysHitFatGoal = fatValues.filter((f, i) => fatGoal > 0 && f >= fatGoal * 0.9).length;
      const daysLoggedMeals = [...new Set((mealsRes.data || []).map((m) => m.consumed_at?.split('T')[0]))].length;
      const totalMeals = (mealsRes.data || []).length;

      const maxCal = Math.max(...calValues, calorieGoal, 1);

      const nutritionScores = days.map((d, i) =>
        computeDayScore({
          calConsumed: calValues[i],
          calGoal: goals[i],
          protein: proteinValues[i],
          proteinGoal,
          carbs: (macroMap[d]?.carbs || 0),
          carbsGoal,
          fat: (macroMap[d]?.fat || 0),
          fatGoal,
          waterMl: waterValues[i],
          waterGoalMl,
        })
      );
      const avgNutritionScore = nutritionScores.length
        ? Math.round(nutritionScores.reduce((a, b) => a + b, 0) / nutritionScores.length)
        : 0;

      const maxCalVal = Math.max(...calValues);
      const mostCalDay = calValues.indexOf(maxCalVal);

      // Best/worst day by nutrition score
      let bestDayIdx = 0;
      let worstDayIdx = 0;
      for (let i = 1; i < nutritionScores.length; i++) {
        if (nutritionScores[i] > nutritionScores[bestDayIdx]) bestDayIdx = i;
        if (nutritionScores[i] < nutritionScores[worstDayIdx]) worstDayIdx = i;
      }

      const weeklyCalTotal = calValues.reduce((a, b) => a + b, 0);
      const weeklyCalGoal = goals.reduce((a, b) => a + b, 0);
      const surplusDeficit = weeklyCalGoal > 0 ? weeklyCalTotal - weeklyCalGoal : 0;

      // Build stat sections (grouped stat boxes)
      const statsSections = [
        {
          title: 'Macro Consistency',
          subtitle: 'Days hitting 90%+ of goal',
          boxes: [
            { value: `${daysHitCalGoal}/7`, label: 'Cal', color: daysHitCalGoal >= 5 ? T.success : T.primary },
            { value: `${daysHitProteinGoal}/7`, label: 'Protein', color: T.protein },
            { value: `${daysHitCarbsGoal}/7`, label: 'Carbs', color: T.carbs },
            { value: `${daysHitFatGoal}/7`, label: 'Fat', color: T.fat },
          ],
        },
        {
          title: 'Weekly Averages',
          subtitle: 'Per day',
          boxes: [
            { value: String(Math.round(avgCal)), label: 'Cal', color: T.calorie },
            { value: `${Math.round(avgProt)}g`, label: 'Protein', color: T.protein },
            { value: `${Math.round(avgWater)}`, label: 'Water (ml)', color: T.water },
          ],
        },
        {
          title: 'Activity',
          subtitle: 'This week',
          boxes: [
            { value: String(totalMeals), label: 'Meals', color: T.text },
            { value: String(daysLoggedMeals), label: 'Days logged', color: T.textMuted },
          ],
        },
        {
          title: 'Performance',
          subtitle: 'Score & balance',
          boxes: [
            { value: String(avgNutritionScore), label: 'Avg score', color: avgNutritionScore >= 70 ? T.success : T.primary },
            ...(nutritionScores.some((s) => s > 0)
              ? [
                  { value: String(nutritionScores[bestDayIdx]), label: `Best day: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][days[bestDayIdx] ? new Date(days[bestDayIdx] + 'T12:00:00').getDay() : 0]}`, color: T.success },
                  ...(bestDayIdx !== worstDayIdx
                    ? [{ value: String(nutritionScores[worstDayIdx]), label: `Lowest score: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][days[worstDayIdx] ? new Date(days[worstDayIdx] + 'T12:00:00').getDay() : 0]}`, color: T.textMuted }]
                    : []),
                ]
              : []),
            ...(weeklyCalTotal > 0
              ? [{
                  value: surplusDeficit > 0 ? `+${Math.round(surplusDeficit)}` : String(Math.round(surplusDeficit)),
                  label: surplusDeficit > 0 ? 'Surplus' : surplusDeficit < 0 ? 'Deficit' : 'On target',
                  color: surplusDeficit > 200 ? T.calorie : surplusDeficit < -200 ? T.primary : T.success,
                }]
              : []),
            ...(maxCalVal > 0
              ? [{ value: String(Math.round(calValues[mostCalDay])), label: `Highest cal: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][days[mostCalDay] ? new Date(days[mostCalDay] + 'T12:00:00').getDay() : 0]}`, color: T.textMuted }]
              : []),
          ],
        },
      ];

      setWeekData({
        days,
        labels: dayLabels,
        calories: calValues,
        protein: proteinValues,
        carbs: carbsValues,
        fat: fatValues,
        water: waterValues,
        goals,
        avgCal: Math.round(avgCal),
        avgProtein: Math.round(avgProt),
        avgWater: Math.round(avgWater),
        daysHitCalGoal,
        daysHitProteinGoal,
        daysHitCarbsGoal,
        daysHitFatGoal,
        maxCal,
        nutritionScores,
        avgNutritionScore,
        weekDateRange: formatWeekRange(days),
        weeklyCalTotal,
        weeklyCalGoal,
        surplusDeficit,
        bestDayIdx,
        worstDayIdx,
        statsSections,
      });
    } catch (e) {
      console.error('Weekly stats error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId, calorieGoal, proteinGoal, carbsGoal, fatGoal, waterGoalMl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: T.background,
    backgroundGradientTo: T.background,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
    labelColor: () => T.textMuted,
    style: { borderRadius: 16, paddingRight: 24, paddingLeft: 12 },
    propsForDots: { r: '3', strokeWidth: '1', stroke: T.calorie },
    propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255,255,255,0.06)' },
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={T.primary}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={T.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Weekly Stats</Text>
          {weekData.weekDateRange ? (
            <Text style={styles.weekRange}>{weekData.weekDateRange}</Text>
          ) : null}
        </View>
      </View>

      {weekData.weeklyCalTotal != null && weekData.weeklyCalGoal != null && weekData.weeklyCalGoal > 0 && (
        <View style={styles.weeklyTotalCard}>
          <Text style={styles.weeklyTotalLabel}>Weekly total vs goal</Text>
          <View style={styles.weeklyTotalRow}>
            <Text style={[styles.weeklyTotalVal, { color: T.calorie }]}>{Math.round(weekData.weeklyCalTotal)}</Text>
            <Text style={styles.weeklyTotalUnit}>cal</Text>
            <Text style={styles.weeklyTotalVs}>vs</Text>
            <Text style={[styles.weeklyTotalGoal, { color: T.textMuted }]}>{Math.round(weekData.weeklyCalGoal)} cal goal</Text>
          </View>
          {weekData.surplusDeficit != null && (
            <Text style={[
              styles.weeklyTotalDiff,
              { color: weekData.surplusDeficit > 200 ? T.calorie : weekData.surplusDeficit < -200 ? T.primary : T.success },
            ]}>
              {weekData.surplusDeficit > 0
                ? `+${Math.round(weekData.surplusDeficit)} surplus`
                : weekData.surplusDeficit < 0
                  ? `${Math.round(weekData.surplusDeficit)} deficit`
                  : 'On target'}
            </Text>
          )}
        </View>
      )}

      {weekData.daysHitProteinGoal != null && (
        <View style={styles.macroConsistencyCard}>
          <Text style={styles.macroConsistencyTitle}>Macro consistency</Text>
          <Text style={styles.macroConsistencySub}>Days on target (90%+ of goal)</Text>
          <View style={styles.macroConsistencyRow}>
            <View style={[styles.macroConsistencyItem, { borderLeftColor: T.protein }]}>
              <Text style={[styles.macroConsistencyValue, { color: T.protein }]}>{weekData.daysHitProteinGoal}/7</Text>
              <Text style={styles.macroConsistencyLabel}>Protein</Text>
            </View>
            <View style={[styles.macroConsistencyItem, { borderLeftColor: T.carbs }]}>
              <Text style={[styles.macroConsistencyValue, { color: T.carbs }]}>{weekData.daysHitCarbsGoal}/7</Text>
              <Text style={styles.macroConsistencyLabel}>Carbs</Text>
            </View>
            <View style={[styles.macroConsistencyItem, { borderLeftColor: T.fat }]}>
              <Text style={[styles.macroConsistencyValue, { color: T.fat }]}>{weekData.daysHitFatGoal}/7</Text>
              <Text style={styles.macroConsistencyLabel}>Fat</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>7-Day Avg</Text>
          <Text style={[styles.statValue, { color: T.calorie }]}>{weekData.avgCal || 0}</Text>
          <Text style={styles.statUnit}>cal</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Protein Avg</Text>
          <Text style={[styles.statValue, { color: T.protein }]}>{weekData.avgProtein || 0}g</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Water Avg</Text>
          <Text style={[styles.statValue, { color: T.water }]}>{weekData.avgWater || 0}ml</Text>
        </View>
      </View>

      <View style={[styles.chartCard, { marginBottom: 20 }]}>
        <Text style={styles.chartTitle}>Nutrition Score</Text>
        <Text style={styles.chartSubtitle}>
          7-day average: {weekData.avgNutritionScore ?? 0}/100
        </Text>
        {weekData.nutritionScores?.length > 0 && (
          <View style={styles.scoreRow}>
            {weekData.labels.map((label, i) => {
              const s = weekData.nutritionScores[i] ?? 0;
              const isBest = weekData.bestDayIdx === i && s > 0;
              const isWorst = weekData.worstDayIdx === i && s > 0 && weekData.bestDayIdx !== weekData.worstDayIdx;
              return (
                <View key={i} style={[styles.scoreDay, isBest && styles.scoreDayBest, isWorst && styles.scoreDayWorst]}>
                  <Text style={[styles.scoreDayLabel, isBest && { color: T.success }, isWorst && { color: T.textMuted }]}>
                    {label}{isBest ? ' ★' : ''}{isWorst ? ' ↓' : ''}
                  </Text>
                  <View style={styles.scoreBarBg}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        {
                          width: `${s}%`,
                          backgroundColor: isBest ? T.success : isWorst ? T.textMuted : s >= 80 ? T.success : s >= 50 ? T.primary : T.textMuted,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.scoreDayVal}>{s}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {weekData.labels?.length > 0 && weekData.protein?.some((p) => p > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Macros</Text>
          <Text style={styles.chartSubtitle}>Protein · Carbs · Fat (grams per day)</Text>
          <View style={styles.macrosLegend}>
            <View style={styles.macrosLegendItem}>
              <View style={[styles.macrosLegendDot, { backgroundColor: T.protein }]} />
              <Text style={styles.macrosLegendText}>Protein</Text>
            </View>
            <View style={styles.macrosLegendItem}>
              <View style={[styles.macrosLegendDot, { backgroundColor: T.carbs }]} />
              <Text style={styles.macrosLegendText}>Carbs</Text>
            </View>
            <View style={styles.macrosLegendItem}>
              <View style={[styles.macrosLegendDot, { backgroundColor: T.fat }]} />
              <Text style={styles.macrosLegendText}>Fat</Text>
            </View>
          </View>
          <MacroBarChart
            labels={weekData.labels}
            protein={weekData.protein}
            carbs={weekData.carbs}
            fat={weekData.fat}
          />
        </View>
      )}

      {weekData.labels?.length > 0 && weekData.calories?.some((c) => c > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Calories</Text>
          <Text style={styles.chartSubtitle}>Goal: {calorieGoal} cal · {weekData.daysHitCalGoal || 0}/7 days on target</Text>
          <View style={styles.chartWrap}>
            <LineChart
              data={{
                labels: weekData.labels,
                datasets: [{ data: weekData.calories.map((v) => Math.max(0, Math.round(v))) }],
              }}
              width={chartWidth}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              fromZero
              yAxisSuffix=""
            />
          </View>
          <View style={styles.goalRef}>
            <View style={[styles.goalDot, { backgroundColor: T.textMuted }]} />
            <Text style={styles.goalRefText}>Goal line: {calorieGoal} cal</Text>
          </View>
        </View>
      )}

      {weekData.statsSections?.length > 0 ? (
        weekData.statsSections.map((section, si) => (
          <View key={si} style={styles.statsSectionCard}>
            <Text style={styles.statsSectionTitle}>{section.title}</Text>
            <Text style={styles.statsSectionSubtitle}>{section.subtitle}</Text>
            <View style={styles.statsGrid}>
              {section.boxes.map((box, i) => (
                <View key={i} style={[styles.statBox, { borderLeftColor: box.color }]}>
                  <Text style={[styles.statBoxValue, { color: box.color }]}>{box.value}</Text>
                  <Text style={styles.statBoxLabel}>{box.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.insightsCard}>
          <Text style={styles.insightEmpty}>Log meals this week to see stats</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 },
  backBtn: { marginRight: 12 },
  title: { fontSize: 22, fontWeight: '700', color: T.text },
  weekRange: { fontSize: 13, color: T.textMuted, marginTop: 2 },
  weeklyTotalCard: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: T.sectionGap,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  weeklyTotalLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  weeklyTotalRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  weeklyTotalVal: { fontSize: 24, fontWeight: '800' },
  weeklyTotalUnit: { fontSize: 14, color: T.textMuted },
  weeklyTotalVs: { fontSize: 14, color: T.textMuted },
  weeklyTotalGoal: { fontSize: 16 },
  weeklyTotalDiff: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  macroConsistencyCard: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: T.sectionGap,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  macroConsistencyTitle: { fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 4 },
  macroConsistencySub: { fontSize: 12, color: T.textMuted, marginBottom: 12 },
  macroConsistencyRow: { flexDirection: 'row', gap: 12 },
  macroConsistencyItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  macroConsistencyValue: { fontSize: 18, fontWeight: '800' },
  macroConsistencyLabel: { fontSize: 12, color: T.textMuted, marginTop: 4 },
  scrollContent: { padding: T.screenPadding },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    alignItems: 'center',
  },
  statLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statUnit: { fontSize: 11, color: T.textMuted },
  chartCard: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: T.sectionGap,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  chartTitle: { fontSize: 18, fontWeight: '700', color: T.text, marginBottom: 4 },
  chartSubtitle: { fontSize: 13, color: T.textMuted, marginBottom: 16 },
  chartWrap: { alignItems: 'center', marginHorizontal: -10 },
  chart: { marginVertical: 4, borderRadius: 12 },
  macrosLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 12 },
  macrosLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macrosLegendDot: { width: 10, height: 10, borderRadius: 5 },
  macrosLegendText: { fontSize: 13, color: T.textMuted },
  goalRef: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  goalDot: { width: 8, height: 8, borderRadius: 4 },
  goalRefText: { fontSize: 12, color: T.textMuted },
  insightsCard: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  statsSectionCard: {
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: T.sectionGap,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  statsSectionTitle: { fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 4 },
  statsSectionSubtitle: { fontSize: 12, color: T.textMuted, marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    width: '31%',
    minWidth: 95,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  statBoxValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statBoxLabel: { fontSize: 11, color: T.textMuted },
  insightEmpty: { fontSize: 15, color: T.textMuted },
  scoreRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  scoreDay: { flex: 1, alignItems: 'center' },
  scoreDayLabel: { fontSize: 12, color: T.textMuted, marginBottom: 6 },
  scoreBarBg: {
    width: '100%',
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreDayVal: { fontSize: 11, fontWeight: '700', color: T.text, marginTop: 4 },
  scoreDayBest: { borderWidth: 1, borderColor: T.success, borderRadius: 8, padding: 4 },
  scoreDayWorst: { opacity: 0.85 },
});
