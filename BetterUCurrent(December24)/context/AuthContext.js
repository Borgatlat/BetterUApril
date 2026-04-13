"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import {
  SIGNUP_EMAIL_IN_USE_MESSAGE,
  isDuplicateSignupAuthError,
  isDuplicateSignupUserObfuscated,
} from "../utils/signupEmailConflict"
import AsyncStorage from "@react-native-async-storage/async-storage"

const AuthContext = createContext()

// Helper function to save user's timezone to their profile
// This is important for streak calculations to use the correct local day
const saveUserTimezone = async (userId) => {
  try {
    // Get the user's timezone from their device (e.g., 'America/New_York')
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Update the profiles table with the timezone
    const { error } = await supabase
      .from('profiles')
      .update({ timezone })
      .eq('id', userId);

    if (error) {
      console.log('[AuthContext] Could not save timezone:', error.message);
    } else {
      console.log(`[AuthContext] Saved timezone: ${timezone}`);
    }
  } catch (error) {
    // Silently fail - timezone is not critical to app function
    console.log('[AuthContext] Timezone save error:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [banStatus, setBanStatus] = useState(null)

  // PROFILE FETCH REMOVED: Commented out all profile fetching and logging
  /*
  // All code that fetches or logs profile data is now commented out.
  */

  // Check if user is banned
  const checkBanStatus = async (userId) => {
    try {
      const { data: bans, error } = await supabase
        .from('bans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (bans && bans.length > 0) {
        const ban = bans[0];
        if (ban.is_permanent) {
          return { isBanned: true, permanent: true };
        } else if (ban.banned_until) {
          const banEndDate = new Date(ban.banned_until);
          if (banEndDate > new Date()) {
            return { 
              isBanned: true, 
              permanent: false,
              endsAt: ban.banned_until,
              reason: ban.reason
            };
          }
        }
      }

      return { isBanned: false };
    } catch (error) {
      console.error('Error checking ban status:', error);
      return { isBanned: false };
    }
  };

  // Update the fetchProfile function to properly handle RLS
  const fetchProfile = async (userId) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist yet, this is expected during onboarding
          return null;
        }
        throw error;
      }

      return profile;
    } catch (error) {
      console.error('[AuthContext] Error fetching profile:', error);
      return null;
    }
  };

  // Add a function to create an initial profile
  const createInitialProfile = async (userId) => {
    // PROFILE FETCH REMOVED: Commented out all profile fetching and logging
    /*
    try {
      if (!userId) return

      const user = await supabase.auth.getUser()
      const email = user?.data?.user?.email

      const initialProfile = {
        profile_id: userId,
        full_name: email ? email.split("@")[0] : "New User",
        email: email,
        training_level: "intermediate",
      }

      const { data, error } = await supabase.from("profiles").insert([initialProfile]).select()

      if (error) {
        console.error("AuthContext: Error creating initial profile:", error)
      } else {
        console.log("AuthContext: Initial profile created:", data)
        setProfile(data[0])
      }
    } catch (error) {
      console.error("AuthContext: Error in createInitialProfile:", error)
    }
    */
  }

  // Update the auth state change handler
  useEffect(() => {
    let mounted = true;
    let subscription = null;

    const initializeAuth = async () => {
      try {
        // Get initial session
            const { data: { session } } = await supabase.auth.getSession();
            if (mounted) {
              setSession(session);
              setUser(session?.user ?? null);
              if (session?.user?.id) {
                // Check ban status first
                const banStatus = await checkBanStatus(session.user.id);
                if (mounted) {
                  setBanStatus(banStatus);
                  console.log('Ban status checked:', banStatus);
                  // Only fetch profile if not banned
                  if (!banStatus.isBanned) {
                    const profile = await fetchProfile(session.user.id);
                    if (mounted) {
                      setProfile(profile);
                      // Save user's timezone for streak calculations
                      // This ensures triggers use the correct local day
                      saveUserTimezone(session.user.id);
                    }
                  } else {
                    console.log('User is banned, not fetching profile');
                  }
                }
              }
              setIsLoading(false);
            }
      } catch (error) {
        console.error("AuthContext: Error in initializeAuth:", error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      try {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user?.id) {
          // Check ban status on auth state change
          const banStatus = await checkBanStatus(session.user.id);
          if (mounted) {
            setBanStatus(banStatus);
            console.log('Ban status checked on auth change:', banStatus);
            
            // Only fetch profile if not banned
            if (!banStatus.isBanned) {
              const profile = await fetchProfile(session.user.id);
              if (mounted) {
                setProfile(profile);
                // Save timezone on auth state change (e.g., sign in)
                saveUserTimezone(session.user.id);
              }
            } else {
              console.log('User is banned, not fetching profile on auth change');
              setProfile(null);
            }
          }
        } else {
          setBanStatus(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("AuthContext: Error handling auth state change:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    subscription = authSubscription;

    return () => {
      mounted = false;
      if (subscription) {
      subscription.unsubscribe();
      }
    };
  }, []); // Remove fetchProfile from dependencies

  // Update the signUp function to better handle the auth state:

  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        }
      });

      if (error) {
        console.error("Supabase signup error:", error);
        if (isDuplicateSignupAuthError(error)) {
          return { error: new Error(SIGNUP_EMAIL_IN_USE_MESSAGE), user: null };
        }
        return { error, user: null };
      }

      if (isDuplicateSignupUserObfuscated(data?.user, data?.session)) {
        return { error: new Error(SIGNUP_EMAIL_IN_USE_MESSAGE), user: null };
      }

      if (data?.user) {
        console.log("User created in Supabase:", data.user.id);

        // Set the user state immediately to trigger auth state change
        setUser(data.user);

        // Create onboarding data with full_name from auth metadata
        const { error: onboardingError } = await supabase
          .from("onboarding_data")
          .upsert({
            id: data.user.id,
            full_name: fullName,
            email: email,
          });

        if (onboardingError) {
          console.error("Error creating onboarding data:", onboardingError);
          return { error: onboardingError, user: data.user };
        }

        console.log("Onboarding data created successfully");

        // Fetch the profile to update the profile state
        fetchProfile(data.user.id);

        return { error: null, user: data.user };
      }

      return { error: new Error("No user data returned from signup"), user: null };
    } catch (error) {
      console.error("Signup error:", error);
      return { error, user: null };
    }
  };

  // Improve error handling in the AuthContext
  // Add this function to the AuthContext:

  const handleAuthError = (error, operation) => {
    console.error(`Error during ${operation}:`, error)
    if (error.message) {
      console.error(`Error message: ${error.message}`)
    }
    if (error.stack) {
      console.error(`Error stack: ${error.stack}`)
    }
    return { error }
  }

  // Then update the signIn function to use it:
  const signIn = async (email, password) => {
    try {
      console.log('Attempting to sign in with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      // Check ban status immediately after successful login
      if (data?.user?.id) {
        const banStatus = await checkBanStatus(data.user.id);
        if (banStatus.isBanned) {
          setBanStatus(banStatus);
          return { 
            error: { 
              message: banStatus.permanent 
                ? 'Your account has been permanently banned.' 
                : `Your account is temporarily banned until ${new Date(banStatus.endsAt).toLocaleDateString()}.`
            } 
          };
        }
      }

      console.log('Sign in successful, user:', data?.user?.id);
      return { error: null, data };
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      return { error };
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  // Update the updateProfile function to use id instead of user_id
  const updateProfile = async (updates) => {
    if (!user) return { error: "No user logged in" }

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (!error) {
        // Update local profile state
        setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      }

      return { error };
    } catch (error) {
      return { error };
    }
  }

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "betteru://reset-password",
      })
      return { error }
    } catch (error) {
      return { error }
    }
  }

  const updatePassword = async (password) => {
    try {
      console.log('[AuthContext] Updating password...');
      
      // Verify we have a valid session before attempting to update
      // This prevents errors when the session has expired
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('[AuthContext] No valid session found for password update');
        return { 
          error: { 
            message: 'No active session. Please sign in again.',
            code: 'NO_SESSION'
          } 
        };
      }
      
      // The updateUser promise is known to hang in React Native
      // We use a timeout wrapper and event-based detection for reliability
      let userUpdated = false;
      
      // Set up a listener for USER_UPDATED event
      // This is more reliable than waiting for the promise to resolve
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'USER_UPDATED') {
          console.log('[AuthContext] USER_UPDATED event received');
          userUpdated = true;
        }
      });
      
      // Call updateUser - we don't rely solely on the promise resolving
      const updateUserPromise = supabase.auth.updateUser({ password });
      
      // Create a timeout promise to prevent infinite waiting
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password update timed out')), 15000)
      );
      
      // Race between updateUser promise, event detection, and timeout
      // We check for the USER_UPDATED event as the primary success indicator
      const checkInterval = setInterval(() => {
        if (userUpdated) {
          clearInterval(checkInterval);
        }
      }, 100);
      
      try {
        // Wait for either the promise to resolve OR the event to fire OR timeout
        const result = await Promise.race([
          updateUserPromise.then(result => {
            // If the promise resolves (rare but possible), check for errors
            if (result.error) {
              throw result.error;
            }
            console.log('[AuthContext] updateUser promise resolved');
            userUpdated = true; // Mark as updated
            return result;
          }),
          new Promise((resolve, reject) => {
            // Wait for USER_UPDATED event
            const maxWait = 10000; // 10 seconds
            const startTime = Date.now();
            const checkEvent = setInterval(() => {
              if (userUpdated) {
                clearInterval(checkEvent);
                resolve({ data: { user: session.user }, error: null });
              } else if (Date.now() - startTime > maxWait) {
                clearInterval(checkEvent);
                reject(new Error('USER_UPDATED event not received'));
              }
            }, 100);
          }),
          timeoutPromise
        ]);
        
        // Clean up
        clearInterval(checkInterval);
        subscription.unsubscribe();
        
        if (result.error) {
          console.error('[AuthContext] Password update error:', result.error);
          return { error: result.error };
        }
        
        console.log('[AuthContext] Password updated successfully');
        return { data: result.data || { user: session.user }, error: null };
        
      } catch (error) {
        // Clean up on error
        clearInterval(checkInterval);
        subscription.unsubscribe();
        
        console.error('[AuthContext] Password update error:', error);
        return { 
          error: { 
            message: error.message || 'Failed to update password',
            code: error.code || 'UPDATE_ERROR'
          } 
        };
      }
      
    } catch (error) {
      console.error('[AuthContext] Unexpected error updating password:', error);
      return { 
        error: { 
          message: error.message || 'An unexpected error occurred',
          code: error.code || 'UNEXPECTED_ERROR'
        } 
      };
    }
  }

  // Update the refetchProfile method to use the same function
  const refetchProfile = useCallback(
    (userId) => {
      if (!userId && user) userId = user.id
      if (userId) {
        fetchProfile(userId)
      }
    },
    [user, fetchProfile],
  )

  const clearUserData = async () => {
    try {
      const { error } = await supabase
        .from('onboarding_data')
        .delete()
        .eq('profile_id', session?.user?.id);

      if (error) throw error;

      // Clear AsyncStorage preferences
      await AsyncStorage.clear();
      
      // Sign out after clearing data
      await signOut();
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsOnboardingComplete(false);
        return;
      }

      // First check if profile exists
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id);

      if (profileError) {
        console.error('Error checking profile:', profileError);
        setIsOnboardingComplete(false);
        return;
      }

      // If no profile exists, treat as not onboarded
      if (!profiles || profiles.length === 0) {
        console.log('No profile found, treating as not onboarded');
        setIsOnboardingComplete(false);
        return;
      }

      // If we have a profile, check its onboarding status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking onboarding status:', error);
        setIsOnboardingComplete(false);
        return;
      }

      setIsOnboardingComplete(!!profile.onboarding_completed);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsOnboardingComplete(false);
    }
  };

  // Include refetchProfile in the value object
  const value = {
    user,
    profile,
    session,
    isLoading,
    isOnboardingComplete,
    banStatus,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    refetchProfile,
    clearUserData,
    checkOnboardingStatus,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

