import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { setFeedLoaded, setCachedFeedData } from '../../utils/feedPreloader';
import { useUser } from '../../context/UserContext';

export default function EditWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { userProfile, updateProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workout, setWorkout] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [exerciseCount, setExerciseCount] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [borderColor, setBorderColor] = useState(null);
  const [applyingColor, setApplyingColor] = useState(false);

  // Duration display helper - duration is read-only
  const durationMinutesDisplay = useMemo(() => {
    const seconds = Number(duration);
    if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
    const minutes = seconds / 60;
    if (minutes >= 60) {
      const wholeHours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes < 0.01) {
        return `${wholeHours} hr${wholeHours === 1 ? '' : 's'}`;
      }
      return `${wholeHours} hr ${remainingMinutes.toFixed(1)} min`;
    }
    return `${minutes < 1 ? minutes.toFixed(2) : minutes.toFixed(1)} min`;
  }, [duration]);

  useEffect(() => {
    fetchWorkout();
  }, [id]);

  const fetchWorkout = async () => {
    try {
      const { data, error } = await supabase
        .from('user_workout_logs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setWorkout(data);
      setName(data.workout_name || '');
      setDescription(data.description || '');
      setDuration(data.duration?.toString() || '');
      setExerciseCount(data.exercise_count?.toString() || '');
      setPhotoUrl(data.photo_url || null);
      setBorderColor(data.border_color || null);
    } catch (error) {
      console.error('Error fetching workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async () => {
    try {
      // Request permissions for media library (images and videos)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your media library to add photos or videos.');
        return;
      }

      // Launch picker with ALL media types (images + videos)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Changed from .Images to .All to support videos
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        videoMaxDuration: 60, // Limit videos to 60 seconds
      });

      if (result.canceled || !result.assets || !result.assets[0]?.uri) return;

      const file = result.assets[0];
      
      // Detect if it's a video or image
      // Note: Using === for comparison (not = which is assignment)
      const isVideo = file.type === 'video' || file.uri.includes('.mp4') || file.uri.includes('.mov');
      
      // Set file type (MIME type) and name based on media type
      const fileType = isVideo ? 'video/mp4' : 'image/jpeg';
      const fileName = isVideo ? 'workout.mp4' : 'workout.jpg';
      
      // Choose the correct Cloudinary endpoint
      const cloudinaryEndpoint = isVideo ? 'video/upload' : 'image/upload';
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/derqwaq9h/${cloudinaryEndpoint}`;

      setUploading(true);
      
      // Create form data for Cloudinary upload
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: fileType, // MIME type: 'video/mp4' or 'image/jpeg'
        name: fileName, // 'workout.mp4' or 'workout.jpg'
      });
      formData.append('upload_preset', 'profilepics');
      
      const response = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.secure_url) throw new Error('Upload failed');
      
      // Save the URL (works for both images and videos)
      setPhotoUrl(data.secure_url);
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      setUploading(true);
      const { error } = await supabase
        .from('user_workout_logs')
        .update({ photo_url: null })
        .eq('id', id);

      if (error) throw error;
      setPhotoUrl(null);
    } catch (error) {
      console.error('Error deleting photo:', error);
      Alert.alert('Error', 'Failed to delete photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Duration is NOT included in updates - it cannot be changed
      const updates = {
        workout_name: name,
        description: description,
        // duration is excluded - cannot be edited
        exercise_count: exerciseCount ? parseInt(exerciseCount) : null,
        photo_url: photoUrl,
      };

      const { error } = await supabase
        .from('user_workout_logs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      router.back();
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  // Color options - basic colors that look great on dark backgrounds
  const COLOR_OPTIONS = [
    { value: '#00ffff', name: 'Cyan' },      // Your app's accent color
    { value: '#ff6b6b', name: 'Coral Red' },
    { value: '#4ecdc4', name: 'Turquoise' },
    { value: '#95e1d3', name: 'Mint' },
    { value: '#f38181', name: 'Pink' },
    { value: '#a8e6cf', name: 'Green' },
    { value: '#ffd93d', name: 'Yellow' },
    { value: '#ff9ff3', name: 'Magenta' },
    { value: '#6c5ce7', name: 'Purple' },
    { value: '#74b9ff', name: 'Blue' },
    { value: '#fd79a8', name: 'Rose' },
    { value: '#fdcb6e', name: 'Orange' },
  ];

  // Helper function to get color option style
  const getColorOptionStyle = (colorValue) => {
    return {
      ...styles.colorOption,
      backgroundColor: colorValue,
    };
  };

  const handleColorSelect = async (color) => {
    // If selecting the same color, do nothing
    if (borderColor === color) return;

    const sparksBalance = userProfile?.sparks_balance || 0;
    const colorName = COLOR_OPTIONS.find(c => c.value === color)?.name || 'this color';
    
    // Check if user has enough sparks
    if (sparksBalance < 1) {
      Alert.alert(
        'Not Enough Sparks',
        'You need 1 Spark to apply a border color. Refer friends to earn Sparks!',
        [
          { text: 'OK' },
          {
            text: 'Earn Sparks',
            onPress: () => router.push('/(tabs)/profile'),
          }
        ]
      );
      return;
    }

    // Confirm purchase
    Alert.alert(
      'Apply Border Color?',
      `Apply ${colorName} border for 1 Spark?\n\nYou will have ${sparksBalance - 1} Sparks remaining.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setApplyingColor(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('User not authenticated');

              // Update workout border color
              const { error: workoutError } = await supabase
                .from('user_workout_logs')
                .update({ border_color: color })
                .eq('id', id);

              if (workoutError) throw workoutError;

              // Deduct 1 spark from user's balance
              const newSparksBalance = sparksBalance - 1;
              const { error: sparksError } = await supabase
                .from('profiles')
                .update({ sparks_balance: newSparksBalance })
                .eq('id', user.id);

              if (sparksError) throw sparksError;

              // Update local state
              setBorderColor(color);
              if (updateProfile) {
                updateProfile({ sparks_balance: newSparksBalance });
              }

              Alert.alert('Success!', `Border color applied! Your workout will stand out in the feed.`);
            } catch (error) {
              console.error('Error applying border color:', error);
              Alert.alert('Error', 'Failed to apply border color. Please try again.');
            } finally {
              setApplyingColor(false);
            }
          }
        }
      ]
    );
  };

  const handleRemoveColor = async () => {
    Alert.alert(
      'Remove Border Color?',
      'This will remove the custom border from your workout post.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            setApplyingColor(true);
            try {
              const { error } = await supabase
                .from('user_workout_logs')
                .update({ border_color: null })
                .eq('id', id);

              if (error) throw error;
              setBorderColor(null);
              Alert.alert('Success!', 'Border color removed.');
            } catch (error) {
              console.error('Error removing border color:', error);
              Alert.alert('Error', 'Failed to remove border color. Please try again.');
            } finally {
              setApplyingColor(false);
            }
          }
        }
      ]
    );
  };

  const handleDelete = () => {
    // Prompt the user before deleting because deletes are permanent.
    Alert.alert(
      'Delete workout?',
      'This will permanently remove this workout from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const { error } = await supabase
                .from('user_workout_logs')
                .delete()
                .eq('id', id); // Restrict delete to this single workout row.
              if (error) throw error;
              // Clear the cached feed so the deleted workout disappears immediately next time the feed opens.
              setFeedLoaded(false);
              setCachedFeedData({
                feed: [],
                allFeedItems: [],
                profileMap: {},
                feedPage: 0,
                hasMoreFeed: true
              });
              Alert.alert('Workout deleted');
              router.replace('/(tabs)/community');
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout. Please try again.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#00ffff" size="large" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Workout</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Workout Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter workout name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Duration Display (Read-only) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>
              {durationMinutesDisplay}
              <Text style={styles.readOnlySubtext}> ({Math.floor(Number(duration) / 60)} minutes)</Text>
            </Text>
            <Text style={styles.readOnlyNote}>Duration cannot be changed</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Exercise Count</Text>
            <TextInput
              style={styles.input}
              value={exerciseCount}
              onChangeText={setExerciseCount}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Border Color Section */}
        <View style={styles.borderColorSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Border Color</Text>
            <Text style={styles.sparkCostText}>1 Spark per color</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Make your workout stand out in the feed with a custom colored border!
          </Text>
          
          {/* Current Color Display */}
          {borderColor && (
            <View style={styles.currentColorContainer}>
              <View style={[styles.currentColorPreview, { borderColor }]} />
              <Text style={styles.currentColorText}>
                Current: {COLOR_OPTIONS.find(c => c.value === borderColor)?.name || 'Custom Color'}
              </Text>
              <TouchableOpacity
                style={styles.removeColorButton}
                onPress={handleRemoveColor}
                disabled={applyingColor}
              >
                <Ionicons name="close-circle" size={20} color="#ff558f" />
                <Text style={styles.removeColorText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Color Picker Grid */}
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map((color) => {
              const isSelected = borderColor === color.value;
              return (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    getColorOptionStyle(color.value),
                    isSelected && styles.colorOptionSelected,
                  ]}
                  onPress={() => handleColorSelect(color.value)}
                  disabled={applyingColor || isSelected}
                >
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Workout Photo</Text>
          <TouchableOpacity 
            style={styles.photoButton}
            onPress={handlePhotoUpload}
            disabled={uploading}
          >
            {photoUrl ? (
              <View style={styles.photoContainer}>
                <Image 
                  source={{ uri: photoUrl }} 
                  style={styles.workoutPhoto}
                  resizeMode="cover"
                />
                <View style={styles.photoOverlay}>
                  <TouchableOpacity 
                    style={styles.photoActionButton}
                    onPress={handlePhotoUpload}
                  >
                    <Ionicons name="camera" size={24} color="#fff" />
                    <Text style={styles.photoActionText}>Change Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.photoActionButton, styles.deleteButton]}
                    onPress={handleDeletePhoto}
                    disabled={uploading}
                  >
                    <Ionicons name="trash" size={24} color="#fff" />
                    <Text style={styles.photoActionText}>
                      {uploading ? 'Deleting...' : 'Delete Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                {uploading ? (
                  <ActivityIndicator color="#00ffff" size="large" />
                ) : (
                  <>
                    <Ionicons name="camera" size={32} color="#00ffff" />
                    <Text style={styles.photoButtonText}>Add Photo</Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteActivityButton, deleting && styles.deleteActivityButtonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteActivityText}>Delete Workout</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingTop: 60,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding at bottom so delete button is fully visible
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#00ffff',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    borderRadius: 15,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#00ffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoSection: {
    marginBottom: 24,
  },
  photoButton: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    marginTop: 8,
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  workoutPhoto: {
    width: '100%',
    height: '100%',
  },
  photoButtonText: {
    color: '#00ffff',
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  photoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 0, 85, 0.2)',
  },
  photoActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteActivityButton: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 85, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 85, 0.4)',
  },
  deleteActivityButtonDisabled: {
    opacity: 0.7,
  },
  deleteActivityText: {
    color: '#ff558f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 13,
  },
  readOnlyField: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  readOnlyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  readOnlySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '400',
  },
  readOnlyNote: {
    color: '#6b7280',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  borderColorSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sparkCostText: {
    color: '#ffd93d',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionDescription: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  currentColorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    gap: 12,
  },
  currentColorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  currentColorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  removeColorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 85, 143, 0.2)',
    borderRadius: 8,
  },
  removeColorText: {
    color: '#ff558f',
    fontSize: 13,
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  colorOptionSelected: {
    borderColor: '#fff',
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
  },
}); 