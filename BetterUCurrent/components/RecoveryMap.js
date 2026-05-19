import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import Body from 'react-native-body-highlighter';
import { supabase } from '../lib/supabase';
import { getExerciseInfo } from '../utils/exerciseLibrary';

const { width: screenWidth } = Dimensions.get('window');

/** Muscle groups tracked in the Recovery Map (upper + lower body). */
const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Biceps',
  'Forearms',
  'Triceps',
  'Shoulders',
  'Abs',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
];

/** Legend grouped by region; each item uses the original pill + label chip style. */
const LEGEND_SECTIONS = [
  {
    title: 'Upper body',
    groups: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs'],
  },
  {
    title: 'Lower body',
    groups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  },
];

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
  if (lower.includes('lower back')) return 'Back';
  if (['abs', 'abdominal', 'abdominals', 'oblique', 'obliques', 'core', 'rectus', 'six-pack', 'six pack'].some(m => lower.includes(m))) {
    return 'Abs';
  }
  if (['back', 'lats', 'rear delts', 'latissimus', 'traps', 'upper back', 'rhomboids'].some(m => lower.includes(m))) return 'Back';
  if (['biceps', 'bicep'].some(m => lower.includes(m))) return 'Biceps';
  if (['forearms', 'forearm', 'brachioradialis', 'wrist flexors', 'wrist extensors'].some(m => lower.includes(m))) {
    return 'Forearms';
  }
  if (['triceps', 'tricep'].some(m => lower.includes(m))) return 'Triceps';
  if (['shoulders', 'delts', 'deltoid', 'front raise', 'lateral raise'].some(m => lower.includes(m))) return 'Shoulders';
  if (['quads', 'quadriceps', 'vastus', 'quad'].some(m => lower.includes(m))) return 'Quads';
  if (['hamstring', 'hamstrings', 'hams'].some(m => lower.includes(m))) return 'Hamstrings';
  if (['glutes', 'glute', 'gluteal', 'gluteus'].some(m => lower.includes(m))) return 'Glutes';
  if (['calves', 'calf', 'gastrocnemius', 'soleus'].some(m => lower.includes(m))) return 'Calves';
  return null;
}

/** One muscle label may map to multiple recovery groups (e.g. "Legs" → all lower body). */
function getCanonicalGroupsFromMuscleName(muscleName) {
  const lower = (muscleName || '').toLowerCase().trim();
  if (lower === 'legs' || lower === 'leg' || lower === 'lower body') {
    return ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
  }
  if (lower === 'core' || lower === 'abs') {
    return ['Abs'];
  }
  const group = getCanonicalGroup(muscleName);
  return group ? [group] : [];
}

/** Guess muscles from exercise name when logs omit targetMuscles (common for recommended workouts). */
function inferMusclesFromExerciseName(name) {
  const lower = (name || '').toLowerCase();
  if (!lower) return '';
  if (/\b(row|pulldown|pull-up|pullup|chin-up|chinup|lat\b|lats\b|deadlift|face pull|shrug|t-bar)\b/.test(lower)) {
    return 'Back, Biceps';
  }
  if (/\b(hammer curl|reverse curl|wrist curl|forearm|farmer|wrist roller)\b/.test(lower)) {
    return 'Forearms, Biceps';
  }
  if (/\b(curl|bicep|chin)\b/.test(lower)) return 'Biceps';
  if (/\b(bench|push-up|pushup|fly|dip|pec)\b/.test(lower)) return 'Chest, Triceps';
  if (/\b(press|shoulder|overhead|lateral raise|arnold)\b/.test(lower)) return 'Shoulders';
  if (/\b(tricep|extension|skull crusher|pushdown)\b/.test(lower)) return 'Triceps';
  if (/\b(squat|lunge|leg press|leg extension|hack squat|goblet squat|step-up|step up)\b/.test(lower)) {
    return 'Quads, Glutes';
  }
  if (/\b(romanian|rdl|leg curl|hamstring|good morning|stiff.?leg)\b/.test(lower)) return 'Hamstrings, Glutes';
  if (/\b(calf raise|calves|calf)\b/.test(lower)) return 'Calves';
  if (/\b(hip thrust|glute bridge)\b/.test(lower)) return 'Glutes, Hamstrings';
  if (/\b(plank|crunch|sit-up|situp|ab wheel|leg raise|russian twist|hollow|dead bug|v-up|v up|cable crunch|mountain climber|pallof)\b/.test(lower)) {
    return 'Abs';
  }
  return '';
}

/** Resolve targetMuscles from log payload, exercise library, or name heuristics. */
function resolveTargetMuscles(exercise) {
  const raw = exercise?.targetMuscles;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.join(', ');
  }
  if (typeof raw === 'string' && raw.trim() && raw.trim().toLowerCase() !== 'full body') {
    return raw.trim();
  }
  const name = exercise?.name || (typeof exercise === 'string' ? exercise : '');
  const fromLibrary = getExerciseInfo(name)?.targetMuscles;
  if (fromLibrary) return fromLibrary;
  return inferMusclesFromExerciseName(name);
}

