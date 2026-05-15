/**
 * Comprehensive Exercise Library
 * Contains instructions and target muscles for common exercises.
 * Optional per-exercise fields: gifUrl (string), videoUrl (string) for how-to media.
 * If not set, the app can fetch a GIF from the ExerciseDB API via fetchExerciseGifUrl().
 */

export const exerciseLibrary = {
  // Upper Body - Chest
  'bench-press': {
    name: 'Bench Press',
    targetMuscles: 'Chest, Shoulders, Triceps',
    instructions: [
      'Lie on bench with feet flat on floor',
      'Grip bar slightly wider than shoulder-width',
      'Lower bar to chest with control',
      'Press bar up until arms are fully extended',
      'Keep core tight and back flat throughout'
    ]
  },
  'push-up': {
    name: 'Push-Up',
    targetMuscles: 'Chest, Shoulders, Triceps, Core',
    instructions: [
      'Start in plank position with hands under shoulders',
      'Lower body until chest nearly touches floor',
      'Push back up to starting position',
      'Keep body straight throughout movement'
    ]
  },
  'incline-bench-press': {
    name: 'Incline Bench Press',
    targetMuscles: 'Upper Chest, Shoulders, Triceps',
    instructions: [
      'Set bench to 30-45 degree incline',
      'Lie back with feet flat on floor',
      'Lower bar to upper chest',
      'Press up until arms are fully extended'
    ]
  },
  'chest-fly': {
    name: 'Chest Fly',
    targetMuscles: 'Chest, Shoulders',
    instructions: [
      'Lie on bench holding dumbbells above chest',
      'Lower weights in wide arc until chest stretch',
      'Bring weights together above chest',
      'Keep slight bend in elbows throughout'
    ]
  },
  'dumbbell-press': {
    name: 'Dumbbell Press',
    targetMuscles: 'Chest, Shoulders, Triceps',
    instructions: [
      'Lie on bench with dumbbells at chest level',
      'Press weights up until arms are straight',
      'Lower with control to starting position',
      'Keep wrists straight and core engaged'
    ]
  },
  'dip': {
    name: 'Dip',
    targetMuscles: 'Chest, Triceps, Shoulders',
    instructions: [
      'Grip parallel bars with arms straight',
      'Lower body until shoulders are below elbows',
      'Press back up to starting position',
      'Keep core tight and avoid swinging'
    ]
  },

  // Upper Body - Back
  'pull-up': {
    name: 'Pull-Up',
    targetMuscles: 'Lats, Biceps, Upper Back',
    instructions: [
      'Hang from bar with palms facing away',
      'Pull body up until chin clears bar',
      'Lower with control to full arm extension',
      'Keep core engaged and avoid swinging'
    ]
  },
  'bent-over-row': {
    name: 'Bent Over Row',
    targetMuscles: 'Lats, Rhomboids, Biceps',
    instructions: [
      'Stand with feet hip-width apart, slight knee bend',
      'Bend forward at hips, keep back straight',
      'Pull weight to lower chest/upper abdomen',
      'Squeeze shoulder blades together at top',
      'Lower weight with control'
    ]
  },
  'lat-pulldown': {
    name: 'Lat Pulldown',
    targetMuscles: 'Lats, Biceps, Upper Back',
    instructions: [
      'Sit with thighs secured under pads',
      'Grip bar wider than shoulder-width',
      'Pull bar to upper chest',
      'Squeeze lats at bottom position',
      'Return to starting position with control'
    ]
  },
  'deadlift': {
    name: 'Deadlift',
    targetMuscles: 'Glutes, Hamstrings, Lower Back, Traps',
    instructions: [
      'Stand with feet hip-width apart, bar over mid-foot',
      'Bend at hips and knees to grip bar',
      'Keep back straight and chest up',
      'Drive through heels to stand upright',
      'Lower bar by pushing hips back',
      'Keep bar close to body throughout movement'
    ]
  },

  // Upper Body - Shoulders
  'shoulder-press': {
    name: 'Shoulder Press',
    targetMuscles: 'Shoulders, Triceps, Upper Chest',
    instructions: [
      'Stand or sit with feet flat on floor',
      'Hold weights at shoulder height',
      'Press weights overhead until arms extended',
      'Lower weights back to shoulder height',
      'Keep core tight throughout'
    ]
  },
  'lateral-raise': {
    name: 'Lateral Raise',
    targetMuscles: 'Shoulders',
    instructions: [
      'Stand holding weights at sides',
      'Raise arms to sides until parallel to floor',
      'Lower with control to starting position',
      'Keep slight bend in elbows',
      'Avoid swinging or using momentum'
    ]
  },
  'front-raise': {
    name: 'Front Raise',
    targetMuscles: 'Front Shoulders, Upper Chest',
    instructions: [
      'Stand holding weight in front of thighs',
      'Raise weight forward until arm is parallel to floor',
      'Lower with control to starting position',
      'Keep core engaged and back straight'
    ]
  },
  'rear-delt-fly': {
    name: 'Rear Delt Fly',
    targetMuscles: 'Rear Shoulders, Upper Back',
    instructions: [
      'Bend forward with slight knee bend',
      'Hold weights with arms hanging down',
      'Raise arms wide to sides until parallel to floor',
      'Squeeze rear delts at top',
      'Lower with control'
    ]
  },

  // Upper Body - Arms
  'bicep-curl': {
    name: 'Bicep Curl',
    targetMuscles: 'Biceps, Forearms',
    instructions: [
      'Stand holding weights with arms at sides',
      'Curl weights up toward shoulders',
      'Squeeze biceps at top position',
      'Lower weights with control',
      'Keep elbows stationary'
    ]
  },
  'tricep-extension': {
    name: 'Tricep Extension',
    targetMuscles: 'Triceps',
    instructions: [
      'Stand or sit holding weight overhead',
      'Lower weight behind head by bending elbows',
      'Extend arms to return to starting position',
      'Keep upper arms stationary',
      'Focus on tricep contraction'
    ]
  },
  'hammer-curl': {
    name: 'Hammer Curl',
    targetMuscles: 'Biceps, Brachialis, Forearms',
    instructions: [
      'Hold weights with neutral grip (palms facing in)',
      'Curl weights up keeping grip neutral',
      'Squeeze at top of movement',
      'Lower with control',
      'Keep elbows stationary'
    ]
  },

  // Lower Body - Quads
  'squat': {
    name: 'Squat',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Stand with feet shoulder-width apart',
      'Lower hips back and down as if sitting in chair',
      'Keep chest up and knees behind toes',
      'Descend until thighs are parallel to floor',
      'Drive through heels to return to standing'
    ]
  },
  'leg-press': {
    name: 'Leg Press',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Sit on machine with feet on platform',
      'Lower weight until knees form 90-degree angle',
      'Press platform away by extending legs',
      'Keep back flat against pad',
      'Don\'t lock knees at top'
    ]
  },
  'lunges': {
    name: 'Lunge',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Stand tall with feet hip-width apart',
      'Step forward with one leg, lowering hips',
      'Both knees should be bent at 90 degrees',
      'Push back to starting position with front heel',
      'Alternate legs for each rep'
    ]
  },
  'leg-extension': {
    name: 'Leg Extension',
    targetMuscles: 'Quads',
    instructions: [
      'Sit on machine with shins against pad',
      'Extend legs to lift weight',
      'Squeeze quads at top position',
      'Lower weight with control',
      'Keep back against seat'
    ]
  },

  // Lower Body - Glutes & Hamstrings
  'hip-thrust': {
    name: 'Hip Thrust',
    targetMuscles: 'Glutes, Hamstrings',
    instructions: [
      'Sit with upper back against bench',
      'Place feet flat on floor, knees bent',
      'Lower hips toward floor',
      'Drive through heels to raise hips',
      'Squeeze glutes at top',
      'Keep core engaged throughout'
    ]
  },
  'romanian-deadlift': {
    name: 'Romanian Deadlift',
    targetMuscles: 'Hamstrings, Glutes, Lower Back',
    instructions: [
      'Stand holding weights with knees slightly bent',
      'Hinge at hips, lowering weights down front of legs',
      'Feel stretch in hamstrings',
      'Drive hips forward to return to standing',
      'Keep back straight throughout'
    ]
  },
  'leg-curl': {
    name: 'Leg Curl',
    targetMuscles: 'Hamstrings',
    instructions: [
      'Lie face down on machine with ankles under pad',
      'Curl legs toward glutes',
      'Squeeze hamstrings at top',
      'Lower weight with control',
      'Keep hips pressed against pad'
    ]
  },

  // Core
  'plank': {
    name: 'Plank',
    targetMuscles: 'Core, Shoulders',
    instructions: [
      'Start in forearm plank position',
      'Keep body in straight line from head to heels',
      'Engage core and glutes',
      'Hold position for desired time',
      'Don\'t let hips sag or raise'
    ]
  },
  'sit-up': {
    name: 'Sit-Up',
    targetMuscles: 'Abdominals',
    instructions: [
      'Lie on back with knees bent, feet flat',
      'Cross arms over chest or place hands behind head',
      'Lift torso toward knees',
      'Lower back down with control',
      'Keep lower back on floor at start'
    ]
  },
  'crunch': {
    name: 'Crunch',
    targetMuscles: 'Abdominals',
    instructions: [
      'Lie on back with knees bent, feet flat',
      'Place hands behind head or across chest',
      'Lift shoulders off floor, engaging abs',
      'Lower back down with control',
      'Focus on contracting abs, not pulling neck'
    ]
  },
  'russian-twist': {
    name: 'Russian Twist',
    targetMuscles: 'Obliques, Core',
    instructions: [
      'Sit with knees bent, lean back slightly',
      'Hold weight at chest level',
      'Rotate torso side to side',
      'Keep core engaged throughout',
      'Control the rotation speed'
    ]
  },
  'mountain-climber': {
    name: 'Mountain Climber',
    targetMuscles: 'Core, Shoulders, Quads',
    instructions: [
      'Start in high plank position',
      'Drive one knee toward chest',
      'Switch legs quickly, alternating knees',
      'Keep core tight and back flat',
      'Maintain steady breathing'
    ]
  },
  'burpee': {
    name: 'Burpee',
    targetMuscles: 'Full Body - Glutes, Quads, Hamstrings, Core, Calves, Chest, Shoulders, Triceps',
    instructions: [
      'Stand with feet shoulder-width apart',
      'Drop into squat, placing hands on floor',
      'Jump feet back into plank position',
      'Do a push-up (optional)',
      'Jump feet forward to squat position',
      'Explosively jump into air, reaching arms overhead',
      'Land softly and repeat'
    ]
  },

  // Cardio
  'jumping-jack': {
    name: 'Jumping Jack',
    targetMuscles: 'Full Body, Calves, Shoulders, Glutes',
    instructions: [
      'Stand upright with feet together, arms at sides',
      'Jump feet out to sides while raising arms overhead',
      'Jump back to starting position',
      'Repeat quickly for desired reps or time',
      'Maintain steady rhythm'
    ]
  },
  'high-knee': {
    name: 'High Knee',
    targetMuscles: 'Hip Flexors, Quads, Calves',
    instructions: [
      'Stand tall with feet hip-width apart',
      'Run in place, bringing knees toward chest',
      'Pump arms naturally as if running',
      'Lift knees as high as comfortable',
      'Keep core engaged and land softly'
    ]
  },
  'box-jump': {
    name: 'Box Jump',
    targetMuscles: 'Legs, Glutes, Core, Calves',
    instructions: [
      'Stand facing a sturdy box or platform',
      'Feet shoulder-width apart, arms at sides',
      'Slight bend in knees, then explosively jump up',
      'Land softly with both feet on top of box',
      'Step or jump down carefully',
      'Keep knees aligned and core engaged'
    ]
  },
  'bear-crawl': {
    name: 'Bear Crawl',
    targetMuscles: 'Core, Shoulders, Quads, Glutes',
    instructions: [
      'Start on hands and feet, knees slightly bent',
      'Keep back flat and core tight',
      'Crawl forward by moving opposite hand and foot',
      'Keep knees close to ground but not touching',
      'Maintain steady pace and control',
      'Reverse direction or continue forward'
    ]
  },

  // Bodyweight & dumbbell (minimal equipment)
  'pike-push-up': {
    name: 'Pike Push-Up',
    targetMuscles: 'Shoulders, Triceps, Upper Chest',
    instructions: [
      'Start in downward dog: hands and feet on floor, hips high',
      'Lower the top of your head toward the floor between your hands',
      'Push back up to the starting position',
      'Keep core tight and avoid sagging in the lower back',
      'Feet can be on floor or elevated for more difficulty'
    ]
  },
  'goblet-squat': {
    name: 'Goblet Squat',
    targetMuscles: 'Quads, Glutes, Core',
    instructions: [
      'Hold one dumbbell vertically at chest level (cupped in both hands)',
      'Stand with feet shoulder-width or slightly wider',
      'Lower into a squat, keeping chest up and elbows inside knees',
      'Drive through heels to stand back up',
      'Keep the weight close to your body throughout'
    ]
  },
  'diamond-push-up': {
    name: 'Diamond Push-Up',
    targetMuscles: 'Triceps, Chest, Shoulders',
    instructions: [
      'Start in plank with hands together under chest, thumbs and index fingers forming a diamond',
      'Lower your chest toward your hands, keeping elbows close to body',
      'Push back up to full arm extension',
      'Keep body in a straight line throughout'
    ]
  },
  'glute-bridge': {
    name: 'Glute Bridge',
    targetMuscles: 'Glutes, Hamstrings, Core',
    instructions: [
      'Lie on your back with knees bent, feet flat on floor',
      'Drive through heels and squeeze glutes to lift hips until body is straight from shoulders to knees',
      'Hold briefly at the top, then lower with control',
      'Keep core engaged and avoid arching the lower back excessively'
    ]
  },
  'bulgarian-split-squat': {
    name: 'Bulgarian Split Squat',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Stand facing away from a bench or step; place top of one foot on it',
      'Front foot is forward, knee over ankle',
      'Lower your back knee toward the floor by bending the front leg',
      'Drive through the front heel to stand back up',
      'Keep torso upright and core braced'
    ]
  },
  'single-arm-row': {
    name: 'Single-Arm Row',
    targetMuscles: 'Lats, Rhomboids, Biceps',
    instructions: [
      'Place one hand and same knee on a bench; hold a dumbbell in the other hand',
      'Pull the dumbbell to your hip, leading with the elbow',
      'Squeeze your shoulder blade at the top',
      'Lower with control and repeat; then switch sides'
    ]
  },
  'incline-push-up': {
    name: 'Incline Push-Up',
    targetMuscles: 'Lower Chest, Shoulders, Triceps',
    instructions: [
      'Place hands on a bench, box, or step; body at an angle, feet on the floor',
      'Lower your chest toward the surface',
      'Push back up to full arm extension',
      'Easier than floor push-ups; lower the surface for more difficulty'
    ]
  },
  'close-grip-push-up': {
    name: 'Close-Grip Push-Up',
    targetMuscles: 'Triceps, Chest, Shoulders',
    instructions: [
      'Start in plank with hands directly under or slightly inside shoulders',
      'Lower your chest toward the floor, keeping elbows close to your body',
      'Push back up to full extension',
      'Keep body in a straight line throughout'
    ]
  },
  'step-up': {
    name: 'Step-Up',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Stand facing a sturdy step or bench',
      'Step one foot onto the platform and drive through that heel to stand up',
      'Bring the other foot up to meet it, or tap and step down',
      'Alternate legs or complete all reps on one leg first',
      'Optional: hold dumbbells for extra resistance'
    ]
  },
  'wall-sit': {
    name: 'Wall Sit',
    targetMuscles: 'Quads, Glutes',
    instructions: [
      'Lean your back against a wall and slide down until knees are at 90 degrees',
      'Feet should be shoulder-width apart and flat on the floor',
      'Hold the position for the desired time',
      'Keep back flat against the wall and core engaged'
    ]
  },
  'overhead-tricep-extension': {
    name: 'Overhead Tricep Extension',
    targetMuscles: 'Triceps',
    instructions: [
      'Stand or sit holding one dumbbell with both hands behind your head',
      'Lower the weight by bending elbows, then extend arms to raise it',
      'Keep upper arms still and close to your head',
      'Control the movement throughout'
    ]
  },
};

