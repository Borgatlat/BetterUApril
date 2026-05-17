import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../hooks/useAuthSession';
import WelcomeScreen from './components/WelcomeScreen';

const NAV_FALLBACK_MS = 5000;

/**
 * Two-door routing: public gym app vs student school workspace vs staff dashboards.
 * Navigation runs as soon as we know session state — profile/org can load in the background.
 */
export default function Index() {
  const { user, workspace, isLoading } = useAuthSession();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigatedRef.current = false;
      setHasNavigated(false);
      return;
    }

    const go = () => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      setHasNavigated(true);
      const target =
        workspace === 'staff' ? '/(school)/dashboard' : '/(tabs)/home';
      router.replace(target);
    };

    if (!isLoading) {
      go();
      return;
    }

    const timer = setTimeout(go, NAV_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [user, workspace, isLoading, router]);

  if (user && !hasNavigated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  if (user) {
    return null;
  }

  return <WelcomeScreen />;
}
