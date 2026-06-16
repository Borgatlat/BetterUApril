import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { resolvePostAuthRoute } from '../lib/onboardingGate';
import WelcomeScreen from './components/WelcomeScreen';

const NAV_FALLBACK_MS = 8000;

/**
 * Signed-out users see Welcome (Sign up / Sign in).
 * Signed-in users go to onboarding, home, or school dashboard based on profile.
 */
export default function Index() {
  const { user, workspace, profile, isLoading, profileLoading } = useAuthSession();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = useState(false);
  const lastTargetRef = useRef(null);

  useEffect(() => {
    if (!user) {
      lastTargetRef.current = null;
      setHasNavigated(false);
      return;
    }

    const navigate = (target) => {
      if (lastTargetRef.current === target) return;
      lastTargetRef.current = target;
      setHasNavigated(true);
      router.replace(target);
    };

    if (isLoading || profileLoading) {
      const fallbackTimer = setTimeout(() => {
        navigate(resolvePostAuthRoute(workspace, profile));
      }, NAV_FALLBACK_MS);
      return () => clearTimeout(fallbackTimer);
    }

    navigate(resolvePostAuthRoute(workspace, profile));
  }, [user, workspace, profile, isLoading, profileLoading, router]);

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
