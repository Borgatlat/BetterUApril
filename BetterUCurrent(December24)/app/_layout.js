import { Slot } from 'expo-router';
import BanScreen from './(auth)/BanScreen';
import { useAuth } from '../context/AuthContext';
import { AuthProvider } from '../context/AuthContext';
import { UserProvider } from '../context/UserContext';
import { UnitsProvider } from '../context/UnitsContext';
import { TrackingProvider } from '../context/TrackingContext';
import { NotificationProvider } from '../context/NotificationContext';
import { LanguageProvider } from '../context/LanguageContext';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { preloadImages } from '../utils/imageUtils';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '../context/SettingsContext';
import { SharedMessageLimitProvider } from '../context/SharedMessageLimitContext';
import { AIConsentProvider } from '../context/AIConsentContext';
import LoadingScreen from '../screens/loadingScreen';
import WelcomeScreen from './components/WelcomeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializePurchases } from '../lib/purchases';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const MainContent = () => {
  const { banStatus, user } = useAuth();
  
  // If user is banned, show ban screen
  if (banStatus?.isBanned) {
    return <BanScreen />;
  }
  
  // Always show the router content (Slot) - let individual routes handle auth
  return <Slot />;
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [contextsReady, setContextsReady] = useState(false);
  const router = useRouter();

  // Handle deep links for OAuth callbacks
  useEffect(() => {
    const handleDeepLink = async (url) => {
      console.log('🔗 Deep link received:', url);
      
      if (url.includes('auth.expo.io') || url.includes('google-auth')) {
        console.log('✅ Google OAuth callback received');
      }
      
      // Handle password reset deep link
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        console.log('🔄 Password reset deep link detected');
        console.log('Full URL:', url);
        
        try {
          // new URL() understands custom schemes like betteru://reset-password?code=...
          // (react-native-url-polyfill is loaded before this module via lib/supabase.js)
          const parsed = new URL(url);

          // Supabase error redirects (e.g. expired link)
          const urlError =
            parsed.searchParams.get('error_description') ||
            parsed.searchParams.get('error');
          if (urlError) {
            console.error('❌ Auth error in reset URL:', urlError);
            Alert.alert('Reset link problem', decodeURIComponent(urlError.replace(/\+/g, ' ')));
            router.push('/(auth)/reset-password');
            return;
          }

          // --- PKCE (recommended): ?code=... — survives mail apps that strip #fragments ---
          const authCode = parsed.searchParams.get('code');
          if (authCode) {
            console.log('🔐 PKCE: exchanging code for password recovery session...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
            if (error) {
              console.error('❌ exchangeCodeForSession failed:', error);
              Alert.alert(
                'Error',
                error.message ||
                  'Failed to verify reset link. Request a new reset from the same device you used to send the email.'
              );
            } else {
              console.log('✅ Recovery session established (PKCE)');
              console.log('Session user:', data?.user?.email);
            }
            router.push('/(auth)/reset-password');
            return;
          }

          // --- Implicit fallback: #access_token=... (older links; hash may be missing on mobile) ---
          const hashRaw = parsed.hash && parsed.hash.length > 1 ? parsed.hash.slice(1) : '';
          const queryForTokens = parsed.search && parsed.search.length > 1 ? parsed.search.slice(1) : '';
          const paramString = hashRaw || queryForTokens;

          if (!paramString) {
            console.log('⚠️ No code or token parameters in URL (hash often stripped by mail clients)');
            router.push('/(auth)/reset-password');
            return;
          }

          const params = new URLSearchParams(paramString);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');

          console.log('Password reset URL params (implicit):', {
            accessToken: !!accessToken,
            refreshToken: !!refreshToken,
            type
          });

          if (accessToken && refreshToken && type === 'recovery') {
            console.log('🔐 Establishing password reset session (implicit tokens)...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (error) {
              console.error('❌ Error establishing password reset session:', error);
              Alert.alert('Error', 'Failed to verify reset link. Please request a new password reset.');
            } else {
              console.log('✅ Password reset session established successfully');
              console.log('Session user:', data?.user?.email);
            }
          } else {
            console.log('⚠️ Missing implicit recovery tokens:', {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              type
            });
          }
        } catch (error) {
          console.error('❌ Error parsing password reset URL:', error);
          console.error('Error details:', error.message);
        }

        router.push('/(auth)/reset-password');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription?.remove();
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const initializeApp = async () => {
      try {
        if (!isMounted) return;
        setLoadingStep('Starting up...');
        setLoadingProgress(0.2);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!isMounted) return;
        setLoadingStep('Loading assets...');
        setLoadingProgress(0.4);
        await Promise.race([
          preloadImages(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Image loading timeout')), 10000))
        ]);
        
        if (!isMounted) return;
        setLoadingStep('Preparing data...');
        setLoadingProgress(0.7);
        
        const maxWaitTime = 5000;
        const startTime = Date.now();
        
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
          setLoadingStep('Ready!');
          setLoadingProgress(1);
          setIsReady(true);
          setError(null);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        if (isMounted) {
          setError(error.message);
          setIsReady(true);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [contextsReady]);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <LoadingScreen 
          progress={loadingProgress}
          loadingStep={loadingStep}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <UserProvider onReady={async (user) => {
            if (user?.id) {
              await initializePurchases(user.id);
            }
            setContextsReady(true);
          }}>
            <SettingsProvider>
              <UnitsProvider>
                <NotificationProvider>
                  <SharedMessageLimitProvider>
                    <TrackingProvider>
                      <AIConsentProvider>
                        <MainContent />
                      </AIConsentProvider>
                    </TrackingProvider>
                  </SharedMessageLimitProvider>
                </NotificationProvider>
              </UnitsProvider>
            </SettingsProvider>
          </UserProvider>
        </AuthProvider>
      </LanguageProvider>
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