/**
 * Workout Muscle Map — utility for computing which body parts a workout
 * will impact, formatted for the `react-native-body-highlighter` library.
 *
 * Why we don't reuse `recoveryEngine.buildBodyHighlighterData`:
 *   That one expects "recovery percentages" (how rested each muscle is).
 *   We need the inverse: "for an upcoming workout, which muscles will it
 *   train?" The shape of the data is the same — `[{slug, intensity}]` —
 *   but the meaning of `intensity` is different here:
 *     0 = not worked  →  shown as defaultFill in the body diagram
 *     1 = secondary   →  mid color
 *     2 = primary     →  brightest color (muscle is the main mover)
 *
 * Inputs are forgiving: each exercise can be either a plain string
 * ("Bench Press") or an object ({ name, targetMuscles, ... }). We also
 * fall back to inferring muscles from the workout name (e.g. "Push Day")
 * when individual exercises don't tag their muscles.
 */

import { getExerciseInfo } from './exerciseLibrary';

// ---------------------------------------------------------------
// 1. Canonical muscle-group resolver
// ---------------------------------------------------------------
// We keep this self-contained so this file doesn't need to peek
// inside recoveryEngine internals. Add new aliases here if a new
// exercise label uses unfamiliar wording.

/** Strict mapping: exact muscle phrase → canonical group label. */
function aliasToCanonical(rawLower) {
  if (['chest', 'pecs', 'pectorals', 'upper chest', 'inner chest', 'lower chest'].some((m) => rawLower.includes(m))) return 'Chest';
  if (rawLower.includes('lower back')) return 'Back';
  if (['abs', 'abdominal', 'oblique', 'core', 'rectus'].some((m) => rawLower.includes(m))) return 'Abs';
  if (['back', 'lats', 'latissimus', 'rhomboid', 'traps', 'trapezius', 'upper back', 'rear delt'].some((m) => rawLower.includes(m))) return 'Back';
  if (['biceps', 'bicep', 'brachialis'].some((m) => rawLower.includes(m))) return 'Biceps';
  if (['forearm', 'brachioradialis', 'wrist'].some((m) => rawLower.includes(m))) return 'Forearms';
  if (['triceps', 'tricep'].some((m) => rawLower.includes(m))) return 'Triceps';
  if (['shoulder', 'delts', 'deltoid'].some((m) => rawLower.includes(m))) return 'Shoulders';
  if (['quads', 'quadriceps', 'vastus', 'quad'].some((m) => rawLower.includes(m))) return 'Quads';
  if (['hamstring', 'hams'].some((m) => rawLower.includes(m))) return 'Hamstrings';
  if (['glute', 'gluteal', 'gluteus'].some((m) => rawLower.includes(m))) return 'Glutes';
  if (['calf', 'calves', 'gastrocnemius', 'soleus'].some((m) => rawLower.includes(m))) return 'Calves';
  return null;
}

/** Some labels expand to multiple groups (e.g. "Legs" → quads/hams/glutes/calves). */
function expandUmbrellaLabel(rawLower) {
  if (rawLower === 'legs' || rawLower === 'leg' || rawLower === 'lower body') {
    return ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
  }
  if (rawLower === 'upper body') {
    return ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
  }
  if (rawLower === 'full body') {
    return ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'];
  }
  return null;
}

/**
 * Convert a raw muscle phrase (one item from a comma-separated list) into
 * one or more canonical group names.
 */
function muscleLabelToCanonicalGroups(label) {
  if (!label) return [];
  const lower = String(label).toLowerCase().trim();
  const umbrella = expandUmbrellaLabel(lower);
  if (umbrella) return umbrella;
  const single = aliasToCanonical(lower);
  return single ? [single] : [];
}

