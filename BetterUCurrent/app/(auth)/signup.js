"use client";

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Linking,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { LogoImage } from "../../utils/imageUtils";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TurnstileCaptcha from "../../components/TurnstileCaptcha";
import { TURNSTILE_CONFIG } from "../../config/turnstile";
import * as AppleAuthentication from 'expo-apple-authentication';
import { consumerDomainFromEmail, isPersonalConsumerEmail } from "../../lib/schoolEmailDomains";
import {
  formatAppleSignInError,
  isAppleSignInCanceled,
  persistAppleProfileFields,
  signInWithAppleNative,
} from "../../utils/appleAuth";
import { normalizeSchoolProfile } from "../../lib/schoolProfileNormalize";
import { hasCompletedAppOnboarding, resolvePostAuthRouteForProfile } from "../../lib/onboardingGate";

const { width, height } = Dimensions.get("window");
const isIphoneX = Platform.OS === "ios" && (height >= 812 || width >= 812);

const SignupScreen = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  /** "public" = standard B2C; "school" = partner school (must use school email for domain match). */
  const [signupMode, setSignupMode] = useState("public");
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signUp: authSignUp } = useAuth();

  // Deep link / welcome CTA: /signup?mode=school
  useEffect(() => {
    const raw = params?.mode;
    const mode = Array.isArray(raw) ? raw[0] : raw;
    if (mode === "school" || mode === "partner") {
      setSignupMode("school");
    }
  }, [params?.mode]);

  const handleSignup = async () => {
    if (fullName === "" || email === "" || password === "" || confirmPassword === "") {
      setError("Please fill in all fields");
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }



    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      Alert.alert("Error", "Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    const domain = consumerDomainFromEmail(email);
    if (signupMode === "school") {
      if (!domain) {
        setError("Enter a valid school email address.");
        Alert.alert("School email", "Please use your school-issued email (e.g. you@yourschool.edu).");
        return;
      }
      if (isPersonalConsumerEmail(email)) {
        setError("School signup needs your school email, not a personal inbox.");
        Alert.alert(
          "Use your school email",
          "Partner school sign-up only works with an email your school gave you (for example @yourschool.edu). Pick “Personal account” if you’re signing up with Gmail or iCloud."
        );
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      // useAuth.signUp creates onboarding_data + apply_school_domain_on_profile (student vs public).
      const { error: signErr, user: createdUser } = await authSignUp(
        email.trim(),
        password,
        fullName.trim()
      );

      if (signErr) {
        console.error("Auth error:", signErr);
        const msg = signErr.message ?? String(signErr);
        const isEmailDeliveryError =
          msg.toLowerCase().includes("confirmation email") ||
          msg.toLowerCase().includes("sending confirmation");
        const friendlyMessage = isEmailDeliveryError
          ? "We couldn't send the verification email right now. Please try again in a few minutes, or sign up with Apple above."
          : msg;
        setError(friendlyMessage);
        Alert.alert(
          "Sign up issue",
          isEmailDeliveryError
            ? "We couldn't send the verification email right now. Please try again in a few minutes, or use \"Sign up with Apple\" at the top of this screen."
            : msg
        );
        setIsLoading(false);
        return;
      }

      if (!createdUser) {
        setError("Failed to create user");
        Alert.alert("Error", "Failed to create user. Please try again.");
        setIsLoading(false);
        return;
      }

      setUserEmail(email.trim());
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Unexpected error:", error);
      setError("An unexpected error occurred");
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
    setIsLoading(false);
  };

  const saveAppleProfileFields = async (userId, credential) => {
    await persistAppleProfileFields(supabase, userId, credential);
  };

  // Handle Apple Sign Up - uses native Apple Authentication API
  // This works for both new users (sign up) and existing users (sign in)
  // Supabase's signInWithIdToken automatically creates an account if the user doesn't exist
  const handleAppleSignUp = async () => {
    try {
      setIsLoading(true);
      setError("");
      console.log('Starting Apple Sign Up...');

      const { data, credential } = await signInWithAppleNative(supabase);

      console.log('Supabase sign up successful:', data);

      await saveAppleProfileFields(data.user.id, credential);

      // Check onboarding status to determine where to navigate
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed, account_type, org_id')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error checking onboarding status:', profileError);
        
        // If profile doesn't exist (PGRST116 error), user is new - go to onboarding
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, new user - redirecting to onboarding');
          router.replace('/(auth)/onboarding/welcome');
          return;
        }
        
        setError('Failed to check onboarding status');
        return;
      }

      if (!hasCompletedAppOnboarding(normalizeSchoolProfile(profile))) {
        router.replace('/(auth)/onboarding/welcome');
      } else {
        router.replace(resolvePostAuthRouteForProfile(profile));
      }
    } catch (error) {
      if (!isAppleSignInCanceled(error)) {
        console.error('Apple Sign Up error:', error);
        const msg = formatAppleSignInError(error, 'sign up with Apple');
        setError(msg);
        Alert.alert('Apple Sign In', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.logoContainer}>
            <LogoImage size={200} style={styles.logo} />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              {signupMode === "school"
                ? "Use your school email to sign up."
                : "Sign up to get started with BetterU"}
            </Text>

            {/* Choose personal vs school-partner signup (two-door B2B2C). */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeChip, signupMode === "public" && styles.modeChipActive]}
                onPress={() => setSignupMode("public")}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={signupMode === "public" ? "#000" : "#ccc"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.modeChipText, signupMode === "public" && styles.modeChipTextActive]}
                >
                  Personal account
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeChip, signupMode === "school" && styles.modeChipActive]}
                onPress={() => setSignupMode("school")}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="school-outline"
                  size={18}
                  color={signupMode === "school" ? "#000" : "#ccc"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.modeChipText, signupMode === "school" && styles.modeChipTextActive]}
                >
                  School sign in
                </Text>
              </TouchableOpacity>
            </View>

            {signupMode === "school" ? (
              <View style={styles.schoolHint}>
                <Ionicons name="information-circle-outline" size={20} color="#00ffff" style={styles.schoolHintIcon} />
                <Text style={styles.schoolHintText}>
                  If your school or district has partnered with BetterU, sign up with the email they
                  gave you (same domain as your classmates). You’ll get the school wellness workspace
                  after you verify email. If your domain isn’t set up yet, you’ll still have a normal
                  account until your school joins.
                </Text>
              </View>
            ) : null}

            {/* Sign up with Apple first (iOS) */}
            {Platform.OS === 'ios' && (
              <>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={10}
                  style={[styles.appleButton, { height: 50, marginBottom: 16 }]}
                  onPress={handleAppleSignUp}
                  disabled={isLoading}
                />
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#888"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={signupMode === "school" ? "School email (you@yourschool.edu)" : "Email"}
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#888"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#888"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Modern Security Verification */}
            <View style={styles.captchaContainer}>
              <View style={styles.captchaHeader}>
                <View style={styles.captchaIconContainer}>
                  <Ionicons name="shield-checkmark" size={24} color="#00ffff" />
                </View>
                <View style={styles.captchaTitleContainer}>
                  <Text style={styles.captchaLabel}>Security Verification</Text>
                  <Text style={styles.captchaSubtitle}>
                    Complete verification to protect your account
                  </Text>
                </View>
              </View>
              
              <View style={styles.captchaContent}>
                <TurnstileCaptcha
                  siteKey={TURNSTILE_CONFIG.SITE_KEY}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError("");
                  }}
                  onError={(message) => {
                    setCaptchaError(message);
                    setCaptchaToken("");
                  }}
                  style={styles.captcha}
                />
                
                {captchaError ? (
                  <View style={styles.captchaErrorContainer}>
                    <Ionicons name="alert-circle" size={18} color="#ff6b6b" />
                    <Text style={styles.captchaErrorText}>{captchaError}</Text>
                  </View>
                ) : null}
                
                {captchaToken ? (
                  <View style={styles.captchaSuccessContainer}>
                    <Ionicons name="checkmark-circle" size={18} color="#00ff88" />
                    <Text style={styles.captchaSuccessText}>Verification complete!</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Terms and Privacy Policy Agreement */}
            <View style={styles.termsAgreementContainer}>
              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
              >
                <View style={[
                  styles.checkbox,
                  agreedToTerms && styles.checkboxChecked
                ]}>
                  {agreedToTerms && (
                    <Ionicons name="checkmark" size={16} color="#000" />
                  )}
                </View>
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsAgreementText}>
                    I agree to BetterU's{' '}
                    <Text 
                      style={styles.termsLink}
                      onPress={() => Linking.openURL('https://www.betteruai.com/terms-of-service')}
                    >
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text 
                      style={styles.termsLink}
                      onPress={() => Linking.openURL('https://www.betteruai.com/privacy-policy')}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
                            style={[
                styles.button,
                !agreedToTerms && styles.buttonDisabled
              ]}
              onPress={handleSignup}
              disabled={isLoading || !agreedToTerms}
            >
              {isLoading ? (
                <ActivityIndicator color="black" />
              ) : (
                <Text style={[
                  styles.buttonText,
                  !agreedToTerms && styles.buttonTextDisabled
                ]}>
                  {!agreedToTerms
                    ? "Agree to Terms to Sign Up"
                    : signupMode === "school"
                      ? "Sign up with school email"
                      : "Sign Up"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>By signing up, you agree to our </Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.betteruai.com/terms-of-service')}>
                <Text style={styles.termsLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.termsText}> and </Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.betteruai.com/privacy-policy')}>
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Email Verification Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            {/* Success Icon */}
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#00ffff" />
            </View>
            
            {/* Header */}
            <Text style={styles.successTitle}>Account Created Successfully!</Text>
            
            {/* Email Info */}
            <View style={styles.emailInfoContainer}>
              <Ionicons name="mail-outline" size={20} color="#00ffff" />
              <Text style={styles.emailText}>
                We've sent a verification email to:
              </Text>
              <Text style={styles.userEmail}>{userEmail}</Text>
            </View>
            
            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Next Steps:</Text>
              <View style={styles.instructionItem}>
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  Check your email inbox (and spam folder)
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Click the verification link in the email
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Return to the app and sign in
                </Text>
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.openEmailButton}
                onPress={() => {
                  // Try to open the user's email app
                  Linking.openURL('mailto:');
                }}
              >
                <Ionicons name="mail" size={18} color="#fff" />
                <Text style={styles.openEmailButtonText}>Open Email App</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.goToLoginButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push("/(auth)/login");
                }}
              >
                <Text style={styles.goToLoginButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
            
            {/* Help Text */}
            <Text style={styles.helpText}>
              Didn't receive the email? Check your spam folder or contact support.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: Platform.OS === "ios" ? (isIphoneX ? 50 : 20) : 0,
  },
  container: {
    flexGrow: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  logoContainer: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: "center",
  },
  logo: {
    // No additional styling needed as LogoImage component handles the circular shape
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    padding: 25,
    width: "90%",
    maxWidth: 400,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    marginBottom: 16,
    textAlign: "center",
  },
  modeRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 5,
  },
  modeChipActive: {
    backgroundColor: "#00ffff",
    borderColor: "#00ffff",
  },
  modeChipText: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "600",
  },
  modeChipTextActive: {
    color: "#000",
  },
  schoolHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.2)",
  },
  schoolHintIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  schoolHintText: {
    flex: 1,
    color: "#b8e8e8",
    fontSize: 13,
    lineHeight: 19,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  inputIcon: {
    marginHorizontal: 15,
  },
  input: {
    flex: 1,
    height: 50,
    color: "white",
    paddingRight: 15,
  },
  passwordToggle: {
    padding: 15,
  },
  errorText: {
    color: "#FF6B6B",
    marginBottom: 15,
    textAlign: "center",
  },
  button: {
    backgroundColor: "cyan",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 50,
  },
  buttonDisabled: {
    backgroundColor: "#666",
    opacity: 0.6,
  },
  buttonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonTextDisabled: {
    color: "#999",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginText: {
    color: "#B3B3B3",
    fontSize: 14,
    marginRight: 5,
  },
  loginLink: {
    color: "cyan",
    fontSize: 14,
    fontWeight: "bold",
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    color: '#B3B3B3',
    marginHorizontal: 10,
    fontSize: 14,
  },
  appleButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  termsText: {
    color: '#888',
    fontSize: 12,
  },
  termsLink: {
    color: '#00ffff',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  // Success Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  emailInfoContainer: {
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  emailText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ffff',
    textAlign: 'center',
  },
  instructionsContainer: {
    width: '100%',
    marginBottom: 25,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 12,
    flex: 1,
  },
  modalButtonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  openEmailButton: {
    backgroundColor: '#00ffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openEmailButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  goToLoginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  goToLoginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  captchaContainer: {
    marginBottom: 0,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
    paddingBottom: 75,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  captchaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
  },
  captchaIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  captchaTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  captchaLabel: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  captchaSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    fontWeight: '400',
  },
  captchaContent: {
    width: '100%',
    alignItems: 'center',
  },
  captchaWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  captcha: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  captchaErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
    width: '100%',
    justifyContent: 'center',
  },
  captchaErrorText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  captchaSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.25)',
    width: '100%',
    justifyContent: 'center',
  },
  captchaSuccessText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  termsAgreementContainer: {
    marginBottom: 2,
    marginTop: 60,
    width: '100%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#00ffff',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#00ffff',
  },
  termsTextContainer: {
    flex: 1,
  },
  termsAgreementText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  termsLink: {
    color: '#00ffff',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  numberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00ffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  numberText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default SignupScreen; 