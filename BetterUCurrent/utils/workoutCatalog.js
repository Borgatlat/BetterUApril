/**
 * Shared workout catalog — single source of truth for all built-in workouts.
 *
 * Why this lives in a separate file:
 *   The same data is now needed in multiple places (the workout tab, the
 *   /more-workouts screen, the /premium-workouts screen, and the shared
 *   /workout-detail screen). Defining it once and importing it everywhere
 *   prevents the data from drifting out of sync between screens.
 *
 * If you add a new starter workout, make sure its `name` matches a key in
 * the `workoutData` object inside `app/(tabs)/active-workout.js` — that's
 * what active-workout uses to look up the set/rep structure when we
 * navigate with `?type=NAME`.
 */

/**
 * Built-in starter workouts shown in the "More Workouts" screen.
 * Compact info — title, description, time, intensity, and a quick exercise
 * list. The detailed set/rep structure lives in active-workout.js.
 */
export const STARTER_WORKOUTS = [
  {
    name: 'Full Body Workout',
    description: 'Complete full body workout targeting all major muscle groups',
    repRange: '8 reps',
    duration: '60 min',
    intensity: 'High Intensity',
    exercises: ['Squats', 'Bench Press', 'Deadlifts', 'Pull-ups', 'Shoulder Press'],
  },
  {
    name: 'Upper Body Power',
    description: 'Heavy upper body focused workout for strength gains',
    repRange: '4 reps',
    duration: '45 min',
    intensity: 'High Intensity',
    exercises: ['Bench Press', 'Weighted Pull-ups', 'Military Press', 'Barbell Rows'],
  },
  {
    name: 'Lower Body Power',
    description: 'Heavy lower body focused workout for strength gains',
    repRange: '4 reps',
    duration: '45 min',
    intensity: 'High Intensity',
    exercises: ['Back Squats', 'Romanian Deadlifts', 'Front Squats', 'Leg Press'],
  },
  {
    name: 'HIIT Cardio',
    description: 'High-intensity interval training for maximum calorie burn',
    repRange: '30s work/30s rest',
    duration: '30 min',
    intensity: 'Very High Intensity',
    exercises: ['Burpees', 'Mountain Climbers', 'Jump Squats', 'High Knees'],
  },
  {
    name: 'Core & Abs',
    description: 'Focused core workout for strength and definition',
    repRange: '15 reps',
    duration: '30 min',
    intensity: 'Medium Intensity',
    exercises: ['Planks', 'Russian Twists', 'Leg Raises', 'Cable Crunches'],
  },
  {
    name: 'Mobility & Recovery',
    description: 'Stretching and mobility work for better flexibility and recovery',
    repRange: '30-60s holds',
    duration: '40 min',
    intensity: 'Low Intensity',
    exercises: ['Dynamic Stretching', 'Foam Rolling', 'Yoga Poses', 'Joint Mobility'],
  },
];

/**
 * Premium workouts — locked unless the user has an active subscription.
 *
 * Each entry includes:
 *   - splitDay: which day in a training split this fits (push/pull/legs/etc.)
 *   - goalType: strength | muscle_growth | athleticism | wellness
 *   - name, description, repRange, duration, intensity
 *   - exercises: list of exercise names
 *   - howTo: one-line coaching cue shown on the detail screen
 */