/**
 * Keyword-based exercise → muscle-groups dictionary.
 *
 * This is the SAFETY NET that catches exercises the library doesn't
 * have (e.g. "Squats" vs library's "squat", "Front Squats", "Weighted
 * Pull-ups"), and exercises with names that differ from the library
 * keys (plural forms, hyphen variations, lifting cues).
 *
 * Each entry is a tuple `[key, primary[], secondary[]]` where:
 *   - key       = lowercase substring to look for in the exercise name
 *   - primary   = muscles this exercise PRIMARILY trains (the obvious
 *                 target — e.g. Calves for "Calf Raise", Biceps for
 *                 "Bicep Curl"). These are rendered in the brightest
 *                 cyan color on the body diagram.
 *   - secondary = muscles that ASSIST in the lift but aren't the
 *                 main target (e.g. Triceps & Shoulders are secondary
 *                 movers in "Bench Press" — chest is the primary).
 *                 Rendered in muted cyan.
 *
 * Why split primary vs. secondary?
 *   The user explicitly asked: for an exercise like "Calf Raise", calves
 *   should appear as the PRIMARY (bright) muscle, not just secondary —
 *   even when the workout has lots of other exercises that don't hit
 *   calves. The previous count-based intensity (where rare muscles
 *   were dimmed if they didn't appear in many exercises) buried the
 *   actual target of single-purpose isolation lifts.
 *
 * How matching works (see `inferMuscleGroupsFromName` below):
 *   1. We lowercase the exercise name.
 *   2. We iterate this list TOP-TO-BOTTOM. For every key whose
 *      substring appears in the (remaining) name, we add that entry's
 *      primary/secondary muscles to the per-exercise result.
 *   3. After a key matches, we REMOVE that key's text from the
 *      remaining name so a more-generic later key (e.g. "curl")
 *      can't double-match the same word (which would, for instance,
 *      wrongly add Biceps to "Leg Curl" via the generic "curl"
 *      fallback after the specific "leg curl" match).
 *
 * Order matters: list specific phrases BEFORE generic single-word
 * fallbacks so they consume the text first.
 */
