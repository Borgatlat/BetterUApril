import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TrainingPlansScreen = () => {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/workout')}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Training Plans</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Push/Pull/Legs Plan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Push/Pull/Legs</Text>
          <View style={styles.sectionMeta}>
            <Text style={styles.sectionSubtitle}>3-day split</Text>
            <Ionicons name="barbell-outline" size={24} color="#00ffff" />
          </View>
        </View>
        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Push Day' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Push Day</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on chest, shoulders, and triceps
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Bench Press</Text>
              <Text style={styles.exercisesList}>2. Overhead Press</Text>
              <Text style={styles.exercisesList}>3. Incline Dumbbell Press</Text>
              <Text style={styles.exercisesList}>4. Lateral Raises</Text>
              <Text style={styles.exercisesList}>5. Tricep Pushdowns</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Push Day' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Pull Day' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Pull Day</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on back, biceps, and rear delts
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Deadlifts</Text>
              <Text style={styles.exercisesList}>2. Pull-ups</Text>
              <Text style={styles.exercisesList}>3. Barbell Rows</Text>
              <Text style={styles.exercisesList}>4. Face Pulls</Text>
              <Text style={styles.exercisesList}>5. Bicep Curls</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Pull Day' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Leg Day' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Leg Day</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on quads, hamstrings, and calves
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Squats</Text>
              <Text style={styles.exercisesList}>2. Romanian Deadlifts</Text>
              <Text style={styles.exercisesList}>3. Leg Press</Text>
              <Text style={styles.exercisesList}>4. Leg Curls</Text>
              <Text style={styles.exercisesList}>5. Calf Raises</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Leg Day' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Upper/Lower Plan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upper/Lower</Text>
          <View style={styles.sectionMeta}>
            <Text style={styles.sectionSubtitle}>4-day split</Text>
            <Ionicons name="fitness-outline" size={24} color="#00ffff" />
          </View>
        </View>
        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Upper Body 1' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Upper Body 1</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on chest, shoulders, and triceps
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Bench Press</Text>
              <Text style={styles.exercisesList}>2. Military Press</Text>
              <Text style={styles.exercisesList}>3. Incline Dumbbell Press</Text>
              <Text style={styles.exercisesList}>4. Lateral Raises</Text>
              <Text style={styles.exercisesList}>5. Tricep Pushdowns</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Upper Body 1' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Lower Body 1' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Lower Body 1</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on quads and calves
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Back Squats</Text>
              <Text style={styles.exercisesList}>2. Leg Press</Text>
              <Text style={styles.exercisesList}>3. Bulgarian Split Squats</Text>
              <Text style={styles.exercisesList}>4. Leg Extensions</Text>
              <Text style={styles.exercisesList}>5. Calf Raises</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Lower Body 1' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Upper Body 2' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Upper Body 2</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on back and biceps
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Deadlifts</Text>
              <Text style={styles.exercisesList}>2. Pull-ups</Text>
              <Text style={styles.exercisesList}>3. Barbell Rows</Text>
              <Text style={styles.exercisesList}>4. Face Pulls</Text>
              <Text style={styles.exercisesList}>5. Bicep Curls</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Upper Body 2' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Lower Body 2' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Lower Body 2</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>8-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on hamstrings and glutes
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Romanian Deadlifts</Text>
              <Text style={styles.exercisesList}>2. Hip Thrusts</Text>
              <Text style={styles.exercisesList}>3. Leg Curls</Text>
              <Text style={styles.exercisesList}>4. Glute Bridges</Text>
              <Text style={styles.exercisesList}>5. Calf Raises</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Lower Body 2' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Strength Focus Plan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Strength Focus</Text>
          <View style={styles.sectionMeta}>
            <Text style={styles.sectionSubtitle}>3-day split</Text>
            <Ionicons name="trophy-outline" size={24} color="#00ffff" />
          </View>
        </View>
        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Strength Day 1' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Strength Day 1</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>5 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on heavy compound lifts
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>5 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Squats</Text>
              <Text style={styles.exercisesList}>2. Bench Press</Text>
              <Text style={styles.exercisesList}>3. Overhead Press</Text>
              <Text style={styles.exercisesList}>4. Barbell Rows</Text>
              <Text style={styles.exercisesList}>5. Weighted Dips</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Strength Day 1' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Strength Day 2' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Strength Day 2</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>5 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on power and explosiveness
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>5 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Deadlifts</Text>
              <Text style={styles.exercisesList}>2. Power Cleans</Text>
              <Text style={styles.exercisesList}>3. Front Squats</Text>
              <Text style={styles.exercisesList}>4. Pull-ups</Text>
              <Text style={styles.exercisesList}>5. Core Work</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Strength Day 2' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Strength Day 3' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Strength Day 3</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>4 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on accessory movements
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Incline Press</Text>
              <Text style={styles.exercisesList}>2. Romanian Deadlifts</Text>
              <Text style={styles.exercisesList}>3. Military Press</Text>
              <Text style={styles.exercisesList}>4. Weighted Chin-ups</Text>
              <Text style={styles.exercisesList}>5. Core Work</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Strength Day 3' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Hypertrophy Focus Plan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hypertrophy Focus</Text>
          <View style={styles.sectionMeta}>
            <Text style={styles.sectionSubtitle}>4-day split</Text>
            <Ionicons name="body-outline" size={24} color="#00ffff" />
          </View>
        </View>
        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Chest & Triceps' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Chest & Triceps</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>10-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on chest and tricep development
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Incline Bench Press</Text>
              <Text style={styles.exercisesList}>2. Flat Dumbbell Press</Text>
              <Text style={styles.exercisesList}>3. Cable Flyes</Text>
              <Text style={styles.exercisesList}>4. Tricep Pushdowns</Text>
              <Text style={styles.exercisesList}>5. Overhead Tricep Extensions</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Chest & Triceps' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Back & Biceps' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Back & Biceps</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>10-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on back and bicep development
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Pull-ups</Text>
              <Text style={styles.exercisesList}>2. Barbell Rows</Text>
              <Text style={styles.exercisesList}>3. Lat Pulldowns</Text>
              <Text style={styles.exercisesList}>4. Bicep Curls</Text>
              <Text style={styles.exercisesList}>5. Hammer Curls</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Back & Biceps' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Legs' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Legs</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>10-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on leg development
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Squats</Text>
              <Text style={styles.exercisesList}>2. Romanian Deadlifts</Text>
              <Text style={styles.exercisesList}>3. Leg Press</Text>
              <Text style={styles.exercisesList}>4. Leg Curls</Text>
              <Text style={styles.exercisesList}>5. Calf Raises</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Legs' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.planCard}
          onPress={() => router.push({
            pathname: '/active-workout',
            params: { type: 'Shoulders & Arms' }
          })}
        >
          <View>
            <View style={styles.workoutHeader}>
              <Text style={styles.planTitle}>Shoulders & Arms</Text>
              <View style={styles.repRange}>
                <Text style={styles.repRangeText}>10-12 reps</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>
              Focus on shoulders and arm development
            </Text>
            <View style={styles.workoutMeta}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.metaText}>45 min</Text>
              <Ionicons name="flame-outline" size={20} color="#666" />
              <Text style={styles.metaText}>High Intensity</Text>
            </View>
            <View style={styles.exercises}>
              <Text style={styles.exercisesTitle}>Exercises:</Text>
              <Text style={styles.exercisesList}>1. Overhead Press</Text>
              <Text style={styles.exercisesList}>2. Lateral Raises</Text>
              <Text style={styles.exercisesList}>3. Face Pulls</Text>
              <Text style={styles.exercisesList}>4. Bicep Curls</Text>
              <Text style={styles.exercisesList}>5. Tricep Extensions</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push({
              pathname: '/active-workout',
              params: { type: 'Shoulders & Arms' }
            })}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#00ffff',
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  repRange: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  repRangeText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  metaText: {
    color: '#666',
    fontSize: 14,
    marginRight: 15,
  },
  exercises: {
    marginBottom: 15,
  },
  exercisesTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 5,
  },
  exercisesList: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  startButton: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  startButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TrainingPlansScreen; 