export const PREMIUM_WORKOUTS = [
  // Push day workouts (chest, shoulders, triceps)
  { splitDay: 'push', goalType: 'strength', name: 'Push Day Strength', description: 'Heavy compound push for chest, shoulders and triceps', repRange: '6-10 reps', duration: '55 min', intensity: 'High', exercises: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Dips', 'Tricep Pushdown', 'Lateral Raise'], howTo: 'Lead with compound moves, then finish with isolation. Rest 2–3 min on heavy sets.' },
  { splitDay: 'push', goalType: 'muscle_growth', name: 'Chest & Triceps Focus', description: 'Chest and tricep emphasis with pump finishers', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Close-Grip Bench Press', 'Tricep Pushdown', 'Skull Crushers'], howTo: 'Control the eccentric and squeeze at the top of each rep for maximum pump.' },
  { splitDay: 'push', goalType: 'muscle_growth', name: 'Push-Pull-Legs Pro', description: 'Advanced PPL push day for muscle growth', repRange: '8-12 reps', duration: '60 min', intensity: 'Pro', exercises: ['Incline Barbell Press', 'Arnold Press', 'Lateral Raise', 'Tricep Pushdown', 'Dips'], howTo: 'Focus on compound movements to maximize muscle engagement and growth.' },
  // Push – bodyweight & dumbbell (minimal equipment)
  { splitDay: 'push', goalType: 'muscle_growth', name: 'Push Day Bodyweight & Dumbbell', description: 'No barbell needed. Chest, shoulders and triceps with push-ups and dumbbells.', repRange: '8-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Push-Up', 'Pike Push-Up', 'Dumbbell Press', 'Lateral Raise', 'Tricep Extension', 'Diamond Push-Up'], howTo: 'Use a bench or floor for push-ups and pike push-ups; one set of dumbbells covers the rest.' },
  { splitDay: 'push', goalType: 'strength', name: 'At-Home Push', description: 'Push day with only bodyweight and dumbbells', repRange: '10-15 reps', duration: '35 min', intensity: 'Medium', exercises: ['Push-Up', 'Dumbbell Shoulder Press', 'Dumbbell Flyes', 'Tricep Extension', 'Lateral Raise'], howTo: 'Focus on control and full range of motion; add weight as you get stronger.' },
  // Pull day workouts (back, biceps, rear delts)
  { splitDay: 'pull', goalType: 'strength', name: 'Pull Day Power', description: 'Heavy back and biceps for strength and size', repRange: '6-10 reps', duration: '55 min', intensity: 'High', exercises: ['Deadlift', 'Barbell Row', 'Pull-Ups', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'], howTo: 'Prioritize deadlift and rows; keep core braced and avoid using momentum.' },
  { splitDay: 'pull', goalType: 'muscle_growth', name: 'Back & Biceps Builder', description: 'Hypertrophy-focused pull with multiple angles', repRange: '8-12 reps', duration: '50 min', intensity: 'Medium', exercises: ['Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Face Pull', 'Bicep Curl', 'Hammer Curl'], howTo: 'Squeeze the back and biceps at the top of each pull; control the negative.' },
  { splitDay: 'pull', goalType: 'muscle_growth', name: 'Pull Day Classic', description: 'Classic pull routine with rows and curls', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Pull-Ups', 'T-Bar Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl', 'Preacher Curl'], howTo: 'Focus on full range of motion and mind–muscle connection on every set.' },
  // Pull – bodyweight & dumbbell
  { splitDay: 'pull', goalType: 'muscle_growth', name: 'Pull Day No Barbell', description: 'Back and biceps using dumbbells and bodyweight only', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Bent Over Row', 'Dumbbell Row', 'Pull-Up', 'Bicep Curl', 'Hammer Curl', 'Rear Delt Fly'], howTo: 'Use a single dumbbell or two for rows and curls; pull-ups can be done with a bar or bands.' },
  { splitDay: 'pull', goalType: 'strength', name: 'Back & Biceps Dumbbell Only', description: 'Full pull day with just dumbbells', repRange: '8-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Bent Over Row', 'Single-Arm Row', 'Rear Delt Fly', 'Bicep Curl', 'Hammer Curl'], howTo: 'Brace your core on rows; squeeze shoulder blades at the top of each row.' },
  // Legs – bodyweight & dumbbell
  { splitDay: 'legs', goalType: 'muscle_growth', name: 'Leg Day Bodyweight & Dumbbell', description: 'Legs and glutes with minimal equipment', repRange: '10-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Goblet Squat', 'Lunges', 'Romanian Deadlift', 'Calf Raise', 'Bulgarian Split Squat', 'Glute Bridge'], howTo: 'Hold one dumbbell for goblet squats and RDL; bodyweight for lunges and bridges.' },
  { splitDay: 'legs', goalType: 'wellness', name: 'At-Home Legs', description: 'Lower body with squats, lunges and one dumbbell', repRange: '12-15 reps', duration: '35 min', intensity: 'Medium', exercises: ['Squat', 'Lunges', 'Glute Bridge', 'Romanian Deadlift', 'Calf Raise'], howTo: 'No rack needed; use dumbbells for RDL and goblet-style squats if you have them.' },
  { splitDay: 'legs', goalType: 'strength', name: 'Leg Day Strength', description: 'Heavy squats and compounds for quad, hamstring and glute strength', repRange: '5-8 reps', duration: '60 min', intensity: 'High', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise', 'Hip Thrust'], howTo: 'Warm up thoroughly; rest 2–3 minutes on squat and deadlift sets.' },
  { splitDay: 'legs', goalType: 'muscle_growth', name: 'Leg Day Hypertrophy', description: 'Volume leg day for size — quads, hamstrings and glutes', repRange: '8-12 reps', duration: '55 min', intensity: 'Medium', exercises: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curl', 'Walking Lunge', 'Calf Raise'], howTo: 'Control the negative on RDL and leg curl; squeeze glutes at the top of hip thrusts.' },
  { splitDay: 'Lower', goalType: 'strength', name: 'Leg Day Home', description: 'Full leg day with bodyweight and dumbbells only', repRange: '8-12 reps', duration: '50 min', intensity: 'High', exercises: ['Goblet Squat', 'Lunges', 'Bulgarian Split Squat', 'Romanian Deadlift', 'Calf Raise', 'Glute Bridge'], howTo: 'Progressive overload by adding dumbbell weight or slowing the tempo.' },
  // Upper – bodyweight & dumbbell
  { splitDay: 'Upper', goalType: 'strength', name: 'Upper Body Power', description: 'Build upper body strength and power', repRange: '6-10 reps', duration: '55 min', intensity: 'High', exercises: ['Pull-Ups', 'Dips', 'Push-Ups', 'Dumbbell Press', 'Tricep Extensions'], howTo: 'Focus on explosive movements and proper form to build upper body power.' },
  { splitDay: 'Upper', goalType: 'muscle_growth', name: 'Upper Body Minimal Equipment', description: 'Chest, back, shoulders and arms with push-ups and dumbbells', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Push-Up', 'Bent Over Row', 'Pike Push-Up', 'Bicep Curl', 'Tricep Extension'], howTo: 'Alternate push and pull; use a table or bar for rows if needed.' },
  { splitDay: 'Upper', goalType: 'muscle_growth', name: 'Upper Body Dumbbell Only', description: 'Complete upper body with only dumbbells', repRange: '8-12 reps', duration: '50 min', intensity: 'Medium', exercises: ['Dumbbell Press', 'Bent Over Row', 'Shoulder Press', 'Lateral Raise', 'Bicep Curl', 'Tricep Extension'], howTo: 'One pair of dumbbells can cover every exercise; adjust weight per movement.' },
  { splitDay: 'Upper', goalType: 'strength', name: 'Upper Body Strength (Gym)', description: 'Barbell and compound upper day for strength', repRange: '5-8 reps', duration: '60 min', intensity: 'High', exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Pull-Ups', 'Barbell Curl', 'Tricep Pushdown'], howTo: 'Alternate pressing and pulling; rest 2–3 min on heavy compounds.' },
  { splitDay: 'Upper', goalType: 'muscle_growth', name: 'Upper Body Hypertrophy', description: 'Chest, back, shoulders and arms for muscle growth', repRange: '8-12 reps', duration: '55 min', intensity: 'Medium', exercises: ['Incline Dumbbell Press', 'Lat Pulldown', 'Cable Row', 'Lateral Raise', 'Bicep Curl', 'Tricep Pushdown'], howTo: 'Hit each muscle group with 2–3 exercises; keep rest around 60–90 seconds.' },
  // Full body – bodyweight & dumbbell
  { splitDay: 'Full Body', goalType: 'wellness', name: 'Full Body Bodyweight', description: 'No equipment. Push, pull, legs and core with bodyweight only.', repRange: '12-15 reps', duration: '35 min', intensity: 'Medium', exercises: ['Push-Up', 'Squat', 'Lunges', 'Plank', 'Mountain Climber', 'Burpee'], howTo: 'Great for travel or home; do circuits or straight sets with short rest.' },
  { splitDay: 'Full Body', goalType: 'strength', name: 'Full Body Dumbbell', description: 'One set of dumbbells for a full-body workout', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Goblet Squat', 'Dumbbell Press', 'Bent Over Row', 'Romanian Deadlift', 'Shoulder Press', 'Bicep Curl'], howTo: 'Compound moves first; finish with curls and tricep work if time allows.' },
  { splitDay: 'Full Body', goalType: 'muscle_growth', name: 'Full Body Home', description: 'Mix of bodyweight and dumbbell for home or small gym', repRange: '10-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Push-Up', 'Bent Over Row', 'Goblet Squat', 'Lunges', 'Plank', 'Jumping Jack'], howTo: 'Minimal space and equipment; focus on form and breathing.' },
  // Full body, upper, lower (existing + more)
  { splitDay: 'Full Body', goalType: 'athleticism', name: 'Athlete Power Circuit', description: 'Explosive full-body circuit for athletes', repRange: '8-10 reps', duration: '50 min', intensity: 'Elite', exercises: ['Power Cleans', 'Push Press', 'Box Jumps', 'Chin-Ups', "Farmer's Walk"], howTo: 'Focus on explosive movements and maintain proper form throughout the circuit.' },
  { splitDay: 'Lower', goalType: 'wellness', name: 'Glute & Core Sculpt', description: 'Targeted glute and core workout for strength and shape', repRange: '12-15 reps', duration: '40 min', intensity: 'High', exercises: ['Hip Thrusts', 'Cable Kickbacks', 'Plank Variations', 'Bulgarian Split Squats', 'Hanging Leg Raises'], howTo: 'Engage your core and glutes with each movement for maximum effectiveness.' },
  { splitDay: 'Full Body', goalType: 'athleticism', name: 'Ultimate Conditioning', description: 'High-intensity conditioning for max calorie burn', repRange: '30s work', duration: '35 min', intensity: 'Extreme', exercises: ['Battle Ropes', 'Sled Push', 'Burpee Pull-Ups', 'Rowing Sprints', 'Medicine Ball Slams'], howTo: 'Push yourself to the limit with short, intense bursts of activity.' },
  { splitDay: 'Full Body', goalType: 'strength', name: 'Elite Strength Builder', description: 'Build raw strength with heavy compound lifts', repRange: '5-8 reps', duration: '70 min', intensity: 'Elite', exercises: ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press', 'Barbell Row'], howTo: 'Use heavy weights and focus on form to build maximum strength.' },
  { splitDay: 'Full Body', goalType: 'wellness', name: 'High-Intensity Interval Training', description: 'Burn fat and improve cardiovascular health', repRange: '20s work, 10s rest', duration: '30 min', intensity: 'High', exercises: ['Mountain Climbers', 'Jump Squats', 'High Knees', 'Burpees', 'Plank Jacks'], howTo: 'Alternate between high-intensity exercises and short rest periods for maximum calorie burn.' },
  { splitDay: 'Full Body', goalType: 'wellness', name: 'Flexibility and Mobility', description: 'Improve flexibility and joint mobility', repRange: '30-60s holds', duration: '45 min', intensity: 'Low', exercises: ['Dynamic Stretching', 'Foam Rolling', 'Yoga Poses', 'Joint Mobility', 'Static Stretching'], howTo: 'Focus on deep breathing and gradual stretching to improve flexibility.' },
  { splitDay: 'Full Body', goalType: 'wellness', name: 'Core Crusher', description: 'Strengthen your core with targeted exercises', repRange: '15-20 reps', duration: '40 min', intensity: 'Medium', exercises: ['Plank Variations', 'Russian Twists', 'Leg Raises', 'Cable Crunches', 'Bicycle Crunches'], howTo: 'Engage your core throughout each exercise for maximum effectiveness.' },
  { splitDay: 'Lower', goalType: 'muscle_growth', name: 'Lower Body Strength', description: 'Strengthen your lower body with heavy lifts', repRange: '8-12 reps', duration: '60 min', intensity: 'High', exercises: ['Squats', 'Lunges', 'Leg Press', 'Calf Raises', 'Romanian Deadlifts'], howTo: 'Use heavy weights and focus on form to build lower body strength.' },
  { splitDay: 'Lower', goalType: 'wellness', name: 'Lower Body Bodyweight', description: 'Legs and glutes with no equipment', repRange: '15-20 reps', duration: '35 min', intensity: 'Medium', exercises: ['Squat', 'Lunges', 'Glute Bridge', 'Calf Raise', 'Step-Up', 'Wall Sit'], howTo: 'Use bodyweight and tempo (slow negatives) to increase difficulty.' },
  // Bro split – Chest, Back, Shoulders, Arms, Legs
  { splitDay: 'Chest', goalType: 'muscle_growth', name: 'Chest Bodyweight & Dumbbell', description: 'Chest and triceps with push-ups and dumbbells only', repRange: '8-12 reps', duration: '40 min', intensity: 'Medium', exercises: ['Push-Up', 'Incline Push-Up', 'Dumbbell Press', 'Dumbbell Flyes', 'Tricep Extension'], howTo: 'Wide push-ups for chest; close grip or diamond for triceps emphasis.' },
  { splitDay: 'Chest', goalType: 'strength', name: 'Chest Day Strength', description: 'Heavy bench focus with triceps finishers', repRange: '5-8 reps', duration: '50 min', intensity: 'High', exercises: ['Bench Press', 'Incline Barbell Press', 'Dumbbell Flyes', 'Dips', 'Tricep Pushdown'], howTo: 'Work up to a heavy set on bench; keep shoulders packed and feet planted.' },
  { splitDay: 'Chest', goalType: 'muscle_growth', name: 'Chest Hypertrophy', description: 'Chest volume with incline and fly work', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Incline Dumbbell Press', 'Bench Press', 'Cable Flyes', 'Dumbbell Flyes', 'Close-Grip Bench Press'], howTo: 'Squeeze at the top of flyes; control the stretch on the way down.' },
  { splitDay: 'Back', goalType: 'strength', name: 'Back Dumbbell Only', description: 'Back and biceps with dumbbells and optional pull-up bar', repRange: '8-12 reps', duration: '45 min', intensity: 'Medium', exercises: ['Bent Over Row', 'Single-Arm Row', 'Rear Delt Fly', 'Bicep Curl', 'Pull-Up'], howTo: 'Keep back flat on rows; squeeze at the top of each rep.' },
  { splitDay: 'Back', goalType: 'strength', name: 'Back Day Strength', description: 'Heavy rows and deadlifts for a thick back', repRange: '5-8 reps', duration: '55 min', intensity: 'High', exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Barbell Curl'], howTo: 'Brace your core on deadlifts; pull elbows to your hips on rows.' },
  { splitDay: 'Back', goalType: 'muscle_growth', name: 'Back Hypertrophy', description: 'Width and thickness — lats, traps and biceps', repRange: '8-12 reps', duration: '50 min', intensity: 'Medium', exercises: ['Lat Pulldown', 'Seated Cable Row', 'T-Bar Row', 'Face Pull', 'Bicep Curl', 'Hammer Curl'], howTo: 'Vary grip width on pulldowns; pause at peak contraction on rows.' },
  { splitDay: 'Shoulders', goalType: 'muscle_growth', name: 'Shoulders Bodyweight & Dumbbell', description: 'Delt focus with pike push-ups and dumbbells', repRange: '10-12 reps', duration: '35 min', intensity: 'Medium', exercises: ['Pike Push-Up', 'Shoulder Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly'], howTo: 'Pike push-ups target shoulders; add dumbbells for isolation.' },
  { splitDay: 'Shoulders', goalType: 'strength', name: 'Shoulder Day Strength', description: 'Overhead pressing and heavy delt work', repRange: '6-10 reps', duration: '45 min', intensity: 'High', exercises: ['Overhead Press', 'Arnold Press', 'Lateral Raise', 'Face Pull', 'Upright Row'], howTo: 'Keep ribs down on overhead press; avoid swinging on lateral raises.' },
  { splitDay: 'Shoulders', goalType: 'muscle_growth', name: 'Shoulder Hypertrophy', description: 'All three delt heads for round, full shoulders', repRange: '10-15 reps', duration: '40 min', intensity: 'Medium', exercises: ['Dumbbell Shoulder Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Cable Lateral Raise'], howTo: 'Light weight, strict form on laterals; rear delts balance pressing volume.' },
  { splitDay: 'Arms', goalType: 'muscle_growth', name: 'Arms Dumbbell Only', description: 'Biceps and triceps with dumbbells only', repRange: '10-12 reps', duration: '30 min', intensity: 'Medium', exercises: ['Bicep Curl', 'Hammer Curl', 'Tricep Extension', 'Overhead Tricep Extension', 'Lateral Raise'], howTo: 'Control the negative and squeeze at the top of each curl and extension.' },
  { splitDay: 'Arms', goalType: 'strength', name: 'Arms Bodyweight & Dumbbell', description: 'Arms with push-ups, dips and dumbbell curls', repRange: '8-12 reps', duration: '35 min', intensity: 'Medium', exercises: ['Diamond Push-Up', 'Tricep Extension', 'Bicep Curl', 'Hammer Curl', 'Close-Grip Push-Up'], howTo: 'Diamond and close-grip push-ups hit triceps; finish with curls.' },
];