const KEYWORD_MUSCLE_PATTERNS = [
  // -------- DEADLIFT family --------
  // Romanian / stiff-leg deadlifts emphasize the posterior chain;
  // back is more "isometric brace" than primary, so it's secondary.
  ['romanian deadlift',     ['Hamstrings', 'Glutes'],          ['Back']],
  ['stiff leg deadlift',    ['Hamstrings', 'Glutes'],          ['Back']],
  ['stiff-leg deadlift',    ['Hamstrings', 'Glutes'],          ['Back']],
  ['sumo deadlift',         ['Glutes', 'Quads'],               ['Hamstrings', 'Back']],
  ['trap bar deadlift',     ['Quads', 'Glutes'],               ['Hamstrings', 'Back']],
  ['conventional deadlift', ['Back', 'Glutes', 'Hamstrings'],  ['Quads']],
  ['deadlift',              ['Back', 'Glutes', 'Hamstrings'],  ['Quads']],

  // -------- SQUAT family --------
  ['bulgarian split squat', ['Quads', 'Glutes'],     ['Hamstrings']],
  ['front squat',           ['Quads'],               ['Glutes', 'Abs']],
  ['back squat',            ['Quads', 'Glutes'],     ['Hamstrings']],
  ['goblet squat',          ['Quads', 'Glutes'],     ['Hamstrings', 'Abs']],
  ['split squat',           ['Quads', 'Glutes'],     ['Hamstrings']],
  ['jump squat',            ['Quads', 'Glutes'],     ['Hamstrings', 'Calves']],
  ['squat jump',            ['Quads', 'Glutes'],     ['Hamstrings', 'Calves']],
  ['wall sit',              ['Quads'],               ['Glutes']],
  ['wall squat',            ['Quads'],               ['Glutes']],
  ['squat',                 ['Quads', 'Glutes'],     ['Hamstrings']],

  // -------- PULL-UP / CHIN-UP / PULLDOWN family --------
  // "weighted pull" must precede "pull-up" so the more-specific
  // entry consumes the text first.
  ['burpee pull', ['Back', 'Quads', 'Glutes'],     ['Biceps', 'Chest', 'Shoulders', 'Hamstrings', 'Abs']],
  ['weighted pull', ['Back'],                       ['Biceps']],
  ['pull-up',       ['Back'],                       ['Biceps']],
  ['pull up',       ['Back'],                       ['Biceps']],
  ['pullup',        ['Back'],                       ['Biceps']],
  ['chin-up',       ['Back', 'Biceps'],             []],
  ['chin up',       ['Back', 'Biceps'],             []],
  ['chinup',        ['Back', 'Biceps'],             []],
  ['lat pulldown',  ['Back'],                       ['Biceps']],
  ['lat pull-down', ['Back'],                       ['Biceps']],
  ['lat pull down', ['Back'],                       ['Biceps']],
  ['pulldown',      ['Back'],                       ['Biceps']],
  ['pull down',     ['Back'],                       ['Biceps']],
  ['lat pull',      ['Back'],                       ['Biceps']],
  ['face pull',     ['Shoulders', 'Back'],          []],

  // -------- PRESS family --------
  ['incline barbell press',   ['Chest'],     ['Shoulders', 'Triceps']],
  ['incline dumbbell press',  ['Chest'],     ['Shoulders', 'Triceps']],
  ['incline bench press',     ['Chest'],     ['Shoulders', 'Triceps']],
  ['close-grip bench press',  ['Triceps'],   ['Chest']],
  ['close grip bench press',  ['Triceps'],   ['Chest']],
  ['close-grip bench',        ['Triceps'],   ['Chest']],
  ['close grip bench',        ['Triceps'],   ['Chest']],
  ['bench press',             ['Chest'],     ['Shoulders', 'Triceps']],
  // Calf isolation on leg press — feet low on platform; calves only (must precede `leg press`).
  ['leg press calf raise',    ['Calves'],    []],
  ['leg press calf raises',   ['Calves'],    []],
  ['seated calf raise',       ['Calves'],    []],
  ['seated calf raises',      ['Calves'],    []],
  ['standing calf raise',     ['Calves'],    []],
  ['standing calf raises',    ['Calves'],    []],
  ['single leg calf raise',   ['Calves'],    []],
  ['donkey calf raise',       ['Calves'],    []],
  ['leg press',               ['Quads'],     ['Glutes', 'Hamstrings']],
  ['incline press',           ['Chest'],     ['Shoulders', 'Triceps']],
  ['dumbbell shoulder press', ['Shoulders'], ['Triceps']],
  ['shoulder press',          ['Shoulders'], ['Triceps']],
  ['overhead press',          ['Shoulders'], ['Triceps']],
  ['military press',          ['Shoulders'], ['Triceps']],
  ['arnold press',            ['Shoulders'], ['Triceps']],
  ['push press',              ['Shoulders'], ['Triceps', 'Quads']],
  ['dumbbell press',          ['Chest'],     ['Shoulders', 'Triceps']],
  ['ohp',                     ['Shoulders'], ['Triceps']],

  // -------- PUSH-UP family --------
  ['pike push-up',       ['Shoulders'], ['Triceps', 'Chest']],
  ['pike push up',       ['Shoulders'], ['Triceps', 'Chest']],
  ['diamond push-up',    ['Triceps'],   ['Chest', 'Shoulders']],
  ['diamond push up',    ['Triceps'],   ['Chest', 'Shoulders']],
  ['close-grip push-up', ['Triceps'],   ['Chest']],
  ['close grip push-up', ['Triceps'],   ['Chest']],
  ['close grip push up', ['Triceps'],   ['Chest']],
  ['incline push-up',    ['Chest'],     ['Shoulders', 'Triceps']],
  ['incline push up',    ['Chest'],     ['Shoulders', 'Triceps']],
  ['decline push-up',    ['Chest'],     ['Shoulders', 'Triceps']],
  ['decline push up',    ['Chest'],     ['Shoulders', 'Triceps']],
  ['push-up',            ['Chest'],     ['Shoulders', 'Triceps', 'Abs']],
  ['push up',            ['Chest'],     ['Shoulders', 'Triceps', 'Abs']],
  ['pushup',             ['Chest'],     ['Shoulders', 'Triceps', 'Abs']],

  // -------- ROW family --------
  ['bent over row',  ['Back'],            ['Biceps']],
  ['bent-over row',  ['Back'],            ['Biceps']],
  ['barbell row',    ['Back'],            ['Biceps']],
  ['t-bar row',      ['Back'],            ['Biceps']],
  ['t bar row',      ['Back'],            ['Biceps']],
  ['seated cable row', ['Back'],          ['Biceps']],
  ['cable row',      ['Back'],            ['Biceps']],
  ['seated row',     ['Back'],            ['Biceps']],
  ['pendlay row',    ['Back'],            ['Biceps']],
  ['inverted row',   ['Back'],            ['Biceps']],
  ['single-arm row', ['Back'],            ['Biceps']],
  ['single arm row', ['Back'],            ['Biceps']],
  ['one arm row',    ['Back'],            ['Biceps']],
  ['dumbbell row',   ['Back'],            ['Biceps']],
  ['upright row',    ['Shoulders'],       ['Back']],
  ['row',            ['Back'],            ['Biceps']],

  // -------- RAISE family --------
  ['cable lateral raise', ['Shoulders'],          []],
  ['lateral raise',       ['Shoulders'],          []],
  ['side raise',          ['Shoulders'],          []],
  ['front raise',         ['Shoulders'],          []],
  ['rear delt raise',     ['Shoulders', 'Back'],  []],
  ['calf raise',          ['Calves'],             []],
  ['hanging leg raise',   ['Abs'],                []],
  ['leg raise',           ['Abs'],                []],

  // -------- CURL family --------
  ['hammer curl',     ['Biceps'],     ['Forearms']],
  ['preacher curl',   ['Biceps'],     []],
  ['barbell curl',    ['Biceps'],     []],
  ['bicep curl',      ['Biceps'],     []],
  ['biceps curl',     ['Biceps'],     []],
  ['leg curl',        ['Hamstrings'], []],
  ['hamstring curl',  ['Hamstrings'], []],
  // Bare "curl" fallback — last so "leg curl" / "hammer curl" win.
  ['curl',            ['Biceps'],     []],

  // -------- EXTENSION family --------
  ['overhead tricep extension', ['Triceps'], []],
  ['tricep extension',  ['Triceps'], []],
  ['triceps extension', ['Triceps'], []],
  ['leg extension',     ['Quads'],   []],
  ['knee extension',    ['Quads'],   []],
  ['back extension',    ['Back'],    ['Glutes']],

  // -------- TRICEP-specific isolation --------
  ['tricep pushdown',  ['Triceps'], []],
  ['tricep push down', ['Triceps'], []],
  ['skull crusher',    ['Triceps'], []],

  // -------- FLY family --------
  ['rear delt fly',  ['Shoulders'], ['Back']],
  ['rear delt flye', ['Shoulders'], ['Back']],
  ['rear delt',      ['Shoulders'], ['Back']],
  ['cable fly',      ['Chest'],     []],
  ['dumbbell fly',   ['Chest'],     []],
  ['chest fly',      ['Chest'],     []],
  ['cable flye',     ['Chest'],     []],
  ['dumbbell flye',  ['Chest'],     []],
  ['flyes',          ['Chest'],     []],
  ['flye',           ['Chest'],     []],

  // -------- LUNGE family --------
  ['walking lunge', ['Quads', 'Glutes'], ['Hamstrings']],
  ['reverse lunge', ['Quads', 'Glutes'], ['Hamstrings']],
  ['lunge',         ['Quads', 'Glutes'], ['Hamstrings']],

  // -------- HIP / GLUTE / BRIDGE --------
  ['hip thrust',     ['Glutes'], ['Hamstrings']],
  ['glute bridge',   ['Glutes'], ['Hamstrings']],
  ['hip bridge',     ['Glutes'], ['Hamstrings']],
  ['cable kickback', ['Glutes'], []],
  ['glute kickback', ['Glutes'], []],
  ['kickback',       ['Glutes'], []],
  ['hip extension',  ['Glutes'], ['Hamstrings']],

  // -------- STEP / JUMP / BOX --------
  ['box jump', ['Quads', 'Glutes'], ['Hamstrings', 'Calves']],
  ['step-up',  ['Quads', 'Glutes'], ['Hamstrings']],
  ['step up',  ['Quads', 'Glutes'], ['Hamstrings']],

  // -------- OLYMPIC --------
  ['power clean', ['Back', 'Quads', 'Glutes'], ['Hamstrings', 'Shoulders']],
  ['hang clean',  ['Back', 'Quads', 'Glutes'], ['Hamstrings', 'Shoulders']],
  ['clean',       ['Back', 'Quads', 'Glutes'], ['Hamstrings', 'Shoulders']],
  ['snatch',      ['Back', 'Quads', 'Glutes'], ['Hamstrings', 'Shoulders']],

  // -------- DIP family --------
  ['tricep dip', ['Triceps'], ['Chest', 'Shoulders']],
  ['bench dip',  ['Triceps'], ['Chest', 'Shoulders']],
  ['chest dip',  ['Chest'],   ['Triceps', 'Shoulders']],
  ['dip',        ['Chest', 'Triceps'], ['Shoulders']],

  // -------- CORE / ABS --------
  ['mountain climber', ['Abs'], ['Shoulders', 'Quads']],
  ['plank jack',       ['Abs'], ['Shoulders']],
  ['plank variation',  ['Abs'], ['Shoulders']],
  ['side plank',       ['Abs'], ['Shoulders']],
  ['plank',            ['Abs'], ['Shoulders']],
  ['bicycle crunch',   ['Abs'], []],
  ['cable crunch',     ['Abs'], []],
  ['russian twist',    ['Abs'], []],
  ['oblique',          ['Abs'], []],
  ['crunch',           ['Abs'], []],
  ['sit-up',           ['Abs'], []],
  ['sit up',           ['Abs'], []],
  ['situp',            ['Abs'], []],

  // -------- CONDITIONING --------
  // Burpees are basically a full-body explosive movement, so most
  // groups are primary; abs are secondary (bracing, not the focus).
  ['burpee',           ['Quads', 'Glutes', 'Chest'],     ['Hamstrings', 'Shoulders', 'Triceps', 'Abs']],
  ['high knee',        ['Quads'],                        ['Calves', 'Abs']],
  ['jumping jack',     ['Calves'],                       ['Shoulders']],
  ['bear crawl',       ['Abs', 'Shoulders'],             ['Quads', 'Glutes']],
  ['battle rope',      ['Shoulders'],                    ['Abs']],
  ['sled push',        ['Quads', 'Glutes'],              ['Calves', 'Hamstrings']],
  ['rowing',           ['Back', 'Quads'],                ['Biceps', 'Hamstrings']],
  ['medicine ball slam', ['Abs', 'Shoulders'],           []],
  ['ball slam',        ['Abs', 'Shoulders'],             []],
  ["farmer's walk",    ['Forearms', 'Back'],             ['Quads', 'Abs']],
  ['farmer walk',      ['Forearms', 'Back'],             ['Quads', 'Abs']],
  ['farmer carry',     ['Forearms', 'Back'],             ['Quads', 'Abs']],

  // -------- CARDIO / RECOVERY (intentionally empty groups) --------
  // These names don't target specific weight-trained muscles, so we
  // map them to [] which means "matched but contributes nothing".
  // Without this, they'd fall through to inferGroupsFromWorkoutName
  // and might contaminate a recovery workout with leg muscles.
  ['dynamic stretch', [], []],
  ['static stretch',  [], []],
  ['foam rolling',    [], []],
  ['foam roll',       [], []],
  ['yoga pose',       [], []],
  ['yoga',            [], []],
  ['joint mobility',  [], []],
  ['mobility',        [], []],
  ['stretch',         [], []],
];

