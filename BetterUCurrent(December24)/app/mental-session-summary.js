"use client";

import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';
import { supabase } from '../lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const MentalSessionSummary = () => {
  const { user } = useAuth();
  const { incrementStat } = useTracking();
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionType = params.sessionType;
  const duration = params.duration; // Actual duration spent (in minutes)
  const durationSeconds = params.durationSeconds; // Actual duration in seconds (for precise display)
  const plannedDuration = params.plannedDuration; // Original planned duration
  const sessionName = params.sessionName;
  const sessionDescription = params.sessionDescription;
  const [calmnessLevel, setCalmnessLevel] = useState(3);
  const [notes, setNotes] = useState('');
  
  // Format duration for display - shows seconds if less than 1 minute
  // This function prioritizes showing actual seconds when available and less than 60 seconds
  const formatDuration = (minutes, seconds = null) => {
    // If we have actual seconds, use that for precise display
    if (seconds !== null && seconds !== undefined) {
      const totalSeconds = parseInt(seconds) || 0;
      
      // If less than 60 seconds, show in seconds
      if (totalSeconds < 60) {
        return `${totalSeconds} ${totalSeconds === 1 ? 'second' : 'seconds'}`;
      }
      
      // If 60+ seconds, convert to minutes for display
      const minsFromSeconds = Math.floor(totalSeconds / 60);
      const remainingSecs = totalSeconds % 60;
      
      if (minsFromSeconds < 60) {
        // Less than 1 hour - show minutes (and seconds if any)
        if (remainingSecs === 0) {
          return `${minsFromSeconds} ${minsFromSeconds === 1 ? 'minute' : 'minutes'}`;
        }
        // Show minutes and seconds if there are remaining seconds
        return `${minsFromSeconds} ${minsFromSeconds === 1 ? 'minute' : 'minutes'} ${remainingSecs} ${remainingSecs === 1 ? 'second' : 'seconds'}`;
      }
      
      // 60+ minutes - format as hours
      const hours = Math.floor(minsFromSeconds / 60);
      const remainingMins = minsFromSeconds % 60;
      if (remainingMins === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
      }
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainingMins} ${remainingMins === 1 ? 'minute' : 'minutes'}`;
    }
    
    // Fallback: format from minutes parameter
    const mins = parseInt(minutes) || 0;
    if (mins < 1) {
      return '0 minutes';
    }
    
    if (mins < 60) {
      return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainingMins} ${remainingMins === 1 ? 'minute' : 'minutes'}`;
  };

  const handleSave = async () => {
    try {
      // Save to mental_session_logs with all details
      // Use actual duration spent (in minutes) - minimum 1 minute if session was started
      const actualDurationMinutes = parseInt(duration) || 1;
      // Get actual seconds for precise tracking (if available)
      const actualDurationSeconds = durationSeconds ? parseInt(durationSeconds) : null;
      
      const { error: logError } = await supabase
        .from('mental_session_logs')
        .insert([
          {
            profile_id: user.id,
            session_type: sessionType,
            session_name: sessionName || (sessionType === 'meditation' ? 'Meditation Session' : 'Breathing Exercise'),
            description: sessionDescription || '',
            duration: actualDurationMinutes, // Store actual time spent in minutes (minimum 1 if started)
            duration_seconds: actualDurationSeconds, // Store actual time spent in seconds for precise display
            calmness_level: calmnessLevel,
            notes: notes,
            completed_at: new Date().toISOString()
          },
        ]);
      
      if (logError) {
        console.error('Error saving session log:', logError);
        throw logError;
      }

      // Update stats
      await incrementStat('mental_sessions');
      
      // Navigate to mental screen
      router.push('/mental');
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save session. Please try again.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.title}>Session Summary</Text>
        
        <View style={styles.summaryCard}>
          <Text style={styles.sessionType}>
            {sessionType === 'meditation' ? 'Meditation' : 'Breathing Exercise'}
          </Text>
          <Text style={styles.duration}>
            Duration: {formatDuration(duration, durationSeconds)}
          </Text>
          {plannedDuration && parseInt(plannedDuration) !== parseInt(duration) && (
            <Text style={styles.plannedDurationNote}>
              (Planned: {formatDuration(plannedDuration)})
            </Text>
          )}
          
          <View style={styles.calmnessSection}>
            <Text style={styles.calmnessLabel}>How calm do you feel?</Text>
            <View style={styles.calmnessButtons}>
              {[1, 2, 3, 4, 5].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.calmnessButton,
                    calmnessLevel === level && styles.selectedCalmnessButton,
                  ]}
                  onPress={() => setCalmnessLevel(level)}
                >
                  <Text style={[
                    styles.calmnessButtonText,
                    calmnessLevel === level && styles.selectedCalmnessButtonText,
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did you feel during the session?"
              placeholderTextColor="#666"
              multiline
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Session</Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sessionType: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  duration: {
    color: '#00ffff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  plannedDurationNote: {
    color: '#888',
    fontSize: 13,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  calmnessSection: {
    marginBottom: 20,
  },
  calmnessLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  calmnessButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calmnessButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCalmnessButton: {
    backgroundColor: '#00ffff',
  },
  calmnessButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCalmnessButtonText: {
    color: '#000',
  },
  notesSection: {
    marginBottom: 20,
  },
  notesLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#00ffff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MentalSessionSummary; 