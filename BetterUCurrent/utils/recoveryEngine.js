import { supabase } from '../lib/supabase';
import { getExerciseInfo } from './exerciseLibrary';

/** Muscle groups tracked in the Recovery Map (upper + lower body). */
export const MUSCLE_GROUPS = [
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

/** Hours for a typical session at baseline (time-only mode uses this). */
export const RECOVERY_HOURS_FULL = 72;

export const RECOVERY_SCORE_LOOKBACK_DAYS = 30;

/** Sessions with measurable stimulus needed before volume-relative mode per muscle. */
const MIN_BASELINE_SESSIONS = 3;

/** Max past sessions used to compute personal median stimulus per muscle. */
const BASELINE_SESSION_CAP = 20;

/** Floor for baseline denominator so r does not explode. */
const MIN_BASELINE_SU = 400;

/** Default median if we ever need a fallback (still requires MIN_BASELINE_SESSIONS). */
const DEFAULT_POPULATION_BASELINE_SU = 6000;

/** Relative load clamps — same absolute work feels easier as baseline grows. */
const R_MIN = 0.25;
const R_MAX = 3;

const H_MIN = 48;
const H_MAX = 120;

/** Combine fatigue from sessions within this window (days). */
const FATIGUE_COMBINE_DAYS = 14;

/** Stimulus assigned per group when only workout title implies training (no sets). */
const TITLE_ONLY_STIMULUS_SU = 2500;

const LOW_STIMULUS_WORKOUT = /\b(foam|stretch|mobility|yoga|meditation|rest)\b/i;

/**
 * Maps recovery % (0-100) to intensity level (1, 2, 3) for the body highlighter.
 */
export function recoveryToIntensity(pct) {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 50) return 1;
  return 1;
}

/** Upper traps: shrugs/rows hit Back; upright rows hit Shoulders — use the more fatigued of the two. */
function upperTrapsIntensity(recoveryPct) {
  const backPct = recoveryPct.Back ?? 100;
  const shoulderPct = recoveryPct.Shoulders ?? 100;
  return recoveryToIntensity(Math.min(backPct, shoulderPct));
}

/**
 * Maps all tracked muscle groups onto body-highlighter slugs (front + back).
 * Includes upper traps (trapezius) and inner thigh (adductors → quads front, hams back).
 */
export function buildBodyHighlighterData(recoveryPct) {
  const intensity = (group) => recoveryToIntensity(recoveryPct[group] ?? 100);
  const back = intensity('Back');
  const abs = intensity('Abs');
  const shoulders = intensity('Shoulders');
  const forearms = intensity('Forearms');
  const triceps = intensity('Triceps');
  const calves = intensity('Calves');
  const quads = intensity('Quads');
  const hamstrings = intensity('Hamstrings');
  const traps = upperTrapsIntensity(recoveryPct);

  return {
    frontData: [
      { slug: 'chest', intensity: intensity('Chest') },
      { slug: 'biceps', intensity: intensity('Biceps') },
      { slug: 'forearm', intensity: forearms },
      { slug: 'triceps', intensity: triceps },
      { slug: 'deltoids', intensity: shoulders },
      { slug: 'trapezius', intensity: traps },
      { slug: 'abs', intensity: abs },
      { slug: 'obliques', intensity: abs },
      { slug: 'quadriceps', intensity: quads },
      { slug: 'adductors', intensity: quads },
      { slug: 'calves', intensity: calves },
    ],
    backData: [
      { slug: 'trapezius', intensity: traps },
      { slug: 'deltoids', intensity: shoulders },
      { slug: 'upper-back', intensity: back },
      { slug: 'lower-back', intensity: back },
      { slug: 'triceps', intensity: triceps },
      { slug: 'forearm', intensity: forearms },
      { slug: 'gluteal', intensity: intensity('Glutes') },
      { slug: 'hamstring', intensity: hamstrings },
      { slug: 'adductors', intensity: hamstrings },
      { slug: 'calves', intensity: calves },
    ],
  };
}