/**
 * Infer primary + secondary muscle groups from a free-form exercise
 * name using keyword matching. Used as a fallback when explicit
 * `targetMuscles` data and the exerciseLibrary lookup both fail.
 *
 * Example:
 *   inferMuscleGroupsFromName('Calf Raise')
 *     → { primary: ['Calves'], secondary: [] }
 *
 *   inferMuscleGroupsFromName('Bench Press')
 *     → { primary: ['Chest'], secondary: ['Shoulders', 'Triceps'] }
 *
 * @param {string} name
 * @returns {{ primary: string[], secondary: string[] }}
 */
function inferMuscleGroupsFromName(name) {
  if (!name) return { primary: [], secondary: [] };

  // Lowercase + trim. We keep both spaced and dashed pattern keys in
  // the dictionary above so we don't have to normalize hyphens here.
  const lower = String(name).toLowerCase().trim();
  let remaining = lower;
  const primary = new Set();
  const secondary = new Set();

  for (const [key, primaryGroups, secondaryGroups] of KEYWORD_MUSCLE_PATTERNS) {
    if (remaining.includes(key)) {
      for (const g of primaryGroups) primary.add(g);
      for (const g of secondaryGroups) secondary.add(g);
      // Replace ALL occurrences of `key` in `remaining` with a space.
      // .split(key).join(' ') is the classic "global string replace
      // for a literal substring" trick (regex would need escaping for
      // dashes / apostrophes). The space prevents adjacent words from
      // getting glued together (which could create false matches).
      remaining = remaining.split(key).join(' ');
    }
  }

  // If a muscle ended up in both sets (rare — happens if two patterns
  // matched and one called it primary, another called it secondary),
  // primary wins because that's the more authoritative claim.
  for (const g of primary) secondary.delete(g);

  return { primary: [...primary], secondary: [...secondary] };
}

