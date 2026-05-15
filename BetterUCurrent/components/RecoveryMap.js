import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import Body from 'react-native-body-highlighter';
import { supabase } from '../lib/supabase';

const { width: screenWidth } = Dimensions.get('window');

/** Canonical muscle groups shown in the Recovery Map (Chest, Back, Biceps, Triceps, Shoulders) */
const MUSCLE_GROUPS = ['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders'];

/** Hours after which a muscle group is considered fully recovered (100%) */
const RECOVERY_HOURS_FULL = 72;

/**
 * Maps recovery % (0-100) to intensity level (1, 2, 3) for the body highlighter.
 * intensity 1 = red (tired), 2 = purple (recovering), 3 = gray (rested)
 */
function recoveryToIntensity(pct) {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 50) return 1;
  return 1;
}

/**
 * Parses targetMuscles from workout exercises (string or array).
 */
function parseTargetMuscles(targetMuscles) {
  if (!targetMuscles) return [];
  if (Array.isArray(targetMuscles)) {
    return targetMuscles.map(m => String(m).trim()).filter(Boolean);
  }
  return String(targetMuscles)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Maps exercise target muscle names to one of the canonical groups.
 */
function getCanonicalGroup(muscleName) {
  const lower = (muscleName || '').toLowerCase();
  if (['chest', 'pecs', 'upper chest', 'pectorals'].some(m => lower.includes(m))) return 'Chest';
  if (['back', 'lats', 'rear delts', 'latissimus', 'traps', 'upper back'].some(m => lower.includes(m))) return 'Back';
  if (['biceps', 'bicep', 'arms'].some(m => lower.includes(m))) return 'Biceps';
  if (['triceps', 'tricep'].some(m => lower.includes(m))) return 'Triceps';
  if (['shoulders', 'delts', 'deltoid', 'front raise', 'lateral raise'].some(m => lower.includes(m))) return 'Shoulders';
  return null;
}

/**
 * Returns pill background color from recovery percentage.
 */
function getRecoveryPillColor(recoveryPct) {
  if (recoveryPct >= 90) return '#2d2d2d';
  if (recoveryPct >= 70) return '#6b5b95';
  if (recoveryPct >= 50) return '#8b3a3a';
  return '#2d2d2d';
}

/**
 * Recovery Map Component
 *
 * Shows muscle group recovery status using react-native-body-highlighter.
 * Displays front view (chest, biceps, triceps, shoulders) and back view (back) with
 * color-coded muscle highlighting and percentage pills.
 *
 * @param {string} userId - Supabase user id; used to fetch user_workout_logs. Required when workouts is not passed.
 * @param {Array|null} workouts - Optional pre-fetched workout logs (e.g. from Analytics). If provided, no fetch is done.
 * @param {number} refreshKey - Optional. When this value changes, the map refetches from the server. Parents can pass a key they bump on focus so the map updates when the user returns to the screen.
 */
const RecoveryMap = ({
  userId,
  workouts: workoutsProp,
  refreshKey,
  accentColor = '#00ffff',
  /** Set false when the parent already shows a Home-style section label above this card. */
  showSectionTitle = true,
}) => {
  const [workouts, setWorkouts] = useState(workoutsProp ?? null);
  const [loading, setLoading] = useState(!workoutsProp && !!userId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (workoutsProp != null) {
      setWorkouts(workoutsProp);
      setLoading(false);
      return;
    }
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchWorkouts = async () => {
      try {
        setError(null);
        const start = new Date();
        start.setDate(start.getDate() - 30);
        const startStr = start.toISOString();
        const nowStr = new Date().toISOString();

        const { data, error: err } = await supabase
          .from('user_workout_logs')
          .select('completed_at, exercises')
          .eq('user_id', userId)
          .gte('completed_at', startStr)
          .lte('completed_at', nowStr)
          .order('completed_at', { ascending: false })
          .limit(100);

        if (cancelled) return;
        if (err) throw err;
        setWorkouts(data || []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load recovery data');
          setWorkouts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWorkouts();
    return () => { cancelled = true; };
  }, [userId, workoutsProp, refreshKey]);

  const getRecoveryByGroup = () => {
    const list = workouts || [];
    const lastByGroup = { Chest: null, Back: null, Biceps: null, Triceps: null, Shoulders: null };

    for (const w of list) {
      const completedAt = w.completed_at ? new Date(w.completed_at).getTime() : null;
      if (!completedAt) continue;
      const exercises = w.exercises || [];
      for (const ex of exercises) {
        const muscles = parseTargetMuscles(ex.targetMuscles);
        for (const m of muscles) {
          const group = getCanonicalGroup(m);

          if (!group) continue;
          if (lastByGroup[group] == null || completedAt > lastByGroup[group]) {
            lastByGroup[group] = completedAt;
          }
        }
      }
    }

    const now = Date.now();
    const result = {};
    for (const group of MUSCLE_GROUPS) {
      const last = lastByGroup[group];
      if (last == null) {
        result[group] = 100;
      } else {
        const hoursSince = (now - last) / (1000 * 60 * 60);
        const pct = Math.min(100, (hoursSince / RECOVERY_HOURS_FULL) * 100);
        result[group] = Math.round(pct / 5) * 5;
      }
    }
    return result;
  };

  const recoveryPct = getRecoveryByGroup();

  if (loading) {
    return (
      <View style={styles.container}>
        {showSectionTitle ? <Text style={styles.sectionTitle}>Recovery Map</Text> : null}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.loadingText}>Loading recovery…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {showSectionTitle ? <Text style={styles.sectionTitle}>Recovery Map</Text> : null}
        <View style={styles.loadingBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  // Build data for body highlighter: intensity 1=red, 2=purple, 3=gray
  const colors = ['#8b3a3a', '#6b5b95', '#2d2d2d'];
  const scale = Math.min(0.6, (screenWidth - 60) / 400);

  const frontData = [
    { slug: 'chest', intensity: recoveryToIntensity(recoveryPct.Chest ?? 100) },
    { slug: 'biceps', intensity: recoveryToIntensity(recoveryPct.Biceps ?? 100) },
    { slug: 'triceps', intensity: recoveryToIntensity(recoveryPct.Triceps ?? 100) },
    { slug: 'deltoids', intensity: recoveryToIntensity(recoveryPct.Shoulders ?? 100) }
  ];

  const backData = [
    { slug: 'upper-back', intensity: recoveryToIntensity(recoveryPct.Back ?? 100) }
  ];

  return (
    <View style={styles.container}>
      {showSectionTitle ? <Text style={styles.sectionTitle}>Recovery Map</Text> : null}

      <View style={styles.bodyRow}>
        <View style={styles.bodyColumn}>
          <Text style={styles.bodyLabel}>Front</Text>
          <View style={styles.bodyWrapper}>
            <Body
              data={frontData}
              colors={colors}
              side="front"
              scale={scale}
              border="#555"
              defaultFill="#333"
            />
          </View>
        </View>
        <View style={styles.bodyColumn}>
          <Text style={styles.bodyLabel}>Back</Text>
          <View style={styles.bodyWrapper}>
            <Body
              data={backData}
              colors={colors}
              side="back"
              scale={scale}
              border="#555"
              defaultFill="#333"
            />
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        {MUSCLE_GROUPS.map((group) => {
          const pct = recoveryPct[group] ?? 100;
          const pillColor = getRecoveryPillColor(pct);
          return (
            <View key={group} style={styles.legendItem}>
              <View style={[styles.pill, { backgroundColor: pillColor }]}>
                <Text style={styles.pillText}>{pct}%</Text>
              </View>
              <Text style={styles.legendLabel}>{group}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 8,
  },
  errorText: {
    color: '#cc6666',
    fontSize: 14,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bodyColumn: {
    alignItems: 'center',
  },
  bodyLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  bodyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  legendLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default RecoveryMap;
