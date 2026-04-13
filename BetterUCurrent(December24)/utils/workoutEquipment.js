/**
 * Equipment filtering for recommended workouts.
 *
 * Each tag is something the user can say they "have" (except bodyweight, which is always treated as available).
 * Premium templates use PREMIUM_WORKOUT_EQUIPMENT so names like "Squat" stay accurate per workout, not per exercise string.
 */

/** All equipment IDs the user can toggle in the UI (bodyweight is implicit — everyone has floor space). */
export const ALL_USER_EQUIPMENT_IDS = [
  'dumbbells',
  'barbell',
  'bench',
  'pull_up_bar',
  'cables',
  'machines',
  'dip_station',
  'kettlebells',
  'resistance_bands',
  'specialty',
];

export const USER_EQUIPMENT_OPTIONS = [
  { id: 'dumbbells', label: 'Dumbbells', description: 'Free weights for presses, rows, curls, etc.' },
  { id: 'barbell', label: 'Barbell & plates', description: 'Squats, deadlifts, rows, presses with a bar.' },
  { id: 'bench', label: 'Bench', description: 'Flat or incline bench for bench press and similar.' },
  { id: 'pull_up_bar', label: 'Pull-up bar', description: 'Bar or sturdy place for pull-ups and hangs.' },
  { id: 'cables', label: 'Cable station', description: 'Lat pulldown, tricep pushdown, face pulls, etc.' },
  { id: 'machines', label: 'Gym machines', description: 'Leg press, preacher curl, pec deck, etc.' },
  { id: 'dip_station', label: 'Dip station', description: 'Parallel bars or dip handles.' },
  { id: 'kettlebells', label: 'Kettlebells', description: 'KB swings, goblet work with kettlebells specifically.' },
  { id: 'resistance_bands', label: 'Resistance bands', description: 'Bands for assistance or resistance.' },
  {
    id: 'specialty',
    label: 'Conditioning / specialty',
    description: 'Battle ropes, sled, rower, medicine ball, plyo box, Olympic lifting area.',
  },
];

/**
 * Curated requirements for each built-in premium template (by workout `name`).
 * Uses AND logic: the user must have every listed tag (plus implicit bodyweight).
 */
export const PREMIUM_WORKOUT_EQUIPMENT = {
  'Push Day Strength': ['bench', 'barbell', 'dumbbells', 'cables', 'dip_station'],
  'Chest & Triceps Focus': ['bench', 'barbell', 'dumbbells', 'cables'],
  'Push-Pull-Legs Pro': ['bench', 'barbell', 'dumbbells', 'cables', 'dip_station'],
  'Push Day Bodyweight & Dumbbell': ['dumbbells'],
  'At-Home Push': ['dumbbells'],
  'Pull Day Power': ['barbell', 'pull_up_bar', 'cables', 'dumbbells'],
  'Back & Biceps Builder': ['barbell', 'cables', 'dumbbells'],
  'Pull Day Classic': ['barbell', 'pull_up_bar', 'cables', 'machines', 'dumbbells'],
  'Pull Day No Barbell': ['dumbbells', 'pull_up_bar'],
  'Back & Biceps Dumbbell Only': ['dumbbells'],
  'Leg Day Bodyweight & Dumbbell': ['dumbbells'],
  'At-Home Legs': ['dumbbells'],
  'Leg Day Home': ['dumbbells'],
  'Upper Body Power': ['pull_up_bar', 'dip_station', 'dumbbells'],
  'Upper Body Minimal Equipment': ['dumbbells'],
  'Upper Body Dumbbell Only': ['dumbbells'],
  'Full Body Bodyweight': [],
  'Full Body Dumbbell': ['dumbbells'],
  'Full Body Home': ['dumbbells'],
  'Athlete Power Circuit': ['barbell', 'pull_up_bar', 'specialty'],
  'Glute & Core Sculpt': ['barbell', 'cables', 'pull_up_bar', 'dumbbells'],
  'Ultimate Conditioning': ['pull_up_bar', 'specialty'],
  'Elite Strength Builder': ['barbell', 'bench'],
  'High-Intensity Interval Training': [],
  'Flexibility and Mobility': [],
  'Core Crusher': ['cables', 'dumbbells'],
  'Lower Body Strength': ['barbell', 'machines', 'dumbbells'],
  'Lower Body Bodyweight': [],
  'Chest Bodyweight & Dumbbell': ['dumbbells'],
  'Back Dumbbell Only': ['dumbbells', 'pull_up_bar'],
  'Shoulders Bodyweight & Dumbbell': ['dumbbells'],
  'Arms Dumbbell Only': ['dumbbells'],
  'Arms Bodyweight & Dumbbell': ['dumbbells'],
};