/**
 * Convert a `targetMuscles` field from the exercise library into a
 * `{primary, secondary}` shape using the convention:
 *   - First listed muscle = primary mover
 *   - Remaining muscles   = secondary movers / assists
 *
 * This convention matches how most exercise databases (and the entries
 * we wrote ourselves) order the muscles — the most-targeted is first.
 *
 * Example:
 *   "Chest, Shoulders, Triceps"
 *     → { primary: ['Chest'], secondary: ['Shoulders', 'Triceps'] }
 */
function splitTargetMusclesField(raw) {
  if (!raw) return { primary: [], secondary: [] };

  const items = Array.isArray(raw)
    ? raw.map((m) => String(m).trim()).filter(Boolean)
    : String(raw)
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

  const primary = new Set();
  const secondary = new Set();

  for (let i = 0; i < items.length; i++) {
    const groups = muscleLabelToCanonicalGroups(items[i]);
    for (const g of groups) {
      // First label → primary; subsequent labels → secondary (unless
      // already promoted to primary by an earlier label).
      if (i === 0) primary.add(g);
      else if (!primary.has(g)) secondary.add(g);
    }
  }

  return { primary: [...primary], secondary: [...secondary] };
}

/**
 * Resolve an exercise to its primary + secondary muscle groups.
 *
 * Resolution order (most authoritative first):
 *   1. Explicit `targetMuscles` on the exercise object — caller knows best.
 *   2. exerciseLibrary lookup by normalized name.
 *   3. Keyword-based name inference (handles plurals + unknown variants).
 *
 * Steps 2 and 3 only run when steps above them produced nothing.
 *
 * @returns {{ primary: string[], secondary: string[] }}
 */
