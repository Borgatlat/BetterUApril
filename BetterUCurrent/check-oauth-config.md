r# OAuth Configuration Debug Guide

## 🚨 The Problem
You're being redirected to `betteruai.com` instead of back to your app after Google authentication.

## 🔍 Step-by-Step Debug Process

### Step 1: Check Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. **Look for ALL OAuth 2.0 Client IDs** (not just one)
4. **Check each one** for these issues:

#### ✅ Correct Configuration Should Have:
```
Authorized redirect URIs:
- https://auth.expo.io/@easbetteru/betterU_TestFlight_v7
- https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth
- https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback
```

#### ❌ Remove These If Found:
```
- betteruai.com (or any variation)
- any other domains that aren't yours
```

### Step 2: Check Supabase Dashboard
1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Click on **Google** provider
4. Verify these settings:
   - **Enabled**: ✅ Yes
   - **Client ID**: Your Google OAuth client ID
   - **Client Secret**: Your Google OAuth client secret
   - **Redirect URL**: `https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback`

### Step 3: Test with Enhanced Logging
1. **Restart your app**: `npx expo start --clear`
2. **Tap "Debug Config"** button (red button)
3. **Check console logs** for Supabase configuration
4. **Tap "Continue with Google"**
5. **Check the detailed OAuth URL analysis** in console logs

### Step 4: Look for These Logs
After tapping Google Sign-In, you should see:
```
LOG  🔍 OAuth URL Analysis:
LOG    - Host: accounts.google.com
LOG    - Client ID: [your-client-id]
LOG    - Redirect URI: [should be your Supabase URL]
```

## 🎯 Common Issues & Solutions

### Issue 1: Multiple OAuth Client IDs
**Problem**: You have multiple OAuth client IDs and the wrong one is being used.
**Solution**: 
1. Check ALL OAuth client IDs in Google Console
2. Remove or update the ones with wrong redirect URIs
3. Make sure Supabase is using the correct client ID

### Issue 2: Cached Configuration
**Problem**: Google is using cached OAuth settings.
**Solution**:
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Wait a few minutes for Google's cache to clear

### Issue 3: Wrong Supabase Project
**Problem**: Your app is connected to the wrong Supabase project.
**Solution**:
1. Check your `lib/supabase.js` file
2. Verify the URL and key match your project
3. Make sure you're in the correct Supabase project

### Issue 4: OAuth Consent Screen
**Problem**: OAuth consent screen has wrong redirect URIs.
**Solution**:
1. Go to Google Cloud Console → **OAuth consent screen**
2. Check if there are any redirect URIs listed there
3. Remove any incorrect ones

## 🔧 Quick Fixes to Try

### Fix 1: Clear All Caches
```bash
# Clear Expo cache
npx expo start --clear

# Clear browser cache for Google
# Go to Chrome settings → Privacy → Clear browsing data
```

### Fix 2: Check for Hidden OAuth Clients
1. In Google Cloud Console, look for:
   - OAuth 2.0 Client IDs
   - Web application clients
   - iOS/Android clients
2. Check each one for `betteruai.com`

### Fix 3: Verify Supabase Project
1. Go to Supabase dashboard
2. Check the project URL matches: `kmpufblmilcvortrfilp.supabase.co`
3. Verify you're in the correct project

## 📊 What to Share for Further Debugging

After running the debug, share these logs:
1. **Debug Config button output**
2. **OAuth URL Analysis** (the detailed breakdown)
3. **Any error messages** from the callback
4. **The exact redirect URL** you see in the browser

## 🚀 Expected Behavior After Fix

1. Tap "Continue with Google"
2. Browser opens with Google account selection
3. Select your Google account
4. **Should redirect back to your app** (not betteruai.com)
5. App automatically signs you in
6. Navigates to onboarding or home screen

## 🆘 If Still Not Working

If the issue persists:
1. **Share the debug logs** from the console
2. **Check if you have multiple Google Cloud projects**
3. **Verify the exact OAuth client ID** being used
4. **Consider creating a new OAuth client ID** with correct settings

The enhanced logging will help us identify exactly which OAuth client ID is being used and where the redirect is going wrong. 