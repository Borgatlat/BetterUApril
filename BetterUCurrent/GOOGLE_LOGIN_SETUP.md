# Google Login Setup Guide - Updated Implementation

## Overview

This guide explains the **proper way** to implement Google Sign-In with Supabase in React Native using Expo. The new implementation is more secure, maintainable, and follows current best practices.

## Key Improvements in the New Implementation

### 1. **Security Enhancements**
- ❌ **Old**: Hardcoded client secrets in the code (security risk)
- ✅ **New**: Secrets stored only in Supabase dashboard (secure)

### 2. **Simplified Flow**
- ❌ **Old**: Manual token exchange with Google APIs
- ✅ **New**: Uses Supabase's built-in OAuth flow

### 3. **Better Error Handling**
- ❌ **Old**: Limited error handling
- ✅ **New**: Comprehensive error handling with user feedback

### 4. **Session Management**
- ❌ **Old**: Manual session handling
- ✅ **New**: Automatic session management by Supabase

## Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google+ API
   - Google Identity API
   - Google OAuth2 API

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Configure OAuth consent screen:
   - User Type: External
   - App name: BetterU
   - User support email: your-email@domain.com
   - Developer contact information: your-email@domain.com
   - Add scopes: `openid`, `profile`, `email`

4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: BetterU Web Client
   - **Important**: Add these Authorized redirect URIs:
     ```
     https://auth.expo.io/@easbetteru/betterU_TestFlight_v7
     https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth
     https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback
     ```

## Step 3: Configure Supabase

1. Go to your Supabase dashboard
2. Navigate to Authentication → Providers
3. Enable Google provider
4. Add your Google OAuth credentials:
   - Client ID: Your Google OAuth client ID
   - Client Secret: Your Google OAuth client secret
   - Redirect URL: `https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback`

## Step 4: Code Implementation Explained

### The New Implementation Structure

