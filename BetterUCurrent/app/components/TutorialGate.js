import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { INTRO_SEEN_KEY, TUTORIAL_SEEN_KEY } from '../../utils/storageKeys';
import { HomeScrollProvider } from '../../context/HomeScrollContext';
import TutorialOverlay from './TutorialOverlay';

/**
 * TutorialGate: optional home tutorial overlay after login.
 * Intro carousel removed — INTRO_SEEN_KEY is always set so existing installs skip it.
 */
export default function TutorialGate({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tutorialSeen, setTutorialSeen] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Spotlight targets live on Home — open that tab before showing the overlay.
  useEffect(() => {
    if (!user || isLoading || tutorialSeen !== false) return;
    router.replace('/(tabs)/home');
  }, [user, isLoading, tutorialSeen, router]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
        const tutorial = await AsyncStorage.getItem(TUTORIAL_SEEN_KEY);
        if (!cancelled) {
          setTutorialSeen(tutorial === 'true');
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setTutorialSeen(false);
          setIsLoading(false);
        }
      }
    }
    const failsafe = setTimeout(() => {
      if (!cancelled) {
        setTutorialSeen((v) => v ?? false);
        setIsLoading(false);
      }
    }, 2000);
    load();
    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
  }, []);

  const handleTutorialComplete = () => {
    setTutorialSeen(true);
    AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true').catch(() => {});
  };

  if (!user) {
    return children;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  return (
    <HomeScrollProvider>
      {children}
      <TutorialOverlay
        visible={!tutorialSeen}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialComplete}
      />
    </HomeScrollProvider>
  );
}