/**
 * Fallback search terms for ExerciseDB GIF lookup, keyed by exact exercise name as used in the app.
 * Use when the first search (by display name) returns no gifUrl—try these strings in order.
 * Keys match exercise names from exerciseLibrary and from workout template exercises arrays.
 */
export const exerciseGifSearchFallbacks = {
  'Arnold Press': ['Arnold Press', 'Arnold Dumbbell Press', 'Alternating Arnold Press', 'Shoulder Press'],
  'Back Squat': ['Barbell Back Squat', 'Squat', 'Back Squat'],
  'Barbell Row': ['Bent Over Barbell Row', 'Barbell Row', 'Pendlay Row', 'Bent Over Row'],
  'Battle Ropes': ['Battle Ropes', 'Rope Wave', 'Battling Ropes'],
  'Bench Press': ['Bench Press', 'Barbell Bench Press', 'Flat Bench Press'],
  'Bent Over Row': ['Bent Over Row', 'Barbell Row', 'Bent-Over Row', 'Bent Over Barbell Row'],
  'Bicycle Crunches': ['Bicycle Crunch', 'Bicycle Kick', 'Air Bicycle'],
  'Bicep Curl': ['Bicep Curl', 'Biceps Curl', 'Dumbbell Bicep Curl', 'Bicep Curls'],
  'Box Jump': ['Box Jump', 'Box Jumps', 'Box Step Jump'],
  'Box Jumps': ['Box Jump', 'Box Jumps', 'Box Step Jump'],
  'Bulgarian Split Squat': ['Bulgarian Split Squat', 'Bulgarian Lunge', 'Rear Foot Elevated Split Squat'],
  'Bulgarian Split Squats': ['Bulgarian Split Squat', 'Bulgarian Lunge', 'Rear Foot Elevated Split Squat'],
  'Burpee': ['Burpee', 'Burpees'],
  'Burpees': ['Burpee', 'Burpees'],
  'Burpee Pull-Ups': ['Burpee Pull-Up', 'Burpee Pull Up', 'Burpee', 'Pull-Up'],
  'Bear Crawl': ['Bear Crawl', 'Bear Walk', 'Bear Crawls'],
  'Cable Crunches': ['Cable Crunch', 'Kneeling Cable Crunch', 'Cable Ab Crunch'],
  'Cable Kickbacks': ['Cable Kickback', 'Cable Hip Extension', 'Kickback', 'Glute Kickback'],
  'Calf Raise': ['Calf Raise', 'Standing Calf Raise', 'Calf Raises'],
  'Calf Raises': ['Calf Raise', 'Standing Calf Raise', 'Seated Calf Raise'],
  'Chest Fly': ['Chest Fly', 'Dumbbell Fly', 'Pec Fly', 'Cable Fly'],
  'Chin-Ups': ['Chin-Up', 'Chin Up', 'Chin Ups', 'Underhand Pull-Up'],
  'Close-Grip Bench Press': ['Close Grip Bench Press', 'Close Grip Press', 'Narrow Grip Bench Press', 'Tricep Bench Press'],
  'Close-Grip Push-Up': ['Close Grip Push-Up', 'Close Grip Push Up', 'Narrow Push-Up', 'Tricep Push-Up'],
  'Crunch': ['Crunch', 'Ab Crunch', 'Crunches'],
  'Deadlift': ['Deadlift', 'Barbell Deadlift', 'Conventional Deadlift'],
  'Diamond Push-Up': ['Diamond Push-Up', 'Diamond Push Up', 'Close Hand Push-Up', 'Tricep Push-Up'],
  'Dip': ['Dip', 'Dips', 'Bench Dip', 'Tricep Dip'],
  'Dips': ['Dip', 'Dips', 'Bench Dip', 'Tricep Dip', 'Chest Dip'],
  'Dynamic Stretching': ['Dynamic Stretch', 'Dynamic Stretching', 'Leg Swing', 'Walking Lunge Stretch'],
  'Dumbbell Flyes': ['Dumbbell Fly', 'Dumbbell Chest Fly', 'Chest Fly', 'Pec Fly'],
  'Dumbbell Press': ['Dumbbell Press', 'Dumbbell Bench Press', 'Dumbbell Chest Press'],
  'Dumbbell Row': ['Dumbbell Row', 'Single Arm Row', 'One Arm Row', 'Bent Over Dumbbell Row'],
  'Dumbbell Shoulder Press': ['Dumbbell Shoulder Press', 'Overhead Press', 'Dumbbell Press', 'Shoulder Press'],
  'Face Pull': ['Cable Face Pull', 'Face Pull', 'Face Pulls', 'Rope Face Pull'],
  "Farmer's Walk": ['Farmer Walk', 'Farmers Walk', 'Farmer Carry', 'Trap Bar Carry'],
  'Foam Rolling': ['Foam Roll', 'Foam Rolling', 'Self Myofascial Release', 'Rolling'],
  'Front Raise': ['Front Raise', 'Front Dumbbell Raise', 'Front Deltoid Raise'],
  'Glute Bridge': ['Glute Bridge', 'Hip Bridge', 'Bridging', 'Glute Bridges'],
  'Goblet Squat': ['Goblet Squat', 'Goblet Squats', 'Dumbbell Goblet Squat'],
  'Hammer Curl': ['Hammer Curl', 'Hammer Curls', 'Neutral Grip Curl', 'Dumbbell Hammer Curl'],
  'Hanging Leg Raises': ['Hanging Leg Raise', 'Leg Raise', 'Hanging Knee Raise', 'Captain Chair'],
  'High Knee': ['High Knee', 'High Knees', 'Running High Knees', 'High Knee Run'],
  'High Knees': ['High Knee', 'High Knees', 'Running High Knees'],
  'Hip Thrust': ['Hip Thrust', 'Hip Thrusts', 'Barbell Hip Thrust', 'Glute Bridge'],
  'Hip Thrusts': ['Hip Thrust', 'Hip Thrusts', 'Barbell Hip Thrust', 'Glute Bridge'],
  'Incline Barbell Press': ['Incline Barbell Press', 'Incline Bench Press', 'Incline Press'],
  'Incline Bench Press': ['Incline Bench Press', 'Incline Barbell Press', 'Incline Press'],
  'Incline Dumbbell Press': ['Incline Dumbbell Press', 'Incline Press', 'Dumbbell Incline Press'],
  'Incline Push-Up': ['Incline Push-Up', 'Incline Push Up', 'Elevated Push-Up'],
  'Joint Mobility': ['Joint Mobility', 'Mobility', 'Joint Circles', 'Wrist Ankle Mobility'],
  'Jump Squats': ['Jump Squat', 'Jump Squats', 'Squat Jump', 'Box Jump'],
  'Jumping Jack': ['Jumping Jack', 'Jumping Jacks', 'Star Jump'],
  'Lat Pulldown': ['Lat Pulldown', 'Lat Pull Down', 'Cable Lat Pulldown', 'Wide Grip Pulldown'],
  'Leg Curl': ['Leg Curl', 'Lying Leg Curl', 'Hamstring Curl', 'Leg Curls'],
  'Leg Extension': ['Leg Extension', 'Leg Extensions', 'Knee Extension', 'Quad Extension'],
  'Leg Press': ['Leg Press', 'Leg Press Machine', 'Seated Leg Press'],
  'Leg Raises': ['Leg Raise', 'Leg Raises', 'Lying Leg Raise', 'Hanging Leg Raise'],
  'Lateral Raise': ['Lateral Raise', 'Side Raise', 'Dumbbell Lateral Raise', 'Lateral Raises'],
  'Lunge': ['Lunge', 'Lunges', 'Walking Lunge', 'Forward Lunge'],
  'Lunges': ['Lunge', 'Lunges', 'Walking Lunge', 'Forward Lunge'],
  'Medicine Ball Slams': ['Medicine Ball Slam', 'Ball Slam', 'Slam Ball', 'MB Slam'],
  'Mountain Climber': ['Mountain Climber', 'Mountain Climbers', 'Running Plank'],
  'Mountain Climbers': ['Mountain Climber', 'Mountain Climbers', 'Running Plank'],
  'Overhead Press': ['Overhead Press', 'OHP', 'Standing Overhead Press', 'Military Press'],
  'Overhead Tricep Extension': ['Overhead Tricep Extension', 'Overhead Tricep Extension Dumbbell', 'French Press', 'Skull Crusher'],
  'Pike Push-Up': ['Pike Push-Up', 'Pike Push Up', 'Decline Push-Up', 'Shoulder Push-Up'],
  'Plank': ['Plank', 'Front Plank', 'Forearm Plank', 'Planks'],
  'Plank Jacks': ['Plank Jack', 'Plank Jacks', 'Plank Jumping Jack'],
  'Plank Variations': ['Plank', 'Side Plank', 'Plank Variation', 'RKC Plank'],
  'Power Cleans': ['Power Clean', 'Power Cleans', 'Clean', 'Olympic Clean'],
  'Preacher Curl': ['Preacher Curl', 'Preacher Curls', 'Scott Curl', 'Bicep Preacher Curl'],
  'Pull-Up': ['Pull-Up', 'Pull Up', 'Pullup', 'Bodyweight Pull-Up'],
  'Pull-Ups': ['Pull-Up', 'Pull Up', 'Pullup', 'Bodyweight Pull-Up'],
  'Push Press': ['Push Press', 'Push Press Barbell', 'Standing Push Press'],
  'Push-Up': ['Push-Up', 'Push Up', 'Push Ups', 'Press Up'],
  'Push-Ups': ['Push-Up', 'Push Up', 'Push Ups', 'Press Up'],
  'Rear Delt Fly': ['Rear Delt Fly', 'Rear Delt Flye', 'Reverse Fly', 'Bent Over Lateral Raise'],
  'Romanian Deadlift': ['Romanian Deadlift', 'RDL', 'Stiff Leg Deadlift', 'Romanian Deadlifts'],
  'Romanian Deadlifts': ['Romanian Deadlift', 'RDL', 'Stiff Leg Deadlift'],
  'Rowing Sprints': ['Rowing', 'Rower', 'Rowing Machine', 'Indoor Rowing'],
  'Russian Twist': ['Russian Twist', 'Russian Twists', 'Seated Twist', 'Twist'],
  'Russian Twists': ['Russian Twist', 'Russian Twists', 'Seated Twist'],
  'Seated Cable Row': ['Seated Cable Row', 'Cable Row', 'Seated Row', 'Low Cable Row'],
  'Shoulder Press': ['Shoulder Press', 'Overhead Press', 'Dumbbell Shoulder Press', 'Military Press'],
  'Single-Arm Row': ['Single Arm Row', 'One Arm Row', 'One Arm Dumbbell Row', 'Dumbbell Row'],
  'Sit-Up': ['Sit-Up', 'Sit Up', 'Sit Ups', 'Situp'],
  'Skull Crushers': ['Skull Crusher', 'Skull Crushers', 'Lying Tricep Extension', 'French Press', 'EZ Bar Skull Crusher'],
  'Sled Push': ['Sled Push', 'Prowler Push', 'Sled Push Sprint'],
  'Squat': ['Squat', 'Squats', 'Barbell Squat', 'Back Squat'],
  'Squats': ['Squat', 'Squats', 'Barbell Squat', 'Back Squat'],
  'Static Stretching': ['Static Stretch', 'Static Stretching', 'Stretch', 'Stretching'],
  'Step-Up': ['Step Up', 'Step-Up', 'Step Ups', 'Bench Step Up'],
  'T-Bar Row': ['T-Bar Row', 'T Bar Row', 'Landmine Row', 'T Bar Row'],
  'Tricep Extension': ['Tricep Extension', 'Tricep Extensions', 'Dumbbell Tricep Extension', 'Overhead Extension'],
  'Tricep Extensions': ['Tricep Extension', 'Tricep Extensions', 'Dumbbell Tricep Extension'],
  'Tricep Pushdown': ['Tricep Pushdown', 'Tricep Push Down', 'Cable Pushdown', 'Pushdown'],
  'Wall Sit': ['Wall Sit', 'Wall Sits', 'Wall Squat'],
  'Yoga Poses': ['Yoga', 'Downward Dog', 'Warrior', 'Yoga Pose'],
};