/** Infer muscle groups from workout title (e.g. "Back & Biceps Builder"). */
function inferGroupsFromWorkoutName(workoutName) {
  const lower = (workoutName || '').toLowerCase();
  const groups = new Set();
  if (/\b(back|pull)\b/.test(lower)) {
    groups.add('Back');
    groups.add('Biceps');
  }
  if (/\b(chest|push)\b/.test(lower)) {
    groups.add('Chest');
    groups.add('Triceps');
    groups.add('Shoulders');
  }
  if (/\b(shoulder)\b/.test(lower)) groups.add('Shoulders');
  if (/\b(bicep|arm)\b/.test(lower)) groups.add('Biceps');
  if (/\b(forearm)\b/.test(lower)) groups.add('Forearms');
  if (/\b(tricep)\b/.test(lower)) groups.add('Triceps');
  if (/\b(legs?|leg day|lower body|lower)\b/.test(lower)) {
    groups.add('Quads');
    groups.add('Hamstrings');
    groups.add('Glutes');
    groups.add('Calves');
  }
  if (/\b(quad)\b/.test(lower)) groups.add('Quads');
  if (/\b(hamstring|hams)\b/.test(lower)) groups.add('Hamstrings');
  if (/\b(glute)\b/.test(lower)) groups.add('Glutes');
  if (/\b(calf|calves)\b/.test(lower)) groups.add('Calves');
  if (/\b(abs?|ab day|core)\b/.test(lower)) groups.add('Abs');
  return [...groups];
}

function createEmptyLastTrainedMap() {
  return MUSCLE_GROUPS.reduce((acc, group) => {
    acc[group] = null;
    return acc;
  }, {});
}

function markGroupTrained(lastByGroup, group, completedAt) {
  if (!group || completedAt == null) return;
  if (lastByGroup[group] == null || completedAt > lastByGroup[group]) {
    lastByGroup[group] = completedAt;
  }
}

/**
 * Returns pill background color from recovery percentage.
 */
/** Pill fill — solid core with a minimal recovery tint (same layout as before). */
function getRecoveryPillStyle(recoveryPct) {
  if (recoveryPct >= 90) {
    return { backgroundColor: '#2d2d2d', borderColor: 'rgba(255, 255, 255, 0.12)' };
  }
  if (recoveryPct >= 70) {
    return { backgroundColor: '#5a4d78', borderColor: 'rgba(107, 91, 149, 0.55)' };
  }
  if (recoveryPct >= 50) {
    return { backgroundColor: '#7a3333', borderColor: 'rgba(139, 58, 58, 0.55)' };
  }
  return { backgroundColor: '#8b3a3a', borderColor: 'rgba(200, 80, 80, 0.5)' };
}

/**
 * Recovery Map Component
 *
 * Shows muscle group recovery status using react-native-body-highlighter.
 * Displays front/back body views with upper- and lower-body muscle highlighting and
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
          .select('completed_at, exercises, workout_name')
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
    const lastByGroup = createEmptyLastTrainedMap();

    for (const w of list) {
      const completedAt = w.completed_at ? new Date(w.completed_at).getTime() : null;
      if (!completedAt) continue;

      for (const group of inferGroupsFromWorkoutName(w.workout_name)) {
        markGroupTrained(lastByGroup, group, completedAt);
      }

      const exercises = w.exercises || [];
      for (const ex of exercises) {
        const muscles = parseTargetMuscles(resolveTargetMuscles(ex));
        for (const m of muscles) {
          for (const group of getCanonicalGroupsFromMuscleName(m)) {
            markGroupTrained(lastByGroup, group, completedAt);
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
    { slug: 'forearm', intensity: recoveryToIntensity(recoveryPct.Forearms ?? 100) },
    { slug: 'triceps', intensity: recoveryToIntensity(recoveryPct.Triceps ?? 100) },
    { slug: 'deltoids', intensity: recoveryToIntensity(recoveryPct.Shoulders ?? 100) },
    { slug: 'abs', intensity: recoveryToIntensity(recoveryPct.Abs ?? 100) },
    { slug: 'obliques', intensity: recoveryToIntensity(recoveryPct.Abs ?? 100) },
    { slug: 'quadriceps', intensity: recoveryToIntensity(recoveryPct.Quads ?? 100) },
    { slug: 'calves', intensity: recoveryToIntensity(recoveryPct.Calves ?? 100) },
  ];

  const backData = [
    { slug: 'upper-back', intensity: recoveryToIntensity(recoveryPct.Back ?? 100) },
    { slug: 'forearm', intensity: recoveryToIntensity(recoveryPct.Forearms ?? 100) },
    { slug: 'hamstring', intensity: recoveryToIntensity(recoveryPct.Hamstrings ?? 100) },
    { slug: 'gluteal', intensity: recoveryToIntensity(recoveryPct.Glutes ?? 100) },
    { slug: 'calves', intensity: recoveryToIntensity(recoveryPct.Calves ?? 100) },
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
        {LEGEND_SECTIONS.map((section) => (
          <View key={section.title} style={styles.legendSection}>
            <Text style={styles.legendSectionTitle}>{section.title}</Text>
            <View style={styles.legendRow}>
              {section.groups.map((group) => {
                const pct = recoveryPct[group] ?? 100;
                return (
                  <View key={group} style={styles.legendItem}>
                    <View style={[styles.pill, getRecoveryPillStyle(pct)]}>
                      <Text style={styles.pillText}>{pct}%</Text>
                    </View>
                    <Text style={styles.legendLabel}>{group}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
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
    marginTop: 4,
    gap: 12,
  },
  legendSection: {
    gap: 6,
  },
  legendSectionTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  legendRow: {
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
    borderWidth: 1,
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
