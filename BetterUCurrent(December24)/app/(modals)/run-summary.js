import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from '../../lib/MapView';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { LinearGradient } from 'expo-linear-gradient';


const RunSummary = () => {
 const router = useRouter();
 const { user, isLoading: isUserLoading } = useUser();
 const params = useLocalSearchParams();
 const [isSaving, setIsSaving] = useState(false);
 const mapRef = useRef(null);
  // Parse the data from params
 const runData = {
   locations: JSON.parse(params.locations || '[]'),
   distance: parseFloat(params.distance || 0),
   duration: parseFloat(params.duration || 0),
   pace: parseFloat(params.pace || 0),
   unit: params.unit || 'km',
   startTime: params.startTime,
   endTime: params.endTime
 };


 useEffect(() => {
   // Debug user state
   console.log('User state in RunSummary:', { isUserLoading, userId: user?.id });
 }, [isUserLoading, user]);


 useEffect(() => {
   if (mapRef.current && runData.locations.length > 1) {
     mapRef.current.fitToCoordinates(runData.locations, {
       edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
       animated: true,
     });
   }
 }, [runData.locations]);


 const formatTime = (seconds) => {
   const hours = Math.floor(seconds / 3600);
   const minutes = Math.floor((seconds % 3600) / 60);
   const secs = Math.floor(seconds % 60);
   return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };


 const formatPace = (pace) => {
   if (pace === 0) return '--:--';
   const minutes = Math.floor(pace);
   const seconds = Math.floor((pace - minutes) * 60);
   return `${minutes}:${seconds.toString().padStart(2, '0')}`;
 };


 const saveRun = async () => {
   if (isSaving) return;

   console.log('Save run button pressed');
   console.log('Current user:', user);
   console.log('Run data:', runData);

   // Get the current user from Supabase directly if context is not ready
   let currentUser = user;
   if (!currentUser?.id) {
     console.log('No user in context, getting from Supabase');
     const { data: { user: supabaseUser } } = await supabase.auth.getUser();
     if (!supabaseUser) {
       console.log('No user found in Supabase');
       Alert.alert('Error', 'Unable to save run. Please try again.');
       return;
     }
     currentUser = supabaseUser;
     console.log('Got user from Supabase:', currentUser);
   }
  
   try {
     setIsSaving(true);
    
     const runDataToSave = {
       user_id: currentUser.id,
       start_time: new Date(parseInt(runData.startTime)).toISOString(),
       end_time: new Date(parseInt(runData.endTime)).toISOString(),
       duration_seconds: runData.duration,
       distance_meters: runData.unit === 'miles' ? runData.distance * 1609.34 : runData.distance * 1000,
       average_pace_minutes_per_km: runData.unit === 'miles' ? runData.pace * 1.60934 : runData.pace,
       path: runData.locations,
       status: 'completed',
       notes: ''
     };

     console.log('Saving run data:', runDataToSave);

     const { error } = await supabase.from('runs').insert([runDataToSave]);

     if (error) {
       console.error('Supabase error:', error);
       throw error;
     }
    
     console.log('Run saved successfully');
     Alert.alert('Success', 'Run saved successfully!');
     router.back();
   } catch (error) {
     console.error('Error saving run:', error);
     Alert.alert('Error', 'Failed to save run. Please try again.');
   } finally {
     setIsSaving(false);
   }
 };


 const discardRun = () => {
   router.back();
 };


 // Only show loading state for a brief moment
 if (isUserLoading) {
   return (
     <SafeAreaView style={styles.container}>
       <View style={styles.loadingContainer}>
         <ActivityIndicator size="large" color="#00c853" />
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
       <Text style={styles.headerTitle}>Run Summary</Text>
     </View>
    
     <ScrollView style={styles.scrollView}>
       <View style={styles.mapContainer}>
         <MapView
           ref={mapRef}
           style={styles.map}
           provider={PROVIDER_GOOGLE}
           initialRegion={{
             latitude: runData.locations[0]?.latitude || 0,
             longitude: runData.locations[0]?.longitude || 0,
             latitudeDelta: 0.01,
             longitudeDelta: 0.01,
           }}
         >
           {runData.locations.length > 1 && (
             <Polyline
               coordinates={runData.locations}
               strokeColor="#00ffff"
               strokeWidth={4}
             />
           )}
           {runData.locations.length > 0 && (
             <>
               <Marker
                 coordinate={runData.locations[0]}
                 title="Start"
               >
                 <View style={styles.startMarker} />
               </Marker>
               <Marker
                 coordinate={runData.locations[runData.locations.length - 1]}
                 title="End"
               >
                 <View style={styles.endMarker} />
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
               {runData.distance.toFixed(2)} {runData.unit}
             </Text>
           </View>
           <View style={styles.statItem}>
             <Text style={styles.statLabel}>Duration</Text>
             <Text style={styles.statValue}>
               {formatTime(runData.duration)}
             </Text>
           </View>
         </View>
         <View style={styles.statRow}>
           <View style={styles.statItem}>
             <Text style={styles.statLabel}>Pace</Text>
             <Text style={styles.statValue}>
               {formatPace(runData.pace)} /{runData.unit}
             </Text>
           </View>
           <View style={styles.statItem}>
             <Text style={styles.statLabel}>Date</Text>
             <Text style={styles.statValue}>
               {new Date(parseInt(runData.startTime)).toLocaleDateString()}
             </Text>
           </View>
         </View>
       </View>


       <View style={styles.buttonContainer}>
         <TouchableOpacity
           style={[styles.button, styles.saveButton, isSaving && styles.disabledButton]}
           onPress={() => {
             console.log('Save button pressed, isSaving:', isSaving);
             saveRun();
           }}
           disabled={isSaving}
         >
           <LinearGradient
             colors={['#00c853', '#009624']}
             style={styles.gradient}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 0 }}
           >
             <Ionicons name="save" size={24} color="#fff" />
             <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Save Run'}</Text>
           </LinearGradient>
         </TouchableOpacity>


         <TouchableOpacity
           style={[styles.button, styles.discardButton]}
           onPress={discardRun}
           disabled={isSaving}
         >
           <LinearGradient
             colors={['#ff4444', '#cc0000']}
             style={styles.gradient}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 0 }}
           >
             <Ionicons name="trash" size={24} color="#fff" />
             <Text style={styles.buttonText}>Discard</Text>
           </LinearGradient>
         </TouchableOpacity>
       </View>
     </ScrollView>
   </SafeAreaView>
 );
};


