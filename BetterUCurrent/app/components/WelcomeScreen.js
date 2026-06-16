import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Dimensions, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import {
  formatAppleSignInError,
  isAppleSignInCanceled,
  persistAppleProfileFields,
  signInWithAppleNative,
} from '../../utils/appleAuth';
import { normalizeSchoolProfile } from '../../lib/schoolProfileNormalize';
import { hasCompletedAppOnboarding, resolvePostAuthRouteForProfile } from '../../lib/onboardingGate';
// Metro resolves static images at build time — path must match a real file under assets/.
// This project ships app-icon.png (not app-logo.png), which is the same role: splash/welcome logo.
import appLogo from '../../assets/images/app-icon.png';

const { height } = Dimensions.get('window');

const WELCOME_BENEFITS = [
  { icon: 'barbell', text: 'Personalized AI workout plans' },
  { icon: 'leaf', text: 'Mental wellness guidance' },
  { icon: 'trending-up', text: 'Track progress & achievements' },
  { icon: 'chatbubble', text: '24/7 AI coaching support' },
  { icon: 'people', text: 'Connect with fitness community' },
];

const WelcomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Sign in with Apple is only available on iOS (and some Android devices; check at runtime)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (isMounted) setAppleAuthAvailable(available);
      } catch (e) {
        if (isMounted) setAppleAuthAvailable(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  /**
   * Continue with Apple: sign in or sign up via native Apple ID.
   * Supabase creates an account if the user doesn't exist; then we redirect to onboarding or home.
   */
  const handleContinueWithApple = async () => {
    try {
      setIsAppleLoading(true);
      const { data, credential } = await signInWithAppleNative(supabase);
      await persistAppleProfileFields(supabase, data.user.id, credential);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed, account_type, org_id')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileError) {
        console.warn('Profile check after Apple sign-in:', profileError.message);
      }
      if (!hasCompletedAppOnboarding(normalizeSchoolProfile(profile))) {
        router.replace('/(auth)/onboarding/welcome');
      } else {
        router.replace(resolvePostAuthRouteForProfile(profile));
      }
    } catch (e) {
      if (!isAppleSignInCanceled(e)) {
        console.error('Continue with Apple error:', e);
        const msg = formatAppleSignInError(e, 'sign in with Apple');
        Alert.alert('Apple Sign In', msg);
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleLogin = () => {
    console.log('Navigating to login...');
    router.push("/login");
  };

  const handleSignup = () => {
    console.log('Navigating to signup...');
    router.push("/signup");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Background */}
      <View style={styles.background} />
      
      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Top section with logo */}
        <View style={styles.topSection}>
          <View style={styles.logoWrapper}>
            <Image 
              source={appLogo}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Main content section */}
        <View style={styles.mainSection}>
          <Text style={styles.title}>Transform Your Life</Text>
          <Text style={styles.subtitle}>
            Join millions of people using AI to achieve their fitness and wellness goals
          </Text>
          
          <View style={styles.benefitsList}>
            {WELCOME_BENEFITS.map((item) => (
              <View key={item.text} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={item.icon} size={20} color="#00ffff" />
                </View>
                <Text style={styles.benefitText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom section with buttons */}
        <View style={styles.bottomSection}>
          {/* Sign up with Apple on iOS; Create Account on Android (no Apple) */}
          {Platform.OS === 'ios' && appleAuthAvailable ? (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={[styles.appleButton, isAppleLoading && styles.appleButtonDisabled]}
                onPress={handleContinueWithApple}
                disabled={isAppleLoading}
              />
              {isAppleLoading && (
                <ActivityIndicator size="small" color="#00ffff" style={styles.appleLoader} />
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSignup}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={isAppleLoading}
          >
            <Text style={styles.secondaryButtonText}>Sign in another way</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.schoolPartnerButton}
            onPress={() => router.push("/signup?mode=school")}
            activeOpacity={0.85}
            disabled={isAppleLoading}
          >
            <Ionicons name="school-outline" size={16} color="#00ffff" style={styles.schoolPartnerIcon} />
            <Text style={styles.schoolPartnerButtonText}>School sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.schoolPartnerButton}
            onPress={() => router.push("/login?mode=school")}
            activeOpacity={0.85}
            disabled={isAppleLoading}
          >
            <Ionicons name="log-in-outline" size={16} color="#00ffff" style={styles.schoolPartnerIcon} />
            <Text style={styles.schoolPartnerButtonText}>School sign in</Text>
          </TouchableOpacity>
        </View>

        {/* TOS text at the very bottom */}
        <View style={styles.tosSection}>
          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 15,
    paddingTop: height * 0.02,
    paddingBottom: height * 0.02,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 96,
    height: 96,
  },
  mainSection: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: height * 0.01,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 17,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 10,
    fontWeight: '400',
  },
  benefitsList: {
    width: '100%',
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },
  bottomSection: {
    paddingBottom: 16,
    gap: 10,
    marginTop: 20,
  },
  appleButton: {
    width: '100%',
    height: 46,
    marginBottom: 0,
  },
  appleButtonDisabled: {
    opacity: 0.7,
  },
  appleLoader: {
    marginVertical: 4,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    width: '100%',
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  orText: {
    color: '#9ca3af',
    fontSize: 14,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#00ffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  schoolPartnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
  },
  schoolPartnerIcon: {
    marginRight: 8,
  },
  schoolPartnerButtonText: {
    color: '#9dd',
    fontSize: 13,
    fontWeight: '600',
  },
  tosSection: {
    paddingBottom: 15, // 15px padding as requested
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});

export default WelcomeScreen;