/**
 * Get exercise info from library by name
 * Handles various name formats (spaces, dashes, lowercase, etc.)
 */
export const getExerciseInfo = (exerciseName) => {
  if (!exerciseName) return null;
  
  // Normalize the exercise name for lookup
  const normalized = exerciseName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, ''); // Remove special characters
  
  return exerciseLibrary[normalized] || null;
};

/**
 * Check if exercise exists in library
 */
export const hasExerciseInfo = (exerciseName) => {
  return getExerciseInfo(exerciseName) !== null;
};

const getFallBackName = async (exerciseName, exerciseGifSearchFallbacks) => {
  const fallBacks = exerciseGifSearchFallbacks[exerciseName];
  if (!Array.isArray(fallBacks) || !fallBacks.length) return null;
  return fallBacks;
};

/**
 * Normalize text so matching works across punctuation/hyphen differences.
 */
function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rank API results so we don't pick unrelated gifs (ex: deadlift for face pull).
 * Higher score = better match to the requested exercise.
 */
function scoreExerciseCandidate(queryName, candidate) {
  const normalizedQuery = normalizeForMatch(queryName);
  const normalizedCandidate = normalizeForMatch(candidate?.name);
  if (!normalizedQuery || !normalizedCandidate) return -1;

  if (normalizedCandidate === normalizedQuery) return 100;

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const candidateTokens = new Set(normalizedCandidate.split(' ').filter(Boolean));
  const matchedTokens = queryTokens.filter((token) => candidateTokens.has(token)).length;
  const tokenScore = queryTokens.length ? (matchedTokens / queryTokens.length) * 70 : 0;

  // Encourage close phrase matches while still allowing mild naming variation.
  const phraseScore =
    normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate) ? 20 : 0;

  return tokenScore + phraseScore;
}

