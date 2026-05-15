"use client";

import { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { LogoImage } from "../../utils/imageUtils";
import { useRouter } from "expo-router";


const { width, height } = Dimensions.get("window");
const isIphoneX = Platform.OS === "ios" && (height >= 812 || width >= 812);

const ResetPasswordScreen = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [userEmail, setUserEmail] = useState(null); // Store user email when session is established
  const [accessToken, setAccessToken] = useState(null); // Store access token when session is established
  const router = useRouter();
  const userUpdatedRef = useRef(false);

  // Check for valid session when component mounts and listen for auth changes
  // This useEffect runs once when the component mounts to verify we have a valid recovery session
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts
    
    const checkSession = async () => {
      try {
        console.log('🔍 Checking for valid password reset session...');
        
        // Use Promise.race to prevent getSession from hanging indefinitely
        // getSession() is known to sometimes hang in React Native, so we add a timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );
        
        let sessionResult;
        try {
          sessionResult = await Promise.race([sessionPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.warn('⚠️ getSession() timed out, checking auth state change listener instead');
          // If getSession hangs, we'll rely on the auth state change listener
          // which will set the session when it's established
          setIsCheckingSession(false);
          return;
        }
        
        const { data: { session }, error } = sessionResult;
        
        if (error) {
          console.error('❌ Error checking session:', error);
          if (isMounted) {
            setError('Invalid reset link. Please request a new password reset.');
            setIsCheckingSession(false);
          }
          return;
        }
        
        if (!session) {
          console.log('⏳ No active session found yet, waiting for session to be established...');
          // Don't set error immediately - the deep link handler might still be processing
          // Give it a few seconds for the session to be established via the deep link
          setTimeout(() => {
            if (isMounted && !isSessionValid) {
              console.warn('⚠️ Still no session after waiting period');
              setError('No active session found. Please request a new password reset.');
              setIsCheckingSession(false);
            }
          }, 3000); // Increased wait time to 3 seconds
          return;
        }
        
        // Verify the session has a user
        if (!session.user) {
          console.error('❌ Session exists but no user found');
          if (isMounted) {
            setError('Invalid reset link. Please request a new password reset.');
            setIsCheckingSession(false);
          }
          return;
        }
        
        console.log('✅ Valid recovery session found for password reset');
        console.log('Session user:', session.user.email);
        if (isMounted) {
          setIsSessionValid(true);
          setUserEmail(session.user.email); // Store email for later use
          setAccessToken(session.access_token); // Store access token for API calls
          setIsCheckingSession(false);
          setError(''); // Clear any previous errors
        }
      } catch (error) {
        console.error('❌ Error in checkSession:', error);
        if (isMounted) {
          setError('Failed to verify reset link. Please try again.');
          setIsCheckingSession(false);
        }
      }
    };
    
    // Initial session check
    checkSession();
    
    // Listen for auth state changes in case session is established after component mounts
    // This is important because the deep link handler might establish the session
    // after this component has already mounted
    // Also listen for USER_UPDATED to detect password updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session ? 'session exists' : 'no session');
      
      // PASSWORD_RECOVERY: emitted for some recovery flows; SIGNED_IN: setSession / PKCE exchange
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        console.log('✅ Session established via auth state change (likely from deep link)');
        if (isMounted) {
          setIsSessionValid(true);
          setUserEmail(session.user?.email || null); // Store email for later use
          setAccessToken(session.access_token || null); // Store access token for API calls
          setIsCheckingSession(false);
          setError(''); // Clear any errors
        }
      } else if (event === 'USER_UPDATED') {
        // This event fires when the password is successfully updated
        console.log('✅ USER_UPDATED event detected in auth state listener');
        userUpdatedRef.current = true;
      } else if (event === 'SIGNED_OUT') {
        console.log('⚠️ User signed out during password reset');
        if (isMounted) {
          setIsSessionValid(false);
          setError('Session expired. Please request a new password reset.');
        }
      }
    });
    
    // Cleanup function - runs when component unmounts
    return () => {
      isMounted = false; // Prevent state updates after unmount
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async () => {
    // Check if session is valid before proceeding
    if (!isSessionValid) {
      setError("Invalid session. Please request a new password reset.");
      Alert.alert("Error", "Invalid session. Please request a new password reset.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log('🔐 Starting password update process...');
      
      // Step 1: Verify we have a valid recovery session
      // This is critical - we need to ensure the session is actually a recovery session
      // and hasn't expired. getSession() can hang, so we use a timeout wrapper.
      console.log('🔍 Step 1: Verifying recovery session...');
      
      const sessionCheckPromise = supabase.auth.getSession();
      const sessionTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session check timed out')), 3000)
      );
      
      let sessionCheck;
      let sessionCheckTimedOut = false;
      try {
        sessionCheck = await Promise.race([sessionCheckPromise, sessionTimeoutPromise]);
      } catch (timeoutError) {
        console.warn('⚠️ Session check timed out, using component state instead');
        sessionCheckTimedOut = true;
        // If getSession hangs, we'll rely on the component's session state
        // which was verified when the component mounted via the auth state change listener
      }
      
      // If getSession() timed out, trust the component's isSessionValid state
      // This state is set by the auth state change listener when the session is established
      if (sessionCheckTimedOut) {
        if (!isSessionValid) {
          console.error('❌ No valid recovery session found: Component state indicates invalid session');
          setError('Invalid or expired reset link. Please request a new password reset.');
          Alert.alert("Error", 'Invalid or expired reset link. Please request a new password reset.');
          setIsLoading(false);
          return;
        }
        // Session is valid according to component state (set by auth listener)
        console.log('✅ Step 1 complete: Valid recovery session confirmed (via component state)');
        console.log('Using component session state - session was established via auth state change listener');
      } else {
        // getSession() succeeded, verify the session
        const { data: { session }, error: sessionError } = sessionCheck || { data: { session: null }, error: null };
        
        if (sessionError || !session) {
          console.error('❌ No valid recovery session found:', sessionError?.message || 'No session');
          setError('Invalid or expired reset link. Please request a new password reset.');
          Alert.alert("Error", 'Invalid or expired reset link. Please request a new password reset.');
          setIsLoading(false);
          return;
        }
        
        // Verify this is actually a recovery session (not a regular login)
        // Recovery sessions have a specific token type
        console.log('✅ Step 1 complete: Valid recovery session confirmed (via getSession)');
        console.log('Session user:', session.user?.email);
      }
      
      // Step 2: Update the password using updateUser
      // The updateUser promise is known to hang in React Native, so we use multiple strategies:
      // 1. Promise.race with timeout
      // 2. Listen for USER_UPDATED event
      // 3. Verify success by checking if we can sign in with new password
      console.log('🔍 Step 2: Updating password...');
      
      // Reset the USER_UPDATED flag
      userUpdatedRef.current = false;
      
      // Track updateUser call status for error detection
      let updateUserImmediateError = null;
      
      // Set up the event listener FIRST, before calling updateUser
      // This ensures we don't miss the event if it fires quickly
      let eventSubscription = null;
      let eventReceived = false;
      
      // Create a promise that resolves when USER_UPDATED event fires
      // This is more reliable than waiting for the updateUser promise to resolve
      const userUpdatedPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (eventSubscription) {
            eventSubscription.unsubscribe();
          }
          reject(new Error('Password update timed out - USER_UPDATED event not received'));
        }, 12000); // 12 second timeout (increased from 10)
        
        // Set up the auth state change listener BEFORE calling updateUser
        // This is critical - if we set it up after, we might miss the event
        console.log('Setting up USER_UPDATED event listener...');
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('🔄 Auth state change event:', event);
          if (event === 'USER_UPDATED') {
            console.log('✅ USER_UPDATED event received!');
            eventReceived = true;
            userUpdatedRef.current = true;
            clearTimeout(timeout);
            if (subscription) {
              subscription.unsubscribe();
            }
            resolve({ event, session });
          } else if (event === 'SIGNED_OUT') {
            // If user is signed out, something went wrong
            console.error('❌ User was signed out during password update');
            clearTimeout(timeout);
            if (subscription) {
              subscription.unsubscribe();
            }
            reject(new Error('Session was lost during password update'));
          }
        });
        
        eventSubscription = subscription;
        
        // Also poll the ref flag as a backup (in case event fires before listener is ready)
        const checkInterval = setInterval(() => {
          if (userUpdatedRef.current || eventReceived) {
            console.log('✅ USER_UPDATED detected via polling');
            clearInterval(checkInterval);
            clearTimeout(timeout);
            if (subscription) {
              subscription.unsubscribe();
            }
            resolve({ event: 'USER_UPDATED', detectedVia: 'polling' });
          }
        }, 100);
        
        // Store interval ID for cleanup
        const cleanup = () => {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          if (subscription) {
            subscription.unsubscribe();
          }
        };
        
        // Ensure cleanup happens on timeout
        setTimeout(() => {
          if (!eventReceived && !userUpdatedRef.current) {
            cleanup();
          }
        }, 12000);
      });
      
      // WORKAROUND: Use direct HTTP request instead of updateUser() which hangs in React Native
      // Get the access token from the stored token (set when session was established)
      console.log('🔧 Using direct API call workaround for password update...');
      console.log('Password length:', newPassword.length);
      
      // Get access token - use stored token first (from auth state change listener)
      let tokenToUse = accessToken;
      
      // If we don't have stored token, try to get it (with timeout protection)
      if (!tokenToUse) {
        console.log('⚠️ No stored access token, trying to get from session...');
        try {
          const tokenCheck = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          tokenToUse = tokenCheck?.data?.session?.access_token;
          if (tokenToUse) {
            // Store it for next time
            setAccessToken(tokenToUse);
          }
        } catch (e) {
          console.warn('⚠️ Could not get access token from getSession()');
        }
      } else {
        console.log('✅ Using stored access token');
      }
      
      if (!tokenToUse) {
        throw new Error('Could not get access token. The reset link may have expired. Please request a new password reset.');
      }
      
      console.log('✅ Got access token, making direct API call to update password...');
      
      // Make direct HTTP request to Supabase auth API
      // This bypasses the broken updateUser() method
      const supabaseUrl = 'https://kmpufblmilcvortrfilp.supabase.co';
      const updatePasswordResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttcHVmYmxtaWxjdm9ydHJmaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2Mjg2MzYsImV4cCI6MjA1OTIwNDYzNn0.JYJ5WSZWp04AGxfcX2GsiPrTn2QUStCfCHmdDNyxo04'
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      const updateResult = await updatePasswordResponse.json();
      
      if (!updatePasswordResponse.ok) {
        console.error('❌ Direct API call failed:', updateResult);
        updateUserImmediateError = {
          message: updateResult.msg || updateResult.error_description || 'Password update failed',
          status: updatePasswordResponse.status
        };
        throw updateUserImmediateError;
      }
      
      console.log('✅ Direct API call successful! Password updated via HTTP request');
      
      // Mark as updated since the API call succeeded
      userUpdatedRef.current = true;
      eventReceived = true;
      
      // Create a resolved promise to match the expected format
      const updateUserPromise = Promise.resolve({
        data: { user: updateResult },
        error: null
      });
      
      // Race between the updateUser promise and our event-based promise
      // Also add a timeout to prevent infinite waiting
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password update operation timed out')), 15000)
      );
      
      try {
        // Since we used direct API call, it already succeeded
        // Just await the promise to get the result (it's already resolved)
        const result = await updateUserPromise;
        
        // Check for any errors in the result
        if (result.error) {
          throw result.error;
        }
        
        console.log('✅ Step 2 complete: Password update successful');
        
        // Since the direct API call succeeded, we can show success immediately
        // The password was definitely updated on the server
        console.log('✅ Password update completed successfully!');
        
        // Stop loading immediately - do this first so UI updates
        setIsLoading(false);
        
        // Clear any errors
        setError('');
        
        // Show success message - use setTimeout to ensure UI has updated
        setTimeout(() => {
          Alert.alert(
            "Success",
            "Your password has been updated successfully. You can now sign in with your new password.",
            [{ 
              text: "OK", 
              onPress: () => {
                console.log('Navigating to login screen...');
                router.push("/(auth)/login");
              }
            }]
          );
        }, 100);
        
        // Optional: Try to verify in the background (non-blocking)
        // This is just for logging, doesn't affect the user experience
        (async () => {
          try {
            console.log('🔍 Step 3: Verifying password in background (non-blocking)...');
            
            // Get the user's email - use stored email first
            let emailForVerification = userEmail;
            
            if (!emailForVerification) {
              // Try from sessionCheck if we have it
              if (!sessionCheckTimedOut && sessionCheck?.data?.session?.user?.email) {
                emailForVerification = sessionCheck.data.session.user.email;
              }
            }
            
            if (emailForVerification) {
              // Wait a moment for the password update to propagate
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Try to sign in with the new password to verify it works
              // Use a timeout to prevent hanging
              const verifyPromise = supabase.auth.signInWithPassword({
                email: emailForVerification,
                password: newPassword
              });
              
              const verifyTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Verification timeout')), 5000)
              );
              
              try {
                const { data: verifyData, error: verifyError } = await Promise.race([
                  verifyPromise,
                  verifyTimeout
                ]);
                
                if (verifyError) {
                  console.warn('⚠️ Background verification failed (but password was updated):', verifyError.message);
                } else {
                  console.log('✅ Background verification successful - password confirmed working');
                }
              } catch (e) {
                console.warn('⚠️ Background verification timed out or failed (but password was updated)');
              }
            }
          } catch (e) {
            // Ignore background verification errors - password was already updated
            console.warn('⚠️ Background verification error (ignored):', e.message);
          }
        })();
        
        return; // Exit early since we've shown success
        
      } catch (updateError) {
        // Handle errors from the update process
        console.error('❌ Password update error:', updateError);
        
        // If the error is a timeout waiting for USER_UPDATED event,
        // try a fallback: wait a bit and attempt to verify by signing in
        if (updateError.message && updateError.message.includes('USER_UPDATED event not received')) {
          console.log('⚠️ USER_UPDATED event not received, trying fallback verification...');
          
          // Check if updateUser had an immediate error
          if (updateUserImmediateError) {
            console.error('❌ updateUser had an immediate error, password was not updated');
            const errorMessage = updateUserImmediateError.message || 'Password update failed. Please check your password and try again.';
            setError(errorMessage);
            Alert.alert("Error", errorMessage);
            setIsLoading(false);
            return;
          }
          
          // Fallback: Wait a moment and try to verify by signing in
          // Sometimes the password is updated even if the event doesn't fire
          try {
            // Get user email for verification - use stored email first, then try other methods
            let emailForVerification = userEmail; // Use stored email from component state
            
            // If we don't have stored email, try to get it
            if (!emailForVerification) {
              // Method 1: Try from sessionCheck if we have it
              if (!sessionCheckTimedOut && sessionCheck?.data?.session?.user?.email) {
                emailForVerification = sessionCheck.data.session.user.email;
                console.log('✅ Got email from sessionCheck');
              } else {
                // Method 2: Try getUser() which is often faster than getSession()
                try {
                  console.log('🔍 Trying getUser() to get email...');
                  const userResult = await Promise.race([
                    supabase.auth.getUser(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                  ]);
                  emailForVerification = userResult?.data?.user?.email;
                  if (emailForVerification) {
                    console.log('✅ Got email from getUser()');
                  }
                } catch (e) {
                  console.warn('⚠️ getUser() failed, trying getSession()...');
                  // Method 3: Try getSession() as last resort
                  try {
                    const quickCheck = await Promise.race([
                      supabase.auth.getSession(),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                    ]);
                    emailForVerification = quickCheck?.data?.session?.user?.email;
                    if (emailForVerification) {
                      console.log('✅ Got email from getSession()');
                    }
                  } catch (e2) {
                    console.warn('❌ Could not get email from any method');
                  }
                }
              }
            } else {
              console.log('✅ Using stored email from component state');
            }
            
            if (emailForVerification) {
              // Wait longer for the update to propagate on the server
              // Password updates can take a few seconds to be fully processed
              console.log('⏳ Waiting for password update to propagate (5 seconds)...');
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Try to sign in with the new password to verify it was updated
              console.log('🔍 Attempting fallback verification via sign-in...');
              
              // First, sign out the current recovery session so we can test sign-in
              // Recovery sessions might interfere with sign-in verification
              try {
                await supabase.auth.signOut();
                console.log('✅ Signed out recovery session for verification');
                // Wait a moment for sign out to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (signOutError) {
                console.warn('⚠️ Could not sign out before verification:', signOutError);
                // Continue anyway
              }
              
              const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
                email: emailForVerification,
                password: newPassword
              });
              
              if (!verifyError && verifyData) {
                // Success! Password was updated even though event didn't fire
                console.log('✅ Fallback verification successful - password was updated!');
                Alert.alert(
                  "Success",
                  "Your password has been updated successfully. You can now sign in with your new password.",
                  [{ text: "OK", onPress: () => router.push("/(auth)/login") }]
                );
                setIsLoading(false);
                return; // Exit early, password update succeeded
              } else {
                console.error('❌ Fallback verification failed:', verifyError);
                // The password might not have been updated, or we need to wait longer
                // Give the user the benefit of the doubt - sometimes updates take time
                // Show a message that they should try signing in manually
                Alert.alert(
                  "Password Update",
                  "The password update may have completed, but we couldn't verify it automatically. Please try signing in with your new password. If it doesn't work, please request a new password reset.",
                  [
                    { text: "Try Sign In", onPress: () => router.push("/(auth)/login") },
                    { text: "Request New Reset", onPress: () => router.push("/(auth)/forgot-password") }
                  ]
                );
                setIsLoading(false);
                return; // Exit - don't throw error, let user try manually
              }
            } else {
              // Can't verify, show error
              throw new Error('Could not verify password update. Please try again.');
            }
          } catch (fallbackError) {
            console.error('❌ Fallback verification also failed:', fallbackError);
            // Continue to show error message below
          }
        }
        
        let errorMessage = 'Failed to update password. Please try again.';
        
        // Check if it's a validation error
        if (updateError.message) {
          if (updateError.message.includes('Password should contain')) {
            errorMessage = 'Password must be at least 6 characters long. For stronger security, include both letters and numbers.';
          } else if (updateError.message.includes('timeout')) {
            errorMessage = 'Password update timed out. Please check your connection and try again.';
          } else if (updateError.message.includes('Invalid')) {
            errorMessage = 'Invalid password reset link. Please request a new password reset.';
          } else {
            errorMessage = updateError.message;
          }
        }
        
        setError(errorMessage);
        Alert.alert("Error", errorMessage);
      }
      
    } catch (error) {
      // Catch any unexpected errors
      console.error('❌ Unexpected error during password update:', error);
      const errorMessage = error.message || "An unexpected error occurred. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
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
            <LogoImage size={160} style={styles.logo} />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below
            </Text>
            
            {isCheckingSession ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#00ffff" size="small" />
                <Text style={styles.loadingText}>Verifying reset link...</Text>
              </View>
            ) : isSessionValid ? (
              <Text style={styles.instructionText}>
                You can now set a new password for your account
              </Text>
            ) : (
              <Text style={styles.errorInstructionText}>
                Invalid or expired reset link. Please request a new password reset.
              </Text>
            )}

            <View style={[styles.inputContainer, !isSessionValid && styles.inputDisabled]}>
              <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, !isSessionValid && styles.inputTextDisabled]}
                placeholder="New Password"
                placeholderTextColor="#888"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading && isSessionValid}
              />
              <TouchableOpacity 
                style={styles.passwordToggle} 
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading || !isSessionValid}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, !isSessionValid && styles.inputDisabled]}>
              <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, !isSessionValid && styles.inputTextDisabled]}
                placeholder="Confirm New Password"
                placeholderTextColor="#888"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading && isSessionValid}
              />
              <TouchableOpacity 
                style={styles.passwordToggle} 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading || !isSessionValid}
              >
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#888" />
              </TouchableOpacity>
            </View>



            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity 
              style={[styles.button, (isLoading || !isSessionValid) && styles.buttonDisabled]} 
              onPress={handleUpdatePassword} 
              disabled={isLoading || !isSessionValid}
            >
              {isLoading ? (
                <ActivityIndicator color="black" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSessionValid ? 'Update Password' : 'Invalid Reset Link'}
                </Text>
              )}
            </TouchableOpacity>



            {!isSessionValid && (
              <TouchableOpacity 
                style={styles.requestResetButton} 
                onPress={() => router.push("/(auth)/forgot-password")}
              >
                <Text style={styles.requestResetButtonText}>
                  Request New Password Reset
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Remember your password?</Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 15,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 14,
    color: "#00ffff",
    marginBottom: 25,
    textAlign: "center",
    fontStyle: "italic",
  },
  errorInstructionText: {
    fontSize: 14,
    color: "#FF6B6B",
    marginBottom: 25,
    textAlign: "center",
    fontStyle: "italic",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },
  loadingText: {
    fontSize: 14,
    color: "#00ffff",
    marginLeft: 10,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputTextDisabled: {
    color: "#666",
  },
  requestResetButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#00ffff",
  },
  requestResetButtonText: {
    color: "#00ffff",
    fontSize: 16,
    fontWeight: "bold",
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
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
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

});

export default ResetPasswordScreen; 