```javascript
// Main Google Sign-In function with detailed explanations
const handleGoogleSignIn = async () => {
  try {
    setIsLoading(true);
    setError("");
    console.log('Starting Google Sign In with Supabase OAuth...');
    
    // Step 1: Clear any existing session to force fresh account selection
    // This ensures the user can choose a different Google account if needed
    console.log('Clearing existing session...');
    await supabase.auth.signOut();
    
    // Step 2: Use Supabase's built-in Google OAuth with proper configuration
    // This is much simpler than manual token exchange
    console.log('Using Supabase OAuth flow...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google', // Specify Google as the OAuth provider
      options: {
        // Use different redirect URIs based on environment
        redirectTo: isExpoGo 
          ? 'https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth' // Expo Go
          : 'betteru://auth/callback', // Standalone app
        queryParams: {
          prompt: 'select_account', // Force account selection dialog
          access_type: 'offline', // Request refresh token for long-term access
          include_granted_scopes: 'true', // Include all granted scopes
        }
      }
    });

    // Step 3: Handle any errors from Supabase
    if (error) {
      console.error('Supabase Google Sign In error:', error);
      setError('Failed to sign in with Google');
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
      return;
    }

    // Step 4: Check if we received a valid OAuth URL
    if (!data?.url) {
      console.error('No OAuth URL received from Supabase');
      setError('Failed to initiate Google sign in');
      Alert.alert('Error', 'Failed to initiate Google sign in. Please try again.');
      return;
    }

    console.log('Opening OAuth URL in browser:', data.url);
    
    // Step 5: Open the OAuth URL in browser using Expo's WebBrowser
    // This handles the OAuth flow in a secure browser context
    const result = await WebBrowser.openAuthSessionAsync(
      data.url, // The OAuth URL from Supabase
      isExpoGo 
        ? 'https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth' // Return URL for Expo Go
        : 'betteru://auth/callback' // Return URL for standalone app
    );

    console.log('WebBrowser result:', result);

    // Step 6: Handle the OAuth result
    if (result.type === 'success') {
      console.log('OAuth completed successfully!');
      
      // Extract tokens from the callback URL if present
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      
      if (accessToken) {
        console.log('Access token found in callback URL');
        // The session should be automatically handled by Supabase
        await checkOnboardingAndNavigate();
      } else {
        console.log('No access token in callback, checking session...');
        // Check if the session was established by Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session check error:', sessionError);
          setError('Failed to establish session');
          return;
        }
        
        if (session) {
          console.log('Session established successfully');
          await checkOnboardingAndNavigate();
        } else {
          console.log('No session found after OAuth');
          setError('Sign in failed - no session established');
        }
      }
    } else if (result.type === 'cancel') {
      console.log('OAuth was cancelled by user');
      setError('Google sign in was cancelled');
    } else {
      console.log('OAuth failed:', result);
      setError('Google sign in failed');
    }
  } catch (error) {
    console.error('Google Sign In error:', error);
    setError('Failed to sign in with Google');
    Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

### Helper Function for Post-Authentication Logic

```javascript
// Helper function to check onboarding status and navigate appropriately
const checkOnboardingAndNavigate = async () => {
  try {
    console.log('Checking onboarding status...');
    
    // Step 1: Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user:', userError);
      setError('Failed to get user information');
      return;
    }
    
    if (!user) {
      console.error('No user found after sign in');
      setError('Sign in failed - no user data');
      return;
    }

    console.log('User signed in successfully:', user.id);
    
    // Step 2: Check onboarding status from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    // Handle the case where the profile doesn't exist yet (new user)
    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error checking onboarding status:', profileError);
      setError('Failed to check onboarding status');
      return;
    }

    // Step 3: Navigate based on onboarding status
    if (!profile || !profile.onboarding_completed) {
      console.log('User needs onboarding, navigating to welcome screen');
      router.replace('/(auth)/onboarding/welcome');
    } else {
      console.log('User completed onboarding, navigating to home');
      router.replace('/(tabs)/home');
    }
  } catch (error) {
    console.error('Error in checkOnboardingAndNavigate:', error);
    setError('Failed to complete sign in process');
  }
};
```

## Step 5: Environment Configuration

### For Development (Expo Go)
```javascript
// Uses Expo's auth proxy for development
redirectTo: 'https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth'
```

### For Production (Standalone App)
```javascript
// Uses custom URL scheme for production
redirectTo: 'betteru://auth/callback'
```

## Step 6: Testing the Implementation

1. Start your app: `npx expo start`
2. Open Expo Go on your device
3. Scan the QR code
4. Test the Google Sign-In button
5. Check the console logs for detailed flow information

## What Happens During Sign-In (Step by Step)

1. **User taps "Sign in with Google"**
   - `handleGoogleSignIn()` function is called
   - Loading state is set to true

2. **Clear existing session**
   - `supabase.auth.signOut()` is called
   - This ensures fresh account selection

3. **Initiate OAuth flow**
   - `supabase.auth.signInWithOAuth()` is called
   - Supabase generates the OAuth URL with proper parameters

4. **Open browser**
   - `WebBrowser.openAuthSessionAsync()` opens the OAuth URL
   - User sees Google's authentication page

5. **User authenticates**
   - User enters credentials or selects account
   - Google processes the authentication

6. **Google redirects back**
   - Google redirects to the specified callback URL
   - Supabase automatically handles the session

7. **Check session**
   - App checks if session was established
   - If successful, proceeds to onboarding check

8. **Check onboarding status**
   - `checkOnboardingAndNavigate()` is called
   - Queries the profiles table for onboarding status

9. **Navigate appropriately**
   - If onboarding incomplete: Navigate to welcome screen
   - If onboarding complete: Navigate to home screen

## Security Best Practices

### ✅ What We're Doing Right:

1. **No hardcoded secrets**: Client secrets are only in Supabase dashboard
2. **Proper redirect URIs**: Using secure, validated redirect URIs
3. **Session management**: Letting Supabase handle session persistence
4. **Error handling**: Comprehensive error handling and user feedback
5. **Environment detection**: Different configurations for dev vs production

### 🔒 Additional Security Considerations:

1. **Environment variables**: Use environment variables for client IDs in production
2. **HTTPS only**: All OAuth URLs use HTTPS
3. **Token validation**: Supabase validates tokens automatically
4. **Session timeout**: Supabase handles session expiration
5. **CSRF protection**: Supabase includes CSRF protection

## Troubleshooting Guide

### Common Issues and Solutions:

1. **"redirect_uri_mismatch" error**
   - **Cause**: Redirect URI in Google Console doesn't match exactly
   - **Solution**: Double-check all redirect URIs in Google Console

2. **"invalid_client" error**
   - **Cause**: Incorrect client ID or secret in Supabase
   - **Solution**: Verify credentials in Supabase dashboard

3. **Session not established**
   - **Cause**: OAuth flow didn't complete properly
   - **Solution**: Check network connectivity and redirect URIs

4. **User stuck on loading**
   - **Cause**: Error in the OAuth flow
   - **Solution**: Check console logs for detailed error messages

## Code Learning Points

### Key Concepts to Understand:

1. **OAuth Flow**: The standard OAuth 2.0 authorization code flow
2. **Session Management**: How Supabase handles user sessions
3. **Error Handling**: Proper error handling in async operations
4. **Environment Detection**: Different configurations for different environments
5. **Security**: Why we don't hardcode secrets in the client

### What Each Function Does:

- `handleGoogleSignIn()`: Orchestrates the entire OAuth flow
- `checkOnboardingAndNavigate()`: Handles post-authentication logic
- `WebBrowser.openAuthSessionAsync()`: Opens OAuth in secure browser
- `supabase.auth.signInWithOAuth()`: Initiates OAuth with Supabase
- `supabase.auth.getSession()`: Checks current session status

This implementation provides a secure, user-friendly, and maintainable Google Sign-In experience that follows current best practices for React Native apps. 