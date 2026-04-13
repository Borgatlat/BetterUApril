import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { FloatingAITrainer } from '../components/FloatingAITrainer';
import FeedbackCard from './components/FeedbackCard';
import { submitFeedback } from '../utils/feedbackService';
import { supabase } from '../lib/supabase';

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const workoutLogId = params.workoutLogId ? String(params.workoutLogId) : null;
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePhotoUpload = async () => {
    if (!workoutLogId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your media library to add photos or videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const file = result.assets[0];
      const isVideo = file.type === 'video' || file.uri.includes('.mp4') || file.uri.includes('.mov');
      const fileType = isVideo ? 'video/mp4' : 'image/jpeg';
      const fileName = isVideo ? 'workout.mp4' : 'workout.jpg';
      const cloudinaryEndpoint = isVideo ? 'video/upload' : 'image/upload';
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/derqwaq9h/${cloudinaryEndpoint}`;
      setUploading(true);
      const formData = new FormData();
      formData.append('file', { uri: file.uri, type: fileType, name: fileName });
      formData.append('upload_preset', 'profilepics');
      const response = await fetch(cloudinaryUrl, { method: 'POST', body: formData, headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!data.secure_url) throw new Error('Upload failed');
      const { error } = await supabase.from('user_workout_logs').update({ photo_url: data.secure_url }).eq('id', workoutLogId);
      if (error) throw error;
      setPhotoUrl(data.secure_url);
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const workoutContextId = params.workoutLogId || params.workoutId || params.workoutName || null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout Complete! 💪</Text>
        <Text style={styles.workoutName}>{params.workoutName}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatTime(params.duration || 0)}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="barbell-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Exercises</Text>
            <Text style={styles.statValue}>{params.exerciseCount || 0}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Sets Completed</Text>
            <Text style={styles.statValue}>{params.completedSets || 0}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="fitness-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Total Weight</Text>
            <Text style={styles.statValue}>{params.totalWeight || 0} lbs</Text>
          </View>
        </View>

        <View style={styles.messageContainer}>
          <Text style={styles.message}>Workout saved successfully!</Text>
          <Text style={styles.submessage}>You can view this in your workout logs</Text>
        </View>
      </View>

      {workoutLogId && (
        <View style={styles.mediaSection}>
          <Text style={styles.mediaSectionTitle}>Share on the feed</Text>
          <Text style={styles.mediaSectionSubtitle}>Add a photo or video to your post</Text>
          {photoUrl ? (
            <View style={styles.mediaPreviewWrap}>
              {!photoUrl.includes('.mp4') && !photoUrl.includes('.mov') && !photoUrl.includes('/video/') ? (
                <Image source={{ uri: photoUrl }} style={styles.mediaPreview} resizeMode="cover" />
              ) : (
                <View style={styles.mediaPreviewPlaceholder}>
                  <Ionicons name="videocam" size={32} color="#00ffff" />
                  <Text style={styles.mediaPreviewLabel}>Video added</Text>
                </View>
              )}
              <Text style={styles.mediaAddedText}>Added to your post</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={handlePhotoUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={24} color="#000" />
                  <Text style={[styles.mediaButtonText, { marginLeft: 8 }]}>Add photo or video</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.feedbackSection}>
        <FeedbackCard
          type="workout-quality"
          contextId={workoutContextId}
          onSubmit={async (data) => {
            const result = await submitFeedback(data);
            if (!result.success) {
              console.warn('[WorkoutSummary] Feedback submit failed:', result.error);
            }
          }}
        />
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/(tabs)')}
      >
        <Text style={styles.buttonText}>Back to Workouts</Text>
      </TouchableOpacity>

      <FloatingAITrainer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerContent: {
    padding: 20,
    paddingBottom: 40,
  },
  mediaSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  mediaSectionTitle: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mediaSectionSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 16,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  mediaButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  mediaPreviewWrap: {
    alignItems: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
  },
  mediaPreviewPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mediaPreviewLabel: {
    color: '#00ffff',
    fontSize: 14,
    marginTop: 8,
  },
  mediaAddedText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  feedbackSection: {
    marginBottom: 24,
  },
  header: {
    marginTop: 60,
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  workoutName: {
    fontSize: 20,
    color: '#00ffff',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 5,
  },
  statValue: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  messageContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  message: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  submessage: {
    color: '#666',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 