/**
 * Shared injury options and avoid-terms for filtering exercises.
 * Used by workout.js (filter logic) and InjuryModal (UI options).
 */

export const INJURY_AVOID_TERMS = {
  // —— Lower body ——
  ACL: [
    'quad', 'knee', 'leg', 'hamstring', 'glute', 'calf', 'lunge', 'squat', 'deadlift',
    'hip thrust', 'step-up', 'bulgarian', 'leg press', 'leg curl', 'romanian deadlift', 'good morning',
    'jump', 'box jump',
  ],
  Knee: [
    'quad', 'knee', 'leg', 'hamstring', 'glute', 'calf', 'lunge', 'squat', 'deadlift',
    'hip thrust', 'step-up', 'bulgarian', 'leg press', 'leg curl', 'romanian deadlift', 'good morning',
  ],
  Hip: [
    'hip', 'glute', 'hip thrust', 'glute bridge', 'abduction', 'adductor', 'lateral lunge',
    'crossover', 'fire hydrant', 'sumo',
  ],
  Hamstring: ['hamstring', 'leg curl', 'romanian deadlift', 'good morning', 'stiff-leg', 'nordic curl'],
  Groin: ['groin', 'adductor', 'inner thigh', 'sumo', 'crossover'],
  Calf: ['calf', 'calves', 'standing calf', 'seated calf', 'calf raise', 'jump'],
  Ankle: ['ankle', 'calf', 'jump', 'hop', 'box jump', 'burpee', 'run', 'sprint'],
  Foot: ['foot', 'plantar', 'metatarsal', 'calf raise', 'jump'],
  Achilles: ['achilles', 'calf', 'jump', 'hop', 'box jump', 'running', 'sprint'],

  // —— Back & core ——
  LowerBack: [
    'lower back', 'lumbar', 'deadlift', 'good morning', 'hyperextension', 'romanian deadlift',
    'stiff-leg', 'back extension', 'reverse hyper', 'bent-over row', 'bent over row',
  ],
  UpperBack: ['upper back', 'trap', 'trapezius', 'shrug', 'face pull', 'upright row', 'lat pulldown'],
  Core: [
    'ab', 'abs', 'core', 'oblique', 'crunch', 'sit-up', 'situp', 'plank', 'russian twist',
    'leg raise', 'hanging leg', 'woodchop', 'dead bug', 'v-up', 'mountain climber',
  ],
  Rib: ['twist', 'rotation', 'woodchop', 'crunch', 'ab wheel'],

  // —— Chest ——
  Chest: ['chest', 'pec', 'bench', 'fly', 'flye', 'push-up', 'pushup', 'dip', 'incline', 'decline', 'chest press'],

  // —— Shoulders & arms ——
  Shoulder: [
    'shoulder', 'delt', 'overhead press', 'military press', 'arnold press', 'push press',
    'lateral raise', 'front raise', 'upright row', 'pike push', 'handstand',
  ],
  RotatorCuff: [
    'rotator', 'shoulder', 'delt', 'overhead', 'lateral raise', 'front raise', 'upright row',
    'face pull', 'external rotation', 'internal rotation',
  ],
  Biceps: [
    'bicep', 'biceps', 'curl', 'chin-up', 'chin up', 'chinup', 'preacher', 'hammer curl',
    'concentration curl', 'barbell curl',
  ],
  Triceps: [
    'tricep', 'triceps', 'tricep extension', 'skull crusher', 'pushdown', 'close-grip',
    'dip', 'overhead extension', 'kickback',
  ],
  Forearm: ['forearm', 'wrist curl', 'wrist extension', 'grip', 'farmer', 'wrist roller', 'dead hang'],
  Elbow: [
    'elbow', 'tricep extension', 'skull crusher', 'close-grip', 'pushdown', 'preacher',
    'overhead extension',
  ],
  Wrist: ['wrist', 'wrist curl', 'wrist extension', 'grip', 'handstand', 'push-up'],
  Neck: ['neck', 'trap', 'shrug', 'trapezius', 'upright row'],
};

/** Injuries that should skip entire lower / leg split days. */
export const LOWER_BODY_INJURY_IDS = [
  'ACL',
  'Knee',
  'Hip',
  'Hamstring',
  'Groin',
  'Calf',
  'Ankle',
  'Foot',
  'Achilles',
];

/** Push-focused day is awkward when chest + both shoulders are limited — optional future use. */
export const UPPER_PUSH_INJURY_IDS = ['Chest', 'Shoulder', 'RotatorCuff'];

