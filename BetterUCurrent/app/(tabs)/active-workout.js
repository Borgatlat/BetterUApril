import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert, ScrollView, AppState, Animated, ActivityIndicator, Platform, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../lib/supabase';
import { useTracking } from '../../context/TrackingContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { useSettings } from '../../context/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import TrainerModal from '../(modals)/trainer-modal';
import Svg, { Circle } from 'react-native-svg';
import { Video } from 'expo-av';
import { getExerciseInfo, hasExerciseInfo, fetchExerciseGifUrl } from '../../utils/exerciseLibrary';
import { generateExerciseInstructions, suggestWeightForExercise } from '../../utils/aiUtils';

// Organized exercise categories for searching and adding exercises
const exerciseCategories = {
  'Chest': [
    'Bench Press', 'Push-Up', 'Incline Bench Press', 'Dumbbell Bench Press', 'Dumbbell Flyes',
    'Cable Flyes', 'Decline Bench Press', 'Incline Push-Up', 'Decline Push-Up', 'Chest Press Machine',
    'Incline Dumbbell Flyes', 'Pec Deck', 'Cable Crossover', 'Dumbbell Pullover', 
    'Diamond Push-Up', 'Wide Grip Push-Up', 'Push-Up Variations'
  ],
  'Back': [
    'Pull-Up', 'Deadlift', 'Barbell Row', 'Lat Pulldown', 'Dumbbell Row', 'Chin-Up',
    'Seated Cable Row', 'Cable Row', 'T-Bar Row', 'Romanian Deadlift', 'Bent Over Row',
    'One Arm Dumbbell Row', 'Wide Grip Pulldown', 'Close Grip Pulldown', 'Face Pull',
    'Cable Pullover', 'Reverse Fly', 'Shrugs', 'Upright Row', 'Cable Lat Pulldown'
  ],
  'Shoulders': [
    'Shoulder Press', 'Lateral Raise', 'Overhead Press', 'Dumbbell Shoulder Press', 'Front Raise',
    'Rear Delt Fly', 'Arnold Press', 'Bent Over Lateral Raise', 'Cable Lateral Raise', 'Upright Row',
    'Push Press', 'Face Pull', 'Rear Delt Machine', 'Cable Shoulder Fly', 
    'Handstand Push-Up', 'Pike Push-Up'
  ],
  'Arms': [
    'Bicep Curl', 'Tricep Dip', 'Hammer Curl', 'Tricep Pushdown', 'Preacher Curl',
    'Concentration Curl', 'Cable Curl', 'Skullcrusher', 'Tricep Kickback', 'Diamond Push-Up',
    'Overhead Tricep Extension', 'Close Grip Bench Press', 'Incline Dumbbell Curl', 'EZ Bar Curl',
    'Spider Curl', 'Cable Tricep Extension', 'Tricep Rope Pushdown', 'Behind Head Extension',
    '21s Bicep Curls', 'Cable Hammer Curl'
  ],
  'Legs': [
    'Squat', 'Deadlift', 'Leg Press', 'Lunge', 'Leg Extension', 'Leg Curl',
    'Romanian Deadlift', 'Front Squat', 'Walking Lunge', 'Calf Raise', 'Reverse Lunge',
    'Bulgarian Split Squat', 'Back Squat', 'Lateral Lunge', 'Goblet Squat', 'Sumo Squat',
    'Stiff Leg Deadlift', 'Standing Calf Raise', 'Seated Calf Raise', 'Jump Squat',
    'Wall Sit', 'Pistol Squat', 'Hack Squat', 'Leg Press Calf Raise', 'Sissy Squat'
  ],
  'Core': [
    'Plank', 'Sit-Up', 'Crunches', 'Russian Twist', 'Leg Raise', 'Mountain Climber',
    'Bicycle Crunch', 'Side Plank', 'Dead Bug', 'Reverse Crunch', 'Cable Crunch',
    'Hanging Leg Raise', 'Ab Wheel Rollout', 'Bird Dog', 'Oblique Crunch', 'Flutter Kicks',
    'Scissor Kicks', 'Hollow Body Hold', 'Plank to Pike', 'Bear Crawl', 'L-Sit', 'V-Up',
    'Dragon Flag', 'Windshield Wipers', 'Cable Wood Chop'
  ],
  'Glutes': [
    'Hip Thrust', 'Glute Bridge', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Reverse Lunge',
    'Donkey Kicks', 'Sumo Deadlift', 'Step-Ups', 'Cable Kickbacks', 'Single Leg Glute Bridge',
    'Fire Hydrants', 'Hip Abduction', 'Kettlebell Swings', 'Clamshells', 'Lateral Band Walk',
    'Glute Press', 'Kickbacks'
  ],
  'Cardio': [
    'Burpees', 'Jump Rope', 'Jumping Jacks', 'High Knees', 'Sprint', 'Mountain Climbers',
    'Jump Squat', 'Box Jump', 'Bear Crawls', 'Jump Lunges', 'Rowing Machine',
    'Battle Ropes', 'Kettlebell Swings', 'Squat Jumps', 'Star Jumps', 'Burpee Box Jump',
    'Tabata', 'Assault Bike', 'Skipping', 'Tuck Jumps'
  ]
};

// Live Activities - shows workout progress on lock screen and Dynamic Island
import {
  startWorkoutLiveActivity,
  updateWorkoutLiveActivity,
  endWorkoutLiveActivity,
  dismissLiveActivity,
} from '../../utils/liveActivities';