async function fetchBestGifFromQuery(query) {
  const q = encodeURIComponent(query.trim());
  const url = `https://exercisedb.dev/api/v1/exercises/search?q=${q}&limit=12`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  if (!list.length) return null;

  let best = null;
  let bestScore = -1;
  for (const item of list) {
    const score = scoreExerciseCandidate(query, item);
    if (score > bestScore && typeof item?.gifUrl === 'string') {
      best = item;
      bestScore = score;
    }
  }

  // Guardrail: only accept sufficiently close matches.
  if (!best || bestScore < 55) return null;
  return best.gifUrl;
}

/**
 * Fetch a demo GIF URL for an exercise from the free ExerciseDB API.
 * Use this to show "how to" visuals in the workout How To modal.
 * Returns the first matching exercise's gifUrl, or null if not found or on error.
 *
 * You can also add gifUrl or videoUrl directly to entries in exerciseLibrary
 * (optional fields); if present, those are used and this API is not called.
 *
 * @param {string} exerciseName - Display name of the exercise (e.g. "Bench Press")
 * @returns {Promise<string|null>} - GIF URL or null
 */
export async function fetchExerciseGifUrl(exerciseName) {
  if (!exerciseName || typeof exerciseName !== 'string') return null;
  try {
    // First try the exact exercise string with robust ranking.
    const primary = await fetchBestGifFromQuery(exerciseName);
    if (primary) return primary;

    // Then try curated fallbacks in order, stopping at first good match.
    const fallbackNames = await getFallBackName(exerciseName, exerciseGifSearchFallbacks);
    if (Array.isArray(fallbackNames)) {
      for (const fallbackName of fallbackNames) {
        const fallbackGif = await fetchBestGifFromQuery(fallbackName);
        if (fallbackGif) return fallbackGif;
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}