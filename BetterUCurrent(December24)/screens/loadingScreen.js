import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';


// Get device width for progress bar sizing
const { width } = Dimensions.get('window');


// The icons used in the tab bar
const fitnessIcons = [
  'home',
  'barbell',
  'leaf',
  'fitness',
  'people',
  'walk',
];


export default function LoadingScreen({ progress: loadingProgress = 0, loadingStep = 'Loading...' }) {
  // Animated value for the progress bar
  const progress = useRef(new Animated.Value(0)).current;
  // State to cycle through icons
  const [iconIndex, setIconIndex] = useState(0);
  // Add a pulsing effect to the progress bar when it's filling
  const pulseAnim = useRef(new Animated.Value(1)).current;


  useEffect(() => {
    // Animate the progress bar to the current loading progress
    Animated.timing(progress, {
      toValue: loadingProgress,
      duration: 500, // Smooth transition
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, loadingProgress]);


  useEffect(() => {
    // Cycle through icons every 400ms
    const interval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % fitnessIcons.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);


  // Add a pulsing effect to the progress bar when it's filling
  useEffect(() => {
    if (loadingProgress > 0 && loadingProgress < 1) {
      // Create a pulsing animation while loading
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loadingProgress]);


  // Interpolate progress bar width - now it fills the entire background
  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.7], // Fill the entire progress bar background
  });


  return (
    <View style={styles.container}>
      {/* Animated fitness icon */}
      <Ionicons
        name={fitnessIcons[iconIndex]}
        size={64}
        color="#00ffff"
        style={styles.icon}
      />
      {/* Loading step text */}
      <Text style={styles.loadingText}>{loadingStep}</Text>
      {/* Progress percentage */}
      <Text style={styles.progressText}>{Math.round(loadingProgress * 100)}%</Text>
      {/* Animated progress bar */}
      <View style={styles.progressBarBackground}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: barWidth,
              transform: [{ scaleX: pulseAnim }]
            }
          ]}
        />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000', // Black background for a modern look
  },
  icon: {
    marginBottom: 40,
  },
  loadingText: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  progressText: {
    color: '#00ffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  progressBarBackground: {
    width: width * 0.7,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,255,255,0.1)', // Lighter background for better contrast
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0,255,255,0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  progressBar: {
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00ffff', // Bright cyan for progress
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
}); 