const workoutData = {
  'Full Body Workout': {
    name: 'Full Body Workout',
    exercises: [
      {
        name: 'Squats',
        targetMuscles: 'Quads, Glutes, Core',
        instructions: [
          'Stand with feet shoulder-width apart, toes slightly turned out',
          'Keep chest up and core tight as you lower down',
          'Push through heels to return to starting position',
          'Keep knees in line with toes throughout movement'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Bench Press',
        targetMuscles: 'Chest, Shoulders, Triceps',
        instructions: [
          'Lie flat on bench with feet planted on ground',
          'Grip bar slightly wider than shoulder width',
          'Lower bar to mid-chest with control',
          'Press bar up to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Deadlifts',
        targetMuscles: 'Back, Hamstrings, Core',
        instructions: [
          'Stand with feet hip-width apart, bar over mid-foot',
          'Bend at hips and knees to grip bar',
          'Keep back straight as you lift bar by extending hips',
          'Lower bar with control, maintaining form'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Pull-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Grip bar slightly wider than shoulder width',
          'Hang with arms fully extended',
          'Pull body up until chin clears bar',
          'Lower with control to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Shoulder Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Hold weights at shoulder height',
          'Press weights overhead until arms are straight',
          'Lower weights with control to starting position',
          'Keep core tight throughout movement'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
    ],
  },
  'Push Day': {
    name: 'Push Day',
    exercises: [
      {
        name: 'Bench Press',
        targetMuscles: 'Chest, Shoulders, Triceps',
        instructions: [
          'Lie flat on bench with feet planted on ground',
          'Grip bar slightly wider than shoulder width',
          'Lower bar to mid-chest with control',
          'Press bar up to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Overhead Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Hold weights at shoulder height',
          'Press weights overhead until arms are straight',
          'Lower weights with control to starting position',
          'Keep core tight throughout movement'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Incline Dumbbell Press',
        targetMuscles: 'Upper Chest, Shoulders',
        instructions: [
          'Set bench to 30-45 degree angle',
          'Hold dumbbells at shoulder level',
          'Press dumbbells up and together',
          'Lower with control to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Lateral Raises',
        targetMuscles: 'Shoulders',
        instructions: [
          'Stand with dumbbells at sides',
          'Raise arms to shoulder height',
          'Keep slight bend in elbows',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Tricep Pushdowns',
        targetMuscles: 'Triceps',
        instructions: [
          'Stand facing cable machine',
          'Keep elbows at sides',
          'Push bar down until arms are straight',
          'Return to starting position with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
    ],
  },
  'Pull Day': {
    name: 'Pull Day',
    exercises: [
      {
        name: 'Deadlifts',
        targetMuscles: 'Back, Hamstrings, Core',
        instructions: [
          'Stand with feet hip-width apart, bar over mid-foot',
          'Bend at hips and knees to grip bar',
          'Keep back straight as you lift bar by extending hips',
          'Lower bar with control, maintaining form'
        ],
        sets: [
          { weight: '', reps: '6-8', completed: false },
          { weight: '', reps: '6-8', completed: false },
          { weight: '', reps: '6-8', completed: false },
        ],
      },
      {
        name: 'Pull-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Grip bar slightly wider than shoulder width',
          'Hang with arms fully extended',
          'Pull body up until chin clears bar',
          'Lower with control to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Barbell Rows',
        targetMuscles: 'Back, Lats, Rear Delts, Biceps',
        instructions: [
          'Stand with feet hip-width apart, grip barbell with overhand grip',
          'Hinge at hips, keep back straight and chest up',
          'Pull barbell to lower chest, squeezing shoulder blades',
          'Lower bar with control, keeping core tight',
          'Repeat for reps'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Face Pulls',
        targetMuscles: 'Rear Delts, Upper Back',
        instructions: [
          'Set cable at face height',
          'Pull rope towards face',
          'Squeeze shoulder blades together',
          'Return with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Bicep Curls',
        targetMuscles: 'Biceps',
        instructions: [
          'Stand with dumbbells at sides',
          'Curl weights up to shoulders',
          'Keep elbows at sides',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
    ],
  },
  'Leg Day': {
    name: 'Leg Day',
    exercises: [
      {
        name: 'Squats',
        targetMuscles: 'Quads, Glutes, Core',
        instructions: [
          'Stand with feet shoulder-width apart, toes slightly turned out',
          'Keep chest up and core tight as you lower down',
          'Push through heels to return to starting position',
          'Keep knees in line with toes throughout movement'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Romanian Deadlifts',
        targetMuscles: 'Hamstrings, Glutes',
        instructions: [
          'Stand with feet hip-width apart',
          'Hinge at hips, keeping back straight',
          'Lower bar along legs',
          'Return to standing by extending hips'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Leg Press',
        targetMuscles: 'Quads, Hamstrings, Glutes',
        instructions: [
          'Place feet shoulder-width apart on platform',
          'Lower weight with control',
          'Push through heels to extend legs',
          'Keep back flat against pad'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
        ],
      },
      {
        name: 'Leg Curls',
        targetMuscles: 'Hamstrings',
        instructions: [
          'Lie face down on machine',
          'Curl legs up to glutes',
          'Squeeze hamstrings at top',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Calf Raises',
        targetMuscles: 'Calves',
        instructions: [
          'Stand on edge of step or platform',
          'Raise heels as high as possible',
          'Lower heels below step level',
          'Repeat with control'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
    ],
  },
  'Upper Body 1': {
    name: 'Upper Body 1',
    exercises: [
      {
        name: 'Bench Press',
        targetMuscles: 'Chest, Shoulders, Triceps',
        instructions: [
          'Lie flat on bench with feet planted on ground',
          'Grip bar slightly wider than shoulder width',
          'Lower bar to mid-chest with control',
          'Press bar up to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Military Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Stand with feet shoulder-width apart',
          'Hold barbell at shoulder height',
          'Press bar overhead until arms are straight',
          'Lower with control to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Incline Dumbbell Press',
        targetMuscles: 'Upper Chest, Shoulders',
        instructions: [
          'Set bench to 30-45 degree angle',
          'Hold dumbbells at shoulder level',
          'Press dumbbells up and together',
          'Lower with control to starting position'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Lateral Raises',
        targetMuscles: 'Shoulders',
        instructions: [
          'Stand with dumbbells at sides',
          'Raise arms to shoulder height',
          'Keep slight bend in elbows',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Tricep Pushdowns',
        targetMuscles: 'Triceps',
        instructions: [
          'Stand facing cable machine',
          'Keep elbows at sides',
          'Push bar down until arms are straight',
          'Return to starting position with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
    ],
  },
  'Lower Body 1': {
    name: 'Lower Body 1',
    exercises: [
      {
        name: 'Back Squats',
        targetMuscles: 'Quads, Glutes, Core',
        instructions: [
          'Stand with feet shoulder-width apart',
          'Bar across upper back',
          'Keep chest up as you squat down',
          'Drive through heels to stand'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Leg Press',
        targetMuscles: 'Quads, Hamstrings, Glutes',
        instructions: [
          'Place feet shoulder-width on platform',
          'Lower weight with control',
          'Push through heels to extend legs',
          'Keep back flat against pad'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
        ],
      },
      {
        name: 'Bulgarian Split Squats',
        targetMuscles: 'Quads, Glutes, Balance',
        instructions: [
          'Back foot elevated on bench',
          'Front foot forward',
          'Lower until back knee nearly touches ground',
          'Push through front heel to stand'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
        ],
      },
      {
        name: 'Leg Extensions',
        targetMuscles: 'Quads',
        instructions: [
          'Sit in machine with back against pad',
          'Hook feet under pad',
          'Extend legs fully',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Calf Raises',
        targetMuscles: 'Calves',
        instructions: [
          'Stand on edge of step',
          'Lower heels below platform',
          'Rise up onto toes',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
    ],
  },
  'Upper Body 2': {
    name: 'Upper Body 2',
    exercises: [
      {
        name: 'Deadlifts',
        targetMuscles: 'Back, Hamstrings, Core',
        instructions: [
          'Stand with feet hip-width apart',
          'Bend at hips and knees to grip bar',
          'Keep back straight as you lift',
          'Lower bar with control'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Pull-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Grip bar slightly wider than shoulders',
          'Hang with arms extended',
          'Pull up until chin over bar',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Barbell Rows',
        targetMuscles: 'Back, Lats, Rear Delts, Biceps',
        instructions: [
          'Stand with feet hip-width apart, grip barbell with overhand grip',
          'Hinge at hips, keep back straight and chest up',
          'Pull barbell to lower chest, squeezing shoulder blades',
          'Lower bar with control, keeping core tight',
          'Repeat for reps'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Face Pulls',
        targetMuscles: 'Rear Delts, Upper Back',
        instructions: [
          'Set cable at face height',
          'Pull rope to face, elbows high',
          'Squeeze shoulder blades',
          'Return with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Bicep Curls',
        targetMuscles: 'Biceps',
        instructions: [
          'Stand with dumbbells at sides',
          'Curl weights to shoulders',
          'Keep elbows at sides',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
    ],
  },
  'Lower Body 2': {
    name: 'Lower Body 2',
    exercises: [
      {
        name: 'Romanian Deadlifts',
        targetMuscles: 'Hamstrings, Lower Back',
        instructions: [
          'Stand with feet hip-width',
          'Soft bend in knees',
          'Hinge at hips, bar close to legs',
          'Feel stretch in hamstrings'
        ],
        sets: [
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
          { weight: '', reps: '8-12', completed: false },
        ],
      },
      {
        name: 'Hip Thrusts',
        targetMuscles: 'Glutes, Hamstrings',
        instructions: [
          'Upper back on bench',
          'Bar across hips',
          'Drive hips up to full extension',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
        ],
      },
      {
        name: 'Leg Curls',
        targetMuscles: 'Hamstrings',
        instructions: [
          'Lie face down on machine',
          'Hook ankles under pad',
          'Curl legs toward glutes',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
        ],
      },
      {
        name: 'Glute Bridges',
        targetMuscles: 'Glutes, Lower Back',
        instructions: [
          'Lie on back, knees bent',
          'Feet flat on ground',
          'Drive hips up to ceiling',
          'Squeeze glutes at top'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
      {
        name: 'Calf Raises',
        targetMuscles: 'Calves',
        instructions: [
          'Stand on edge of step',
          'Lower heels below platform',
          'Rise up onto toes',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
    ],
  },
  'Strength Day 1': {
    name: 'Strength Day 1',
    exercises: [
      {
        name: 'Squats',
        targetMuscles: 'Quads, Glutes, Core',
        instructions: [
          'Bar across upper back',
          'Feet shoulder-width apart',
          'Break at hips and knees',
          'Drive through heels'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Bench Press',
        targetMuscles: 'Chest, Shoulders, Triceps',
        instructions: [
          'Arch back slightly',
          'Grip bar just outside shoulders',
          'Lower to mid-chest',
          'Press with explosive power'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Overhead Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Grip just outside shoulders',
          'Brace core tight',
          'Press bar overhead',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Barbell Rows',
        targetMuscles: 'Back, Lats, Rear Delts, Biceps',
        instructions: [
          'Stand with feet hip-width apart, grip barbell with overhand grip',
          'Hinge at hips, keep back straight and chest up',
          'Pull barbell to lower chest, squeezing shoulder blades',
          'Lower bar with control, keeping core tight',
          'Repeat for reps'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Weighted Dips',
        targetMuscles: 'Chest, Triceps',
        instructions: [
          'Add weight via belt/vest',
          'Lower until shoulders stretched',
          'Press back to straight arms',
          'Keep core tight'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
    ],
  },
  'Strength Day 2': {
    name: 'Strength Day 2',
    exercises: [
      {
        name: 'Deadlifts',
        targetMuscles: 'Back, Hamstrings, Core',
        instructions: [
          'Bar over mid-foot',
          'Grip just outside legs',
          'Keep back flat',
          'Drive through floor'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Power Cleans',
        targetMuscles: 'Full Body, Explosiveness',
        instructions: [
          'Start like deadlift',
          'Pull explosively',
          'Catch on shoulders',
          'Stand and reset'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Front Squats',
        targetMuscles: 'Quads, Core',
        instructions: [
          'Bar on front shoulders',
          'Elbows high',
          'Keep torso upright',
          'Break at hips and knees'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
      {
        name: 'Pull-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Wide grip on bar',
          'Pull chest to bar',
          'Lead with elbows',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
          { weight: '', reps: '5', completed: false },
        ],
      },
    ],
  },
  'Strength Day 3': {
    name: 'Strength Day 3',
    exercises: [
      {
        name: 'Incline Press',
        targetMuscles: 'Upper Chest, Shoulders',
        instructions: [
          'Bench at 30-45 degrees',
          'Grip slightly wider than shoulders',
          'Lower to upper chest',
          'Press with power'
        ],
        sets: [
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
        ],
      },
      {
        name: 'Romanian Deadlifts',
        targetMuscles: 'Hamstrings, Lower Back',
        instructions: [
          'Soft knee bend',
          'Hinge at hips',
          'Bar close to legs',
          'Feel hamstring stretch'
        ],
        sets: [
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
        ],
      },
      {
        name: 'Military Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Strict form',
          'Press overhead',
          'Bar path straight',
          'Full lockout'
        ],
        sets: [
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
        ],
      },
      {
        name: 'Weighted Chin-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Add weight via belt',
          'Underhand grip',
          'Pull to upper chest',
          'Full range of motion'
        ],
        sets: [
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
          { weight: '', reps: '4', completed: false },
        ],
      },
    ],
  },
  'Upper Body Power': {
    name: 'Upper Body Power',
    exercises: [
      {
        name: 'Bench Press',
        targetMuscles: 'Chest, Shoulders, Triceps',
        instructions: [
          'Lie flat on bench with feet planted',
          'Grip bar slightly wider than shoulders',
          'Lower bar to mid-chest with control',
          'Press with explosive power'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
      {
        name: 'Weighted Pull-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Add weight via belt or vest',
          'Grip bar slightly wider than shoulders',
          'Pull chest to bar with power',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
      {
        name: 'Military Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Stand with feet shoulder-width apart',
          'Press bar overhead with power',
          'Keep core tight throughout',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
      {
        name: 'Barbell Rows',
        targetMuscles: 'Back, Lats, Rear Delts, Biceps',
        instructions: [
          'Stand with feet hip-width apart, grip barbell with overhand grip',
          'Hinge at hips, keep back straight and chest up',
          'Pull barbell to lower chest, squeezing shoulder blades',
          'Lower bar with control, keeping core tight',
          'Repeat for reps'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
    ],
  },
  'Lower Body Power': {
    name: 'Lower Body Power',
    exercises: [
      {
        name: 'Back Squats',
        targetMuscles: 'Quads, Glutes',
        instructions: [
          'Bar across upper back',
          'Feet shoulder-width apart',
          'Break at hips and knees',
          'Drive through heels explosively'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
      {
        name: 'Romanian Deadlifts',
        targetMuscles: 'Hamstrings, Lower Back',
        instructions: [
          'Stand with feet hip-width',
          'Hinge at hips with soft knees',
          'Lower bar along legs with power',
          'Drive hips forward explosively'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
      {
        name: 'Front Squats',
        targetMuscles: 'Quads, Core',
        instructions: [
          'Bar racked on front delts',
          'Elbows high, chest up',
          'Break at hips and knees',
          'Stand explosively'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
      {
        name: 'Leg Press',
        targetMuscles: 'Quads, Hamstrings, Glutes',
        instructions: [
          'Feet shoulder-width on platform',
          'Lower weight with control',
          'Drive through heels powerfully',
          'Stop just before lockout'
        ],
        sets: [
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
          { weight: '', reps: '4-6', completed: false },
        ],
      },
    ],
  },
  'HIIT Cardio': {
    name: 'HIIT Cardio',
    exercises: [
      {
        name: 'Burpees',
        targetMuscles: 'Glutes, Quads, Hamstrings, Core, Calves, Chest, Shoulders, Triceps',
        instructions: [
          "Stand with your feet shoulder-width apart, arms at your sides.",
          "Drop into a squat position and place your hands on the floor in front of you.",
          "Jump your feet back so you're in a high plank position.",
          "Do a push-up, keeping your body straight and core tight.",
          "Jump your feet forward to return to the squat position.",
          "Explosively jump into the air, reaching your arms overhead.",
          "Land softly and immediately go into the next rep."
        ],
        sets: [
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false }
        ]
      },
      {
        name: 'Mountain Climbers',
        targetMuscles: 'Core, Shoulders',
        instructions: [
          'Start in plank position',
          'Drive knees to chest alternately',
          'Keep hips level',
          'Maintain fast, controlled pace'
        ],
        sets: [
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
        ],
      },
      {
        name: 'Jump Squats',
        targetMuscles: 'Legs, Core',
        instructions: [
          'Start in squat stance',
          'Lower into squat',
          'Jump explosively',
          'Land softly and repeat'
        ],
        sets: [
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
        ],
      },
      {
        name: 'High Knees',
        targetMuscles: 'Core, Legs',
        instructions: [
          'Stand tall, arms at sides',
          'Drive knees up alternately',
          'Touch knees to palms',
          'Maintain quick rhythm'
        ],
        sets: [
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
          { weight: '', reps: '30s', completed: false },
        ],
      },
    ],
  },
  'Core & Abs': {
    name: 'Core & Abs',
    exercises: [
      {
        name: 'Planks',
        targetMuscles: 'Core, Shoulders',
        instructions: [
          'Start in forearm plank position',
          'Keep body in straight line',
          'Engage core and glutes',
          'Breathe steadily throughout'
        ],
        sets: [
          { weight: '', reps: '60s', completed: false },
          { weight: '', reps: '45s', completed: false },
          { weight: '', reps: '30s', completed: false },
        ],
      },
      {
        name: 'Russian Twists',
        targetMuscles: 'Obliques, Core',
        instructions: [
          'Sit with knees bent, feet off ground',
          'Lean back slightly, keeping back straight',
          'Rotate torso side to side',
          'Touch ground on each side'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
      {
        name: 'Leg Raises',
        targetMuscles: 'Lower Abs',
        instructions: [
          'Lie flat on back',
          'Keep legs straight',
          'Raise legs to 90 degrees',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
      {
        name: 'Cable Crunches',
        targetMuscles: 'Upper Abs',
        instructions: [
          'Kneel facing cable machine',
          'Hold rope behind head',
          'Curl torso down and in',
          'Squeeze abs at bottom'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
        ],
      },
    ],
  },
  'Mobility & Recovery': {
    name: 'Mobility & Recovery',
    exercises: [
      {
        name: 'Dynamic Stretching',
        targetMuscles: 'Hips, Hamstrings, Quads, Glutes, Shoulders, Core',
        instructions: [
          "Perform a series of active movements to warm up the body before exercise.",
          "Examples: Arm circles (shoulders), leg swings (hips, hamstrings), walking lunges (quads, glutes), high knees (hip flexors, core), butt kicks (hamstrings, quads), trunk twists (core), and side shuffles (adductors, abductors).",
          "Each movement should be performed for 20-30 seconds, moving through a full range of motion without holding the stretch."
        ],
        sets: [
          { weight: '', reps: '60s', completed: false },
          { weight: '', reps: '60s', completed: false }
        ]
      },
      {
        name: 'Yoga Poses',
        targetMuscles: 'Back, Hips, Hamstrings, Shoulders, Core',
        instructions: [
          "Perform a sequence of foundational yoga poses, holding each for 30-60 seconds:",
          "1. Downward Facing Dog: Start on hands and knees, lift hips to form an inverted V. Stretches hamstrings, calves, shoulders, and back.",
          "2. Cat-Cow: Alternate arching and rounding your back on hands and knees. Mobilizes spine and stretches back/core.",
          "3. Cobra Pose: Lie on your stomach, hands under shoulders, press up to lift chest. Stretches chest, abs, and strengthens back.",
          "4. Child's Pose: Kneel, sit back on heels, stretch arms forward. Stretches back, hips, and relaxes the body.",
          "5. Warrior I: Lunge forward with one leg, arms overhead, hips square. Stretches hips, strengthens legs and shoulders."
        ],
        sets: [
          { weight: '', reps: '30s each', completed: false },
          { weight: '', reps: '30s each', completed: false }
        ]
      },
      {
        name: 'Joint Mobility',
        targetMuscles: 'Ankles, Hips, Shoulders',
        instructions: [
          "Start with gentle circular movements",
          "Move through full range of motion",
          "Focus on controlled, smooth movements",
          "Perform 8-10 reps in each direction",
          "Stop if you feel any sharp pain"
        ],
        sets: [
          { weight: '', reps: '30s each', completed: false },
          { weight: '', reps: '30s each', completed: false }
        ]
      },
      {
        name: 'Foam Rolling',
        targetMuscles: 'Back, Legs',
        instructions: [
          'Start with major muscle groups: quads, hamstrings, calves',
          'Roll slowly, pausing on tender spots for 20-30 seconds',
          'Maintain proper posture and core engagement',
          'Breathe deeply while rolling',
          'Avoid rolling directly over joints or bones'
        ],
        sets: [
          { weight: '', reps: '60s per area', completed: false },
          { weight: '', reps: '60s per area', completed: false },
        ],
      },
    ],
  },
  // Standalone recovery flows — keys must match RecoverySuggestionsModal `workoutType` exactly.
  'Foam Rolling': {
    name: 'Foam Rolling',
    exercises: [
      {
        name: 'Quads & IT Band',
        targetMuscles: 'Quads, IT Band',
        instructions: [
          'Lie face down with foam roller under one thigh (quad).',
          'Roll from just above the knee to the hip. Support weight on forearms.',
          'Pause 20-30 seconds on tender spots. Switch legs.',
          'For IT band: lie on side, roller under outer thigh; roll from knee to hip.',
        ],
        sets: [
          { weight: '', reps: '60s per leg', completed: false },
          { weight: '', reps: '60s per leg', completed: false },
        ],
      },
      {
        name: 'Hamstrings & Calves',
        targetMuscles: 'Hamstrings, Calves',
        instructions: [
          'Sit with roller under hamstrings; hands behind for support.',
          'Roll from below the glutes to the back of the knee. Pause on tight spots 20-30s.',
          'For calves: place roller under lower leg; roll from ankle toward knee.',
          'Keep core engaged and breathe steadily.',
        ],
        sets: [
          { weight: '', reps: '60s per area', completed: false },
          { weight: '', reps: '60s per area', completed: false },
        ],
      },
      {
        name: 'Back & Glutes',
        targetMuscles: 'Upper Back, Lats, Glutes',
        instructions: [
          'Lie on your back with roller under upper back (between shoulder blades).',
          'Support head with hands; roll from mid-back to shoulders. Avoid lower back.',
          'For glutes: sit on roller, cross one ankle over opposite knee; roll the glute on the roller side.',
          'Pause on tender areas 20-30 seconds each.',
        ],
        sets: [
          { weight: '', reps: '60s per area', completed: false },
          { weight: '', reps: '60s per area', completed: false },
        ],
      },
    ],
  },
  'Stretching': {
    name: 'Stretching',
    exercises: [
      {
        name: 'Hamstrings & Hips',
        targetMuscles: 'Hamstrings, Hip Flexors, Glutes',
        instructions: [
          'Seated hamstring stretch: sit with one leg extended, other bent; lean forward until you feel a stretch. Hold 20-60s.',
          'Hip flexor lunge: low lunge with back knee down; tuck tailbone, hold 30s each side.',
          'Figure-four (glute): lie on back, cross ankle over knee, pull thigh toward chest. Hold 30s each side.',
        ],
        sets: [
          { weight: '', reps: '30s each', completed: false },
          { weight: '', reps: '30s each', completed: false },
        ],
      },
      {
        name: 'Shoulders & Chest',
        targetMuscles: 'Chest, Shoulders, Upper Back',
        instructions: [
          'Doorway chest stretch: arm at 90° on door frame, step through until you feel stretch. Hold 30s each side.',
          'Cross-body shoulder stretch: pull one arm across chest. Hold 20-30s each side.',
          'Thread the needle: on hands and knees, reach one arm under body, then open chest. Hold 20s each side.',
        ],
        sets: [
          { weight: '', reps: '30s each', completed: false },
          { weight: '', reps: '30s each', completed: false },
        ],
      },
      {
        name: 'Back & Core',
        targetMuscles: 'Lower Back, Obliques, Core',
        instructions: [
          "Child's pose: kneel, sit back on heels, arms extended forward. Hold 30-60s.",
          'Cat-cow: on hands and knees, alternate arching and rounding the spine. 8-10 reps.',
          'Seated twist: sit with one leg crossed; twist toward bent knee. Hold 20-30s each side.',
        ],
        sets: [
          { weight: '', reps: '30s each', completed: false },
          { weight: '', reps: '30s each', completed: false },
        ],
      },
    ],
  },
  'Chest & Triceps': {
    name: 'Chest & Triceps',
    exercises: [
      {
        name: 'Incline Bench Press',
        targetMuscles: 'Upper Chest, Front Delts',
        instructions: [
          'Set bench to 30 degree angle',
          'Grip bar slightly wider than shoulders',
          'Lower bar to upper chest',
          'Press bar up to starting position'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Flat Dumbbell Press',
        targetMuscles: 'Mid Chest, Front Delts',
        instructions: [
          'Lie flat on bench',
          'Hold dumbbells at chest level',
          'Press up with natural arc',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Cable Flyes',
        targetMuscles: 'Chest, Shoulders',
        instructions: [
          'Stand between cable machines',
          'Slight forward lean',
          'Keep arms slightly bent',
          'Bring hands together in arc'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Tricep Pushdowns',
        targetMuscles: 'Triceps',
        instructions: [
          'Face cable machine',
          'Elbows at sides',
          'Extend arms fully',
          'Control the negative'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Overhead Tricep Extensions',
        targetMuscles: 'Triceps (Long Head)',
        instructions: [
          'Hold dumbbell overhead',
          'Keep elbows close',
          'Lower behind head',
          'Extend arms fully'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      }
    ]
  },
  'Back & Biceps': {
    name: 'Back & Biceps',
    exercises: [
      {
        name: 'Pull-ups',
        targetMuscles: 'Back, Biceps',
        instructions: [
          'Wide grip on bar',
          'Pull chest to bar',
          'Focus on back contraction',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Barbell Rows',
        targetMuscles: 'Back, Lats, Rear Delts, Biceps',
        instructions: [
          'Stand with feet hip-width apart, grip barbell with overhand grip',
          'Hinge at hips, keep back straight and chest up',
          'Pull barbell to lower chest, squeezing shoulder blades',
          'Lower bar with control, keeping core tight',
          'Repeat for reps'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Lat Pulldowns',
        targetMuscles: 'Lats, Biceps',
        instructions: [
          'Grip bar wide',
          'Lean back slightly',
          'Pull to upper chest',
          'Control the return'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Bicep Curls',
        targetMuscles: 'Biceps',
        instructions: [
          'Stand with dumbbells',
          'Keep elbows at sides',
          'Curl with control',
          'Full range of motion'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Hammer Curls',
        targetMuscles: 'Biceps, Forearms',
        instructions: [
          'Neutral grip',
          'Keep elbows still',
          'Curl to shoulders',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      }
    ]
  },
  'Legs': {
    name: 'Legs',
    exercises: [
      {
        name: 'Squats',
        targetMuscles: 'Quads, Glutes',
        instructions: [
          'Feet shoulder width',
          'Keep chest up',
          'Break at hips and knees',
          'Drive through heels'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Romanian Deadlifts',
        targetMuscles: 'Hamstrings, Lower Back',
        instructions: [
          'Soft knee bend',
          'Hinge at hips',
          'Bar close to legs',
          'Feel hamstring stretch'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Leg Press',
        targetMuscles: 'Quads, Hamstrings',
        instructions: [
          'Feet shoulder width',
          'Lower with control',
          'Do not lock knees',
          'Push through heels'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Leg Curls',
        targetMuscles: 'Hamstrings',
        instructions: [
          'Lie face down',
          'Curl heels to glutes',
          'Hold peak contraction',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Calf Raises',
        targetMuscles: 'Calves',
        instructions: [
          'Stand on edge',
          'Full range of motion',
          'Hold at top',
          'Slow negative'
        ],
        sets: [
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false },
          { weight: '', reps: '15-20', completed: false }
        ]
      }
    ]
  },
  'Shoulders & Arms': {
    name: 'Shoulders & Arms',
    exercises: [
      {
        name: 'Overhead Press',
        targetMuscles: 'Shoulders, Triceps',
        instructions: [
          'Stand with feet planted',
          'Press overhead',
          'Keep core tight',
          'Control the descent'
        ],
        sets: [
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false },
          { weight: '', reps: '10-12', completed: false }
        ]
      },
      {
        name: 'Lateral Raises',
        targetMuscles: 'Side Delts',
        instructions: [
          'Stand with dumbbells',
          'Slight bend in elbows',
          'Raise to shoulder level',
          'Lower with control'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Face Pulls',
        targetMuscles: 'Rear Delts, Upper Back',
        instructions: [
          'Cable at head height',
          'Pull to face',
          'Lead with elbows',
          'Squeeze at back'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Bicep Curls',
        targetMuscles: 'Biceps',
        instructions: [
          'Stand with dumbbells',
          'Keep elbows at sides',
          'Full range of motion',
          'Squeeze at top'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      },
      {
        name: 'Tricep Extensions',
        targetMuscles: 'Triceps',
        instructions: [
          'Lie on bench',
          'Hold dumbbells overhead',
          'Lower behind head',
          'Extend arms fully'
        ],
        sets: [
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false },
          { weight: '', reps: '12-15', completed: false }
        ]
      }
    ]
  },
  'power-clean': {
    name: 'Power Clean',
    targetMuscles: 'Full Body, Back, Shoulders, Legs',
    instructions: [
      'Stand with feet hip-width apart, barbell over mid-foot',
      'Grip bar just outside legs, back flat, chest up',
      'Pull bar explosively from floor, extending hips and knees',
      'Shrug shoulders and pull bar up, dropping under to catch on shoulders',
      'Stand up fully with bar on shoulders'
    ]
  },
  'push-press': {
    name: 'Push Press',
    targetMuscles: 'Shoulders, Triceps, Legs',
    instructions: [
      'Stand with barbell at shoulder height, feet shoulder-width apart',
      'Dip knees slightly, then drive up explosively',
      'Press bar overhead to full extension',
      'Lower bar back to shoulders with control'
    ]
  },
  'box-jump': {
    name: 'Box Jump',
    targetMuscles: 'Legs, Glutes, Core',
    instructions: [
      'Stand in front of box with feet shoulder-width apart',
      'Bend knees and swing arms back',
      'Explosively jump onto box, landing softly',
      'Stand up fully, then step down carefully'
    ]
  },
  'chin-up': {
    name: 'Chin-Up',
    targetMuscles: 'Back, Biceps',
    instructions: [
      'Grip bar with palms facing you, hands shoulder-width apart',
      'Hang with arms fully extended',
      'Pull chin above bar, squeezing back and biceps',
      'Lower with control to starting position'
    ]
  },
  'farmer\'s-walk': {
    name: "Farmer's Walk",
    targetMuscles: 'Grip, Shoulders, Core, Legs',
    instructions: [
      'Hold heavy dumbbells or kettlebells at sides',
      'Stand tall, shoulders back, core tight',
      'Walk forward for distance or time',
      'Keep posture upright throughout'
    ]
  },
  'cable-kickback': {
    name: 'Cable Kickback',
    targetMuscles: 'Glutes, Hamstrings',
    instructions: [
      'Attach ankle strap to low cable',
      'Stand facing machine, hold support',
      'Kick leg back, squeezing glute',
      'Return with control, repeat for reps'
    ]
  },
  'plank-variation': {
    name: 'Plank Variation',
    targetMuscles: 'Core, Shoulders',
    instructions: [
      'Assume plank position (forearm, side, or extended)',
      'Keep body in straight line',
      'Engage core and glutes',
      'Hold for desired time or switch variations'
    ]
  },
  'hanging-leg-raise': {
    name: 'Hanging Leg Raise',
    targetMuscles: 'Abs, Hip Flexors',
    instructions: [
      'Hang from pull-up bar, arms extended',
      'Keep legs straight, raise them to hip height or higher',
      'Lower with control',
      'Avoid swinging'
    ]
  },
  'battle-rope': {
    name: 'Battle Ropes',
    targetMuscles: 'Shoulders, Arms, Core',
    instructions: [
      'Hold rope ends with both hands',
      'Stand with knees slightly bent',
      'Move arms explosively to create waves',
      'Alternate or use both arms together'
    ]
  },
  'sled-push': {
    name: 'Sled Push',
    targetMuscles: 'Legs, Glutes, Core',
    instructions: [
      'Stand behind sled, hands on handles',
      'Lean forward, drive through legs to push sled',
      'Keep core tight and back flat',
      'Push for distance or time'
    ]
  },
  'burpee-pull-up': {
    name: 'Burpee Pull-Up',
    targetMuscles: 'Full Body, Back, Arms',
    instructions: [
      'Perform a burpee under a pull-up bar',
      'After jumping up, grab bar and do a pull-up',
      'Lower down, return to burpee position',
      'Repeat for reps'
    ]
  },
  'rowing-sprint': {
    name: 'Rowing Sprint',
    targetMuscles: 'Back, Legs, Cardio',
    instructions: [
      'Sit on rowing machine, feet strapped in',
      'Grip handle, drive with legs then pull with arms',
      'Row as fast as possible for set time or distance',
      'Maintain good form throughout'
    ]
  },
  'medicine-ball-slam': {
    name: 'Medicine Ball Slam',
    targetMuscles: 'Shoulders, Core, Arms',
    instructions: [
      'Stand holding medicine ball overhead',
      'Slam ball down to floor with force',
      'Squat to pick up and repeat'
    ]
  },
  'incline-barbell-press': {
    name: 'Incline Barbell Press',
    targetMuscles: 'Upper Chest, Shoulders, Triceps',
    instructions: [
      'Set bench to 30-45 degrees',
      'Grip bar slightly wider than shoulders',
      'Lower bar to upper chest',
      'Press bar up to starting position'
    ]
  },
  'pendlay-row': {
    name: 'Pendlay Row',
    targetMuscles: 'Back, Lats, Rear Delts',
    instructions: [
      'Stand with feet hip-width, barbell on floor',
      'Grip bar overhand, back parallel to ground',
      'Pull bar explosively to lower chest',
      'Lower bar to floor each rep'
    ]
  },
  'walking-lunge': {
    name: 'Walking Lunge',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Stand tall, step forward into lunge',
      'Lower until both knees are bent at 90 degrees',
      'Push through front heel, bring back foot forward',
      'Alternate legs as you walk'
    ]
  },
  'arnold-press': {
    name: 'Arnold Press',
    targetMuscles: 'Shoulders, Triceps',
    instructions: [
      'Sit or stand holding dumbbells at shoulder height, palms facing you',
      'Rotate palms outward as you press weights overhead',
      'Lower with control, rotating palms back in'
    ]
  },
  'nordic-hamstring-curl': {
    name: 'Nordic Hamstring Curl',
    targetMuscles: 'Hamstrings, Glutes',
    instructions: [
      'Kneel with ankles secured',
      'Lower torso forward slowly, keeping hips extended',
      'Catch yourself with hands if needed, pull back up with hamstrings'
    ]
  },
  'plank-jack': {
    name: 'Plank Jack',
    targetMuscles: 'Core, Shoulders, Legs',
    instructions: [
      'Start in plank position',
      'Jump feet out wide, then back together',
      'Keep core tight and back flat',
      'Repeat for reps or time'
    ]
  },
  'static-stretching': {
    name: 'Static Stretching',
    targetMuscles: 'Full Body',
    instructions: [
      'Hold each stretch for 20-60 seconds',
      'Do not bounce, relax into the stretch',
      'Breathe deeply and focus on target muscle',
      'Switch sides as needed'
    ]
  },
  'bicycle-crunch': {
    name: 'Bicycle Crunch',
    targetMuscles: 'Abs, Obliques',
    instructions: [
      'Lie on back, hands behind head',
      'Bring knees up, lift shoulders off floor',
      'Alternate bringing opposite elbow to knee, extending other leg',
      'Repeat in a pedaling motion'
    ]
  },
  'dip': {
    name: 'Dip',
    targetMuscles: 'Chest, Triceps, Shoulders',
    instructions: [
      'Grip parallel bars, arms straight',
      'Lower body until shoulders are below elbows',
      'Press back up to starting position',
      'Keep core tight throughout'
    ]
  },
  'dumbbell-press': {
    name: 'Dumbbell Press',
    targetMuscles: 'Chest, Shoulders, Triceps',
    instructions: [
      'Lie on bench with dumbbells at chest level',
      'Press weights up until arms are straight',
      'Lower with control to starting position'
    ]
  },
};

// Add a helper to generate a howTo string from instructions
function generateHowTo(instructions) {
  if (!instructions || instructions.length === 0) return '';
  return instructions.join(' ');
}

// Add howTo to every exercise in workoutData
Object.values(workoutData).forEach(workout => {
  if (Array.isArray(workout.exercises)) {
    workout.exercises.forEach(ex => {
      if (!ex.howTo) {
        ex.howTo = generateHowTo(ex.instructions);
      }
    });
  }
});

// Helper: get default info for common exercises
const defaultExerciseInfo = {
  'push-up': {
    name: 'Push-Up',
    targetMuscles: 'Chest, Shoulders, Triceps, Core',
    instructions: [
      'Start in a plank position with hands under shoulders',
      'Lower your body until your chest nearly touches the floor',
      'Push back up to starting position',
      'Keep your body straight throughout'
    ]
  },
  'sit-up': {
    name: 'Sit-Up',
    targetMuscles: 'Abdominals',
    instructions: [
      'Lie on your back with knees bent',
      'Cross arms over chest or place hands behind head',
      'Lift your torso toward your knees',
      'Lower back down with control'
    ]
  },
  'plank': {
    name: 'Plank',
    targetMuscles: 'Core, Shoulders',
    instructions: [
      'Start in forearm plank position',
      'Keep body in straight line',
      'Engage core and glutes',
      'Hold position for desired time'
    ]
  },
  'jumping jack': {
    name: 'Jumping Jack',
    targetMuscles: 'Full Body, Calves, Shoulders, Glutes',
    instructions: [
      'Stand upright with feet together and arms at your sides',
      'Jump feet out to the sides while raising arms overhead',
      'Jump back to starting position',
      'Repeat quickly for desired reps or time'
    ]
  },
  'lunge': {
    name: 'Lunge',
    targetMuscles: 'Quads, Glutes, Hamstrings',
    instructions: [
      'Stand tall with feet hip-width apart',
      'Step forward with one leg and lower your hips until both knees are bent at about 90 degrees',
      'Push back to starting position',
      'Alternate legs for each rep'
    ]
  },
  'crunch': {
    name: 'Crunch',
    targetMuscles: 'Abdominals',
    instructions: [
      'Lie on your back with knees bent and feet flat on the floor',
      'Place hands behind your head or across your chest',
      'Lift your shoulders off the floor, engaging your abs',
      'Lower back down with control'
    ]
  },
  'mountain climber': {
    name: 'Mountain Climber',
    targetMuscles: 'Core, Shoulders, Quads',
    instructions: [
      "Start in a high plank position",
      "Drive one knee toward your chest",
      "Switch legs quickly, alternating knees to chest",
      "Keep core tight and back flat throughout"
    ]
  },
  'burpee': {
    name: 'Burpee',
    targetMuscles: 'Glutes, Quads, Hamstrings, Core, Calves, Chest, Shoulders, Triceps',
    instructions: [
      "Stand with your feet shoulder-width apart, arms at your sides",
      "Drop into a squat position and place your hands on the floor in front of you",
      "Jump your feet back so you're in a high plank position",
      "Do a push-up, keeping your body straight and core tight",
      "Jump your feet forward to return to the squat position",
      "Explosively jump into the air, reaching your arms overhead",
      "Land softly and immediately go into the next rep."
    ]
  },
  // Add more as needed
};

// Circular Progress Component
const CircularProgress = ({ progress, size = 80, strokeWidth = 6, color = '#00ffff', backgroundColor = 'rgba(255, 255, 255, 0.1)' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      {/* Background circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={backgroundColor}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      {/* Progress circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

const ActiveWorkoutScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { updateStats, stats, incrementStat } = useTracking();
  const { settings, updateSettings } = useSettings();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [calories, setCalories] = useState(0);
  const [workout, setWorkout] = useState(null);
  const [workoutSessionId, setWorkoutSessionId] = useState(null);
  // Store the Live Activity ID - we need this to update/end it later
  const [liveActivityId, setLiveActivityId] = useState(null);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTime, setRestTime] = useState(90); // Default value
  const [currentRestTime, setCurrentRestTime] = useState(90); // Default value
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false); // Prevents double-save
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [currentExercise, setCurrentExercise] = useState(null);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [activeExerciseCategory, setActiveExerciseCategory] = useState('Chest');
  const [workoutId, setWorkoutId] = useState(null); // Track workout ID if it's from database
  const [isPredefinedWorkout, setIsPredefinedWorkout] = useState(false); // Track if it's a starter/predefined workout
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [showEditRestTimeModal, setShowEditRestTimeModal] = useState(false);
  const { userProfile, personalRecords, isPremium } = useUser();
  
  // Progressive overload tracking - shows previous workout data to encourage progression
  const [previousWorkoutData, setPreviousWorkoutData] = useState(null);
  const [progressiveOverloadSuggestions, setProgressiveOverloadSuggestions] = useState({});
  
  // Circular progress bar animation
  const progressAnimation = useRef(new Animated.Value(0)).current;
  
  // Background timer refs
  const backgroundTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const backgroundTaskRef = useRef(null);
  const timerDataStoredRef = useRef(false);
  const restTimerRef = useRef(null);
  const workoutStartTimeRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const spotifyPollingRef = useRef(null);
  const lastSpotifyTrackRef = useRef(null);
  const workoutSessionIdRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track if workout has been loaded to prevent infinite loops
  const workoutLoadedRef = useRef(false);
  const lastParamsRef = useRef(null);

  // Helper: keep our Spotify polling interval under control
  function stopSpotifyPolling() {
    if (spotifyPollingRef.current) {
      clearInterval(spotifyPollingRef.current);
      spotifyPollingRef.current = null;
    }
  }

  // Helper: write the session's final state back to Supabase
  async function closeWorkoutSession(status = 'completed', { clearState = true } = {}) {
    const sessionId = workoutSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    try {
      await supabase
        .from('workout_sessions')
        .update({
          ended_at: new Date().toISOString(),
          status
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Failed to finalize workout session:', error);
    } finally {
      if (clearState) {
        workoutSessionIdRef.current = null;
        if (isMountedRef.current) {
          setWorkoutSessionId(null);
        }
      }
    }
  }

  async function syncRecentSpotifyTracks(sessionId) {
    if (!sessionId || !user?.id) {
      return;
    }

    const sessionStartMs =
      typeof sessionStartTimeRef.current === 'number'
        ? sessionStartTimeRef.current
        : typeof workoutStartTimeRef.current === 'number'
          ? workoutStartTimeRef.current
          : null;

    try {
      const { data: recentPayload, error: recentError } = await supabase.functions.invoke(
        'spotify-current-track',
        {
          body: {
            user_id: user.id,
            recent_limit: 10
          }
        }
      );

      if (recentError) {
        console.error('Spotify recent tracks invocation error:', recentError);
        return;
      }

      const recentTracks = Array.isArray(recentPayload?.recent_tracks)
        ? recentPayload.recent_tracks
        : [];

      if (recentTracks.length === 0) {
        return;
      }

      const thresholdMs = sessionStartMs ? sessionStartMs - 60_000 : null;

      for (const track of recentTracks) {
        const playedAtMs = track?.played_at ? new Date(track.played_at).getTime() : Date.now();

        if (thresholdMs && (!playedAtMs || playedAtMs < thresholdMs)) {
          continue;
        }

        const playedAtIso = playedAtMs ? new Date(playedAtMs).toISOString() : new Date().toISOString();

        const { error: upsertError } = await supabase
          .from('workout_spotify_tracks')
          .upsert({
            workout_session_id: sessionId,
            user_id: user.id,
            track_name: track?.track_name ?? 'Unknown Track',
            artist_name: track?.artist_name ?? null,
            album_name: track?.album_name ?? null,
            album_image_url: track?.album_image_url ?? null,
            track_id: track?.track_id ?? null,
            played_at: playedAtIso
          });

        if (upsertError) {
          console.error('Failed to store Spotify recent track:', upsertError);
        }
      }
    } catch (recentSyncError) {
      console.error('Failed to sync recent Spotify tracks:', recentSyncError);
    }
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopSpotifyPolling();
      const sessionId = workoutSessionIdRef.current;
      if (sessionId) {
        // Supabase queries need .then() to execute before .catch() works
        // The query returns a builder object until you call .then() or await it
        supabase
          .from('workout_sessions')
          .update({
            ended_at: new Date().toISOString(),
            status: 'abandoned'
          })
          .eq('id', sessionId)
          .then(({ error }) => {
            if (error) console.error('Failed to clean up workout session on unmount:', error);
          });
      }
      // Clean up Live Activity on component unmount
      // If user leaves the screen while workout is active, dismiss the Live Activity
      if (liveActivityId) {
        dismissLiveActivity(liveActivityId).catch(error => 
          console.error('Failed to dismiss Live Activity on unmount:', error)
        );
      }
    };
  }, [liveActivityId]); // Clean up when liveActivityId changes or component unmounts

  // Helper to format rest time as "M:SS"
  const formatRestTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handler to update rest time with settings persistence
  const handleRestTimeChange = async (seconds) => {
    try {
      setRestTime(seconds);
      // Update current rest time if timer is showing but not active
      if (showRestTimer && !restTimerActive) {
        setCurrentRestTime(seconds);
      }
      // Update in settings context and AsyncStorage
      const settingsResult = await updateSettings({ rest_time_seconds: seconds });
      if (!settingsResult.success) {
        throw new Error(settingsResult.error || 'Failed to update settings');
      }
      await AsyncStorage.setItem('rest_time_seconds', seconds.toString());
    } catch (error) {
      console.error('Error updating rest time:', error);
      Alert.alert('Error', 'Failed to update rest time. Please try again.');
    }
  };
  
  // Initialize workout state based on params
  useEffect(() => {
    // Check if params have changed - if so, reset the loaded flag
    const currentParams = JSON.stringify(params);
    if (lastParamsRef.current !== currentParams) {
      workoutLoadedRef.current = false;
      lastParamsRef.current = currentParams;
    }
    
    // Prevent multiple loads for the same params
    if (workoutLoadedRef.current) {
      return;
    }
    
    const loadWorkout = async () => {
      try {
        // Clear old stored workout if we have new params
        if (params.custom === 'true' && params.workout) {
          await AsyncStorage.removeItem('currentWorkout');
        }
        
        // First try to get workout from params
        if (params.custom === 'true' && params.workout) {
          const parsed = JSON.parse(params.workout);
          console.log('Custom workout parsed:', parsed);
          
          // Store workout ID if it exists (for saving back to database)
          // Only custom and AI-generated workouts have IDs, not predefined workouts
          if (parsed.id) {
            setWorkoutId(parsed.id);
            setIsPredefinedWorkout(false); // Custom/AI workouts are not predefined
          } else {
            setIsPredefinedWorkout(false); // Still not predefined even without ID
          }
          
          const processedWorkout = {
            name: parsed.name,
            exercises: parsed.exercises.map((ex, index) => {
              console.log(`Processing exercise ${index}:`, ex);
              
              // If ex is a string, it's just the exercise name
              if (typeof ex === 'string') {
                // Try to find matching exercise in workoutData
                let found = null;
                for (const workout of Object.values(workoutData)) {
                  if (workout.exercises) {
                  found = workout.exercises.find(e => e.name && e.name.toLowerCase() === ex.toLowerCase());
                  if (found) break;
                  }
                }
                // If found, use that exercise's data
                if (found) {
                  return {
                    ...found,
                    sets: Array.from({ length: 3 }, () => ({
                      weight: '',
                      reps: found.sets[0].reps,
                      completed: false
                    }))
                  };
                }
                // If not found, use default info or create basic exercise
                return {
                  name: ex,
                  targetMuscles: 'Full Body',
                  instructions: ['No specific instructions available.'],
                  sets: Array.from({ length: 3 }, () => ({
                    weight: '',
                    reps: '8-12',
                    completed: false
                  }))
                };
              }
              // If ex is an object, use its data
              return {
                name: ex.name,
                targetMuscles: ex.targetMuscles || 'Full Body',
                instructions: ex.instructions || ['No specific instructions available.'],
                sets: Array.from({ length: parseInt(ex.sets) || 3 }, () => ({
                  weight: '',
                  reps: ex.reps || '8-12',
                  completed: false
                }))
              };
            })
          };
          
          console.log('Processed workout:', processedWorkout);
          
          // Validate workout structure
          if (!processedWorkout.exercises || processedWorkout.exercises.length === 0) {
            throw new Error('Invalid workout structure: no exercises found');
          }
          
          // Create a clean workout object to prevent any reference issues
          const cleanWorkout = {
            name: processedWorkout.name,
            exercises: processedWorkout.exercises.map(exercise => ({
              name: exercise.name,
              targetMuscles: exercise.targetMuscles,
              instructions: exercise.instructions,
              sets: exercise.sets.map(set => ({
                weight: set.weight || '',
                reps: set.reps || '8-12',
                completed: set.completed || false
              }))
            }))
          };
          
          console.log('Clean workout:', cleanWorkout);
          setWorkout(cleanWorkout);
          // Store workout in AsyncStorage for backup
          await AsyncStorage.setItem('currentWorkout', JSON.stringify(cleanWorkout));
          workoutLoadedRef.current = true;
        } else if (params.type) {
          // Handle predefined workouts (starter workouts that come with the app)
          setIsPredefinedWorkout(true); // Mark as predefined so we don't save modifications
          await AsyncStorage.removeItem('currentWorkout'); // Clear old workout first
          // Expo Router can pass repeated query keys as an array — normalize to a single string.
          const workoutName = Array.isArray(params.type) ? params.type[0] : params.type;
          if (workoutData[workoutName]) {
            setWorkout(workoutData[workoutName]);
            // Store workout in AsyncStorage for backup
            await AsyncStorage.setItem('currentWorkout', JSON.stringify(workoutData[workoutName]));
            workoutLoadedRef.current = true;
          } else {
            console.error('Workout not found:', workoutName);
            Alert.alert(
              'Error',
              'Workout not found. Please try again.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          }
        } else {
          // Try to load from AsyncStorage if params are missing
          const storedWorkout = await AsyncStorage.getItem('currentWorkout');
          if (storedWorkout) {
            const parsed = JSON.parse(storedWorkout);
            // Check if this is a predefined workout by checking if the name matches workoutData keys
            // Object.keys(workoutData) returns an array of predefined workout names
            const isPredefined = Object.keys(workoutData).includes(parsed.name);
            setIsPredefinedWorkout(isPredefined);
            setWorkout(parsed);
            workoutLoadedRef.current = true;
          } else {
            console.error('No workout data available');
            Alert.alert(
              'Error',
              'No workout data available. Please start a new workout.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          }
        }
      } catch (error) {
        console.error('Error loading workout:', error);
        Alert.alert(
          'Error',
          'Failed to load workout. Please try again.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    };

    loadWorkout();
  }, [params]); // Re-run when params change

  // Cleanup stored workout when component unmounts
  useEffect(() => {
    return () => {
      clearStoredWorkout();
    };
  }, []);

  /**
   * Fetches previous workout data to provide progressive overload suggestions
   * Compares current workout with previous workouts to encourage progression (weight/reps/volume)
   * This helps users know what they did last time and suggests increases
   */
  const fetchPreviousWorkoutData = async (workoutName) => {
    try {
      if (!user?.id || !workoutName) {
        return;
      }

      // Fetch the last 3 times this workout was completed
      // We use 3 to show progression trends
      const { data, error } = await supabase
        .from('user_workout_logs')
        .select('exercises, completed_at, workout_name')
        .eq('user_id', user.id)
        .eq('workout_name', workoutName)
        .order('completed_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching previous workout:', error);
        return;
      }

      if (data && data.length > 0) {
        const lastWorkout = data[0];
        setPreviousWorkoutData(lastWorkout);

        // Generate progressive overload suggestions for each exercise
        // Creates a map where key is exercise index and value contains previous performance data
        const suggestions = {};
        
        workout?.exercises.forEach((currentExercise, exIndex) => {
          // Find matching exercise from last workout by name (case-insensitive)
          const previousExercise = lastWorkout.exercises.find(
            ex => ex.name?.toLowerCase() === currentExercise.name?.toLowerCase()
          );
          
          if (previousExercise && previousExercise.sets && previousExercise.sets.length > 0) {
            // Get completed sets from previous workout
            const completedSets = previousExercise.sets.filter(s => s.completed);
            
            if (completedSets.length > 0) {
              // Use the last completed set to get most recent performance
              const lastSet = completedSets[completedSets.length - 1];
              const lastSetWeight = parseFloat(lastSet.weight) || 0;
              const lastSetReps = parseInt(lastSet.reps) || 0;
              
              // Calculate average weight and reps across all completed sets for better suggestion
              const totalWeight = completedSets.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
              const totalReps = completedSets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
              const avgWeight = totalWeight / completedSets.length;
              const avgReps = totalReps / completedSets.length;

              suggestions[exIndex] = {
                lastWeight: lastSetWeight,
                lastReps: lastSetReps,
                avgWeight: avgWeight,
                avgReps: avgReps,
                suggestedWeight: lastSetWeight > 0 ? Math.max(lastSetWeight + 5, avgWeight + 5) : 0, // Suggest 5 lb increase
                suggestedReps: lastSetReps > 0 ? lastSetReps + 1 : 0, // Or add 1 rep
                lastVolume: completedSets.length, // Number of sets completed
                daysAgo: Math.floor((new Date() - new Date(lastWorkout.completed_at)) / (1000 * 60 * 60 * 24))
              };
            }
          }
        });
        
        console.log('Progressive overload suggestions:', suggestions);
        setProgressiveOverloadSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error in fetchPreviousWorkoutData:', error);
    }
  };

  // Fetch previous workout data whenever workout loads
  useEffect(() => {
    if (workout?.workout_name || workout?.name) {
      fetchPreviousWorkoutData(workout.workout_name || workout.name);
    }
  }, [workout?.workout_name, workout?.name, user?.id]);

  // Whenever a workout loads, open a session row so we can attach Spotify tracks to it
  useEffect(() => {
    let cancelled = false;

    const ensureWorkoutSession = async () => {
      if (!user?.id || !workout?.name || !Array.isArray(workout?.exercises) || workout.exercises.length === 0) {
        return;
      }

      if (workoutSessionIdRef.current) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: user.id,
            workout_name: workout.workout_name || workout.name,
            started_at: new Date().toISOString()
          })
          .select('id, started_at')
          .single();

        if (error) {
          throw error;
        }

        if (!cancelled) {
          workoutSessionIdRef.current = data.id;
          sessionStartTimeRef.current = data?.started_at
            ? new Date(data.started_at).getTime()
            : Date.now();
          setWorkoutSessionId(data.id);
          lastSpotifyTrackRef.current = null;
          
          // Start Live Activity when workout session is created
          // This creates a Live Activity on the iOS lock screen showing workout progress
          if (workout) {
            // Calculate total sets across all exercises in the workout
            // reduce() adds up all set counts: starts at 0, then adds each exercise's set count
            const totalSets = workout.exercises.reduce((sum, exercise) => {
              return sum + (exercise.sets?.length || 0);
            }, 0);
            
            // Get the first exercise name, or show "Starting..." if no exercises
            const currentExercise = workout.exercises[0]?.name || 'Starting...';
            
            // Start the Live Activity with initial workout data
            // This will show on the lock screen and Dynamic Island (iPhone 14 Pro+)
            startWorkoutLiveActivity({
              workoutId: data.id,
              workoutName: workout.name,
              currentExercise: currentExercise,
              setsCompleted: 0,
              totalSets: totalSets,
              elapsedTime: elapsedTime,
              calories: calories,
            }).then((activityId) => {
              // If successful, save the activity ID so we can update/end it later
              if (activityId) {
                setLiveActivityId(activityId);
              }
            });
          }
        }
      } catch (error) {
        console.error('Failed to create workout session:', error);
      }
    };

    ensureWorkoutSession();

    return () => {
      cancelled = true;
    };
  }, [user?.id, workout?.name, workout?.exercises?.length]);

  // Initialize rest time from settings
  useEffect(() => {
    if (settings?.rest_time_seconds) {
      const newRestTime = parseInt(settings.rest_time_seconds);
      console.log('[ActiveWorkout] Setting rest time from settings:', newRestTime);
      setRestTime(newRestTime);
      setCurrentRestTime(newRestTime);
    }
  }, [settings?.rest_time_seconds]);

  // Setup notifications and background tasks
  useEffect(() => {
    // Removed notification setup - no longer needed
  }, []);

  // Temporarily disable background task to test if it's causing immediate notifications
  // useEffect(() => {
  //   const REST_TIMER_TASK = 'rest-timer-task';
  //   
  //   // Register background task
  //   TaskManager.defineTask(REST_TIMER_TASK, async () => {
  //     // ... background task logic
  //   });
  //
  //   const registerBackgroundTask = async () => {
  //     try {
  //       console.log('Attempting to register background task...');
  //       await BackgroundTask.registerTaskAsync(REST_TIMER_TASK);
  //       console.log('Background task registered successfully');
  //     } catch (error) {
  //       console.error('Background task registration failed:', error);
  //       console.log('Using scheduled notification only (works in all environments)');
  //     }
  //   };
  //
  //   registerBackgroundTask();
  //
  //   return () => {
  //     try {
  //       BackgroundTask.unregisterTaskAsync(REST_TIMER_TASK);
  //     } catch (error) {
  //       console.log('Error unregistering background task:', error);
  //     }
  //   };
  // }, []);
  
  console.log('Background task completely disabled for testing');

  // Handle app state changes for background timer
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - check for background timer data
        try {
          // Check rest timer data
          const storedData = await AsyncStorage.getItem('restTimerData');
          if (storedData) {
            const { startTime, initialTime, isActive } = JSON.parse(storedData);
            
            if (isActive) {
              const now = Date.now();
              const elapsed = Math.floor((now - startTime) / 1000);
              const newTime = Math.max(0, initialTime - elapsed);
              
              setCurrentRestTime(newTime);
              setRestTimerActive(true);
              setShowRestTimer(true);
              
              if (newTime <= 0) {
                // Timer finished while in background
                setRestTimerActive(false);
                // Keep showRestTimer true so the component stays visible showing "Rest Timer Done"
                setCurrentRestTime(0);
                clearRestTimerData();
              }
            }
          }

          // Check workout timer data
          const workoutTimerData = await AsyncStorage.getItem('workoutTimerData');
          if (workoutTimerData && workout) {
            const { startTime, startElapsed, isActive } = JSON.parse(workoutTimerData);
            
            if (isActive) {
              const now = Date.now();
              const elapsedSinceStart = Math.floor((now - startTime) / 1000);
              const newElapsedTime = startElapsed + elapsedSinceStart;
              
              setElapsedTime(newElapsedTime);
              const newCalories = Math.floor(newElapsedTime / 60 * 5);
              setCalories(newCalories);
            }
          }
        } catch (error) {
          console.log('Error checking background timer data:', error);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [workout]);

  // Removed notification function - no longer needed

  // Store rest timer data for background processing
  const storeRestTimerData = async (isActive, time) => {
    try {
      // Prevent multiple calls
      if (timerDataStoredRef.current) {
        console.log('Timer data already stored, skipping');
        return;
      }
      
      console.log('storeRestTimerData called with:', { isActive, time });
      
      const timerData = {
        startTime: Date.now(),
        initialTime: time,
        isActive: isActive,
      };
      await AsyncStorage.setItem('restTimerData', JSON.stringify(timerData));
      
      timerDataStoredRef.current = true;
      console.log('Rest timer started for', time, 'seconds (visual only)');
    } catch (error) {
      console.log('Error storing rest timer data:', error);
    }
  };

  // Clear rest timer data
  const clearRestTimerData = async () => {
    try {
      console.log('clearRestTimerData called');
      await AsyncStorage.removeItem('restTimerData');
      timerDataStoredRef.current = false; // Reset the ref
    } catch (error) {
      console.log('Error clearing rest timer data:', error);
    }
  };

  // Store workout timer data for background processing
  const storeWorkoutTimerData = async (startTime, startElapsed) => {
    try {
      const timerData = {
        startTime: startTime,
        startElapsed: startElapsed,
        isActive: true
      };
      await AsyncStorage.setItem('workoutTimerData', JSON.stringify(timerData));
      console.log('Workout timer data stored for background processing');
    } catch (error) {
      console.log('Error storing workout timer data:', error);
    }
  };

  // Clear workout timer data
  const clearWorkoutTimerData = async () => {
    try {
      await AsyncStorage.removeItem('workoutTimerData');
      console.log('Workout timer data cleared');
    } catch (error) {
      console.log('Error clearing workout timer data:', error);
    }
  };

  // Rest timer countdown
  useEffect(() => {
    // Clear any existing timer
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    
    if (restTimerActive && currentRestTime > 0) {
      // Store background timer info
      backgroundTimerRef.current = {
        startTime: Date.now(),
        initialTime: currentRestTime
      };
      
      restTimerRef.current = setInterval(() => {
        setCurrentRestTime(prev => {
          if (prev <= 1) {
            // Use setTimeout to avoid state updates during render
            setTimeout(() => {
              setRestTimerActive(false);
              // Keep showRestTimer true so the component stays visible showing "Rest Timer Done"
              setCurrentRestTime(0);
              clearRestTimerData(); // Clear stored data
              console.log('Rest timer finished in foreground');
            }, 0);
            return 0;
          }
          
          // Update progress animation
          const progress = 1 - (prev - 1) / restTime;
          Animated.timing(progressAnimation, {
            toValue: progress,
            duration: 1000,
            useNativeDriver: false
          }).start();
          
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear background timer ref when timer stops
      backgroundTimerRef.current = null;
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [restTimerActive, restTime]);

  // Poll Spotify every ~30s while the session is active so we can capture songs
  useEffect(() => {
    if (!workoutSessionId || !user?.id) {
      return;
    }

    let cancelled = false;

    const pollSpotifyTrack = async () => {
      if (cancelled || !workoutSessionIdRef.current) {
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('spotify-current-track', {
          body: { user_id: user.id }
        });

        if (error) {
          console.error('Spotify current track invocation error:', error);
          return;
        }

        if (!data || data?.error) {
          if (data?.error) {
            console.error('Spotify current track function returned error:', data.error);
          }
          return;
        }

        const trackPayload = data?.track ?? null;

        if (!trackPayload || !trackPayload.track_id) {
          if (data?.track === null) {
            lastSpotifyTrackRef.current = null;
          }
          return;
        }

        const playedAt = trackPayload.played_at ?? new Date().toISOString();
        const trackKey = `${trackPayload.track_id}-${playedAt}`;

        if (lastSpotifyTrackRef.current === trackKey) {
          return;
        }

        lastSpotifyTrackRef.current = trackKey;

        const { error: insertError } = await supabase
          .from('workout_spotify_tracks')
          .upsert({
            workout_session_id: workoutSessionIdRef.current,
            user_id: user.id,
            track_name: trackPayload.track_name ?? 'Unknown Track',
            artist_name: trackPayload.artist_name ?? null,
            album_name: trackPayload.album_name ?? null,
            album_image_url: trackPayload.album_image_url ?? null,
            track_id: trackPayload.track_id,
            played_at: playedAt
          });

        if (insertError) {
          console.error('Failed to store Spotify track:', insertError);
        }
      } catch (error) {
        console.error('Error polling Spotify current track:', error);
      }
    };

    pollSpotifyTrack();
    spotifyPollingRef.current = setInterval(pollSpotifyTrack, 30000);

    return () => {
      cancelled = true;
      stopSpotifyPolling();
    };
  }, [workoutSessionId, user?.id]);

  // Timer and calories tracking
  useEffect(() => {
    let timer;
    
    if (workout) {
      // Store workout timer data for background processing
      workoutStartTimeRef.current = Date.now();
      const initialElapsedTime = 0;
      storeWorkoutTimerData(workoutStartTimeRef.current, initialElapsedTime);
      
      timer = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          // Calculate calories burned (rough estimate: 5 calories per minute)
          const newCalories = Math.floor(newTime / 60 * 5);
          setCalories(newCalories);
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
      // Clear workout timer data when workout ends
      clearWorkoutTimerData();
    };
  }, [workout?.name]); // Only depend on workout name, not the entire workout object

  // Update Live Activity whenever timer, calories, or workout progress changes
  // This useEffect runs whenever the timer, calories, or workout state changes
  // It updates the Live Activity on the lock screen with the latest progress
  useEffect(() => {
    // If no Live Activity is active or no workout data, don't try to update
    if (!liveActivityId || !workout) {
      return;
    }

    // Find the current exercise - this is the first exercise that has incomplete sets
    // find() looks through exercises and returns the first one matching the condition
    // If all exercises are complete, fall back to the first exercise
    const currentExercise = workout.exercises.find((exercise) =>
      exercise.sets?.some((set) => !set.completed)
    ) || workout.exercises[0];

    // Count completed sets across all exercises
    // reduce() starts at 0, then adds up all completed sets from all exercises
    const setsCompleted = workout.exercises.reduce((count, exercise) => {
      return count + (exercise.sets?.filter((set) => set.completed).length || 0);
    }, 0);

    // Calculate total sets in the workout (completed + incomplete)
    const totalSets = workout.exercises.reduce((sum, exercise) => {
      return sum + (exercise.sets?.length || 0);
    }, 0);

    // Format elapsed time for display (convert seconds to MM:SS format)
    const formattedTime = formatTime(elapsedTime);

    // Update the Live Activity on the lock screen with new progress data
    // This happens automatically whenever the workout state changes
    updateWorkoutLiveActivity(liveActivityId, {
      workoutName: workout?.name || '💪 Workout',
      elapsedTime: formattedTime,
      currentExercise: currentExercise?.name || 'In Progress',
      setsCompleted: setsCompleted,
      totalSets: totalSets,
      calories: calories,
      // Rest timer info
      isResting: restTimerActive,
      restTimeRemaining: currentRestTime,
    });
  }, [elapsedTime, calories, workout, liveActivityId, restTimerActive, currentRestTime]); // Update when any of these change

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetComplete = (exerciseIndex, setIndex) => {
    // Prevent multiple rapid calls
    if (restTimerActive) {
      console.log('Rest timer already active, ignoring set completion');
      return;
    }
    
    // Ensure workout and exercises exist
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
      console.error('Invalid workout structure for set completion');
      return;
    }
    
    console.log('Setting complete for exercise:', exerciseIndex, 'set:', setIndex);
    console.log('Current workout:', workout);
    
    // Create a new workout object with the completed set
    const newWorkout = {
      name: workout.name,
      exercises: workout.exercises.map((exercise, exIndex) => {
        if (exIndex === exerciseIndex) {
          // Ensure exercise has sets array
          const sets = exercise.sets || [];
          return {
            name: exercise.name,
            targetMuscles: exercise.targetMuscles,
            instructions: exercise.instructions,
            sets: sets.map((set, setIdx) => {
              if (setIdx === setIndex) {
                return { 
                  weight: set.weight || '',
                  reps: set.reps || '8-12',
                  completed: true 
                };
              }
              return {
                weight: set.weight || '',
                reps: set.reps || '8-12',
                completed: set.completed || false
              };
            })
          };
        }
        return {
          name: exercise.name,
          targetMuscles: exercise.targetMuscles,
          instructions: exercise.instructions,
          sets: exercise.sets.map(set => ({
            weight: set.weight || '',
            reps: set.reps || '8-12',
            completed: set.completed || false
          }))
        };
      })
    };
    
    console.log('New workout after set completion:', newWorkout);
    setWorkout(newWorkout);
    
    // Use the current rest time from state
    setCurrentRestTime(restTime);
    setShowRestTimer(true);
    setRestTimerActive(true);
    
    // Initialize progress animation
    progressAnimation.setValue(0);
    
    // Start visual timer
    storeRestTimerData(true, restTime);
    console.log('Rest timer started for', restTime, 'seconds (visual only)');
  };

  const resetWorkout = () => {
    // Ensure workout and exercises exist
    if (!workout || !workout.exercises) {
      console.error('Invalid workout structure for reset');
      return;
    }
    
    // Create a new workout object with all sets reset
    const resetWorkoutData = {
      ...workout,
      exercises: workout.exercises.map(exercise => {
        // Ensure exercise has sets array
        const sets = exercise.sets || [];
        return {
          ...exercise,
          sets: sets.map(set => ({
            ...set,
            completed: false
          }))
        };
      })
    };
    setWorkout(resetWorkoutData);
    setElapsedTime(0);
    setCalories(0);
  };

  const handleFinish = async () => {
    setShowFinishConfirmation(true);
  };

  const confirmFinish = async () => {
    // Prevent double-save if user taps finish button multiple times
    if (isSavingWorkout) {
      console.log('Already saving workout, ignoring duplicate tap');
      return;
    }

    
    try {
      setIsSavingWorkout(true); // Lock to prevent double-save
      
      if (!user?.id) {
        console.error('No user found');
        return;
      }

      const sessionIdForSummary = workoutSessionIdRef.current;
      if (sessionIdForSummary) {
        stopSpotifyPolling();
      }
      
      // Calculate stats - treat sets with weight AND reps as completed (even without tapping checkmark)
      let completedSets = 0;
      let totalWeight = 0;
      const getReps = (set) => {
        const repsStr = String(set.reps || '0');
        return parseInt(repsStr.includes('-') ? repsStr.split('-')[0] : repsStr) || 0;
      };
      const getWeight = (set) => parseFloat(set.weight) || 0;

      workout.exercises.forEach(exercise => {
        exercise.sets.forEach(set => {
          const weight = getWeight(set);
          const reps = getReps(set);
          const hasData = weight > 0 && reps > 0;
          const isCounted = set.completed || hasData;
          if (isCounted && hasData) {
            completedSets++;
            totalWeight += weight * reps;
          }
        });
       

      });

      // Build exercises payload - mark sets with weight+reps as completed so they show in logs
      const exercisesPayload = workout.exercises.map(exercise => ({
        name: exercise.name,
        targetMuscles: exercise.targetMuscles || [],
        sets: exercise.sets.map(set => {
          const weight = getWeight(set);
          const reps = getReps(set);
          const hasData = weight > 0 && reps > 0;
          return {
            weight: weight || set.weight || 0,
            reps: reps || set.reps || 0,
            completed: set.completed || hasData
          };
        })
      }));

      // Save workout log (omit workout_session_id - may not exist in all schemas)
      const insertPayload = {
        user_id: user.id,
        workout_name: workout.workout_name || workout.name,
        exercises: exercisesPayload,
        completed_sets: completedSets,
        exercise_count: workout.exercises.length,
        exercise_names: workout.exercises.map(ex => ex.name),
        total_weight: Math.round(totalWeight),
        duration: elapsedTime,
        calories_burned: Math.round(calories),
        completed_at: new Date().toISOString()
      };
      const { data: insertedRow, error } = await supabase
        .from('user_workout_logs')
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) {
        console.error('Error saving workout:', error);
        Alert.alert(
          'Error',
          'Failed to save your workout. Please try again.'
        );

        return;
      }

      // If this is a custom or AI-generated workout with an ID, update it in the workouts table
      // This saves the modified version (with added/removed exercises and sets) back to the template
      // We call saveWorkoutTemplate which handles all the checks and saving logic
      // This ensures the workout template is saved when finishing, even if it was already saved during editing
      await saveWorkoutTemplate();

      // Update local stats
      await updateStats(prev => ({
        ...prev,
        workouts: (prev.workouts || 0) + 1,
        minutes: (prev.minutes || 0) + Math.floor(elapsedTime / 60),
        today_workout_completed: true
      }));

      if (sessionIdForSummary) {
        await syncRecentSpotifyTracks(sessionIdForSummary);
        await closeWorkoutSession('completed');
      }
      
      // Update Live Activity to show completion stats (stays visible for user to dismiss)
      if (liveActivityId) {
        await endWorkoutLiveActivity(liveActivityId, {
          duration: elapsedTime,
          totalWeight: Math.round(totalWeight),
          completedSets: completedSets,
          exerciseCount: workout.exercises.length,
          workoutName: workout.workout_name || workout.name,
        });
        setLiveActivityId(null); // Clear the activity ID
      }

      // Reset workout and hide confirmation
      resetWorkout();
      setShowFinishConfirmation(false);
      
      // Navigate to summary with stats (pass workout log id so summary can add photo/video)
      const summaryParams = {
        duration: String(elapsedTime),
        exerciseCount: String(workout.exercises.length),
        completedSets: String(completedSets),
        totalWeight: String(Math.round(totalWeight)),
        workoutName: workout.workout_name || workout.name,
        justCompleted: 'true'
      };
      if (insertedRow?.id) {
        summaryParams.workoutLogId = String(insertedRow.id);
      }
      if (sessionIdForSummary) {
        summaryParams.workoutSessionId = sessionIdForSummary;
      }

      router.push({
        pathname: '/(tabs)/workout-summary',
        params: summaryParams
      });
    } catch (error) {
      console.error('Error finishing workout:', error);
      Alert.alert(
        'Error',
        'There was a problem saving your workout. Please try again.',
        [{ text: 'OK', onPress: () => setShowFinishConfirmation(false) }]
      );
    } finally {
      // Always unlock save guard so user can retry if needed.
      setIsSavingWorkout(false);
    }
  };

  const handleExit = () => {
    setShowExitConfirmation(true);
  };

  // Cleanup function to clear stored workout data
  const clearStoredWorkout = async () => {
    try {
      await AsyncStorage.removeItem('currentWorkout');
    } catch (error) {
      console.error('Error clearing stored workout:', error);
    }
  };

  const skipRest = () => {
    // Clear the timer first
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    
    setShowRestTimer(false);
    setRestTimerActive(false);
    clearRestTimerData(); // Clear background timer data
    timerDataStoredRef.current = false; // Reset the ref
    console.log('Rest timer skipped');
  };

  const toggleRestTimer = () => {
    if (restTimerActive) {
      // Pause timer
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      setRestTimerActive(false);
    } else {
      // Resume timer
      setRestTimerActive(true);
    }
  };

  const handleWeightChange = (exerciseIndex, setIndex, weight) => {
    // Ensure workout and exercises exist
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
      console.error('Invalid workout structure for weight change');
      return;
    }
    
    // Create a new workout object with the updated weight
    const newWorkout = {
      ...workout,
      exercises: workout.exercises.map((exercise, exIndex) => {
        if (exIndex === exerciseIndex) {
          // Ensure exercise has sets array
          const sets = exercise.sets || [];
          return {
            ...exercise,
            sets: sets.map((set, setIdx) => {
              if (setIdx === setIndex) {
                return { ...set, weight };
              }
              return set;
            })
          };
        }
        return exercise;
      })
    };
    setWorkout(newWorkout);
  };

  const handleRepsChange = (exerciseIndex, setIndex, reps) => {
    // Ensure workout and exercises exist
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
      console.error('Invalid workout structure for reps change');
      return;
    }
    
    // Create a new workout object with the updated reps
    // Allow editing reps even after set is completed so users can adjust if they did more/fewer reps
    const newWorkout = {
      ...workout,
      exercises: workout.exercises.map((exercise, exIndex) => {
        if (exIndex === exerciseIndex) {
          // Ensure exercise has sets array
          const sets = exercise.sets || [];
          return {
            ...exercise,
            sets: sets.map((set, setIdx) => {
              if (setIdx === setIndex) {
                return { ...set, reps };
              }
              return set;
            })
          };
        }
        return exercise;
      })
    };
    setWorkout(newWorkout);
  };

  /**
   * Gets progressive overload message based on current vs previous performance
   * This encourages users to increase weight, reps, or volume over time
   * @param {number} exerciseIndex - Index of the exercise in the workout
   * @param {number} setIndex - Index of the set within the exercise
   * @param {string} currentWeight - Current weight being used
   * @param {string} currentReps - Current reps being performed
   * @returns {Object|null} - Message object with type and text, or null if no suggestion
   */
  const getProgressiveOverloadMessage = (exerciseIndex, setIndex, currentWeight, currentReps) => {
    const suggestion = progressiveOverloadSuggestions[exerciseIndex];
    if (!suggestion || !currentWeight || !currentReps) return null;

    const weight = parseFloat(currentWeight) || 0;
    const reps = parseInt(currentReps) || 0;

    // Check if user matched or exceeded previous performance
    if (weight > suggestion.lastWeight) {
      return {
        type: 'success',
        message: `🔥 New weight PR! (+${(weight - suggestion.lastWeight).toFixed(1)} lbs)`
      };
    } else if (weight === suggestion.lastWeight && reps > suggestion.lastReps) {
      return {
        type: 'success',
        message: `💪 More reps! (+${reps - suggestion.lastReps} reps)`
      };
    } else if (weight === suggestion.lastWeight && reps === suggestion.lastReps) {
      return {
        type: 'suggestion',
        message: `💡 Same as last time. Try ${suggestion.suggestedWeight} lbs or ${suggestion.suggestedReps} reps!`
      };
    }
    
    return null;
  };

  // Save workout template to database (for custom/AI workouts only)
  // This function saves the current workout state to the workouts table
  // Called whenever exercises or sets are modified to persist changes immediately
  const saveWorkoutTemplate = async () => {
    // Only save if this is a custom or AI-generated workout with an ID
    if (!workoutId || !workout) return;
    
    const workoutName = workout.workout_name || workout.name;
    const isPredefinedByName = Object.keys(workoutData).includes(workoutName);
    
    // Don't save predefined workouts
    if (isPredefinedWorkout || isPredefinedByName) {
      return;
    }

    try {
      // Prepare exercises for saving in the workouts table format
      // Format: [{ name, sets (as string), reps (as string) }]
      const exercisesForTemplate = workout.exercises.map(exercise => ({
        name: exercise.name,
        sets: exercise.sets.length.toString(), // Number of sets as string
        reps: exercise.sets[0]?.reps || '8-12' // Default reps from first set
      }));

      const { error: updateError } = await supabase
        .from('workouts')
        .update({
          exercises: exercisesForTemplate,
          workout_name: workoutName
        })
        .eq('id', workoutId);

      if (updateError) {
        console.error('Error saving workout template:', updateError);
      } else {
        console.log('Workout template saved successfully');
      }
    } catch (saveErr) {
      console.error('Error saving workout template:', saveErr);
    }
  };

  // Remove a set from an exercise
  // This function removes a specific set by its index from the exercise's sets array
  const handleRemoveSet = (exerciseIndex, setIndex) => {
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
      console.error('Invalid workout structure for removing set');
      return;
    }

    const exercise = workout.exercises[exerciseIndex];
    const sets = exercise.sets || [];
    
    // Don't allow removing if there's only one set left
    if (sets.length <= 1) {
      return;
    }

    // Create a new workout object with the set removed
    // filter() creates a new array excluding the set at setIndex
    const newWorkout = {
      ...workout,
      exercises: workout.exercises.map((ex, exIdx) => {
        if (exIdx === exerciseIndex) {
          return {
            ...ex,
            sets: sets.filter((_, setIdx) => setIdx !== setIndex)
          };
        }
        return ex;
      })
    };
    setWorkout(newWorkout);
    
    // Save workout template immediately after removing set
    saveWorkoutTemplate();
  };

  // Add a new set to an exercise
  // This function adds a new empty set to the end of the exercise's sets array
  const handleAddSet = (exerciseIndex) => {
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
      console.error('Invalid workout structure for adding set');
      return;
    }

    const exercise = workout.exercises[exerciseIndex];
    const sets = exercise.sets || [];
    
    // Get the reps value from the last set, or use default '8-12' if no sets exist
    // This helps maintain consistency when adding new sets
    const lastSetReps = sets.length > 0 ? sets[sets.length - 1].reps : '8-12';
    
    // Create a new workout object with a new set added
    // The spread operator (...) creates a new array with the existing sets plus the new one
    const newWorkout = {
      ...workout,
      exercises: workout.exercises.map((ex, exIdx) => {
        if (exIdx === exerciseIndex) {
          return {
            ...ex,
            sets: [...sets, { weight: '', reps: lastSetReps, completed: false }]
          };
        }
        return ex;
      })
    };
    setWorkout(newWorkout);
    
    // Save workout template immediately after adding set
    saveWorkoutTemplate();
  };

  // Add a new exercise to the workout
  // This function adds a new exercise with default sets to the workout
  const handleAddExercise = (exerciseName) => {
    if (!workout) {
      console.error('No workout to add exercise to');
      return;
    }

    // Get exercise info from library if available
    const exerciseInfo = getExerciseInfo(exerciseName);
    
    // Create a new exercise object with default structure
    // Sets array with 3 default sets, each with empty weight and '8-12' reps
    const newExercise = {
      name: exerciseName,
      targetMuscles: exerciseInfo?.targetMuscles || 'Various',
      instructions: exerciseInfo?.instructions || [],
      sets: [
        { weight: '', reps: '8-12', completed: false },
        { weight: '', reps: '8-12', completed: false },
        { weight: '', reps: '8-12', completed: false },
      ],
    };

    // Create a new workout object with the new exercise added
    // The spread operator adds the new exercise to the end of the exercises array
    const newWorkout = {
      ...workout,
      exercises: [...workout.exercises, newExercise]
    };
    
    setWorkout(newWorkout);
    setShowAddExerciseModal(false);
    setExerciseSearchQuery('');
    
    // Save workout template immediately after adding exercise
    saveWorkoutTemplate();
  };

  // Remove an exercise from the workout
  // This function removes a specific exercise by its index from the workout
  // Shows a confirmation dialog before removing to prevent accidental deletions
  const handleRemoveExercise = (exerciseIndex) => {
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
      console.error('Invalid workout structure for removing exercise');
      return;
    }

    const exercises = workout.exercises || [];
    const exerciseName = exercises[exerciseIndex]?.name || 'this exercise';
    
    // Don't allow removing if there's only one exercise left
    if (exercises.length <= 1) {
      Alert.alert(
        'Cannot Remove',
        'You must have at least one exercise in your workout.'
      );
      return;
    }

    // Show confirmation dialog before removing
    // Alert.alert() displays a native dialog with title, message, and buttons
    Alert.alert(
      'Remove Exercise?',
      `Are you sure you want to remove "${exerciseName}" from your workout?`,
      [
        {
          text: 'Cancel',
          style: 'cancel' // This makes it the cancel button (appears on left on iOS)
        },
        {
          text: 'Remove',
          style: 'destructive', // Red text on iOS to indicate destructive action
          onPress: () => {
            // Only remove if user confirms by pressing "Remove"
            // Create a new workout object with the exercise removed
            // filter() creates a new array excluding the exercise at exerciseIndex
            const newWorkout = {
              ...workout,
              exercises: exercises.filter((_, exIdx) => exIdx !== exerciseIndex)
            };
            
            setWorkout(newWorkout);
            
            // Save workout template immediately after removing exercise
            saveWorkoutTemplate();
          }
        }
      ]
    );
  };

  // Auto-fill weight suggestions for an exercise
  const handleAutoFillWeight = async (exerciseIndex) => {
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) return;
    
    const exercise = workout.exercises[exerciseIndex];
    
    // Skip if exercise already has weights filled
    if (exercise.sets && exercise.sets.some(set => set.weight && set.weight.trim() !== '')) {
      return;
    }
    
    try {
      // Get target reps from first set (parse range like "8-12" to average)
      const targetRepsStr = exercise.sets?.[0]?.reps || '10';
      const repsMatch = targetRepsStr.match(/(\d+)/);
      const targetReps = repsMatch ? parseInt(repsMatch[1]) : 10;
      
      // Get weight suggestion (pass userId for workout history learning)
      const suggestion = await suggestWeightForExercise(
        exercise.name,
        personalRecords || [],
        userProfile,
        targetReps,
        user?.id || null
      );
      
      if (suggestion && suggestion.weight) {
        // Fill all sets with the suggested weight (0 for bodyweight exercises)
        const newWorkout = {
          ...workout,
          exercises: workout.exercises.map((ex, exIdx) => {
            if (exIdx === exerciseIndex) {
              return {
                ...ex,
                sets: ex.sets.map(set => ({
                  ...set,
                  weight: set.weight || suggestion.weight
                }))
              };
            }
            return ex;
          })
        };
        setWorkout(newWorkout);
        if (suggestion.isBodyweight) {
          console.log(`[Auto-fill] Filled ${exercise.name} with 0 (bodyweight exercise)`);
        } else {
          console.log(`[Auto-fill] Suggested ${suggestion.weight}lbs for ${exercise.name} (${suggestion.source})`);
        }
      }
    } catch (error) {
      console.error('[Auto-fill] Error suggesting weight:', error);
    }
  };

  // Auto-fill weights for all exercises
  const handleAutoFillAll = async () => {
    if (!workout || !workout.exercises) return;
    
    try {
      const updates = [];
      
      // Collect all suggestions
      for (let i = 0; i < workout.exercises.length; i++) {
        const exercise = workout.exercises[i];
        
        // Skip if already has weights
        if (exercise.sets && exercise.sets.some(set => set.weight && set.weight.trim() !== '')) {
          continue;
        }
        
        // Get target reps
        const targetRepsStr = exercise.sets?.[0]?.reps || '10';
        const repsMatch = targetRepsStr.match(/(\d+)/);
        const targetReps = repsMatch ? parseInt(repsMatch[1]) : 10;
        
        // Get suggestion (pass userId for workout history learning)
        const suggestion = await suggestWeightForExercise(
          exercise.name,
          personalRecords || [],
          userProfile,
          targetReps,
          user?.id || null
        );
        
        // Include all exercises (bodyweight exercises will get "0")
        if (suggestion && suggestion.weight) {
          updates.push({ index: i, weight: suggestion.weight, exerciseName: exercise.name });
        }
      }
      
      // Apply all updates at once
      if (updates.length > 0) {
        const newWorkout = {
          ...workout,
          exercises: workout.exercises.map((exercise, exIdx) => {
            const update = updates.find(u => u.index === exIdx);
            if (update) {
              return {
                ...exercise,
                sets: exercise.sets.map(set => ({
                  ...set,
                  weight: set.weight || update.weight
                }))
              };
            }
            return exercise;
          })
        };
        setWorkout(newWorkout);
        console.log(`[Auto-fill All] Filled ${updates.length} exercises`);
      }
    } catch (error) {
      console.error('[Auto-fill All] Error:', error);
    }
  };

  const handleHowToPress = async (exercise) => {
    try {
      console.log('[handleHowToPress] Exercise data:', JSON.stringify(exercise, null, 2));
      
      // Normalize exercise data - handle both targetMuscles and target_muscles
      const normalizedExercise = {
        name: exercise.name,
        targetMuscles: exercise.targetMuscles || exercise.target_muscles || 'N/A',
        instructions: exercise.instructions || null
      };
      
      // Helper to check if instructions are placeholder/generic
      const isPlaceholderInstruction = (inst) => {
        if (!inst) return true;
        const placeholderTexts = [
          'no specific instructions available',
          'no instructions available',
          'instructions not available',
          'n/a',
          'tbd',
          'to be determined'
        ];
        const instStr = Array.isArray(inst) ? inst.join(' ').toLowerCase() : inst.toLowerCase();
        return placeholderTexts.some(placeholder => instStr.includes(placeholder)) || instStr.trim().length === 0;
      };

      // Helper: fetch demo GIF from ExerciseDB API and update modal if still showing this exercise
      const tryFetchAndSetGif = (name) => {
        fetchExerciseGifUrl(name).then((url) => {
          if (url) setCurrentExercise((prev) => (prev && prev.name === name ? { ...prev, gifUrl: url } : prev));
        });
      };
      
      // First, check if exercise already has valid instructions (not placeholder)
      if (normalizedExercise.instructions && !isPlaceholderInstruction(normalizedExercise.instructions)) {
        const validInstructions = Array.isArray(normalizedExercise.instructions) 
          ? normalizedExercise.instructions 
          : [normalizedExercise.instructions];
        
        // Double-check the instructions aren't all placeholders
        if (validInstructions.length > 0 && !isPlaceholderInstruction(validInstructions.join(' '))) {
          console.log('[handleHowToPress] Using exercise own instructions');
          const data = { name: normalizedExercise.name, targetMuscles: normalizedExercise.targetMuscles, instructions: validInstructions };
          setCurrentExercise(data);
          setShowHowToModal(true);
          if (!data.gifUrl && !data.videoUrl) tryFetchAndSetGif(exercise.name);
          return;
        }
      }

      // Try to find in exercise library
      const libraryInfo = getExerciseInfo(exercise.name);
      if (libraryInfo) {
        console.log('[handleHowToPress] Found in exercise library');
        setCurrentExercise(libraryInfo);
        setShowHowToModal(true);
        if (!libraryInfo.gifUrl && !libraryInfo.videoUrl) tryFetchAndSetGif(exercise.name);
        return;
      }

      // Try defaultExerciseInfo as fallback
      const defaultInfo = defaultExerciseInfo[exercise.name.toLowerCase().replace(/\s+/g, '-')];
      if (defaultInfo) {
        console.log('[handleHowToPress] Found in defaultExerciseInfo');
        setCurrentExercise(defaultInfo);
        setShowHowToModal(true);
        if (!defaultInfo.gifUrl && !defaultInfo.videoUrl) tryFetchAndSetGif(exercise.name);
        return;
      }

      // If not found, generate instructions with AI
      console.log('[handleHowToPress] Generating with AI');
      setLoadingInstructions(true);
      const result = await generateExerciseInstructions(exercise.name);
      setLoadingInstructions(false);

      if (result.success && result.exercise) {
        // Convert instructions to array format if it's a string
        const exerciseData = {
          name: result.exercise.name || exercise.name,
          targetMuscles: result.exercise.targetMuscles || result.exercise.target_muscles || 'N/A',
          instructions: Array.isArray(result.exercise.instructions) 
            ? result.exercise.instructions 
            : typeof result.exercise.instructions === 'string'
            ? [result.exercise.instructions]
            : ['Instructions generated successfully']
        };
        console.log('[handleHowToPress] AI generated exercise data:', exerciseData);
        setCurrentExercise(exerciseData);
        setShowHowToModal(true);
        if (!exerciseData.gifUrl && !exerciseData.videoUrl) tryFetchAndSetGif(exercise.name);
    } else {
      Alert.alert(
          'Unable to Load Instructions',
          'Sorry, we couldn\'t load instructions for this exercise. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      setLoadingInstructions(false);
      console.error('[handleHowToPress] Error loading exercise instructions:', error);
      Alert.alert(
        'Error',
        'Failed to load exercise instructions. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Add loading state at the top of the component
  if (!workout) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'}}>
        <Text style={{color: '#00ffff', fontSize: 18}}>Loading workout...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
      {/* Rest Timer Corner Widget - Floating */}
      {showRestTimer && (
        <View style={[
          styles.restTimerWidget,
          restTimerActive && { shadowOpacity: 0.6 } // Brighter shadow when active
        ]}>
          <View style={styles.restTimerHeader}>
            <Text style={styles.restTimerTitle}>Rest</Text>
            <View style={styles.restTimerHeaderActions}>
              <TouchableOpacity 
                onPress={() => setShowEditRestTimeModal(true)} 
                style={styles.editRestTimeButton}
                accessibilityLabel="Customize rest time"
              >
                <Ionicons name="time-outline" size={16} color="#00ffff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={skipRest} style={styles.skipRestButton}>
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Circular Progress Bar Container */}
          <View style={styles.progressContainer}>
            <CircularProgress 
              progress={restTimerActive && currentRestTime > 0 ? 1 - (currentRestTime / restTime) : 1}
              size={100}
              strokeWidth={8}
              color="#00ffff"
              backgroundColor="rgba(255, 255, 255, 0.1)"
            />
            <View style={styles.timerContent}>
              {restTimerActive && currentRestTime > 0 ? (
                <>
                  <Text style={styles.restTimerText}>{formatTime(currentRestTime)}</Text>
                  <TouchableOpacity onPress={toggleRestTimer} style={styles.restTimerPlayButton}>
                    <Ionicons 
                      name={restTimerActive ? "pause" : "play"} 
                      size={24} 
                      color="#00ffff" 
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[styles.restTimerText, { fontSize: 11, textAlign: 'center', paddingHorizontal: 4 }]}>
                  Rest Timer{'\n'}Done
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleExit}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {workout?.name}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.headerActionColumn}>
          <TouchableOpacity 
            style={styles.finishButton}
            onPress={handleFinish}
          >
            <Text style={styles.finishButtonText}>Finish</Text>
          </TouchableOpacity>
              {workout?.exercises && workout.exercises.some(ex => 
                ex.sets && ex.sets.every(set => !set.weight || set.weight.trim() === '')
              ) && (
                <TouchableOpacity 
                  style={styles.autofillAllButton}
                  onPress={handleAutoFillAll}
                >
                  <Ionicons name="sparkles" size={14} color="#00ffff" />
                  <Text style={styles.autofillAllButtonText}>Autofill All</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={20} color="#00ffff" />
            <Text style={styles.statText}>{formatTime(elapsedTime)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flame-outline" size={20} color="#00ffff" />
            <Text style={styles.statText}>{Math.round(calories)} cal</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {workout?.exercises.map((exercise, exerciseIndex) => (
            <View key={exerciseIndex} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                {/* Top Row: Exercise Name and Target Muscles */}
                <View style={styles.exerciseInfoRow}>
                  <Text style={styles.exerciseName}>{exercise.name || 'Exercise'}</Text>
                  <Text style={styles.targetMuscles}>
                    {exercise.targetMuscles || 'N/A'}
                  </Text>
                </View>
                
                {/* Bottom Bar: Autofill Weight, How To, Trash (evenly spaced) */}
                <View style={styles.exerciseTopBar}>
                  {/* Autofill Weight Button - Left side */}
                  {exercise.sets && exercise.sets.every(set => !set.weight || set.weight.trim() === '') ? (
                  <TouchableOpacity
                          style={styles.autoFillButton}
                          onPress={() => handleAutoFillWeight(exerciseIndex)}
                        >
                          <Ionicons name="sparkles" size={16} color="#00ffff" />
                          <Text style={styles.autoFillButtonText}>Autofill Weight</Text>
                        </TouchableOpacity>
                  ) : (
                    <View style={styles.autoFillButtonPlaceholder} />
                      )}
                  
                  {/* How To Button - Center */}
                      <TouchableOpacity
                        style={[styles.howToButton, loadingInstructions && styles.howToButtonDisabled]}
                    onPress={() => handleHowToPress(exercise)}
                        disabled={loadingInstructions}
                  >
                        {loadingInstructions ? (
                          <ActivityIndicator size="small" color="#00ffff" />
                        ) : (
                    <Text style={styles.howToButtonText}>How To</Text>
                        )}
                  </TouchableOpacity>
                  
                  {/* Remove Exercise Button - Right side */}
                  {workout.exercises.length > 1 ? (
                    <TouchableOpacity
                      style={styles.removeExerciseButton}
                      onPress={() => handleRemoveExercise(exerciseIndex)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.removeExerciseButtonPlaceholder} />
                  )}
                </View>
              </View>

              {/* Show last time data above first set if we have suggestions */}
              {progressiveOverloadSuggestions[exerciseIndex] && exercise.sets.length > 0 && (
                <View style={styles.lastTimeCard}>
                  <Ionicons name="time-outline" size={16} color="#00ffff" />
                  <Text style={styles.lastTimeText}>
                    Last time: {progressiveOverloadSuggestions[exerciseIndex].lastWeight} lbs × {progressiveOverloadSuggestions[exerciseIndex].lastReps} reps
                    {progressiveOverloadSuggestions[exerciseIndex].daysAgo > 0 && ` (${progressiveOverloadSuggestions[exerciseIndex].daysAgo}d ago)`}
                  </Text>
                </View>
              )}

              {exercise.sets.map((set, setIndex) => {
                // Get progressive overload message for this set
                const suggestion = progressiveOverloadSuggestions[exerciseIndex];
                const overloadMessage = set.weight && set.reps ? 
                  getProgressiveOverloadMessage(exerciseIndex, setIndex, set.weight, set.reps) : null;
                
                return (
                  <View key={setIndex}>
                    <View style={styles.setRow}>
                      <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                      <View style={styles.setInputs}>
                        <View style={styles.weightInput}>
                          <TextInput
                            style={[
                              styles.input,
                              set.completed && styles.inputCompleted
                            ]}
                            placeholder={suggestion && setIndex === 0 ? 
                              `${suggestion.suggestedWeight}` : "0"}
                            placeholderTextColor={suggestion && setIndex === 0 ? "#00ffff" : "#666"}
                            keyboardType="numeric"
                            value={set.weight}
                            onChangeText={(text) => handleWeightChange(exerciseIndex, setIndex, text)}
                            editable={!set.completed}
                          />
                          <Text style={styles.inputLabel}>Weight (lbs)</Text>
                        </View>
                        <View style={styles.repsInput}>
                          <TextInput
                            style={[
                              styles.input,
                              set.completed && styles.inputCompleted
                            ]}
                            placeholder={suggestion && setIndex === 0 ? 
                              `${suggestion.suggestedReps}` : "0"}
                            placeholderTextColor={suggestion && setIndex === 0 ? "#00ffff" : "#666"}
                            keyboardType="numeric"
                            value={set.reps}
                            onChangeText={(text) => handleRepsChange(exerciseIndex, setIndex, text)}
                            editable={true} // Always editable so users can adjust reps even after completion
                          />
                          <Text style={styles.inputLabel}>Reps</Text>
                        </View>
                      </View>
                      {/* Complete Set Button - Checkmark to mark set as done */}
                      <TouchableOpacity 
                        style={[
                          styles.checkButton,
                          set.completed && styles.checkButtonCompleted
                        ]}
                        onPress={() => !set.completed && handleSetComplete(exerciseIndex, setIndex)}
                      >
                        <Ionicons 
                          name={set.completed ? "checkmark" : "ellipse-outline"} 
                          size={24} 
                          color={set.completed ? "#000" : "#00ffff"} 
                        />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Show progressive overload feedback */}
                    {overloadMessage && (
                      <View style={[
                        styles.progressFeedback,
                        overloadMessage.type === 'success' ? styles.progressSuccess : styles.progressSuggestion
                      ]}>
                        <Text style={styles.progressFeedbackText}>
                          {overloadMessage.message}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {/* Split Button: Left half for Add Set, Right half for Remove Set */}
              <View style={styles.splitSetButtons}>
                {/* Add Set Button - Left half */}
                <TouchableOpacity 
                  style={[styles.splitButton, styles.addSetButtonLeft]}
                  onPress={() => handleAddSet(exerciseIndex)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#00ffff" />
                  <Text style={styles.splitButtonText}>Add Set</Text>
                </TouchableOpacity>
                {/* Remove Set Button - Right half */}
                <TouchableOpacity 
                  style={[styles.splitButton, styles.removeSetButtonRight]}
                  onPress={() => handleRemoveSet(exerciseIndex, exercise.sets.length - 1)}
                  disabled={exercise.sets.length <= 1} // Disable if only one set left
                >
                  <Ionicons 
                    name="remove-circle-outline" 
                    size={20} 
                    color={exercise.sets.length <= 1 ? "#444" : "#ff4444"} 
                  />
                  <Text style={[
                    styles.splitButtonText,
                    exercise.sets.length <= 1 && styles.splitButtonTextDisabled
                  ]}>
                    Remove Set
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {/* Add Exercise Button */}
          <TouchableOpacity 
            style={styles.addExerciseButton}
            onPress={() => setShowAddExerciseModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="#00ffff" />
            <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Exit Confirmation Modal */}
        <Modal
          visible={showExitConfirmation}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="warning-outline" size={40} color="#ff4444" />
              </View>
              <Text style={styles.modalTitle}>Exit Workout?</Text>
              <Text style={styles.modalText}>
                Your progress will be lost if you exit now.{'\n'}
                Are you sure you want to leave?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowExitConfirmation(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Stay</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={async () => {
                    setShowExitConfirmation(false);
                    stopSpotifyPolling();
                    if (workoutSessionIdRef.current) {
                      await closeWorkoutSession('abandoned');
                    }
                    // Dismiss Live Activity when user abandons workout
                    // This immediately removes it from the lock screen
                    if (liveActivityId) {
                      await dismissLiveActivity(liveActivityId);
                      setLiveActivityId(null);
                    }
                    await clearStoredWorkout();
                    resetWorkout();
                    router.replace('/(tabs)/workout');
                  }}
                >
                  <Text style={styles.confirmButtonText}>Exit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Finish Confirmation Modal */}
        <Modal
          visible={showFinishConfirmation}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="checkmark-circle-outline" size={40} color="#00ffff" />
              </View>
              <Text style={styles.modalTitle}>Finish Workout?</Text>
              <Text style={styles.modalText}>
                Great job! Ready to complete this workout?{'\n'}
                Your progress will be saved.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowFinishConfirmation(false)}
                >
                  <Text style={styles.cancelButtonText}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={async () => {
                  
                   await confirmFinish();
                  }}
                >
                  <Text style={styles.confirmButtonText}>Finish</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* How To Modal */}
        <Modal
          visible={showHowToModal && !!currentExercise}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHowToModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.howToModalContent}>
              <View style={styles.howToModalHeader}>
                <Text style={styles.howToModalTitle}>{currentExercise?.name || 'Exercise Instructions'}</Text>
                <TouchableOpacity 
                  style={styles.howToCloseButton}
                  onPress={() => {
                    setShowHowToModal(false);
                    setCurrentExercise(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              {/* How-to media: GIF or video demo (GIF from ExerciseDB API or optional videoUrl in library) */}
              {(currentExercise?.gifUrl || currentExercise?.videoUrl) && (
                <View style={styles.howToMediaContainer}>
                  {currentExercise.videoUrl ? (
                    <Video
                      source={{ uri: currentExercise.videoUrl }}
                      style={styles.howToMedia}
                      resizeMode="contain"
                      shouldPlay={false}
                      useNativeControls
                      isLooping={true} 
                    />
                  ) : currentExercise.gifUrl ? (
                    <Image source={{ uri: currentExercise.gifUrl }} style={styles.howToMedia} resizeMode="contain" />
                  ) : null}
                </View>
              )}
              
              <ScrollView 
                style={styles.instructionsScrollContainer} 
                contentContainerStyle={styles.instructionsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.musclesSection}>
                  <Text style={styles.sectionLabel}>Target Muscles</Text>
                  <Text style={styles.targetMusclesText}>{currentExercise?.targetMuscles || 'N/A'}</Text>
                </View>
                
                <View style={styles.instructionsSection}>
                  <Text style={styles.sectionLabel}>Instructions</Text>
                  
                {currentExercise?.instructions ? (
                  typeof currentExercise.instructions === 'string' ? (
                    <Text style={styles.instructionText}>{currentExercise.instructions}</Text>
                    ) : Array.isArray(currentExercise.instructions) && currentExercise.instructions.length > 0 ? (
                    currentExercise.instructions.map((instruction, index) => (
                      <View key={index} style={styles.instructionStep}>
                          <Text style={styles.stepNumber}>{index + 1}</Text>
                        <Text style={styles.instructionText}>{instruction}</Text>
                      </View>
                    ))
                  ) : (
                      <Text style={styles.noInstructionsText}>No instructions available.</Text>
                  )
                ) : (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#00ffff" />
                      <Text style={styles.loadingText}>Loading instructions...</Text>
                    </View>
                )}
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
      <TouchableOpacity 
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          zIndex: 1000,
        }}
        onPress={() => setShowTrainerModal(true)}
      >
        <LinearGradient
          colors={['#00ffff', '#0088ff']}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2.5,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            shadowColor: '#00ffff',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 6,
            elevation: 6,
          }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 32, marginBottom: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 2 }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 2 }} />
            </View>
            <View style={{ width: 12, height: 2, backgroundColor: '#fff', borderRadius: 1, shadowColor: '#fff', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.6, shadowRadius: 1, elevation: 1 }} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
      </View>

      {/* Edit Rest Time Modal */}
      <Modal
        visible={showEditRestTimeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditRestTimeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { alignItems: 'center', padding: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Rest Time</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowEditRestTimeModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <Text style={styles.restTimePickerHint}>Rest time in 15-second steps</Text>
              <Picker
                selectedValue={Math.max(15, Math.min(300, Math.round(restTime / 15) * 15))}
                onValueChange={handleRestTimeChange}
                style={{ width: 200, color: '#fff', backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#222' }}
                itemStyle={{ color: '#fff', fontSize: 22 }}
              >
                {[...Array(20)].map((_, i) => {
                  const val = 15 + i * 15;
                  return <Picker.Item key={val} label={formatRestTime(val)} value={val} />;
                })}
              </Picker>
            </View>
            <TouchableOpacity 
              style={[styles.confirmButton, { marginTop: 20, width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }]} 
              onPress={() => setShowEditRestTimeModal(false)}
            >
              <Text style={[styles.confirmButtonText, { color: '#000' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Trainer Modal */}
      {showTrainerModal && (
        <TrainerModal
          visible={showTrainerModal}
          onClose={() => setShowTrainerModal(false)}
        />
      )}

      {/* Add Exercise Modal */}
      <Modal
        visible={showAddExerciseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddExerciseModal(false);
          setExerciseSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addExerciseModalContent}>
            {/* Header */}
            <View style={styles.addExerciseModalHeader}>
              <Text style={styles.addExerciseModalTitle}>Add Exercise</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddExerciseModal(false);
                  setExerciseSearchQuery('');
                }}
                style={styles.addExerciseModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.addExerciseSearchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.addExerciseSearchIcon} />
              <TextInput
                style={styles.addExerciseSearchInput}
                placeholder="Search exercises..."
                placeholderTextColor="#666"
                value={exerciseSearchQuery}
                onChangeText={setExerciseSearchQuery}
                autoCapitalize="none"
              />
              {exerciseSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setExerciseSearchQuery('')}
                  style={styles.addExerciseClearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Tabs */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.addExerciseCategoryTabs}
              contentContainerStyle={styles.addExerciseCategoryTabsContent}
            >
              {Object.keys(exerciseCategories).map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.addExerciseCategoryTab,
                    activeExerciseCategory === category && styles.addExerciseCategoryTabActive
                  ]}
                  onPress={() => {
                    setActiveExerciseCategory(category);
                    setExerciseSearchQuery('');
                  }}
                >
                  <Text style={[
                    styles.addExerciseCategoryTabText,
                    activeExerciseCategory === category && styles.addExerciseCategoryTabTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Exercise List */}
            <ScrollView 
              style={styles.addExerciseList}
              contentContainerStyle={styles.addExerciseListContent}
              showsVerticalScrollIndicator={false}
            >
              {(exerciseSearchQuery ? 
                // If searching, show all exercises that match
                Object.values(exerciseCategories).flat().filter(exercise => 
                  exercise.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                ) : 
                // Otherwise, show exercises in selected category
                exerciseCategories[activeExerciseCategory]
              ).map((exercise) => {
                // Check if exercise is already in workout
                const isAlreadyAdded = workout?.exercises?.some(e => e.name === exercise);
                
                return (
                  <TouchableOpacity
                    key={exercise}
                    style={[
                      styles.addExerciseItem,
                      isAlreadyAdded && styles.addExerciseItemDisabled
                    ]}
                    onPress={() => !isAlreadyAdded && handleAddExercise(exercise)}
                    disabled={isAlreadyAdded}
                  >
                    <Text style={[
                      styles.addExerciseItemText,
                      isAlreadyAdded && styles.addExerciseItemTextDisabled
                    ]}>
                      {exercise}
                    </Text>
                    {isAlreadyAdded ? (
                      <Ionicons name="checkmark-circle" size={20} color="#666" />
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color="#00ffff" />
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {/* No results message */}
              {exerciseSearchQuery && (exerciseSearchQuery ? 
                Object.values(exerciseCategories).flat().filter(exercise => 
                  exercise.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                ) : []
              ).length === 0 && (
                <View style={styles.addExerciseNoResults}>
                  <Ionicons name="search-outline" size={40} color="#666" />
                  <Text style={styles.addExerciseNoResultsText}>No exercises found</Text>
                  <Text style={styles.addExerciseNoResultsSubtext}>Try a different search term</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative', // Required for absolutely positioned children
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#000000',
    zIndex: 1,
    gap: 12,
  },
  closeButton: {
    padding: 8,
    zIndex: 2,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerActions: {
    flexShrink: 0,
  },
  headerActionColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  finishButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 5,
  },
  autofillAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00ffff',
    gap: 5,
    width: 100,
    justifyContent: 'center',
  },
  autofillAllButtonText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  finishButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    paddingBottom: 150, // Extra padding to ensure scrolling to bottom works
  },
  content: {
    flex: 1,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseHeader: {
    marginBottom: 20,
  },
  // Bottom Bar: Contains autofill, how to, and trash buttons horizontally
  // justifyContent: 'space-between' evenly spaces buttons across the width
  exerciseTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  // Placeholder views to maintain even spacing when buttons are conditionally hidden
  autoFillButtonPlaceholder: {
    flex: 1,
  },
  removeExerciseButtonPlaceholder: {
    width: 40, // Same width as trash button to maintain spacing
  },
  // Bottom Row: Exercise name and target muscles side by side
  exerciseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  // Remove Exercise Button: Trash icon to delete an exercise from the workout
  // Positioned in the top bar on the left
  removeExerciseButton: {
    padding: 4,
  },
  autoFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ffff',
    gap: 6,
  },
  autoFillButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
  },
  howToButtonDisabled: {
    opacity: 0.5,
  },
  howToButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  howToButtonText: {
    color: '#00ffff',
    fontSize: 14,
  },
  targetMuscles: {
    color: '#666',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  setNumber: {
    width: 60,
    color: '#fff',
    fontSize: 14,
  },
  setInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 15,
  },
  weightInput: {
    flex: 1,
  },
  repsInput: {
    flex: 1,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  inputCompleted: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    color: '#00ffff',
  },
  repsText: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    textAlign: 'center',
  },
  repsTextCompleted: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    color: '#00ffff',
  },
  inputLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  // Check Button: Circle button to mark set as completed
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00ffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  checkButtonCompleted: {
    backgroundColor: '#00ffff',
  },
  // Split Set Buttons Container: Holds both Add and Remove buttons side by side
  // flexDirection: 'row' arranges buttons horizontally
  // gap adds space between the two halves
  splitSetButtons: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  // Split Button: Base style for both halves of the split button
  // flex: 1 makes each half take equal width
  // flexDirection: 'row' arranges icon and text horizontally
  splitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  // Add Set Button (Left Half): Cyan-themed button
  addSetButtonLeft: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  // Remove Set Button (Right Half): Red-themed button
  removeSetButtonRight: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  // Split Button Text: Text style for both button halves
  splitButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Split Button Text Disabled: Grayed out text when button is disabled
  splitButtonTextDisabled: {
    color: '#666',
  },
  restTimerWidget: {
    position: 'absolute',
    top: 120,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    padding: 16,
    width: 140,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999, // Much higher z-index to stay on top
    // Ensure it stays floating above all content
    pointerEvents: 'box-none',
    alignItems: 'center',
  },
  progressContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  timerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: 100,
  },
  restTimerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restTimerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editRestTimeButton: {
    padding: 2,
  },
  restTimerTitle: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  skipRestButton: {
    padding: 2,
  },
  restTimerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  restTimerPlayButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  backgroundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 2,
  },
  backgroundIndicatorText: {
    color: '#00ffff',
    fontSize: 8,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  modalIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  timeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    width: '100%',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmButton: {
    backgroundColor: '#00ffff',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  howToModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 0,
    width: '90%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  howToModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  howToModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    letterSpacing: -0.3,
  },
  howToCloseButton: {
    padding: 4,
    marginLeft: 12,
  },
  howToMediaContainer: {
    width: '100%',
    aspectRatio: 16/9,
    maxHeight: 280,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginLeft: 10,
  },
  howToMedia: {
    width: '100%',
    height: '100%',
  },
  instructionsScrollContainer: {
    maxHeight: 520,
  },
  instructionsScrollContent: {
    padding: 24,
  },
  musclesSection: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetMusclesText: {
    fontSize: 16,
    color: '#00ffff',
    lineHeight: 24,
    fontWeight: '400',
  },
  instructionsSection: {
    marginTop: 0,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ffff',
    marginRight: 16,
    marginTop: 2,
    minWidth: 24,
  },
  instructionText: {
    fontSize: 16,
    color: '#ddd',
    flex: 1,
    lineHeight: 24,
    fontWeight: '400',
  },
  noInstructionsText: {
    fontSize: 15,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#00ffff',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '400',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalCloseButton: {
    padding: 5,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    alignItems: 'center',
  },
  restTimePickerHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00ffff',
    marginVertical: 20,
  },
  // Add Exercise Button: Button at bottom of workout to add new exercises
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#00ffff',
    gap: 10,
  },
  addExerciseButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Add Exercise Modal Styles
  addExerciseModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '85%',
    paddingTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addExerciseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  addExerciseModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addExerciseModalCloseButton: {
    padding: 4,
  },
  addExerciseSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addExerciseSearchIcon: {
    marginRight: 10,
  },
  addExerciseSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  addExerciseClearButton: {
    marginLeft: 10,
    padding: 4,
  },
  addExerciseCategoryTabs: {
    maxHeight: 50,
    marginBottom: 15,
  },
  addExerciseCategoryTabsContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  addExerciseCategoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addExerciseCategoryTabActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderColor: '#00ffff',
  },
  addExerciseCategoryTabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  addExerciseCategoryTabTextActive: {
    color: '#00ffff',
  },
  addExerciseList: {
    flex: 1,
  },
  addExerciseListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  addExerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addExerciseItemDisabled: {
    opacity: 0.5,
  },
  addExerciseItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  addExerciseItemTextDisabled: {
    color: '#666',
  },
  addExerciseNoResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  addExerciseNoResultsText: {
    color: '#999',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  addExerciseNoResultsSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  // Progressive Overload Styles
  lastTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 4,
    gap: 8,
  },
  lastTimeText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
  },
  progressFeedback: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 0,
  },
  progressSuccess: {
    backgroundColor: 'rgba(0, 255, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#00ff00',
  },
  progressSuggestion: {
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#ffa500',
  },
  progressFeedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'left',
  },
});

export default ActiveWorkoutScreen; 