function roundToStep5(n) {
  return Math.round(n / 5) * 5;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseTargetMuscles(targetMuscles) {
  if (!targetMuscles) return [];
  if (Array.isArray(targetMuscles)) {
    return targetMuscles.map((m) => String(m).trim()).filter(Boolean);
  }
  return String(targetMuscles)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCanonicalGroup(muscleName) {
  const lower = (muscleName || '').toLowerCase();
  if (['chest', 'pecs', 'upper chest', 'pectorals'].some((m) => lower.includes(m))) return 'Chest';
  if (lower.includes('lower back')) return 'Back';
  if (
    ['abs', 'abdominal', 'abdominals', 'oblique', 'obliques', 'core', 'rectus', 'six-pack', 'six pack'].some(
      (m) => lower.includes(m)
    )
  ) {
    return 'Abs';
  }
  if (['back', 'lats', 'rear delts', 'latissimus', 'traps', 'upper back', 'rhomboids'].some((m) => lower.includes(m))) {
    return 'Back';
  }
  if (['biceps', 'bicep'].some((m) => lower.includes(m))) return 'Biceps';
  if (['forearms', 'forearm', 'brachioradialis', 'wrist flexors', 'wrist extensors'].some((m) => lower.includes(m))) {
    return 'Forearms';
  }
  if (['triceps', 'tricep'].some((m) => lower.includes(m))) return 'Triceps';
  if (['shoulders', 'delts', 'deltoid', 'front raise', 'lateral raise'].some((m) => lower.includes(m))) {
    return 'Shoulders';
  }
  if (['quads', 'quadriceps', 'vastus', 'quad'].some((m) => lower.includes(m))) return 'Quads';
  if (['hamstring', 'hamstrings', 'hams'].some((m) => lower.includes(m))) return 'Hamstrings';
  if (['glutes', 'glute', 'gluteal', 'gluteus'].some((m) => lower.includes(m))) return 'Glutes';
  if (['calves', 'calf', 'gastrocnemius', 'soleus'].some((m) => lower.includes(m))) return 'Calves';
  return null;
}

function getCanonicalGroupsFromMuscleName(muscleName) {
  const lower = (muscleName || '').toLowerCase().trim();
  if (lower === 'legs' || lower === 'leg' || lower === 'lower body') {
    return ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
  }
  if (lower === 'core' || lower === 'abs') {
    return ['Abs'];
  }
  if (
    lower.includes('trap') ||
    lower.includes('shrug') ||
    lower === 'upper back' ||
    lower.includes('upper trap')
  ) {
    return ['Shoulders', 'Back'];
  }
  if (lower.includes('adductor') || lower.includes('inner thigh') || lower.includes('groin')) {
    return ['Quads', 'Hamstrings'];
  }
  const group = getCanonicalGroup(muscleName);
  return group ? [group] : [];
}

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
  if (/\b(adductor|inner thigh|groin|copenhagen)\b/.test(lower)) return 'Quads, Hamstrings';
  if (/\b(shrug|trap|upright row)\b/.test(lower)) return 'Back, Shoulders';
  if (/\b(hip thrust|glute bridge)\b/.test(lower)) return 'Glutes, Hamstrings';
  if (
    /\b(plank|crunch|sit-up|situp|ab wheel|leg raise|russian twist|hollow|dead bug|v-up|v up|cable crunch|mountain climber|pallof)\b/.test(
      lower
    )
  ) {
    return 'Abs';
  }
  return '';
}

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
  if (/\b(trap|shrug|upper back)\b/.test(lower)) {
    groups.add('Shoulders');
    groups.add('Back');
  }
  if (/\b(adductor|inner thigh|groin)\b/.test(lower)) {
    groups.add('Quads');
    groups.add('Hamstrings');
  }
  return [...groups];
}

function createEmptyGroupMap(initial = 0) {
  return MUSCLE_GROUPS.reduce((acc, group) => {
    acc[group] = initial;
    return acc;
  }, {});
}