/** Normalize exercise display name for map lookup (lowercase, single spaces). */
const normEx = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Single-exercise → equipment tags (AND). Empty array = bodyweight-only / no extra gear.
 * Used for user-created workouts when there is no premium entry.
 */
const EXERCISE_EQUIPMENT = {
  'bench press': ['barbell', 'bench'],
  'incline bench press': ['barbell', 'bench'],
  'incline barbell press': ['barbell', 'bench'],
  'overhead press': ['barbell'],
  'push press': ['barbell'],
  'deadlift': ['barbell'],
  'barbell row': ['barbell'],
  'squat': ['barbell'],
  'squats': ['barbell'],
  'back squat': ['barbell'],
  'romanian deadlift': ['dumbbells'],
  'romanian deadlifts': ['dumbbells'],
  'goblet squat': ['dumbbells'],
  'dumbbell press': ['dumbbells', 'bench'],
  'dumbbell flyes': ['dumbbells', 'bench'],
  'dumbbell fly': ['dumbbells', 'bench'],
  'incline dumbbell press': ['dumbbells', 'bench'],
  'dumbbell shoulder press': ['dumbbells'],
  'shoulder press': ['dumbbells'],
  'lateral raise': ['dumbbells'],
  'front raise': ['dumbbells'],
  'rear delt fly': ['dumbbells'],
  'bicep curl': ['dumbbells'],
  'hammer curl': ['dumbbells'],
  'tricep extension': ['dumbbells'],
  'tricep extensions': ['dumbbells'],
  'overhead tricep extension': ['dumbbells'],
  'bent over row': ['dumbbells'],
  'dumbbell row': ['dumbbells'],
  'single-arm row': ['dumbbells'],
  'arnold press': ['dumbbells'],
  'close-grip bench press': ['barbell', 'bench'],
  'skull crushers': ['barbell', 'bench'],
  'tricep pushdown': ['cables'],
  'lat pulldown': ['cables'],
  'seated cable row': ['cables'],
  'face pull': ['cables'],
  'cable crossover': ['cables'],
  'cable crunches': ['cables'],
  'cable kickbacks': ['cables'],
  'pull-up': ['pull_up_bar'],
  'pull-ups': ['pull_up_bar'],
  'pull ups': ['pull_up_bar'],
  'pull up': ['pull_up_bar'],
  'chin-ups': ['pull_up_bar'],
  'chin ups': ['pull_up_bar'],
  'burpee pull-ups': ['pull_up_bar', 'specialty'],
  't-bar row': ['barbell'],
  'leg press': ['machines'],
  'leg curl': ['machines'],
  'leg extension': ['machines'],
  'preacher curl': ['machines'],
  'dips': ['dip_station'],
  'dip': ['dip_station'],
  'push-up': [],
  'push-ups': [],
  'push ups': [],
  'push up': [],
  'diamond push-up': [],
  'close-grip push-up': [],
  'incline push-up': [],
  'pike push-up': [],
  'plank': [],
  'mountain climber': [],
  'mountain climbers': [],
  'burpee': [],
  'burpees': [],
  'jumping jack': [],
  'jumping jacks': [],
  'lunge': [],
  'lunges': [],
  'bulgarian split squat': ['bench'],
  'bulgarian split squats': ['bench'],
  'weighted lunges': ['dumbbells'],
  'weighted step-ups': ['dumbbells'],
  'weighted bulgarian split squats': ['dumbbells'],
  'glute bridge': [],
  'calf raise': [],
  'calf raises': [],
  'step-up': ['bench'],
  'wall sit': [],
  'plank variations': [],
  'russian twist': [],
  'russian twists': [],
  'leg raises': [],
  'bicycle crunches': [],
  'jump squats': [],
  'high knees': [],
  'plank jacks': [],
  'dynamic stretching': [],
  'static stretching': [],
  'foam rolling': ['specialty'],
  'yoga poses': [],
  'joint mobility': [],
  'power cleans': ['barbell', 'specialty'],
  "farmer's walk": ['dumbbells'],
  'box jumps': ['specialty'],
  'hip thrusts': ['barbell', 'bench'],
  'hanging leg raises': ['pull_up_bar'],
  'battle ropes': ['specialty'],
  'sled push': ['specialty'],
  'rowing sprints': ['specialty'],
  'medicine ball slams': ['specialty'],
};

