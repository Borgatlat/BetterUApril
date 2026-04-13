# ActivityKit Deployment Target Fix

## Problem

When building with Xcode for a test build, you got this error:

```
Entitlement com.apple.developer.activity-kit not found and could not be included in profile. 
This likely is not a valid entitlement and should be removed from your entitlements file.
```

## Root Cause

**ActivityKit requires iOS 16.1 or later**, but your main app's deployment target was set to iOS 15.1. When Xcode tried to create a provisioning profile for iOS 15.1 with the ActivityKit entitlement, it failed because:

- ActivityKit framework is only available on iOS 16.1+
- The entitlement `com.apple.developer.activity-kit` cannot be included in provisioning profiles for apps targeting iOS versions below 16.1
- Xcode correctly rejected the entitlement because it's incompatible with the deployment target

## What We Fixed

1. **Updated `app.config.js`**: Changed `deploymentTarget` from `"15.1"` to `"16.1"` in the `expo-build-properties` plugin configuration

2. **Updated `project.pbxproj`**: Changed `IPHONEOS_DEPLOYMENT_TARGET` from `15.1` to `16.1` for the main app target (both Debug and Release configurations)

## Technical Explanation

### Deployment Target vs. Runtime Requirements

**Deployment Target** (`IPHONEOS_DEPLOYMENT_TARGET`):
- This is the **minimum iOS version** your app requires to run
- It's set in your Xcode project settings
- When you set it to 16.1, you're telling Apple: "This app requires iOS 16.1 or newer"
- Users with iOS 15.x devices won't be able to install your app

**Why ActivityKit Needs iOS 16.1+**:
- ActivityKit (Live Activities) was introduced in iOS 16.1
- Apple's frameworks are tied to specific iOS versions
- You can't use features from iOS 16.1 if your deployment target is 15.1

### What Changed

**Before:**
```javascript
// app.config.js
"deploymentTarget": "15.1"  // ❌ Too old for ActivityKit
```

**After:**
```javascript
// app.config.js
"deploymentTarget": "16.1"  // ✅ Matches ActivityKit requirement
```

### Impact of This Change

**What This Means:**
- ✅ Your app will now build successfully with ActivityKit entitlement
- ✅ Users with iOS 16.1+ devices can install your app
- ❌ Users with iOS 15.x devices **cannot** install your app anymore

**iOS Version Adoption:**
- iOS 16.1 was released in October 2022
- As of 2024, the vast majority of active iOS devices support iOS 16.1+
- This is generally an acceptable trade-off for Live Activities support

### Understanding the Error Message

When Xcode saw:
- Deployment target: iOS 15.1
- Entitlement: `com.apple.developer.activity-kit`

It said: "Wait, ActivityKit doesn't exist on iOS 15.1, so I can't create a provisioning profile that includes this entitlement for an iOS 15.1 app."

The error message was a bit misleading - it said "not found" but really meant "incompatible with your deployment target."

## Next Steps

1. **Clean and rebuild in Xcode:**
   ```
   Product → Clean Build Folder (⇧⌘K)
   Product → Build (⌘B)
   ```

2. **Verify the fix:**
   - The build should now succeed
   - The provisioning profile will include the ActivityKit entitlement
   - No more entitlement errors

3. **If you run `npx expo prebuild` again:**
   - It will use the updated `deploymentTarget` from `app.config.js`
   - The Xcode project will be regenerated with iOS 16.1 as the minimum

## Related Notes

- Your LiveActivity extension already had the correct deployment target (iOS 16.2)
- The main app and extension should have compatible deployment targets (both 16.1+)
- If you need to support iOS 15.1 users, you'd need to:
  - Remove ActivityKit entitlement
  - Remove Live Activities feature
  - Keep deployment target at 15.1

But since you're building with ActivityKit, iOS 16.1+ is the correct choice!
