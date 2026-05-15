import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from '../../lib/MapView';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { LinearGradient } from 'expo-linear-gradient';

const ActivitySummary = () => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const params = useLocalSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const mapRef = useRef(null);
  
  // Parse the data from params
  const activityData = {
    locations: JSON.parse(params.locations || '[]'),
    distance: parseFloat(params.distance || 0),
    duration: parseFloat(params.duration || 0),
    pace: parseFloat(params.pace || 0),
    unit: params.unit || 'km',
    activityType: params.activityType || 'run', // 'run', 'walk', or 'bike'
    startTime: params.startTime,
    endTime: params.endTime
  };

  // Get activity-specific labels and icons
  const getActivityInfo = (type) => {
    switch (type) {
      case 'walk':
        return {
          title: 'Walk Summary',
          icon: 'footsteps',
          color: '#4CAF50',
          verb: 'walked',
          noun: 'walk'
        };
      case 'bike':
        return {
          title: 'Bike Summary',
          icon: 'bicycle',
          color: '#FF9800',
          verb: 'biked',
          noun: 'bike ride'
        };
      case 'timed_distance':
        return {
          title: 'Timed Distance Summary',
          icon: 'flash',
          color: '#ffd700',
          verb: 'completed',
          noun: 'timed distance'
        };
      case 'run':
      default:
        return {
          title: 'Run Summary',
          icon: 'flash',
          color: '#00ffff',
          verb: 'ran',
          noun: 'run'
        };
    }
  };

  const activityInfo = getActivityInfo(activityData.activityType);

  useEffect(() => {
    // Debug user state
    console.log('User state in ActivitySummary:', { isUserLoading, userId: user?.id });
  }, [isUserLoading, user]);

  useEffect(() => {
    if (mapRef.current && activityData.locations.length > 1) {
      mapRef.current.fitToCoordinates(activityData.locations, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  }, [activityData.locations]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace, activityType, unit) => {
    if (pace === 0) return '--:--';
    
    if (activityType === 'bike') {
      // For biking, show speed instead of pace
      const speed = unit === 'miles' ? pace * 0.621371 : pace;
      return `${speed.toFixed(1)} ${unit === 'miles' ? 'mph' : 'kph'}`;
    } else {
      // For running/walking, show pace
      const minutes = Math.floor(pace);
      const seconds = Math.floor((pace - minutes) * 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  const getPaceLabel = (activityType) => {
    return activityType === 'bike' ? 'Speed' : 'Avg Pace';
  };

  const saveActivity = async () => {
    if (isSaving) return;

    console.log('Save activity button pressed');
    console.log('Current user:', user);
    console.log('Activity data:', activityData);

    // Get the current user from Supabase directly if context is not ready
    let currentUser = user;
    if (!currentUser?.id) {
      console.log('No user in context, getting from Supabase');
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (!supabaseUser) {
        console.log('No user found in Supabase');
        Alert.alert('Error', 'Unable to save activity. Please try again.');
        return;
      }
      currentUser = supabaseUser;
      console.log('Got user from Supabase:', currentUser);
    }
  
    try {
      setIsSaving(true);
    
      const activityDataToSave = {
        user_id: currentUser.id,
        name: `${activityInfo.noun.charAt(0).toUpperCase() + activityInfo.noun.slice(1)}`,
        start_time: new Date(parseInt(activityData.startTime)).toISOString(),
        end_time: new Date(parseInt(activityData.endTime)).toISOString(),
        duration_seconds: activityData.duration,
        distance_meters: activityData.unit === 'miles' ? activityData.distance * 1609.34 : activityData.distance * 1000,
        average_pace_minutes_per_km: activityData.activityType === 'bike' ? activityData.pace : (activityData.unit === 'miles' ? activityData.pace * 1.60934 : activityData.pace),
        path: activityData.locations,
        status: 'completed',
        notes: `Completed ${activityInfo.noun}`,
        show_map_to_others: true,
        activity_type: activityData.activityType
      };

      console.log('Saving activity data:', activityDataToSave);

      const { error } = await supabase.from('runs').insert([activityDataToSave]);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
    
      console.log('Activity saved successfully');
      Alert.alert('Success', `${activityInfo.noun.charAt(0).toUpperCase() + activityInfo.noun.slice(1)} saved successfully!`);
      router.back();
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', `Failed to save ${activityInfo.noun}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  const discardActivity = () => {
    router.back();
  };

  // Only show loading state for a brief moment
  if (isUserLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activityInfo.color} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activityInfo.title}</Text>
      </View>
    
      <ScrollView style={styles.scrollView}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: activityData.locations[0]?.latitude || 0,
              longitude: activityData.locations[0]?.longitude || 0,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {activityData.locations.length > 1 && (
              <Polyline
                coordinates={activityData.locations}
                strokeColor={activityInfo.color}
                strokeWidth={4}
              />
            )}
            {activityData.locations.length > 0 && (
              <>
                <Marker
                  coordinate={activityData.locations[0]}
                  title="Start"
                >
                  <View style={[styles.startMarker, { backgroundColor: activityInfo.color }]} />
                </Marker>
                <Marker
                  coordinate={activityData.locations[activityData.locations.length - 1]}
                  title="End"
                >
                  <View style={[styles.endMarker, { backgroundColor: activityInfo.color }]} />
                </Marker>
              </>
            )}
          </MapView>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>
                {activityData.distance.toFixed(2)} {activityData.unit}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {formatTime(activityData.duration)}
              </Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{getPaceLabel(activityData.activityType)}</Text>
              <Text style={styles.statValue}>
                {formatPace(activityData.pace, activityData.activityType, activityData.unit)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Activity Type</Text>
              <Text style={styles.statValue}>
                {activityData.activityType === 'timed_distance' ? 'Timed Distance' : 
                 activityData.activityType === 'run' ? 'Run' :
                 activityData.activityType === 'walk' ? 'Walk' :
                 activityData.activityType === 'bike' ? 'Bike' :
                 activityData.activityType.charAt(0).toUpperCase() + activityData.activityType.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: activityInfo.color }]}
            onPress={saveActivity}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save {activityInfo.noun}</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.discardButton}
            onPress={discardActivity}
          >
            <Ionicons name="close" size={20} color="#ff4444" />
            <Text style={styles.discardButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  scrollView: {
    flex: 1,
  },
  mapContainer: {
    height: 300,
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  startMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  endMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  statsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 5,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 30,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff4444',
    backgroundColor: 'transparent',
  },
  discardButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ActivitySummary;