/** Placeholder targets from failed lookups — must not block name-based inference. */
function isPlaceholderTargetMuscles(raw) {
  const lower = String(raw || '').trim().toLowerCase();
  return !lower || lower === 'full body' || lower === 'various' || lower === 'general';
}

function getMuscleGroupsForExercise(exercise) {
  // 1. Object with explicit targetMuscles wins (unless it's a generic placeholder).
  let raw = null;
  if (exercise && typeof exercise === 'object' && !isPlaceholderTargetMuscles(exercise.targetMuscles)) {
    raw = exercise.targetMuscles;
  }

  // 2. Look up in the shared exercise library by name.
  const name = typeof exercise === 'string' ? exercise : exercise?.name;
  if (!raw) {
    const info = name ? getExerciseInfo(name) : null;
    if (info?.targetMuscles && !isPlaceholderTargetMuscles(info.targetMuscles)) {
      raw = info.targetMuscles;
    }
  }

  // 3. If we have a `raw` value (from 1 or 2), parse it using the
  //    "first listed = primary" convention.
  if (raw) {
    const split = splitTargetMusclesField(raw);
    if (split.primary.length > 0 || split.secondary.length > 0) {
      return split;
    }
  }

  // 4. Keyword inference fallback. This is what catches names like
  //    "Squats", "Front Squats", "Weighted Pull-Ups", "Romanian
  //    Deadlifts" that don't appear in the library or whose plural
  //    form mismatches the library's singular keys.
  return inferMuscleGroupsFromName(name);
}

