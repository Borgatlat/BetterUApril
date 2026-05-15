import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import WelcomeScreen from './components/WelcomeScreen';

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // User is authenticated, redirect to main app
      // Fix: Navigate to a specific tab within the (tabs) group
      router.replace('/(tabs)/home');
    }
  }, [user, router]);

  if (user) {
    // Show loading while redirecting authenticated users
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  // Show welcome screen for non-authenticated users
  return <WelcomeScreen />;
} 