/** Effective load (lb-equivalent) per rep for bodyweight movements. */
function getBodyweightLoadPerRep(exerciseName) {
  const lower = (exerciseName || '').toLowerCase();
  if (/\b(pull-up|pullup|chin-up|chinup|muscle-up)\b/.test(lower)) return 90;
  if (/\b(dip|push-up|pushup|handstand)\b/.test(lower)) return 65;
  if (/\b(squat|lunge|step-up|step up|pistol)\b/.test(lower)) return 70;
  if (/\b(plank|dead bug|hollow|mountain climber)\b/.test(lower)) return 25;
  if (/\b(crunch|sit-up|situp|leg raise|twist)\b/.test(lower)) return 35;
  return 50;
}

function weightToLb(weight, unit) {
  const w = parseFloat(weight) || 0;
  if (w <= 0) return 0;
  const u = (unit || 'lbs').toLowerCase();
  if (u === 'kg' || u === 'kilograms') return w * 2.205;
  return w;
}

function isCompletedSet(set) {
  const reps = parseInt(set?.reps, 10) || 0;
  const weight = parseFloat(set?.weight) || 0;
  if (reps <= 0) return false;
  return set?.completed === true || weight > 0;
}

/** Equal split of stimulus across muscle groups targeted by the exercise. */
function getMuscleSharesForExercise(exercise) {
  const muscles = parseTargetMuscles(resolveTargetMuscles(exercise));
  const groups = new Set();
  for (const m of muscles) {
    for (const g of getCanonicalGroupsFromMuscleName(m)) {
      groups.add(g);
    }
  }
  if (groups.size === 0) return {};
  const share = 1 / groups.size;
  const out = {};
  for (const g of groups) {
    out[g] = share;
  }
  return out;
}

/**
 * Stimulus units (lb × rep equivalent) per muscle group for one workout.
 */
export function computeWorkoutStimulusByGroup(workout) {
  const byGroup = createEmptyGroupMap(0);
  const name = workout?.workout_name || '';
  const isLowStimulusDay = LOW_STIMULUS_WORKOUT.test(name);

  const exercises = workout?.exercises || [];
  let hasSetData = false;

  for (const ex of exercises) {
    const exName = ex?.name || '';
    const shares = getMuscleSharesForExercise(ex);
    if (Object.keys(shares).length === 0) continue;

    for (const set of ex.sets || []) {
      if (!isCompletedSet(set)) continue;
      hasSetData = true;
      const reps = parseInt(set.reps, 10) || 0;
      let load = weightToLb(set.weight, set.weight_unit);
      if (load <= 0) {
        load = getBodyweightLoadPerRep(exName);
      }
      const setSu = reps * load;
      for (const [group, share] of Object.entries(shares)) {
        byGroup[group] += setSu * share;
      }
    }
  }

  if (!hasSetData && !isLowStimulusDay) {
    for (const group of inferGroupsFromWorkoutName(name)) {
      if (byGroup[group] === 0) {
        byGroup[group] = TITLE_ONLY_STIMULUS_SU;
      }
    }
  }

  return byGroup;
}

/**
 * Personal median session stimulus per muscle (grows as the user gets stronger).
 * Returns null for muscles without enough history → time-only mode.
 */
