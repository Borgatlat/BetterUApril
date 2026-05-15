"use client";

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const CategoryExercises = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const exercises = JSON.parse(params.exercises);
  const title = params.title;
  const color = params.color;

  const handleExercisePress = (exercise) => {
    router.push({
      pathname: '/active-mental-session',
      params: {
        id: exercise.id,
        title: exercise.title,
        duration: exercise.duration,
        description: exercise.description,
        steps: exercise.steps,
        type: exercise.type || exercise.session_type
      }
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.exercisesList}>
        {exercises.map((exercise) => (
          <TouchableOpacity
            key={exercise.id}
            style={[styles.exerciseCard, { borderColor: color }]}
            onPress={() => handleExercisePress(exercise)}
          >
            <View style={styles.exerciseContent}>
              <Text style={styles.exerciseTitle}>{exercise.title}</Text>
              <Text style={styles.exerciseDuration}>{exercise.duration} minutes</Text>
              <Text style={styles.exerciseDescription}>{exercise.description}</Text>
            </View>
            <View style={[styles.exerciseIcon, { backgroundColor: color }]}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
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
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  exercisesList: {
    padding: 20,
  },
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exerciseContent: {
    flex: 1,
    padding: 20,
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  exerciseDuration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  exerciseIcon: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CategoryExercises; 