/** Pull / arms day heavily limited when multiple arm injuries selected. */
export const ARM_HEAVY_INJURY_IDS = ['Biceps', 'Triceps', 'Forearm', 'Elbow', 'Wrist'];

export const injuredMusclesOptions = [
  // Lower body
  { id: 'ACL', label: 'ACL / Knee (ligament)', avoidTerms: INJURY_AVOID_TERMS.ACL },
  { id: 'Knee', label: 'Knee (general)', avoidTerms: INJURY_AVOID_TERMS.Knee },
  { id: 'Hip', label: 'Hip', avoidTerms: INJURY_AVOID_TERMS.Hip },
  { id: 'Hamstring', label: 'Hamstring', avoidTerms: INJURY_AVOID_TERMS.Hamstring },
  { id: 'Groin', label: 'Groin / Adductor', avoidTerms: INJURY_AVOID_TERMS.Groin },
  { id: 'Calf', label: 'Calf', avoidTerms: INJURY_AVOID_TERMS.Calf },
  { id: 'Ankle', label: 'Ankle', avoidTerms: INJURY_AVOID_TERMS.Ankle },
  { id: 'Foot', label: 'Foot / Plantar', avoidTerms: INJURY_AVOID_TERMS.Foot },
  { id: 'Achilles', label: 'Achilles', avoidTerms: INJURY_AVOID_TERMS.Achilles },

  // Torso
  { id: 'LowerBack', label: 'Lower back', avoidTerms: INJURY_AVOID_TERMS.LowerBack },
  { id: 'UpperBack', label: 'Upper back / Traps', avoidTerms: INJURY_AVOID_TERMS.UpperBack },
  { id: 'Core', label: 'Core / Abs', avoidTerms: INJURY_AVOID_TERMS.Core },
  { id: 'Rib', label: 'Ribs / Side', avoidTerms: INJURY_AVOID_TERMS.Rib },
  { id: 'Chest', label: 'Chest / Pectoral', avoidTerms: INJURY_AVOID_TERMS.Chest },

  // Arms & shoulders
  { id: 'Shoulder', label: 'Shoulder', avoidTerms: INJURY_AVOID_TERMS.Shoulder },
  { id: 'RotatorCuff', label: 'Rotator cuff', avoidTerms: INJURY_AVOID_TERMS.RotatorCuff },
  { id: 'Biceps', label: 'Biceps', avoidTerms: INJURY_AVOID_TERMS.Biceps },
  { id: 'Triceps', label: 'Triceps', avoidTerms: INJURY_AVOID_TERMS.Triceps },
  { id: 'Forearm', label: 'Forearm', avoidTerms: INJURY_AVOID_TERMS.Forearm },
  { id: 'Elbow', label: 'Elbow (tennis / golfer)', avoidTerms: INJURY_AVOID_TERMS.Elbow },
  { id: 'Wrist', label: 'Wrist', avoidTerms: INJURY_AVOID_TERMS.Wrist },
  { id: 'Neck', label: 'Neck', avoidTerms: INJURY_AVOID_TERMS.Neck },
];

/**
 * Flat list of terms to avoid for the selected injury ids.
 */
export function getAvoidTermsForInjuries(injuredIds) {
  if (!injuredIds?.length) return [];
  return [...new Set(injuredIds.flatMap((id) => INJURY_AVOID_TERMS[id] || []))];
}

/**
 * True when today's split is legs/lower and a lower-body injury is active.
 */
export function shouldSkipLegDayForInjuries(splitDay, injuredIds) {
  const day = String(splitDay || '').toLowerCase();
  const isLegDay = day === 'lower' || day === 'legs';
  if (!isLegDay || !injuredIds?.length) return false;
  return injuredIds.some((id) => LOWER_BODY_INJURY_IDS.includes(id));
}

/**
 * Whether a single exercise is safe given injury avoid-terms.
 */
export function isExerciseSafeForInjuries(exercise, avoidTerms, lookupExerciseInfo) {
  if (!avoidTerms?.length) return true;
  const name = typeof exercise === 'string' ? exercise : (exercise?.name ?? '');
  const targetMuscles =
    typeof exercise === 'object' && exercise?.targetMuscles
      ? exercise.targetMuscles
      : (lookupExerciseInfo?.(name)?.targetMuscles ?? '');
  const textToCheck = `${String(targetMuscles || '').toLowerCase()} ${name.toLowerCase()}`;
  return !avoidTerms.some((term) => textToCheck.includes(term));
}
