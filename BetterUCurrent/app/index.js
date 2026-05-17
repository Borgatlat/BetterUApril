import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { resolvePostAuthRoute } from '../lib/resolveInitialRoute';
import WelcomeScreen from './components/WelcomeScreen';

const NAV_FALLBACK_MS = 5000;
/** Brief wait so background profile fetch can set onboarding_completed before we guess. */
const PROFILE_HINT_MS = 2000;

/**
 * Signed-out users see Welcome (Sign up / Sign in).
 * Signed-in users go to onboarding, home, or school dashboard based on profile.
 */
export default function Index() {
  const { user, workspace, profile, isLoading } = useAuthSession();
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

    const go = () => {
      navigate(resolvePostAuthRoute(workspace, profile));
    };

    const profileKnown =
      profile?.onboarding_completed === true ||
      profile?.onboarding_completed === false;

    if (!isLoading && profileKnown) {
      go();
      return;
    }

    if (!isLoading) {
      const hintTimer = setTimeout(go, PROFILE_HINT_MS);
      const fallbackTimer = setTimeout(go, NAV_FALLBACK_MS);
      return () => {
        clearTimeout(hintTimer);
        clearTimeout(fallbackTimer);
      };
    }

    const fallbackTimer = setTimeout(go, NAV_FALLBACK_MS);
    return () => clearTimeout(fallbackTimer);
  }, [user, workspace, profile, isLoading, router]);

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
