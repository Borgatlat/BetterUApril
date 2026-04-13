import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { INTRO_SEEN_KEY, TUTORIAL_SEEN_KEY } from '../../utils/storageKeys';
import { HomeScrollProvider } from '../../context/HomeScrollContext';
import IntroScreen from './IntroScreen';
import TutorialOverlay from './TutorialOverlay';

/**
 * TutorialGate orchestrates the new-user flow: Intro → Overlay Tutorial → Main App.
 * - If user hasn't seen intro: show IntroScreen (full screen)
 * - If intro done but not overlay: show tabs + TutorialOverlay on top
 * - If both done: show tabs only
 */
export default function TutorialGate({ children }) {
  const { user } = useAuth();
  const [introSeen, setIntroSeen] = useState(null);
  const [tutorialSeen, setTutorialSeen] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [intro, tutorial] = await Promise.all([
          AsyncStorage.getItem(INTRO_SEEN_KEY),
          AsyncStorage.getItem(TUTORIAL_SEEN_KEY)
        ]);
        setIntroSeen(intro === 'true');
        setTutorialSeen(tutorial === 'true');
      } catch (e) {
        setIntroSeen(false);
        setTutorialSeen(false);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleIntroComplete = async () => {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
    setIntroSeen(true);
  };

  const handleTutorialComplete = async () => {
    await AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    setTutorialSeen(true);
  };

  // Not logged in - show children (auth flow handles login/signup)
  if (!user) {
    return children;
  }

  // Still loading storage
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  // Haven't seen intro - show IntroScreen
  if (!introSeen) {
    return <IntroScreen onComplete={handleIntroComplete} />;
  }

  // Intro done - show main app with overlay if tutorial not seen.
  // HomeScrollProvider lets HomeScreen register its scroll ref; TutorialOverlay uses it to scroll to each step.
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