export function computeBaselinesByGroup(workouts) {
  const baselines = createEmptyGroupMap(null);
  const history = MUSCLE_GROUPS.reduce((acc, group) => {
    acc[group] = [];
    return acc;
  }, {});

  const sorted = [...(workouts || [])].sort(
    (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  );

  for (const w of sorted) {
    const stimulus = computeWorkoutStimulusByGroup(w);
    for (const group of MUSCLE_GROUPS) {
      const su = stimulus[group];
      if (su > 0) {
        history[group].push(su);
      }
    }
  }

  for (const group of MUSCLE_GROUPS) {
    const values = history[group].slice(-BASELINE_SESSION_CAP);
    if (values.length < MIN_BASELINE_SESSIONS) {
      baselines[group] = null;
    } else {
      baselines[group] = Math.max(MIN_BASELINE_SU, median(values) || DEFAULT_POPULATION_BASELINE_SU);
    }
  }

  return baselines;
}

function recoveryMultiplier(r) {
  return 0.7 + 0.6 * r;
}

function fatigueDepthPercent(r) {
  return clamp(20 + 25 * Math.min(r, 2), 20, 70);
}

/** Time-only recovery (new users / muscle without baseline). */
function recoveryFromTimeOnly(completedAtMs, nowMs) {
  const hoursSince = (nowMs - completedAtMs) / (1000 * 60 * 60);
  const pct = Math.min(100, (hoursSince / RECOVERY_HOURS_FULL) * 100);
  const hoursRemaining = Math.max(0, RECOVERY_HOURS_FULL - hoursSince);
  return {
    pct: roundToStep5(pct),
    hoursRequired: RECOVERY_HOURS_FULL,
    hoursRemaining,
    relativeLoad: null,
    usesVolume: false,
  };
}

/** Volume-relative recovery for one session on one muscle. */
function recoveryFromVolumeSession({ completedAtMs, stimulus, baseline, nowMs }) {
  const r = clamp(stimulus / Math.max(baseline, MIN_BASELINE_SU), R_MIN, R_MAX);
  const hoursRequired = clamp(RECOVERY_HOURS_FULL * recoveryMultiplier(r), H_MIN, H_MAX);
  const startPct = clamp(100 - fatigueDepthPercent(r), 25, 90);
  const hoursSince = (nowMs - completedAtMs) / (1000 * 60 * 60);
  const progress = Math.min(1, hoursSince / hoursRequired);
  const pct = startPct + (100 - startPct) * progress;
  const hoursRemaining = Math.max(0, hoursRequired - hoursSince);

  return {
    pct: roundToStep5(Math.min(100, pct)),
    hoursRequired,
    hoursRemaining,
    relativeLoad: Math.round(r * 10) / 10,
    usesVolume: true,
  };
}

function formatHoursAgo(hoursSince) {
  if (hoursSince < 1) return 'Less than 1h ago';
  if (hoursSince < 24) return `${Math.round(hoursSince)}h ago`;
  const days = Math.floor(hoursSince / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/**
 * Fetches workout logs used by Recovery Map and Home recovery score.
 */
export async function fetchRecoveryWorkouts(userId) {
  if (!userId) return [];

  const start = new Date();
  start.setDate(start.getDate() - RECOVERY_SCORE_LOOKBACK_DAYS);
  const startStr = start.toISOString();
  const nowStr = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_workout_logs')
    .select('completed_at, exercises, workout_name')
    .eq('user_id', userId)
    .gte('completed_at', startStr)
    .lte('completed_at', nowStr)
    .order('completed_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

/**
 * Per-muscle recovery with personal baselines when enough history exists.
 * @returns {{
 *   recoveryPct: Record<string, number>,
 *   lastTrainedAt: Record<string, number|null>,
 *   muscleDetails: Record<string, { usesVolume, relativeLoad, hoursRequired, hoursRemaining }>
 * }}
 */
export function computeMuscleRecovery(workouts) {
  const list = workouts || [];
  const nowMs = Date.now();
  const baselines = computeBaselinesByGroup(list);
  const fatigueCutoffMs = nowMs - FATIGUE_COMBINE_DAYS * 24 * 60 * 60 * 1000;

  const recoveryPct = createEmptyGroupMap(100);
  const lastTrainedAt = createEmptyGroupMap(null);
  const muscleDetails = createEmptyGroupMap(null);

  for (const w of list) {
    const completedAtMs = w.completed_at ? new Date(w.completed_at).getTime() : null;
    if (!completedAtMs) continue;

    const stimulus = computeWorkoutStimulusByGroup(w);
    const groupsHit = MUSCLE_GROUPS.filter((g) => stimulus[g] > 0);

    for (const group of groupsHit) {
      if (lastTrainedAt[group] == null || completedAtMs > lastTrainedAt[group]) {
        lastTrainedAt[group] = completedAtMs;
      }

      if (completedAtMs < fatigueCutoffMs) continue;

      const baseline = baselines[group];
      const session =
        baseline == null || stimulus[group] <= 0
          ? recoveryFromTimeOnly(completedAtMs, nowMs)
          : recoveryFromVolumeSession({
              completedAtMs,
              stimulus: stimulus[group],
              baseline,
              nowMs,
            });

      const fatigue = 100 - session.pct;
      const prevFatigue = 100 - (recoveryPct[group] ?? 100);

      if (fatigue > prevFatigue) {
        recoveryPct[group] = session.pct;
        muscleDetails[group] = {
          usesVolume: session.usesVolume,
          relativeLoad: session.relativeLoad,
          hoursRequired: session.hoursRequired,
          hoursRemaining: session.hoursRemaining,
        };
      }
    }
  }

  for (const group of MUSCLE_GROUPS) {
    if (lastTrainedAt[group] == null) {
      recoveryPct[group] = 100;
      muscleDetails[group] = null;
    } else if (muscleDetails[group] == null) {
      const session = recoveryFromTimeOnly(lastTrainedAt[group], nowMs);
      recoveryPct[group] = session.pct;
      muscleDetails[group] = {
        usesVolume: false,
        relativeLoad: null,
        hoursRequired: session.hoursRequired,
        hoursRemaining: session.hoursRemaining,
      };
    }
  }

  return { recoveryPct, lastTrainedAt, muscleDetails };
}

/**
 * Overall readiness from muscle map: weakest trained muscle drives the score.
 */
export function computeOverallRecoveryScore(recoveryPct, lastTrainedAt, muscleDetails = {}) {
  const trainedGroups = MUSCLE_GROUPS.filter((g) => lastTrainedAt[g] != null);

  if (trainedGroups.length === 0) {
    return {
      score: 100,
      hoursToRecoverLabel: 'Fully recovered',
      limitingGroup: null,
    };
  }

  let limitingGroup = trainedGroups[0];
  let minPct = recoveryPct[limitingGroup] ?? 100;

  for (const group of trainedGroups) {
    const pct = recoveryPct[group] ?? 100;
    if (pct < minPct) {
      minPct = pct;
      limitingGroup = group;
    }
  }

  const score = Math.max(20, Math.min(100, minPct));

  let hoursToRecoverLabel = 'Fully recovered';
  const detail = muscleDetails[limitingGroup];
  if (minPct < 90 && detail) {
    const remaining = Math.ceil(detail.hoursRemaining ?? 0);
    hoursToRecoverLabel = remaining <= 0 ? 'Fully recovered' : `${remaining}h`;
  } else if (minPct < 90 && lastTrainedAt[limitingGroup] != null) {
    const hoursSince = (Date.now() - lastTrainedAt[limitingGroup]) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, Math.ceil(RECOVERY_HOURS_FULL - hoursSince));
    hoursToRecoverLabel = hoursRemaining <= 0 ? 'Fully recovered' : `${hoursRemaining}h`;
  }

  return { score, hoursToRecoverLabel, limitingGroup };
}

/**
 * Breakdown rows for RecoveryBreakdownModal — aligned with Recovery Map muscle %.
 */
export function buildRecoveryBreakdown(recoveryPct, lastTrainedAt, muscleDetails = {}) {
  const now = Date.now();
  const draggingDown = [];
  const bringingUp = [];

  for (const group of MUSCLE_GROUPS) {
    const pct = recoveryPct[group] ?? 100;
    const last = lastTrainedAt[group];
    if (last == null) continue;

    const hoursSince = (now - last) / (1000 * 60 * 60);
    const trainedLabel = formatHoursAgo(hoursSince);
    const detail = muscleDetails[group];

    if (pct < 90) {
      let extra = '';
      if (detail?.usesVolume && detail.relativeLoad != null) {
        const loadLabel =
          detail.relativeLoad >= 1.15
            ? `${detail.relativeLoad}× your usual volume`
            : detail.relativeLoad <= 0.85
              ? 'lighter than usual'
              : 'about your usual volume';
        extra = ` · ${loadLabel}`;
      } else if (detail && !detail.usesVolume) {
        extra = ' · building your baseline';
      }

      draggingDown.push({
        label: group,
        detail: `Trained ${trainedLabel} · ${pct}% recovered${extra}`,
        impact: 100 - pct,
      });
    } else {
      bringingUp.push({
        label: group,
        detail: pct >= 100 ? 'Fully recovered' : `Recovered · ${pct}%`,
        impact: Math.min(15, pct - 75),
      });
    }
  }

  draggingDown.sort((a, b) => b.impact - a.impact);
  bringingUp.sort((a, b) => b.impact - a.impact);

  return { draggingDown, bringingUp };
}
