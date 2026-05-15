import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
// useUser was only used to block non-premium users; now everyone can create workouts, so the import is no longer required.

// Organized exercise categories for better UX - Most common exercises first
const exerciseCategories = {
  'Chest': [
    // Most common at top
    'Bench Press', 'Push-Up', 'Incline Bench Press', 'Dumbbell Bench Press', 'Dumbbell Flyes',
    // Common variations
    'Cable Flyes', 'Decline Bench Press', 'Incline Push-Up', 'Decline Push-Up', 'Chest Press Machine',
    // Specialized exercises
    'Incline Dumbbell Flyes', 'Pec Deck', 'Cable Crossover', 'Dumbbell Pullover', 
    'Diamond Push-Up', 'Wide Grip Push-Up', 'Push-Up Variations'
  ],
  'Back': [
    // Most common at top
    'Pull-Up', 'Deadlift', 'Barbell Row', 'Lat Pulldown', 'Dumbbell Row', 'Chin-Up',
    // Common variations
    'Seated Cable Row', 'Cable Row', 'T-Bar Row', 'Romanian Deadlift', 'Bent Over Row',
    // Specialized exercises
    'One Arm Dumbbell Row', 'Wide Grip Pulldown', 'Close Grip Pulldown', 'Face Pull',
    'Cable Pullover', 'Reverse Fly', 'Shrugs', 'Upright Row', 'Cable Lat Pulldown'
  ],
  'Shoulders': [
    // Most common at top
    'Shoulder Press', 'Lateral Raise', 'Overhead Press', 'Dumbbell Shoulder Press', 'Front Raise',
    // Common variations
    'Rear Delt Fly', 'Arnold Press', 'Bent Over Lateral Raise', 'Cable Lateral Raise', 'Upright Row',
    // Specialized exercises
    'Push Press', 'Face Pull', 'Rear Delt Machine', 'Cable Shoulder Fly', 
    'Handstand Push-Up', 'Pike Push-Up'
  ],
  'Arms': [
    // Most common at top
    'Bicep Curl', 'Tricep Dip', 'Hammer Curl', 'Tricep Pushdown', 'Preacher Curl',
    // Common variations
    'Concentration Curl', 'Cable Curl', 'Skullcrusher', 'Tricep Kickback', 'Diamond Push-Up',
    // Specialized exercises
    'Overhead Tricep Extension', 'Close Grip Bench Press', 'Incline Dumbbell Curl', 'EZ Bar Curl',
    'Spider Curl', 'Cable Tricep Extension', 'Tricep Rope Pushdown', 'Behind Head Extension',
    '21s Bicep Curls', 'Cable Hammer Curl'
  ],
  'Legs': [
    // Most common at top
    'Squat', 'Deadlift', 'Leg Press', 'Lunge', 'Leg Extension', 'Leg Curl',
    // Common variations
    'Romanian Deadlift', 'Front Squat', 'Walking Lunge', 'Calf Raise', 'Reverse Lunge',
    // Specialized exercises
    'Bulgarian Split Squat', 'Back Squat', 'Lateral Lunge', 'Goblet Squat', 'Sumo Squat',
    'Stiff Leg Deadlift', 'Standing Calf Raise', 'Seated Calf Raise', 'Jump Squat',
    'Wall Sit', 'Pistol Squat', 'Hack Squat', 'Leg Press Calf Raise', 'Sissy Squat'
  ],
  'Core': [
    // Most common at top
    'Plank', 'Sit-Up', 'Crunches', 'Russian Twist', 'Leg Raise', 'Mountain Climber',
    // Common variations
    'Bicycle Crunch', 'Side Plank', 'Dead Bug', 'Reverse Crunch', 'Cable Crunch',
    // Specialized exercises
    'Hanging Leg Raise', 'Ab Wheel Rollout', 'Bird Dog', 'Oblique Crunch', 'Flutter Kicks',
    'Scissor Kicks', 'Hollow Body Hold', 'Plank to Pike', 'Bear Crawl', 'L-Sit', 'V-Up',
    'Dragon Flag', 'Windshield Wipers', 'Cable Wood Chop'
  ],
  'Glutes': [
    // Most common at top
    'Hip Thrust', 'Glute Bridge', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Reverse Lunge',
    // Common variations
    'Donkey Kicks', 'Sumo Deadlift', 'Step-Ups', 'Cable Kickbacks', 'Single Leg Glute Bridge',
    // Specialized exercises
    'Fire Hydrants', 'Hip Abduction', 'Kettlebell Swings', 'Clamshells', 'Lateral Band Walk',
    'Glute Press', 'Kickbacks'
  ],
  'Cardio': [
    // Most common at top
    'Burpees', 'Jump Rope', 'Jumping Jacks', 'High Knees', 'Sprint', 'Mountain Climbers',
    // Common variations
    'Jump Squat', 'Box Jump', 'Bear Crawls', 'Jump Lunges', 'Rowing Machine',
    // Specialized exercises
    'Battle Ropes', 'Kettlebell Swings', 'Squat Jumps', 'Star Jumps', 'Burpee Box Jump',
    'Tabata', 'Assault Bike', 'Skipping', 'Tuck Jumps'
  ]
};