/**
 * Last-ditch fallback: infer muscle groups purely from a workout's name.
 * Used when the exercises don't tag their muscles AND the library lookup
 * fails (e.g. a totally custom workout called "Bro Sesh" with no targets).
 */
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
  if (/\b(tricep)\b/.test(lower)) groups.add('Triceps');
  if (/\b(legs?|leg day|lower body|lower)\b/.test(lower)) {
    groups.add('Quads');
    groups.add('Hamstrings');
    groups.add('Glutes');
    groups.add('Calves');
  }
  if (/\b(glute)\b/.test(lower)) groups.add('Glutes');
  if (/\b(calf|calves)\b/.test(lower)) groups.add('Calves');
  if (/\b(ab|core)\b/.test(lower)) groups.add('Abs');
  if (/\b(full body|total body)\b/.test(lower)) {
    ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Abs'].forEach((g) => groups.add(g));
  }
  return [...groups];
}

// ---------------------------------------------------------------
// 2. Public API
// ---------------------------------------------------------------

/**
 * Aggregate primary + secondary muscle groups across every exercise
 * in a workout.
 *
 * Aggregation rule (matches the user's mental model):
 *   - A muscle is PRIMARY for the workout if it's the primary mover
 *     for AT LEAST ONE exercise. (E.g. "Calf Raise" → Calves goes
 *     primary, even if the workout has 5 other unrelated exercises.)
 *   - A muscle is SECONDARY if it only appears as a secondary mover
 *     across all exercises and never gets promoted to primary.
 *   - Anything else doesn't appear on the body diagram.
 *
 * @param {Array} exercises – strings or { name, targetMuscles } objects
 * @param {string} [workoutName] – fallback used when nothing else matches
 * @returns {{ primary: string[], secondary: string[] }}
 */
/**
 * Human-readable target string for workout cards / active-workout rows.
 * @param {string|{ name?: string, targetMuscles?: string }} exercise
 * @returns {string}
 */
export function formatTargetMusclesForExercise(exercise) {
  const split = getMuscleGroupsForExercise(exercise);
  const groups = [...split.primary, ...split.secondary];
  return groups.length > 0 ? groups.join(', ') : 'Full Body';
}

