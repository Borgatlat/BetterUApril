import { Slot } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { UserProvider } from '../context/UserContext';
import { UnitsProvider } from '../context/UnitsContext';
import { TrackingProvider } from '../context/TrackingContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import LoadingScreen from '../screens/loadingScreen';
import { useState, useEffect } from 'react';
import { preloadImages } from '../utils/imageUtils';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '../context/SettingsContext';


import IntroScreen from './components/IntroScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializePurchases } from '../lib/purchases';


export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [contextsReady, setContextsReady] = useState(false);


  const [showIntro, setShowIntro] = useState(true);


  useEffect(() => {
    const checkIntroStatus = async () => {
      try {
        const hasSeenIntro = await AsyncStorage.getItem('hasSeenIntro');
        if (hasSeenIntro === 'true') {
          setShowIntro(false);
        }
      } catch (error) {
        console.error('Error checking intro status:', error);
      }
    };
    checkIntroStatus();
  }, []);


  const handleIntroComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenIntro', 'true');
      setShowIntro(false);
    } catch (error) {
      console.error('Error saving intro status:', error);
    }
  };


  useEffect(() => {
    let isMounted = true;
    let timeoutId;


    const initializeApp = async () => {
      try {
        // Initial delay to ensure basic setup
        if (!isMounted) return;
        setLoadingStep('Starting up...');
        setLoadingProgress(0.1);
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 100);
        });
       
        // Preload images with timeout
        if (!isMounted) return;
        setLoadingStep('Loading assets...');
        setLoadingProgress(0.3);
        const imageLoadPromise = preloadImages();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Image loading timeout')), 10000)
        );
        await Promise.race([imageLoadPromise, timeoutPromise]);
       
        // Give more time for contexts to initialize
        if (!isMounted) return;
        setLoadingStep('Preparing data...');
        setLoadingProgress(0.7);
       await new Promise(resolve => setTimeout(resolve, 300));
        // Check if component is still mounted before proceeding
        if (!isMounted) return;
     
        // Update loading status to 90% complete
        console.log('🔄 Setting loading step to 90%: Loading data...');
        setLoadingStep('Loading data...');
        setLoadingProgress(0.9);
       
        // Add a shorter delay to make the 90% step visible but faster
        console.log('⏳ Waiting 300ms to show 90% step...');
        await new Promise(resolve => setTimeout(resolve, 300));
       
        // Set a maximum wait time for contexts
        const maxWaitTime = 5000; // Increased to 5 seconds
        const startTime = Date.now();
        console.log('⏰ Starting context wait with 5 second timeout...');
     
        // Wait for contexts to be ready with a timeout
        await new Promise((resolve) => {
          const checkContexts = () => {
            if (contextsReady || Date.now() - startTime > maxWaitTime) {
              resolve();
            } else {
              timeoutId = setTimeout(checkContexts, 500);
            }
          };
          checkContexts();
        });
       
        if (isMounted) {
          setLoadingProgress(1.0);
          setIsReady(true);
          setError(null);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        if (isMounted) {
          setError(error.message);
          // Still set ready to true to prevent infinite loading
          setIsReady(true);
        }
      }
    };


    initializeApp();


    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [contextsReady]);


  if (showIntro) {
    return (
      <SafeAreaProvider>
        <IntroScreen onComplete={handleIntroComplete} />
      </SafeAreaProvider>
    );
  }
 
  if (!isReady) {
    return (
      <SafeAreaProvider>
        <LoadingScreen progress={loadingProgress} loadingStep={loadingStep} />
      </SafeAreaProvider>
    );
  }


  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserProvider onReady={async (user) => {
          console.log('👤 UserProvider ready callback called');
          if (user?.id) {
            console.log('💰 Initializing purchases for user:', user.id);
            await initializePurchases(user.id);
          }
          console.log('✅ Setting contextsReady to true');
          setContextsReady(true);
        }}>
          <SettingsProvider>
            <UnitsProvider>
              <TrackingProvider>
                <Slot />
              </TrackingProvider>
            </UnitsProvider>
          </SettingsProvider>
        </UserProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#ff4444',
    textAlign: 'center',
    paddingHorizontal: 20
  }
}); 