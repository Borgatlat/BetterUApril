import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert, Switch } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from '../../lib/MapView';
import { setFeedLoaded, setCachedFeedData } from '../../utils/feedPreloader';
import { useUser } from '../../context/UserContext';

export default function EditRunScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { userProfile, updateProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [run, setRun] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [pace, setPace] = useState('');
  const [showMapToOthers, setShowMapToOthers] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [borderColor, setBorderColor] = useState(null);
  const [applyingColor, setApplyingColor] = useState(false);

  useEffect(() => {
    fetchRun();
  }, [id]);

  const fetchRun = async () => {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setRun(data);
      setName(data.name || '');
      setDescription(data.notes || '');
      setDistance((data.distance_meters / 1000).toFixed(2));
      setDuration(data.duration_seconds?.toString() || '');
      // Recalculate pace: (duration in minutes) / (distance in km)
      const distanceKm = data.distance_meters / 1000;
      const durationMinutes = data.duration_seconds / 60;
      const calculatedPace = distanceKm > 0 && durationMinutes > 0 ? durationMinutes / distanceKm : 0;
      setPace(calculatedPace > 0 ? calculatedPace.toFixed(2) : '');
      setShowMapToOthers(data.show_map_to_others !== false); // Default to true if not set
      setPhotoUrl(data.photo_url || null);
      setBorderColor(data.border_color || null);
    } catch (error) {
      console.error('Error fetching run:', error);
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
      const isVideo = file.type === 'video' || file.uri.includes('.mp4') || file.uri.includes('.mov');
      
      // Set file type (MIME type) and name based on media type
      const fileType = isVideo ? 'video/mp4' : 'image/jpeg';
      const fileName = isVideo ? 'run.mp4' : 'run.jpg';
      
      // Choose the correct Cloudinary endpoint
      const cloudinaryEndpoint = isVideo ? 'video/upload' : 'image/upload';
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/derqwaq9h/${cloudinaryEndpoint}`;

      setUploading(true);
      
      // Create form data for Cloudinary upload
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: fileType, // MIME type: 'video/mp4' or 'image/jpeg'
        name: fileName, // 'run.mp4' or 'run.jpg'
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
        .from('runs')
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
    if (saving) return;

    try {
      setSaving(true);
      
      const updates = {
        name: name.trim() || null,
        notes: description.trim() || null,
        photo_url: photoUrl,
        show_map_to_others: showMapToOthers,
      };

      const { error } = await supabase
        .from('runs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', 'Run updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating run:', error);
      Alert.alert('Error', 'Failed to update run. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete run?',
      'This will permanently remove this run from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const { error } = await supabase
                .from('runs')
                .delete()
                .eq('id', id); // Constrain delete to the current run.
              if (error) throw error;
              setFeedLoaded(false);
              setCachedFeedData({
                feed: [],
                allFeedItems: [],
                profileMap: {},
                feedPage: 0,
                hasMoreFeed: true
              });
              Alert.alert('Run deleted');
              router.replace('/(tabs)/community');
            } catch (error) {
              console.error('Error deleting run:', error);
              Alert.alert('Error', 'Failed to delete run. Please try again.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const formatDurationMinutes = (seconds) => {
    if (seconds === undefined || seconds === null || seconds === '') {
      return '-';
    }

    const totalSeconds = Number(seconds);
    if (Number.isNaN(totalSeconds)) {
      return '-';
    }

    const totalMinutes = totalSeconds / 60;

    if (totalMinutes < 1) {
      return `${totalMinutes.toFixed(1)} min`;
    }

    if (totalMinutes < 60) {
      return `${Math.round(totalMinutes)} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.round(totalMinutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  // Color options - same as workout colors
  const COLOR_OPTIONS = [
    { value: '#00ffff', name: 'Cyan' },
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

  const formatPace = (pace) => {
    if (!pace || pace === 0) return '--:--';
    const paceNum = parseFloat(pace);
    if (isNaN(paceNum) || paceNum <= 0) return '--:--';
    const minutes = Math.floor(paceNum);
    const seconds = Math.round((paceNum - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleColorSelect = async (color) => {
    if (borderColor === color) return;

    const sparksBalance = userProfile?.sparks_balance || 0;
    const colorName = COLOR_OPTIONS.find(c => c.value === color)?.name || 'this color';
    
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

              const { error: runError } = await supabase
                .from('runs')
                .update({ border_color: color })
                .eq('id', id);

              if (runError) throw runError;

              const newSparksBalance = sparksBalance - 1;
              const { error: sparksError } = await supabase
                .from('profiles')
                .update({ sparks_balance: newSparksBalance })
                .eq('id', user.id);

              if (sparksError) throw sparksError;

              setBorderColor(color);
              if (updateProfile) {
                updateProfile({ sparks_balance: newSparksBalance });
              }

              Alert.alert('Success!', `Border color applied! Your activity will stand out in the feed.`);
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
      'This will remove the custom border from your activity post.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            setApplyingColor(true);
            try {
              const { error } = await supabase
                .from('runs')
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ffff" />
        <Text style={styles.loadingText}>Loading run...</Text>
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Run</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Run Map */}
        {run?.path && run.path.length > 1 && (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: run.path[0]?.latitude || 0,
                longitude: run.path[0]?.longitude || 0,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Polyline
                coordinates={run.path}
                strokeColor="#00ffff"
                strokeWidth={4}
              />
              {run.path.length > 0 && (
                <>
                  <Marker coordinate={run.path[0]} title="Start">
                    <View style={styles.startMarker} />
                  </Marker>
                  <Marker coordinate={run.path[run.path.length - 1]} title="End">
                    <View style={styles.endMarker} />
                  </Marker>
                </>
              )}
            </MapView>
          </View>
        )}

        {/* Run Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{distance} km</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Duration (minutes)</Text>
              <Text style={styles.statValue}>{formatDurationMinutes(run?.duration_seconds ?? duration)}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pace</Text>
              <Text style={styles.statValue}>{formatPace(parseFloat(pace))} /km</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Date</Text>
              <Text style={styles.statValue}>
                {run?.start_time ? new Date(run.start_time).toLocaleDateString() : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Run Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Enter run name..."
            placeholderTextColor="#666"
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add notes about your run..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Map Visibility Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleLabel}>Show Map to Others</Text>
              <Text style={styles.toggleDescription}>
                Allow friends to see your run route on the map
              </Text>
            </View>
            <Switch
              value={showMapToOthers}
              onValueChange={setShowMapToOthers}
              trackColor={{ false: '#333', true: '#00ffff' }}
              thumbColor={showMapToOthers ? '#fff' : '#ccc'}
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
            Make your activity stand out in the feed with a custom colored border!
          </Text>
          
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

        {/* Photo Section */}
        <View style={styles.photoContainer}>
          <Text style={styles.sectionTitle}>Run Photo</Text>
          {photoUrl ? (
            <View style={styles.photoWrapper}>
              <Image source={{ uri: photoUrl }} style={styles.photo} />
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoButton} onPress={handlePhotoUpload}>
                  <Ionicons name="camera" size={20} color="#00ffff" />
                  <Text style={styles.photoButtonText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoButton, styles.deleteButton]} onPress={handleDeletePhoto}>
                  <Ionicons name="trash" size={20} color="#ff4444" />
                  <Text style={[styles.photoButtonText, styles.deleteButtonText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addPhotoButton} onPress={handlePhotoUpload}>
              <Ionicons name="camera" size={32} color="#00ffff" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}
          {uploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#00ffff" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.deleteActivityButton, (deleting || saving) && styles.deleteActivityButtonDisabled]}
          onPress={handleDelete}
          disabled={deleting || saving}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteActivityText}>Delete Run</Text>
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
    paddingTop: 50, // Add padding for status bar
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding at bottom so delete button is fully visible
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#00c853',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#666',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  startMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00c853',
    borderWidth: 2,
    borderColor: '#fff',
  },
  endMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statsContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toggleDescription: {
    color: '#888',
    fontSize: 14,
  },
  photoContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  photoWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  photoButtonText: {
    color: '#00ffff',
    marginLeft: 4,
    fontSize: 14,
  },
  deleteButton: {
    marginLeft: 16,
  },
  deleteButtonText: {
    color: '#ff4444',
  },
  addPhotoButton: {
    backgroundColor: 'rgba(0,255,255,0.1)',
    borderWidth: 2,
    borderColor: '#00ffff',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    color: '#00ffff',
    fontSize: 16,
    marginTop: 8,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  uploadingText: {
    color: '#00ffff',
    marginLeft: 8,
  },
  deleteActivityButton: {
    marginTop: 24,
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