const styles = StyleSheet.create({
 container: {
   flex: 1,
   backgroundColor: '#111',
 },
 loadingContainer: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
 },
 loadingText: {
   color: '#fff',
   fontSize: 18,
   marginTop: 10,
 },
 header: {
   flexDirection: 'row',
   alignItems: 'center',
   padding: 16,
   borderBottomWidth: 1,
   borderBottomColor: 'rgba(255,255,255,0.1)',
 },
 closeButton: {
   padding: 8,
 },
 headerTitle: {
   color: '#fff',
   fontSize: 20,
   fontWeight: 'bold',
   marginLeft: 16,
 },
 scrollView: {
   flex: 1,
 },
 mapContainer: {
   height: 300,
   margin: 20,
   borderRadius: 20,
   overflow: 'hidden',
 },
 map: {
   flex: 1,
 },
 startMarker: {
   width: 20,
   height: 20,
   borderRadius: 10,
   backgroundColor: '#00c853',
   borderWidth: 2,
   borderColor: '#fff',
 },
 endMarker: {
   width: 20,
   height: 20,
   borderRadius: 10,
   backgroundColor: '#ff4444',
   borderWidth: 2,
   borderColor: '#fff',
 },
 statsContainer: {
   backgroundColor: 'rgba(0,0,0,0.9)',
   margin: 20,
   padding: 20,
   borderRadius: 20,
 },
 statRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   marginBottom: 20,
 },
 statItem: {
   flex: 1,
   alignItems: 'center',
 },
 statLabel: {
   color: '#888',
   fontSize: 14,
   marginBottom: 4,
 },
 statValue: {
   color: '#fff',
   fontSize: 24,
   fontWeight: 'bold',
 },
 buttonContainer: {
   margin: 20,
   gap: 10,
 },
 button: {
   height: 60,
   borderRadius: 30,
   overflow: 'hidden',
 },
 gradient: {
   flex: 1,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
 },
 saveButton: {
   backgroundColor: '#00c853',
 },
 discardButton: {
   backgroundColor: '#d50000',
 },
 buttonText: {
   color: '#fff',
   fontSize: 20,
   fontWeight: 'bold',
   marginLeft: 8,
 },
 disabledButton: {
   opacity: 0.5,
 },
});


export default RunSummary;