/**
 * If the exercise string is not in EXERCISE_EQUIPMENT, guess from keywords in the name.
 * This keeps custom / AI workouts somewhat filterable without mapping every possible name.
 */
function inferExerciseEquipmentFromKeywords(nameLower) {
  const tags = new Set();
  if (nameLower.includes('dumbbell') || nameLower.includes('goblet')) tags.add('dumbbells');
  if (nameLower.includes('barbell') || nameLower.includes('deadlift') && !nameLower.includes('romanian')) {
    if (!nameLower.includes('dumbbell')) tags.add('barbell');
  }
  if (nameLower.includes('kettlebell') || nameLower.includes('kb ')) tags.add('kettlebells');
  if (nameLower.includes('cable') || nameLower.includes('pulldown') || nameLower.includes('pushdown')) tags.add('cables');
  if (nameLower.includes('machine') || nameLower.includes('leg press') || nameLower.includes('leg curl') || nameLower.includes('leg extension')) {
    tags.add('machines');
  }
  if (nameLower.includes('pull-up') || nameLower.includes('pull up') || nameLower.includes('chin-up') || nameLower.includes('chin up')) {
    tags.add('pull_up_bar');
  }
  if (nameLower.includes('dip') && !nameLower.includes('hip')) tags.add('dip_station');
  if (nameLower.includes('bench press') || (nameLower.includes('bench') && nameLower.includes('press'))) {
    tags.add('bench');
    if (!nameLower.includes('dumbbell')) tags.add('barbell');
  }
  if (nameLower.includes('incline') && nameLower.includes('press') && nameLower.includes('dumbbell')) {
    tags.add('bench');
    tags.add('dumbbells');
  }
  if (nameLower.includes('resistance band') || nameLower.includes('band ')) tags.add('resistance_bands');
  if (
    nameLower.includes('battle rope') ||
    nameLower.includes('sled') ||
    nameLower.includes('medicine ball') ||
    nameLower.includes('rower') ||
    nameLower.includes('rowing sprint') ||
    nameLower.includes('box jump') ||
    nameLower.includes('clean') ||
    nameLower.includes('foam roll')
  ) {
    tags.add('specialty');
  }
  return [...tags];
}

export function getEquipmentForExerciseName(exerciseName) {
  const key = normEx(exerciseName);
  if (!key) return [];
  if (EXERCISE_EQUIPMENT[key]) return [...EXERCISE_EQUIPMENT[key]];
  const keywordTags = inferExerciseEquipmentFromKeywords(key);
  if (keywordTags.length) return keywordTags;
  return [];
}

/**
 * Union of all exercise requirements for a workout (custom / DB workouts).
 */
export function inferEquipmentFromWorkoutExercises(exercises) {
  if (!Array.isArray(exercises)) return [];
  const union = new Set();
  for (const ex of exercises) {
    const name = typeof ex === 'string' ? ex : ex?.name;
    const tags = getEquipmentForExerciseName(name);
    tags.forEach((t) => union.add(t));
  }
  return [...union];
}

function getPremiumEquipmentKeys(workout) {
  const n = workout?.name || workout?.workout_name;
  if (!n || typeof n !== 'string') return null;
  const direct = PREMIUM_WORKOUT_EQUIPMENT[n];
  if (direct) return direct;
  return null;
}

/**
 * Returns true if the user can do this workout with their selected gear.
 * @param {object} workout - { name?, workout_name?, exercises? }
 * @param {string[]} userEquipmentIds - ids the user checked (bodyweight added automatically inside)
 * @param {boolean} filterEnabled - if false, always true
 */
export function workoutFitsUserEquipment(workout, userEquipmentIds, filterEnabled) {
  if (!filterEnabled) return true;
  const user = new Set(Array.isArray(userEquipmentIds) ? userEquipmentIds : []);
  // bodyweight / floor: always available — we never require it in arrays, but this documents intent

  let required = getPremiumEquipmentKeys(workout);
  if (!required) {
    required = inferEquipmentFromWorkoutExercises(workout?.exercises);
  }
  if (!required.length) return true;
  return required.every((id) => user.has(id));
}
