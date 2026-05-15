import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  ActivityIndicator,
  Alert,
  Share,
  Image,
  Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from '../../lib/MapView';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useUnits } from '../../context/UnitsContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const ActivityDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { useImperial } = useUnits();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [error, setError] = useState(null);
  const [spotifyTracks, setSpotifyTracks] = useState([]);
  const [spotifyTracksLoading, setSpotifyTracksLoading] = useState(false);
  const [isAppleHealthImport, setIsAppleHealthImport] = useState(false);
  
  // Use a ref to track the timeout ID so we can clear it when loading completes
  // Refs persist across renders and don't trigger re-renders, perfect for storing values
  // that need to be accessed by closures (like setTimeout callbacks)
  const timeoutRef = useRef(null);

  const openSpotifyTrack = useCallback(async (track) => {
    const trackId = track?.track_id?.trim();

    if (!trackId) {
      Alert.alert('Track unavailable', 'We could not find a Spotify link for this song.');
      return;
    }

    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;

    try {
      const canOpen = await Linking.canOpenURL(spotifyUrl);
      if (!canOpen) {
        Alert.alert('Spotify unavailable', 'Spotify could not be opened on this device.');
        return;
      }

      await Linking.openURL(spotifyUrl);
    } catch (error) {
      console.error('Failed to open Spotify track link:', error);
      Alert.alert('Error', 'Something went wrong while opening Spotify.');
    }
  }, []);

  // Fetch activity details
  useEffect(() => {
    // Clear any existing timeout when the effect runs (e.g., when id changes)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (id) {
      fetchActivityDetails();
      
      // Add timeout to prevent infinite loading
      // Store the timeout ID in a ref so we can clear it when loading completes
      timeoutRef.current = setTimeout(() => {
        // Use setLoading with a function to get the CURRENT loading state
        // This avoids the closure problem - we check the actual current state
        setLoading(currentLoading => {
          // Only show error if we're STILL loading after 13 seconds
          if (currentLoading) {
            console.log('Activity loading timeout - forcing error state');
            setError('Loading timeout - please try again');
            return false; // Stop loading
          }
          return currentLoading; // If already loaded, don't change state
        });
        timeoutRef.current = null; // Clear the ref after timeout fires
      }, 13000); // 13 second timeout
      
      // Cleanup: clear timeout if component unmounts or id changes
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    } else {
      setError('No activity ID provided');
      setLoading(false);
    }
  }, [id]);

  const [userProfile, setUserProfile] = useState(null);

  const fetchWorkoutSpotifyTracks = async (sessionId) => {
    if (!sessionId) {
      setSpotifyTracks([]);
      return;
    }

    try {
      setSpotifyTracksLoading(true);
      const { data, error } = await supabase
        .from('workout_spotify_tracks')
        .select('track_name, artist_name, album_name, album_image_url, played_at, track_id')
        .eq('workout_session_id', sessionId)
        .order('played_at', { ascending: true });

      if (error) {
        throw error;
      }

      setSpotifyTracks(data || []);
    } catch (fetchError) {
      console.error('Error fetching workout Spotify tracks:', fetchError);
      setSpotifyTracks([]);
    } finally {
      setSpotifyTracksLoading(false);
    }
  };

  const fetchActivityDetails = async () => {
    try {
      setLoading(true);
      setSpotifyTracks([]);
      setSpotifyTracksLoading(false);
      
      if (!id) {
        console.error('No activity ID provided');
        Alert.alert('Error', 'No activity ID provided');
        router.back();
        return;
      }
      
      // First try to fetch as a run activity
      let { data: runData, error: runError } = await supabase
        .from('runs')
        .select('*')
        .eq('id', id)
        .single();

      if (runData && !runError) {
        console.log('Found activity in runs table:', runData);
        setActivity({ ...runData, type: 'run' });
        // Safely calculate map region with error handling
        try {
          calculateMapRegion(runData.path);
        } catch (mapError) {
          console.error('Error calculating map region:', mapError);
          // Don't set error state for map issues - just log them
        }
        await fetchUserProfile(runData.user_id);
        setSpotifyTracks([]);
        
        // Check if this was imported from Apple Health
        const { data: importCheck } = await supabase
          .from('apple_health_imports')
          .select('id')
          .eq('target_table', 'runs')
          .eq('target_id', id)
          .single();
        setIsAppleHealthImport(!!importCheck);
        
        // Clear the timeout since we successfully loaded the activity
        // This prevents the timeout from firing later and showing an error
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setLoading(false); // Turn off loading when activity is found
        return;
      }

      // Try to fetch as a workout
      let { data: workoutData, error: workoutError } = await supabase
        .from('user_workout_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (workoutData && !workoutError) {
        console.log('Found activity in user_workout_logs table:', workoutData);
        setActivity({ ...workoutData, type: 'workout' });
        await fetchUserProfile(workoutData.user_id);
        await fetchWorkoutSpotifyTracks(workoutData.workout_session_id);
        
        // Check if this was imported from Apple Health
        const { data: importCheck } = await supabase
          .from('apple_health_imports')
          .select('id')
          .eq('target_table', 'user_workout_logs')
          .eq('target_id', id)
          .single();
        setIsAppleHealthImport(!!importCheck);
        
        // Clear the timeout since we successfully loaded the activity
        // This prevents the timeout from firing later and showing an error
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setLoading(false); // Turn off loading when activity is found
        return;
      }

      // Try to fetch as a mental session
      let { data: mentalData, error: mentalError } = await supabase
        .from('mental_session_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (mentalData && !mentalError) {
        console.log('Found activity in mental_session_logs table:', mentalData);
        setActivity({ ...mentalData, type: 'mental' });
        await fetchUserProfile(mentalData.profile_id);
        setSpotifyTracks([]);
        // Clear the timeout since we successfully loaded the activity
        // This prevents the timeout from firing later and showing an error
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setLoading(false); // Turn off loading when activity is found
        return;
      }

      console.error('Activity not found in any table:', { id, runError, workoutError, mentalError });
      console.log('Debug info:', {
        id,
        runData: runData || null,
        workoutData: workoutData || null,
        mentalData: mentalData || null,
        runError: runError?.message || null,
        workoutError: workoutError?.message || null,
        mentalError: mentalError?.message || null
      });
      // Clear the timeout since we're handling the error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError('Activity not found in any table');
      setLoading(false);
      return;
    } catch (error) {
      console.error('Error fetching activity:', error);
      // Clear the timeout since we're handling the error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError(`Failed to load activity details: ${error.message}`);
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId) => {
    try {
      if (!userId) {
        console.log('No user ID provided for profile fetch');
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setUserProfile(data);
      } else if (error) {
        console.error('Error fetching user profile:', error);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const calculateMapRegion = (pathString) => {
    try {
      if (!pathString) {
        console.log('No path data provided for map region calculation');
        return;
      }
      
      const path = typeof pathString === 'string' ? JSON.parse(pathString) : pathString;
      if (!path || !Array.isArray(path) || path.length === 0) {
        console.log('Invalid path data for map region calculation:', pathString);
        return;
      }

      // Filter out invalid coordinates
      const validCoords = path.filter(coord => 
        coord && 
        typeof coord.latitude === 'number' && 
        typeof coord.longitude === 'number' &&
        !isNaN(coord.latitude) && 
        !isNaN(coord.longitude) &&
        coord.latitude >= -90 && 
        coord.latitude <= 90 &&
        coord.longitude >= -180 && 
        coord.longitude <= 180
      );

      if (validCoords.length === 0) {
        console.log('No valid coordinates found in path');
        return;
      }

      const lats = validCoords.map(coord => coord.latitude);
      const lngs = validCoords.map(coord => coord.longitude);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const latDelta = Math.max((maxLat - minLat) * 1.2, 0.01);
      const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.01);
      
      setMapRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      });
    } catch (error) {
      console.error('Error calculating map region:', error);
    }
  };

  const formatDuration = (seconds) => {
    // Round to nearest integer to avoid decimal places
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (paceMinutes) => {
    if (!paceMinutes) return '-';
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.floor((paceMinutes % 1) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    const km = meters / 1000;
    if (useImperial) {
      const miles = km * 0.621371;
      return `${miles.toFixed(2)} mi`;
    }
    return `${km.toFixed(2)} km`;
  };

  const formatSpeed = (meters, seconds) => {
    if (!seconds || seconds === 0) return '-';
    const kmh = (meters / 1000) / (seconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  };

  const getActivityIcon = (type, activityType) => {
    if (!type) return 'fitness-outline';
    
    switch (type) {
      case 'workout':
        return 'barbell-outline';
      case 'mental':
        return 'leaf-outline';
      case 'run':
        return activityType === 'run' ? 'fitness' : 
               activityType === 'walk' ? 'walk' : 'bicycle';
      default:
        return 'fitness-outline';
    }
  };

  const getActivityTitle = (type, activityType, name) => {
    if (name) return name;
    if (!type) return 'Activity';
    
    switch (type) {
      case 'workout':
        return 'Workout';
      case 'mental':
        return 'Mental Session';
      case 'run':
        return activityType === 'run' ? 'Run' : 
               activityType === 'walk' ? 'Walk' : 'Bike';
      default:
        return 'Activity';
    }
  };

  const handleShare = async () => {
    if (!activity) return;

    const activityText = `${getActivityTitle(activity.type, activity.activity_type, activity.name)} - ${formatDistance(activity.distance_meters || 0)} in ${formatDuration(activity.duration_seconds || 0)}`;
    
    try {
      await Share.share({
        message: activityText,
        title: 'Check out my activity!'
      });
    } catch (error) {
      console.error('Error sharing activity:', error);
    }
  };

  const handleEdit = () => {
    if (!activity) return;
    
    switch (activity.type) {
      case 'workout':
        router.push(`/edit-workout/${activity.id}`);
        break;
      case 'mental':
        router.push(`/edit-mental/${activity.id}`);
        break;
      case 'run':
        router.push(`/edit-run/${activity.id}`);
        break;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ffff" />
        <Text style={styles.loadingText}>Loading activity details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchActivityDetails();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Activity not found</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            fetchActivityDetails();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/community')}
        >
          <Ionicons name="chevron-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Ionicons 
            name={getActivityIcon(activity?.type, activity?.activity_type)} 
            size={24} 
            color="#00ffff" 
          />
          <Text style={styles.headerTitle}>
            {getActivityTitle(activity?.type, activity?.activity_type, activity?.name)}
          </Text>
        </View>

        <View style={styles.headerActions}>
           <TouchableOpacity 
             style={styles.actionButton}
             onPress={() => router.push({
               pathname: '/(modals)/CommentsScreen',
               params: { activityId: activity?.id, activityType: activity?.type }
             })}
           >
             <Ionicons name="chatbubble-ellipses-outline" size={20} color="#00ffff" />
           </TouchableOpacity>
           
           <TouchableOpacity 
             style={styles.actionButton}
             onPress={handleShare}
           >
             <Ionicons name="share-outline" size={20} color="#00ffff" />
           </TouchableOpacity>
           
           {activity && (activity.user_id === user?.id || activity.profile_id === user?.id) && (
             <TouchableOpacity 
               style={styles.actionButton}
               onPress={handleEdit}
             >
               <Ionicons name="pencil" size={20} color="#00ffff" />
             </TouchableOpacity>
           )}
         </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
         {/* User Profile Section */}
         {userProfile && (
           <View style={styles.userSection}>
             <TouchableOpacity 
               style={styles.userCard}
               onPress={() => router.push(`/profile/${userProfile.id}`)}
               activeOpacity={0.8}
             >
               <View style={styles.userInfo}>
                 <View style={styles.avatarContainer}>
                   {userProfile.avatar_url ? (
                     <Image 
                       source={{ uri: userProfile.avatar_url }} 
                       style={styles.avatar}
                     />
                   ) : (
                     <View style={styles.avatarPlaceholder}>
                       <Ionicons name="person" size={24} color="#00ffff" />
                     </View>
                   )}
                 </View>
                 <View style={styles.userDetails}>
                   <Text style={styles.userName}>
                     {userProfile.full_name || userProfile.username || 'User'}
                   </Text>
                   <Text style={styles.userDate}>
                     {new Date(activity.start_time || activity.completed_at || activity.created_at).toLocaleDateString()}
                   </Text>
                 </View>
               </View>
               <Ionicons name="chevron-forward" size={20} color="#666" />
             </TouchableOpacity>
           </View>
         )}

         {/* Apple Health Import Badge */}
         {isAppleHealthImport && (
           <View style={styles.appleHealthBadge}>
             <View style={styles.appleHealthBadgeContent}>
               <Ionicons name="heart" size={18} color="#FF2D55" />
               <Text style={styles.appleHealthBadgeText}>Imported from Apple Health</Text>
             </View>
           </View>
         )}

         {/* Activity Stats */}
         <View style={styles.statsSection}>
           <Text style={styles.sectionTitle}>Activity Stats</Text>
           
           <View style={styles.statsGrid}>
             {/* GPS Activities (Run, Walk, Bike) - Distance */}
             {activity.distance_meters != null && activity.distance_meters > 0 && activity.type === 'run' && (
               <View style={styles.statCard}>
                 <View style={styles.iconWrapper}>
                   <Ionicons name="map-outline" size={26} color="#00ffff" />
                 </View>
                 <Text style={styles.statValue}>{formatDistance(activity.distance_meters)}</Text>
                 <Text style={styles.statLabel}>Distance</Text>
               </View>
             )}
             
             {/* Duration for all activities */}
             {activity.duration_seconds != null && activity.duration_seconds > 0 && (
               <View style={styles.statCard}>
                 <View style={styles.iconWrapper}>
                   <Ionicons name="time-outline" size={26} color="#00ffff" />
                 </View>
                 <Text style={styles.statValue}>{formatDuration(activity.duration_seconds)}</Text>
                 <Text style={styles.statLabel}>Duration</Text>
               </View>
             )}
             
             {/* Pace/Speed for GPS activities */}
            {activity.average_pace_minutes_per_km != null && activity.average_pace_minutes_per_km > 0 && activity.type === 'run' && (
               <View style={styles.statCard}>
                 <View style={styles.iconWrapper}>
                   <Ionicons 
                     name={activity.activity_type === 'bike' ? 'speedometer-outline' : 'timer-outline'} 
                     size={26} 
                     color="#00ffff" 
                   />
                 </View>
                 <Text style={styles.statValue}>
                   {activity.activity_type === 'bike' 
                     ? formatSpeed(activity.distance_meters, activity.duration_seconds)
                    : `${formatPace(useImperial ? activity.average_pace_minutes_per_km * 1.60934 : activity.average_pace_minutes_per_km)} ${useImperial ? '/mi' : '/km'}`
                   }
                 </Text>
                 <Text style={styles.statLabel}>
                   {activity.activity_type === 'bike' ? 'Avg Speed' : 'Pace'}
                 </Text>
               </View>
             )}
            
            {/* Calories for runs (from Apple Health) */}
            {activity.type === 'run' && activity.calories_burned != null && activity.calories_burned > 0 && (
              <View style={styles.statCard}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="flame-outline" size={26} color="#00ffff" />
                </View>
                <Text style={styles.statValue}>{activity.calories_burned}</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
            )}
            
            {/* Heart Rate for runs (from Apple Health) */}
            {activity.type === 'run' && activity.average_heart_rate != null && activity.average_heart_rate > 0 && (
              <View style={styles.statCard}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="heart-outline" size={26} color="#ff6b6b" />
                </View>
                <Text style={styles.statValue}>{activity.average_heart_rate} bpm</Text>
                <Text style={styles.statLabel}>Avg Heart Rate</Text>
              </View>
            )}
             
             {/* Workout-specific stats */}
             {activity.type === 'workout' && activity.completed_sets != null && activity.completed_sets > 0 && (
               <View style={styles.statCard}>
                 <View style={styles.iconWrapper}>
                   <Ionicons name="checkmark-circle-outline" size={26} color="#00ffff" />
                 </View>
                 <Text style={styles.statValue}>{activity.completed_sets}</Text>
                 <Text style={styles.statLabel}>Sets Completed</Text>
               </View>
             )}
             
             {activity.type === 'workout' && activity.exercise_count != null && activity.exercise_count > 0 && (
               <View style={styles.statCard}>
                 <View style={styles.iconWrapper}>
                   <Ionicons name="barbell-outline" size={26} color="#00ffff" />
                 </View>
                 <Text style={styles.statValue}>{activity.exercise_count}</Text>
                 <Text style={styles.statLabel}>Exercises</Text>
               </View>
             )}
             
             {activity.type === 'workout' && activity.total_weight != null && activity.total_weight > 0 && (
               <View style={styles.statCard}>
                 <View style={styles.iconWrapper}>
                   <Ionicons name="fitness-outline" size={26} color="#00ffff" />
                 </View>
                 <Text style={styles.statValue}>{activity.total_weight.toLocaleString()}</Text>
                 <Text style={styles.statLabel}>Total Weight (lbs)</Text>
               </View>
             )}
             
             {/* Mental-specific stats */}
             {activity.type === 'mental' && (activity.duration_seconds != null || activity.duration != null) && (
                <View style={styles.statCard}>
                  <View style={styles.iconWrapper}>
                    <Ionicons name="time-outline" size={26} color="#00ffff" />
                  </View>
                  <Text style={styles.statValue}>
                    {(() => {
                      // If we have duration_seconds, format it to show seconds if < 60, otherwise minutes
                      if (activity.duration_seconds != null && activity.duration_seconds > 0) {
                        const seconds = activity.duration_seconds;
                        if (seconds < 60) {
                          return `${seconds} ${seconds === 1 ? 'sec' : 'secs'}`;
                        }
                        const mins = Math.floor(seconds / 60);
                        const remainingSecs = seconds % 60;
                        if (remainingSecs === 0) {
                          return `${mins} ${mins === 1 ? 'min' : 'mins'}`;
                        }
                        return `${mins} min ${remainingSecs} ${remainingSecs === 1 ? 'sec' : 'secs'}`;
                      }
                      // Fallback to duration in minutes
                      if (activity.duration != null && activity.duration > 0) {
                        return `${activity.duration} ${activity.duration === 1 ? 'min' : 'mins'}`;
                      }
                      return '—';
                    })()}
                  </Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
              )}
              
             {activity.type === 'mental' && activity.calmness_level != null && activity.calmness_level > 0 && (
                <View style={styles.statCard}>
                  <View style={styles.iconWrapper}>
                    <Ionicons name="heart-outline" size={26} color="#00ffff" />
                  </View>
                  <Text style={styles.statValue}>{activity.calmness_level}/10</Text>
                  <Text style={styles.statLabel}>Calmness</Text>
                </View>
              )}
              
             {activity.type === 'mental' && activity.session_type != null && (
                <View style={styles.statCard}>
                  <View style={styles.iconWrapper}>
                    <Ionicons name="leaf-outline" size={26} color="#00ffff" />
                  </View>
                  <Text style={styles.statValue}>
                    {activity.session_type === 'meditation' ? 'Meditation' : 
                     activity.session_type === 'breathing' ? 'Breathing' : 
                    String(activity.session_type).charAt(0).toUpperCase() + String(activity.session_type).slice(1)}
                  </Text>
                  <Text style={styles.statLabel}>Type</Text>
                </View>
              )}
              
             {/* Calories for workouts (runs show calories above) */}
             {activity.type === 'workout' && activity.calories_burned != null && activity.calories_burned > 0 && (
                <View style={styles.statCard}>
                  <View style={styles.iconWrapper}>
                    <Ionicons name="flame-outline" size={26} color="#00ffff" />
                  </View>
                  <Text style={styles.statValue}>{activity.calories_burned}</Text>
                  <Text style={styles.statLabel}>Calories</Text>
                </View>
              )}
           </View>
         </View>

        {/* No Route Available for Apple Health Imports */}
        {isAppleHealthImport && activity.type === 'run' && (!activity.path || !Array.isArray(activity.path) || activity.path.length <= 1) && (
          <View style={styles.noRouteSection}>
            <View style={styles.noRouteCard}>
              <View style={styles.noRouteIconContainer}>
                <Ionicons name="map-outline" size={28} color="#64748b" />
              </View>
              <Text style={styles.noRouteTitle}>No Route Data</Text>
              <Text style={styles.noRouteText}>
                GPS route data isn't available for activities imported from Apple Health
              </Text>
            </View>
          </View>
        )}

        {/* Route Map - Only show if path has GPS data */}
        {activity.path && Array.isArray(activity.path) && activity.path.length > 1 && activity.type === 'run' && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Route</Text>
            
            <TouchableOpacity 
              style={styles.mapContainer}
              onPress={() => setShowFullMap(true)}
              activeOpacity={0.9}
            >
              {mapRegion ? (
                <MapView
                  style={styles.map}
                  region={mapRegion}
                  provider={PROVIDER_GOOGLE}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  {(() => {
                    try {
                      const path = typeof activity.path === 'string' ? JSON.parse(activity.path) : activity.path;
                      if (path && path.length > 1) {
                        return (
                          <Polyline
                            coordinates={path}
                            strokeColor="#00ffff"
                            strokeWidth={4}
                            lineDashPattern={[1]}
                            zIndex={1}
                            lineCap="round"
                            lineJoin="round"
                            geodesic={true}
                          />
                        );
                      }
                    } catch (error) {
                      console.error('Error rendering route:', error);
                    }
                    return null;
                  })()}
                  
                  {(() => {
                    try {
                      const path = typeof activity.path === 'string' ? JSON.parse(activity.path) : activity.path;
                      if (path && path.length > 0) {
                        return (
                          <>
                            <Marker coordinate={path[0]} title="Start">
                              <View style={styles.startMarker} />
                            </Marker>
                            {path.length > 1 && (
                              <Marker coordinate={path[path.length - 1]} title="End">
                                <View style={styles.endMarker} />
                              </Marker>
                            )}
                          </>
                        );
                      }
                    } catch (error) {
                      console.error('Error rendering markers:', error);
                    }
                    return null;
                  })()}
                </MapView>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={32} color="#00ffff" />
                  <Text style={styles.mapPlaceholderText}>Route Map</Text>
                </View>
              )}
              
              <View style={styles.mapOverlay}>
                <Ionicons name="expand-outline" size={20} color="#fff" />
                <Text style={styles.mapOverlayText}>Tap to view full map</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

         {/* Workout Summary */}
         {activity.type === 'workout' && (
           <View style={styles.summarySection}>
             <Text style={styles.sectionTitle}>Workout Summary</Text>
             
             <View style={styles.summaryCard}>
               <View style={styles.summaryRow}>
                 <Ionicons name="barbell-outline" size={20} color="#00ffff" />
                 <Text style={styles.summaryLabel}>Workout Name</Text>
                 <Text style={styles.summaryValue}>{activity.workout_name}</Text>
               </View>
               
               {activity.exercise_names && Array.isArray(activity.exercise_names) && activity.exercise_names.length > 0 && (
                 <View style={styles.summaryRow}>
                   <Ionicons name="list-outline" size={20} color="#00ffff" />
                   <Text style={styles.summaryLabel}>Exercises</Text>
                   <Text style={styles.summaryValue}>{activity.exercise_names.join(', ')}</Text>
                 </View>
               )}
               
               {activity.completed_sets > 0 && (
                 <View style={styles.summaryRow}>
                   <Ionicons name="checkmark-circle-outline" size={20} color="#00ffff" />
                   <Text style={styles.summaryLabel}>Sets Completed</Text>
                   <Text style={styles.summaryValue}>{activity.completed_sets}</Text>
                 </View>
               )}
               
               {activity.total_weight > 0 && (
                 <View style={styles.summaryRow}>
                   <Ionicons name="fitness-outline" size={20} color="#00ffff" />
                   <Text style={styles.summaryLabel}>Total Weight</Text>
                   <Text style={styles.summaryValue}>{activity.total_weight.toLocaleString()} lbs</Text>
                 </View>
               )}
             </View>
           </View>
         )}

         {/* Spotify Tracks */}
         {activity.type === 'workout' && (
           <View style={styles.spotifySection}>
             <View style={styles.sectionHeaderRow}>
               <View style={styles.sectionHeaderLeft}>
                 <Ionicons name="musical-notes-outline" size={20} color="#00ffff" style={{ marginRight: 8 }} />
                 <Text style={styles.sectionTitle}>Songs Played</Text>
               </View>
             </View>
             {spotifyTracksLoading ? (
               <View style={styles.spotifyLoadingContainer}>
                 <ActivityIndicator size="small" color="#00ffff" />
                 <Text style={styles.spotifyLoadingText}>Syncing Spotify...</Text>
               </View>
             ) : spotifyTracks.length === 0 ? (
               <Text style={styles.emptyStateText}>No songs captured during this workout.</Text>
             ) : (
              <View style={styles.spotifyList}>
                {spotifyTracks.map((track, index) => (
                  <TouchableOpacity
                    key={`${track.track_name || track.played_at || index}-${index}`}
                    style={styles.spotifyListItem}
                    activeOpacity={0.85}
                    onPress={() => openSpotifyTrack(track)}
                  >
                    {track.album_image_url ? (
                      <Image source={{ uri: track.album_image_url }} style={styles.spotifyAlbumArt} />
                    ) : (
                      <View style={styles.spotifyAlbumFallback}>
                        <Ionicons name="musical-notes-outline" size={18} color="#00ffff" />
                      </View>
                    )}
                    <View style={styles.spotifyTrackInfo}>
                      <Text style={styles.spotifyTrackTitle} numberOfLines={1} ellipsizeMode="tail">
                        {track.track_name || 'Unknown Track'}
                      </Text>
                      {track.artist_name ? (
                        <Text style={styles.spotifyTrackArtist} numberOfLines={1} ellipsizeMode="tail">
                          {track.artist_name}
                        </Text>
                      ) : null}
                      {track.album_name ? (
                        <Text style={styles.spotifyTrackAlbum} numberOfLines={1} ellipsizeMode="tail">
                          {track.album_name}
                        </Text>
                      ) : null}
                    </View>
                    {track.played_at ? (
                      <Text style={styles.spotifyTrackTime}>
                        {new Date(track.played_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
             )}
           </View>
         )}

          {/* Mental Session Summary */}
          {activity.type === 'mental' && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Session Summary</Text>
              
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Ionicons name="leaf-outline" size={20} color="#00ffff" />
                  <Text style={styles.summaryLabel}>Session Type</Text>
                  <Text style={styles.summaryValue}>
                    {activity.session_type === 'meditation' ? 'Meditation' : 
                     activity.session_type === 'breathing' ? 'Breathing Exercise' : 
                     activity.session_type.charAt(0).toUpperCase() + activity.session_type.slice(1)}
                  </Text>
                </View>
                
                {activity.duration && (
                  <View style={styles.summaryRow}>
                    <Ionicons name="time-outline" size={20} color="#00ffff" />
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>{activity.duration} minutes</Text>
                  </View>
                )}
                
                {activity.calmness_level && (
                  <View style={styles.summaryRow}>
                    <Ionicons name="heart-outline" size={20} color="#00ffff" />
                    <Text style={styles.summaryLabel}>Calmness Level</Text>
                    <Text style={styles.summaryValue}>{activity.calmness_level}/10</Text>
                  </View>
                )}
                
                {activity.session_name && activity.session_name !== activity.session_type && (
                  <View style={styles.summaryRow}>
                    <Ionicons name="document-text-outline" size={20} color="#00ffff" />
                    <Text style={styles.summaryLabel}>Session Name</Text>
                    <Text style={styles.summaryValue}>{activity.session_name}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Exercise Breakdown for Workouts */}
          {activity.type === 'workout' && activity.exercises && Array.isArray(activity.exercises) && activity.exercises.length > 0 && (
            <View style={styles.exercisesSection}>
              <Text style={styles.sectionTitle}>Exercise Breakdown</Text>
              
              {activity.exercises.map((exercise, index) => (
                <View key={index} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Ionicons name="barbell-outline" size={20} color="#00ffff" />
                    <Text style={styles.exerciseName}>{exercise?.name || 'Unknown Exercise'}</Text>
                  </View>
                  
                  {exercise?.targetMuscles && (
                    <Text style={styles.exerciseMuscles}>
                      Target: {Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles.join(', ') : exercise.targetMuscles}
                    </Text>
                  )}
                  
                  {exercise.sets && Array.isArray(exercise.sets) && exercise.sets.length > 0 && (
                    <View style={styles.setsContainer}>
                      <Text style={styles.setsTitle}>Sets:</Text>
                      {exercise.sets.map((set, setIndex) => {
                        if (!set) return null;
                        return (
                          <View key={setIndex} style={styles.setRow}>
                            <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                            <View style={styles.setDetails}>
                              {set.weight !== undefined && set.weight !== null && set.weight > 0 && (
                                <Text style={styles.setDetail}>{set.weight} lbs</Text>
                              )}
                              {set.reps !== undefined && set.reps !== null && (
                                <Text style={styles.setDetail}>{set.reps} reps</Text>
                              )}
                              {set.completed && (
                                <Ionicons name="checkmark-circle" size={16} color="#00ff00" />
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

         {/* Activity Details */}
         <View style={styles.detailsSection}>
           <Text style={styles.sectionTitle}>Details</Text>
           
           <View style={styles.detailRow}>
             <Ionicons name="calendar-outline" size={20} color="#666" />
             <Text style={styles.detailLabel}>Date</Text>
             <Text style={styles.detailValue}>
               {new Date(activity.start_time || activity.completed_at || activity.created_at).toLocaleDateString()}
             </Text>
           </View>
           
           <View style={styles.detailRow}>
             <Ionicons name="time-outline" size={20} color="#666" />
             <Text style={styles.detailLabel}>Time</Text>
             <Text style={styles.detailValue}>
               {new Date(activity.start_time || activity.completed_at || activity.created_at).toLocaleTimeString()}
             </Text>
           </View>
           
                       {activity.activity_type && (
              <View style={styles.detailRow}>
                <Ionicons name="fitness-outline" size={20} color="#666" />
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}
                </Text>
              </View>
            )}
            
            {activity.type === 'mental' && activity.session_type && (
              <View style={styles.detailRow}>
                <Ionicons name="leaf-outline" size={20} color="#666" />
                <Text style={styles.detailLabel}>Session Type</Text>
                <Text style={styles.detailValue}>
                  {activity.session_type === 'meditation' ? 'Meditation' : 
                   activity.session_type === 'breathing' ? 'Breathing Exercise' : 
                   activity.session_type.charAt(0).toUpperCase() + activity.session_type.slice(1)}
                </Text>
              </View>
            )}
           
           {activity.notes && (
             <View style={styles.notesContainer}>
               <Text style={styles.notesLabel}>Notes</Text>
               <Text style={styles.notesText}>{activity.notes}</Text>
             </View>
           )}
         </View>
      </ScrollView>

      {/* Full Map Modal */}
      {showFullMap && activity.path && (
        <View style={styles.fullMapContainer}>
          <View style={styles.fullMapHeader}>
            <TouchableOpacity 
              style={styles.closeMapButton}
              onPress={() => setShowFullMap(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullMapTitle}>Route Map</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {mapRegion && (
            <MapView
              style={styles.fullMap}
              region={mapRegion}
              provider={PROVIDER_GOOGLE}
              showsUserLocation={false}
              showsMyLocationButton={false}
              scrollEnabled={true}
              zoomEnabled={true}
              rotateEnabled={true}
              pitchEnabled={true}
            >
              {(() => {
                try {
                  const path = typeof activity.path === 'string' ? JSON.parse(activity.path) : activity.path;
                  if (path && path.length > 1) {
                    return (
                      <Polyline
                        coordinates={path}
                        strokeColor="#00ffff"
                        strokeWidth={4}
                        lineDashPattern={[1]}
                        zIndex={1}
                        lineCap="round"
                        lineJoin="round"
                        geodesic={true}
                      />
                    );
                  }
                } catch (error) {
                  console.error('Error rendering full map route:', error);
                }
                return null;
              })()}
              
              {(() => {
                try {
                  const path = typeof activity.path === 'string' ? JSON.parse(activity.path) : activity.path;
                  if (path && path.length > 0) {
                    return (
                      <>
                        <Marker coordinate={path[0]} title="Start">
                          <View style={styles.startMarker} />
                        </Marker>
                        {path.length > 1 && (
                          <Marker coordinate={path[path.length - 1]} title="End">
                            <View style={styles.endMarker} />
                          </Marker>
                        )}
                      </>
                    );
                  }
                } catch (error) {
                  console.error('Error rendering full map markers:', error);
                }
                return null;
              })()}
            </MapView>
          )}
        </View>
      )}
    </View>
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
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#00ffff',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#ff0055',
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 28,
    letterSpacing: 0.5,
  },
  statsSection: {
    marginTop: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: (width - 60) / 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  statLabel: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  iconWrapper: {
    marginBottom: 4,
  },
  mapSection: {
    marginTop: 20,
  },
  mapContainer: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#222',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#18191b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  startMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00ff00',
    borderWidth: 2,
    borderColor: '#fff',
  },
  endMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff0055',
    borderWidth: 2,
    borderColor: '#fff',
  },
  spotifySection: {
    marginTop: 20,
    backgroundColor: '#0f0f0f',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f1f1f'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  spotifyLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  spotifyLoadingText: {
    color: '#00ffff',
    fontSize: 14,
    marginLeft: 10
  },
  spotifyList: {
    marginTop: 4
  },
  spotifyListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    gap: 16
  },
  spotifyAlbumArt: {
    width: 48,
    height: 48,
    borderRadius: 12
  },
  spotifyAlbumFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  spotifyTrackInfo: {
    flex: 1,
    minWidth: 0
  },
  spotifyTrackTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1
  },
  spotifyTrackArtist: {
    color: '#00ffff',
    fontSize: 13,
    marginTop: 2,
    flexShrink: 1
  },
  spotifyTrackAlbum: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1
  },
  spotifyTrackTime: {
    color: '#999',
    fontSize: 12
  },
  emptyStateText: {
    color: '#777',
    fontSize: 14
  },
  detailsSection: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  detailLabel: {
    color: '#999',
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  notesLabel: {
    color: '#999',
    fontSize: 15,
    marginBottom: 12,
    fontWeight: '600',
  },
  notesText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  fullMapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  fullMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#000',
  },
  closeMapButton: {
    padding: 8,
  },
  fullMapTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
     fullMap: {
     flex: 1,
   },
   exercisesSection: {
     marginTop: 20,
   },
   exerciseCard: {
     backgroundColor: '#111',
     borderRadius: 16,
     padding: 20,
     marginBottom: 16,
     borderWidth: 1,
     borderColor: '#222',
   },
   exerciseHeader: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 8,
   },
   exerciseName: {
     color: '#fff',
     fontSize: 16,
     fontWeight: 'bold',
     marginLeft: 8,
   },
   exerciseMuscles: {
     color: '#888',
     fontSize: 14,
     marginBottom: 12,
   },
   setsContainer: {
     marginTop: 8,
   },
   setsTitle: {
     color: '#00ffff',
     fontSize: 14,
     fontWeight: 'bold',
     marginBottom: 8,
   },
   setRow: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between',
     paddingVertical: 6,
     borderBottomWidth: 1,
     borderBottomColor: '#333',
   },
   setNumber: {
     color: '#888',
     fontSize: 14,
     fontWeight: '500',
   },
   setDetails: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 12,
   },
   setDetail: {
     color: '#fff',
     fontSize: 14,
   },
   summarySection: {
     marginTop: 20,
   },
  summaryCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
   summaryRow: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 8,
     borderBottomWidth: 1,
     borderBottomColor: '#333',
   },
   summaryLabel: {
     color: '#888',
     fontSize: 14,
     flex: 1,
     marginLeft: 12,
   },
   summaryValue: {
     color: '#fff',
     fontSize: 14,
     fontWeight: '500',
     flex: 2,
     textAlign: 'right',
   },
   userSection: {
     marginTop: 20,
   },
  userCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#222',
  },
   userInfo: {
     flexDirection: 'row',
     alignItems: 'center',
     flex: 1,
   },
   avatarContainer: {
     marginRight: 12,
   },
   avatar: {
     width: 48,
     height: 48,
     borderRadius: 24,
   },
   avatarPlaceholder: {
     width: 48,
     height: 48,
     borderRadius: 24,
     backgroundColor: '#222',
     justifyContent: 'center',
     alignItems: 'center',
   },
   userDetails: {
     flex: 1,
   },
   userName: {
     color: '#fff',
     fontSize: 16,
     fontWeight: 'bold',
     marginBottom: 2,
   },
   userDate: {
     color: '#888',
     fontSize: 14,
   },
   // Apple Health Import Badge
   appleHealthBadge: {
     marginHorizontal: 20,
     marginTop: 8,
     marginBottom: 8,
   },
   appleHealthBadgeContent: {
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: 'rgba(255, 45, 85, 0.1)',
     paddingVertical: 10,
     paddingHorizontal: 14,
     borderRadius: 12,
     borderWidth: 1,
     borderColor: 'rgba(255, 45, 85, 0.3)',
     gap: 8,
   },
   appleHealthBadgeText: {
     color: '#FF2D55',
     fontSize: 14,
     fontWeight: '600',
   },
   // No Route Section (for Apple Health imports)
   noRouteSection: {
     marginHorizontal: 20,
     marginBottom: 20,
   },
   noRouteCard: {
     backgroundColor: '#111',
     borderRadius: 16,
     padding: 24,
     alignItems: 'center',
     borderWidth: 1,
     borderColor: '#222',
   },
   noRouteIconContainer: {
     width: 56,
     height: 56,
     borderRadius: 28,
     backgroundColor: '#1e293b',
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: 12,
   },
   noRouteTitle: {
     color: '#fff',
     fontSize: 16,
     fontWeight: '600',
     marginBottom: 6,
   },
   noRouteText: {
     color: '#64748b',
     fontSize: 14,
     textAlign: 'center',
     lineHeight: 20,
   },
 });

export default ActivityDetailScreen;
