# Fix Provisioning Profile ActivityKit Entitlement

## Problem
The build is failing because the provisioning profile doesn't include the `com.apple.developer.activity-kit` entitlement, even though it's correctly configured in your `app.config.js` and entitlements files.

**Error Message:**
```
Provisioning profile "*[expo] com.enriqueortiz.betteru AppStore ..." doesn't include the com.apple.developer.activity-kit entitlement.
```

## Root Cause
When you add a new entitlement to an existing app, the provisioning profile needs to be regenerated to include that entitlement. EAS Build uses cached provisioning profiles, so we need to force it to regenerate them.

## Solution: Regenerate Provisioning Profile

### Important Note About ActivityKit

**ActivityKit doesn't appear as a checkbox in the Apple Developer Portal** - this is normal! Unlike some capabilities (like Push Notifications or HealthKit), ActivityKit is automatically granted when you include it in your entitlements file. You don't need to enable it manually in the Developer Portal.

The issue is simply that your provisioning profile was created before the ActivityKit entitlement was added, so it needs to be regenerated.

### Step 1: Delete and Regenerate Provisioning Profile in EAS

Use EAS CLI to delete the existing provisioning profile and let it regenerate with the new entitlement:

```bash
# Delete the existing iOS credentials for production
eas credentials

# Select:
# - iOS
# - production (or the profile you're using)
# - "Remove credentials for this project on EAS servers"
# - Confirm deletion
```

Then rebuild - EAS will automatically regenerate the provisioning profile:

```bash
eas build --platform ios --profile production
```

### Step 2: Alternative - Use EAS Credentials Management (Recommended)

You can also manage credentials more granularly:

```bash
# This will show you current credentials
eas credentials

# Select iOS → production
# Choose "Remove specific credentials"
# Select "Remove Provisioning Profile"
# Then rebuild - EAS will regenerate it
```

### Step 3: Verify the Fix

After regenerating, the build should succeed. The new provisioning profile will include:
- ✅ `com.apple.developer.activity-kit` entitlement
- ✅ All your other entitlements (HealthKit, Apple Sign In, etc.)

## What We Fixed in the Code

1. **Updated `BetterU.entitlements`**: Changed `aps-environment` from `development` to `production` (correct for production builds)

2. **Updated `LiveActivity.entitlements`**: Added the ActivityKit entitlement to the extension's entitlements file (it was empty before)

## Technical Explanation

### Why This Happened

**Entitlements vs. Provisioning Profiles:**
- **Entitlements** (`*.entitlements` files) tell Xcode what capabilities your app wants to use
- **Provisioning Profiles** are signed certificates from Apple that authorize your app to actually use those capabilities
- When you add a new entitlement, you need a new provisioning profile that includes it

**The Build Process:**
1. Xcode reads your entitlements file and sees you want ActivityKit
2. Xcode tries to use the provisioning profile to sign the app
3. The provisioning profile (created before ActivityKit was added) doesn't include ActivityKit
4. Xcode fails because there's a mismatch

**How EAS Handles This:**
- EAS caches provisioning profiles for efficiency
- When you add new entitlements, the cached profile becomes outdated
- Deleting and regenerating forces EAS to create a new profile with all current entitlements

### Understanding Entitlements

**Entitlements** are like permissions that your app requests from iOS. They're defined in:
- `app.config.js` (for Expo/EAS to understand what you need)
- `*.entitlements` files (for Xcode to include in the build)

**Common Entitlements:**
- `com.apple.developer.activity-kit`: Live Activities (Dynamic Island, Lock Screen widgets)
  - ⚠️ **Note**: This entitlement doesn't appear in Apple Developer Portal - it's automatically granted when included in entitlements
- `com.apple.developer.healthkit`: Health data access (requires Portal enablement)
- `aps-environment`: Push notifications (development vs production)
- `com.apple.developer.applesignin`: Sign in with Apple (requires Portal enablement)

### What Changed If You Modify Entitlements

**If you remove an entitlement:**
- You still need to regenerate the provisioning profile
- For capabilities that require Portal enablement (like HealthKit), you should disable them in the Developer Portal
- ActivityKit doesn't require Portal enablement, so no Portal action needed

**If you add an entitlement:**
- You MUST regenerate the provisioning profile (what we're doing now)
- **For ActivityKit specifically**: No Portal action needed - it's automatically granted when in entitlements
- For other entitlements (HealthKit, Push Notifications, etc.): The capability must be enabled in Apple Developer Portal
- Otherwise, the build will fail like you're experiencing

## Testing After Fix

After regenerating the provisioning profile, verify:

1. **Build succeeds**: `eas build --platform ios --profile production`
2. **Archive includes ActivityKit**: Check the build logs for successful signing
3. **App runs with Live Activities**: Test the Live Activities feature in your app

## Additional Notes

- The provisioning profile regeneration happens automatically when you delete credentials
- EAS will fetch a new profile from Apple that matches your current entitlements
- This process usually takes 1-2 minutes
- You don't need to manually download or install the profile - EAS handles it