export function aggregateWorkoutMuscleGroups(exercises, workoutName) {
  const primary = new Set();
  const secondary = new Set();
  const safeExercises = Array.isArray(exercises) ? exercises : [];

  for (const ex of safeExercises) {
    const split = getMuscleGroupsForExercise(ex);
    for (const g of split.primary) primary.add(g);
    for (const g of split.secondary) secondary.add(g);
  }

  // If a muscle ended up in BOTH sets (e.g. it was secondary for one
  // exercise and primary for another), keep it as primary only — the
  // primary claim wins because we only need one exercise to make the
  // diagram light up bright for that muscle.
  for (const g of primary) secondary.delete(g);

  // Fallback: nothing matched any exercise → infer from workout name
  // alone (e.g. "Push Day" → Chest/Triceps/Shoulders). These are
  // educated guesses, so we mark them all as primary.
  if (primary.size === 0 && secondary.size === 0) {
    for (const g of inferGroupsFromWorkoutName(workoutName)) primary.add(g);
  }

  return {
    primary: [...primary],
    secondary: [...secondary],
  };
}

/**
 * Convert the aggregated primary/secondary sets into the front+back
 * arrays expected by `react-native-body-highlighter`. Intensity scale:
 *   - 0: not worked (default body color, hidden via filter())
 *   - 1: secondary mover (muted cyan)
 *   - 2: primary mover (bright cyan)
 *
 * @param {Array} exercises
 * @param {string} [workoutName]
 * @returns {{ frontData: Array, backData: Array }}
 */
export function buildWorkoutImpactData(exercises, workoutName) {
  const { primary, secondary } = aggregateWorkoutMuscleGroups(exercises, workoutName);

  // Sets give us O(1) `.has()` lookups vs O(n) `.includes()` on arrays.
  const primarySet = new Set(primary);
  const secondarySet = new Set(secondary);

  const intensity = (group) => {
    if (primarySet.has(group)) return 2;
    if (secondarySet.has(group)) return 1;
    return 0;
  };

  // The slug strings here MUST match what react-native-body-highlighter
  // accepts (see its README). Adding/removing slugs changes which body
  // parts can light up.
  return {
    frontData: [
      { slug: 'chest', intensity: intensity('Chest') },
      { slug: 'biceps', intensity: intensity('Biceps') },
      { slug: 'forearm', intensity: intensity('Forearms') },
      { slug: 'triceps', intensity: intensity('Triceps') },
      { slug: 'deltoids', intensity: intensity('Shoulders') },
      // Trapezius gets the larger of Back/Shoulders signal (upper traps span
      // both groups in practice — shrugs hit traps, lateral raises clip them).
      { slug: 'trapezius', intensity: Math.max(intensity('Back'), intensity('Shoulders')) },
      { slug: 'abs', intensity: intensity('Abs') },
      { slug: 'obliques', intensity: intensity('Abs') },
      { slug: 'quadriceps', intensity: intensity('Quads') },
      { slug: 'adductors', intensity: intensity('Quads') },
      { slug: 'calves', intensity: intensity('Calves') },
    ].filter((d) => d.intensity > 0),
    backData: [
      { slug: 'trapezius', intensity: Math.max(intensity('Back'), intensity('Shoulders')) },
      { slug: 'deltoids', intensity: intensity('Shoulders') },
      { slug: 'upper-back', intensity: intensity('Back') },
      { slug: 'lower-back', intensity: intensity('Back') },
      { slug: 'triceps', intensity: intensity('Triceps') },
      { slug: 'forearm', intensity: intensity('Forearms') },
      { slug: 'gluteal', intensity: intensity('Glutes') },
      { slug: 'hamstring', intensity: intensity('Hamstrings') },
      { slug: 'adductors', intensity: intensity('Hamstrings') },
      { slug: 'calves', intensity: intensity('Calves') },
    ].filter((d) => d.intensity > 0),
  };
}
