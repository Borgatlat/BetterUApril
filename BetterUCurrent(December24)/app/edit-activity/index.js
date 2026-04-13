import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';

const EditActivity = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { updateStats } = useTracking();
  const [activity, setActivity] = useState({
    name: '',
    type: '',
    duration: '',
    calories: '',
    notes: ''
  });

  const handleSave = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in to save activities');
        return;
      }

      const { error } = await supabase
        .from('user_activities')
        .insert({
          user_id: user.id,
          name: activity.name,
          type: activity.type,
          duration: parseInt(activity.duration),
          calories: parseInt(activity.calories),
          notes: activity.notes,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update stats
      await updateStats(prev => ({
        ...prev,
        activities: (prev.activities || 0) + 1,
        minutes: (prev.minutes || 0) + parseInt(activity.duration)
      }));

      Alert.alert(
        'Success',
        'Activity saved successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Activity</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Activity Name</Text>
          <TextInput
            style={styles.input}
            value={activity.name}
            onChangeText={(text) => setActivity(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Running, Swimming, Cycling"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <TextInput
            style={styles.input}
            value={activity.type}
            onChangeText={(text) => setActivity(prev => ({ ...prev, type: text }))}
            placeholder="e.g., Cardio, Strength, Flexibility"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={activity.duration}
            onChangeText={(text) => setActivity(prev => ({ ...prev, duration: text }))}
            placeholder="Enter duration in minutes"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Calories Burned</Text>
          <TextInput
            style={styles.input}
            value={activity.calories}
            onChangeText={(text) => setActivity(prev => ({ ...prev, calories: text }))}
            placeholder="Enter calories burned"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={activity.notes}
            onChangeText={(text) => setActivity(prev => ({ ...prev, notes: text }))}
            placeholder="Add any additional notes..."
            placeholderTextColor="#666"
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  notesInput: {
    height: 100,
  },
});

export default EditActivity; 