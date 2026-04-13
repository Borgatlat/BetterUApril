import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FeedbackCard from './FeedbackCard';
import { submitFeedback } from '../../utils/feedbackService';

const FEEDBACK_STORAGE_KEY = '@BetterU_mental_session_count';
const FEEDBACK_FREQUENCY = 5; // Show on 1st session, then every 5th (5, 10, 15...)

const MentalSessionSummary = ({ sessionData, onSave }) => {
  const router = useRouter();
  const [showFeedbackCard, setShowFeedbackCard] = useState(false);

  const handleSave = async () => {
    try {
      await onSave(sessionData);
      router.push('/mental-logs');
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Check if we should show feedback on mount (1st session or every Nth session)
  useEffect(() => {
    let mounted = true;

    const checkFeedbackFrequency = async () => {
      try {
        const raw = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
        const count = raw ? parseInt(raw, 10) : 0;
        const newCount = count + 1;
        await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, String(newCount));

        // Show on first session OR every 5th session
        const shouldShow = newCount === 1 || newCount % FEEDBACK_FREQUENCY === 0;
        if (mounted) setShowFeedbackCard(shouldShow);
      } catch (e) {
        console.warn('Feedback frequency check failed:', e);
        if (mounted) setShowFeedbackCard(false);
      }
    };

    checkFeedbackFrequency();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFeedbackSubmit = async (data) => {
    const result = await submitFeedback(data);
    if (!result.success) {
      console.warn('[MentalSessionSummary] Feedback submit failed:', result.error);
    }
    return result;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session Summary</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Session Details</Text>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={24} color="#00ffff" />
          <Text style={styles.detailText}>Duration: {sessionData.duration} minutes</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="fitness-outline" size={24} color="#00ffff" />
          <Text style={styles.detailText}>Type: {sessionData.type}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="heart-outline" size={24} color="#00ffff" />
          <Text style={styles.detailText}>Calmness Level: {sessionData.calmnessLevel}/10</Text>
        </View>
      </View>

      <View style={styles.notesCard}>
        <Text style={styles.notesTitle}>Notes</Text>
        <Text style={styles.notesText}>{sessionData.notes || 'No notes added'}</Text>
      </View>

      {showFeedbackCard && (
        <View style={styles.feedbackCardContainer}>
          <FeedbackCard
            type="mental-heath"
            contextId={sessionData?.type || null}
            onSubmit={handleFeedbackSubmit}
          />
        </View>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Session</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 10,
  },
  notesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  notesText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
  },
  feedbackCardContainer: {
    marginBottom: 20,
    
  },
  saveButton: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default MentalSessionSummary;
