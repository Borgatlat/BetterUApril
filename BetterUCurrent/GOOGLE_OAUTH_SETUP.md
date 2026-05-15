# Google OAuth Setup for React Native with Supabase

## Overview

This guide explains how to properly implement Google Sign-In with Supabase in a React Native app using Expo. The implementation uses Supabase's built-in OAuth flow, which is more secure and easier to maintain than manual token exchange.

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
   - Authorized redirect URIs:
     - `https://auth.expo.io/@easbetteru/betterU_TestFlight_v7`
     - `https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth`
     - `https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback` (for Supabase)

## Step 3: Configure Supabase

1. Go to your Supabase dashboard
2. Navigate to Authentication → Providers
3. Enable Google provider
4. Add your Google OAuth credentials:
   - Client ID: Your Google OAuth client ID
   - Client Secret: Your Google OAuth client secret
   - Redirect URL: `https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback`

## Step 4: Implementation Details

### Key Features of the New Implementation:

1. **Uses Supabase's Built-in OAuth**: No manual token exchange needed
2. **Proper Redirect URIs**: Uses Expo's auth proxy for development
3. **Session Management**: Automatic session handling by Supabase
4. **Error Handling**: Comprehensive error handling and user feedback
5. **Security**: No hardcoded secrets in the code

### Code Structure:

```javascript
// The main Google Sign-In function
const handleGoogleSignIn = async () => {
  try {
    // Clear existing session
    await supabase.auth.signOut();
    
    // Use Supabase's built-in OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isExpoGo 
          ? 'https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth'
          : 'betteru://auth/callback',
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
          include_granted_scopes: 'true',
        }
      }
    });

    // Open OAuth URL in browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    
    // Handle the result
    if (result.type === 'success') {
      await checkOnboardingAndNavigate();
    }
  } catch (error) {
    // Handle errors
  }
};
```

## Step 5: Environment-Specific Configuration

### For Development (Expo Go):
- Uses Expo's auth proxy: `https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth`
- Works on both iOS and Android
- No native configuration needed

### For Production (Standalone App):
- Uses custom URL scheme: `betteru://auth/callback`
- Requires additional configuration in app.json

## Step 6: Testing

1. Start your app: `npx expo start`
2. Open Expo Go on your device
3. Scan the QR code
4. Test the Google Sign-In button

## Security Best Practices

1. **Never hardcode secrets**: Client secrets should only be in Supabase dashboard
2. **Use environment variables**: For client IDs in production
3. **Validate redirect URIs**: Ensure they match exactly in Google Console
4. **Handle errors gracefully**: Provide clear error messages to users
5. **Session management**: Let Supabase handle session persistence

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch" error**:
   - Check that redirect URIs in Google Console match exactly
   - For Expo Go: `https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth`
   - For Supabase: `https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback`

2. **"invalid_client" error**:
   - Verify client ID and secret in Supabase dashboard
   - Check OAuth consent screen configuration

3. **Session not established**:
   - Check Supabase configuration
   - Verify redirect URIs are correct
   - Check network connectivity

4. **OAuth flow cancelled**:
   - This is normal user behavior
   - Handle gracefully in the UI

## Code Explanation

### Why This Approach is Better:

1. **Simplified Flow**: No manual token exchange required
2. **Better Security**: Secrets stay on the server
3. **Automatic Session Management**: Supabase handles session persistence
4. **Error Handling**: Built-in error handling and retry logic
5. **Cross-Platform**: Works on both iOS and Android without native code

### Key Functions:

- `handleGoogleSignIn()`: Main OAuth flow handler
- `checkOnboardingAndNavigate()`: Post-authentication navigation logic
- `WebBrowser.openAuthSessionAsync()`: Opens OAuth in browser
- `supabase.auth.signInWithOAuth()`: Initiates OAuth flow

### What Happens During Sign-In:

1. User taps "Sign in with Google"
2. App clears any existing session
3. Supabase generates OAuth URL with proper parameters
4. Browser opens with Google's OAuth page
5. User authenticates with Google
6. Google redirects back to the app
7. Supabase automatically handles the session
8. App checks user's onboarding status
9. App navigates to appropriate screen

This implementation follows current best practices for OAuth in React Native apps and provides a secure, user-friendly authentication experience. 