const CreateWorkoutScreen = () => {
  const router = useRouter();
  const [workoutName, setWorkoutName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Chest');
  const [searchQuery, setSearchQuery] = useState('');
  // Everyone can now build workouts, so we no longer pull premium status from context.

  const toggleExercise = (exercise) => {
    try {
      if (selectedExercises.some(e => e.name === exercise)) {
        setSelectedExercises(selectedExercises.filter(e => e.name !== exercise));
      } else {
        setSelectedExercises([...selectedExercises, { name: exercise, sets: '3', reps: '10' }]);
      }
    } catch (err) {
      console.error('toggleExercise error:', err);
    }
  };

  const updateExerciseField = (exercise, field, value) => {
    try {
      setSelectedExercises(selectedExercises.map(e =>
        e.name === exercise ? { ...e, [field]: value } : e
      ));
    } catch (err) {
      console.error('updateExerciseField error:', err);
    }
  };

  const handleSave = async () => {
    try {
      if (!workoutName.trim()) {
        Alert.alert('Please enter a workout name.');
        return;
      }
      if (selectedExercises.length === 0) {
        Alert.alert('Please select at least one exercise.');
        return;
      }
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      const { error } = await supabase
        .from('workouts')
        .insert([
          {
            profile_id: user.id,
            workout_name: workoutName,
            exercises: selectedExercises,
          },
        ]);
      if (error) throw error;
      Alert.alert('Workout saved!');
      router.replace('/(tabs)/workout');
    } catch (err) {
      console.error('handleSave error:', err);
      Alert.alert('Error', err.message || 'Failed to save workout.');
    } finally {
      setSaving(false);
    }
  };

  const removeExercise = (exerciseName) => {
    setSelectedExercises(selectedExercises.filter(e => e.name !== exerciseName));
  };

  return (
    <KeyboardAvoidingView 
      style={styles.screenContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitButton} onPress={() => router.replace('/(tabs)/workout')}>
          <Ionicons name="close" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Workout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Workout Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Workout Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter workout name..."
            placeholderTextColor="#666"
            value={workoutName}
            onChangeText={setWorkoutName}
          />
        </View>

        {/* Selected Exercises Summary */}
        {selectedExercises.length > 0 && (
          <View style={styles.selectedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected Exercises ({selectedExercises.length})</Text>
              <TouchableOpacity onPress={() => setSelectedExercises([])}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.selectedExercises}>
              {selectedExercises.map((exercise, index) => (
                <View key={exercise.name} style={styles.selectedExerciseCard}>
                  <View style={styles.selectedExerciseInfo}>
                    <Text style={styles.selectedExerciseName}>{exercise.name}</Text>
                    <View style={styles.setsRepsContainer}>
                      <TextInput
                        style={styles.setsRepsInput}
                        value={exercise.sets}
                        onChangeText={val => updateExerciseField(exercise.name, 'sets', val)}
                        keyboardType="numeric"
                        placeholder="3"
                        placeholderTextColor="#666"
                      />
                      <Text style={styles.setsRepsText}>sets</Text>
                      <TextInput
                        style={styles.setsRepsInput}
                        value={exercise.reps}
                        onChangeText={val => updateExerciseField(exercise.name, 'reps', val)}
                        keyboardType="numeric"
                        placeholder="10"
                        placeholderTextColor="#666"
                      />
                      <Text style={styles.setsRepsText}>reps</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeExercise(exercise.name)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Exercise Categories */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Choose Exercises</Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Category Tabs */}
          {!searchQuery && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryTabs}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {Object.keys(exerciseCategories).map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryTab, activeCategory === category && styles.categoryTabActive]}
                  onPress={() => setActiveCategory(category)}
                >
                  <Text style={[styles.categoryTabText, activeCategory === category && styles.categoryTabTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Exercises - Filtered by search or category */}
          <View style={styles.exercisesGrid}>
            {(searchQuery ? 
              // If searching, show all exercises that match
              Object.values(exerciseCategories).flat().filter(exercise => 
                exercise.toLowerCase().includes(searchQuery.toLowerCase())
              ) : 
              // Otherwise, show exercises in selected category
              exerciseCategories[activeCategory]
            ).map((exercise) => {
              const selected = selectedExercises.some(e => e.name === exercise);
              return (
                <TouchableOpacity
                  key={exercise}
                  style={[styles.exerciseCard, selected && styles.exerciseCardSelected]}
                  onPress={() => toggleExercise(exercise)}
                >
                  <View style={styles.exerciseCardContent}>
                    <Text style={[styles.exerciseCardText, selected && styles.exerciseCardTextSelected]}>
                      {exercise}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color="#00ffff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* No results message */}
          {searchQuery && (searchQuery ? 
            Object.values(exerciseCategories).flat().filter(exercise => 
              exercise.toLowerCase().includes(searchQuery.toLowerCase())
            ) : []
          ).length === 0 && (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search-outline" size={40} color="#666" />
              <Text style={styles.noResultsText}>No exercises found</Text>
              <Text style={styles.noResultsSubtext}>Try a different search term</Text>
            </View>
          )}
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="hourglass-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </View>
            ) : (
              <View style={styles.saveButtonContent}>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Workout</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  exitButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding to ensure content is accessible when keyboard is open
  },
  inputSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    borderRadius: 15,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedSection: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  clearText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedExercises: {
    gap: 10,
  },
  selectedExerciseCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  selectedExerciseInfo: {
    flex: 1,
  },
  selectedExerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  setsRepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setsRepsInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    borderRadius: 8,
    padding: 6,
    fontSize: 14,
    textAlign: 'center',
    width: 50,
  },
  setsRepsText: {
    color: '#666',
    fontSize: 14,
  },
  removeButton: {
    padding: 5,
  },
  categoriesSection: {
    marginBottom: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  clearSearchButton: {
    padding: 5,
  },
  categoryTabs: {
    marginBottom: 20,
  },
  categoryTabsContent: {
    paddingHorizontal: 5,
  },
  categoryTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderColor: '#00ffff',
  },
  categoryTabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#00ffff',
  },
  exercisesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    minWidth: '48%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseCardSelected: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: '#00ffff',
  },
  exerciseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseCardText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  exerciseCardTextSelected: {
    color: '#00ffff',
  },
  saveSection: {
    marginBottom: 30,
  },
  saveButton: {
    backgroundColor: '#00ffff',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  noResultsSubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 5,
  },
});

export default CreateWorkoutScreen; 