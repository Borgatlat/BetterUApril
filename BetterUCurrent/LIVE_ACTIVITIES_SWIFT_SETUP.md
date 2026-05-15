# Swift Widget Extension Setup Guide

## Overview

This guide will walk you through setting up the Swift Widget Extension for Live Activities. The Swift code has been created - now you need to set it up in Xcode.

---

## Step 1: Install Dependencies

First, install the React Native library:

```bash
npm install
```

---

## Step 2: Generate iOS Project

Expo needs to generate the native iOS project files:

```bash
npx expo prebuild --platform ios
```

**What this does:**
- Creates the `ios/` folder with Xcode project files
- Sets up native dependencies
- Prepares for widget extension

---

## Step 3: Open in Xcode

Open the workspace (NOT the project file):

```bash
open ios/BetterU.xcworkspace
```

**Important:** Use `.xcworkspace` not `.xcodeproj` because we use CocoaPods.

---

## Step 4: Create Widget Extension Target

### 4.1 Add New Target

1. In Xcode, go to: **File → New → Target...**
2. Select **"Widget Extension"** (under iOS)
3. Click **Next**

### 4.2 Configure Target

Fill in the details:

- **Product Name:** `BetterUWidget`
- **Organization Identifier:** `com.enriqueortiz` (should match your main app)
- **Bundle Identifier:** `com.enriqueortiz.betteru.BetterUWidget` (automatically generated)
- **Language:** Swift
- **Project:** BetterU (should be selected)
- **Embed in Application:** BetterU (should be selected)

4. Click **Finish**

5. When prompted: **"Activate 'BetterUWidget' scheme?"** → Click **Cancel** (we'll activate later)

### 4.3 Delete Default Files

Xcode created some default files we don't need. Delete these:

1. In Project Navigator, find `BetterUWidget` folder
2. Delete these files (right-click → Delete → Move to Trash):
   - `BetterUWidget.swift` (default one)
   - `BetterUWidgetBundle.swift` (default one)
   - Any other default widget files

---

## Step 5: Add Our Swift Files

The Swift files are already created in `ios/BetterUWidget/`. We need to add them to the Xcode project:

### 5.1 Add Files to Project

1. In Xcode Project Navigator, right-click on `BetterUWidget` folder (or target)
2. Select **"Add Files to 'BetterU'..."**
3. Navigate to `ios/BetterUWidget/`
4. Select these files:
   - `WorkoutAttributes.swift`
   - `BetterUWorkoutLiveActivity.swift`
   - `BetterUWidgetBundle.swift`
5. Make sure these options are checked:
   - ✅ **"Copy items if needed"** (uncheck if files are already in ios/)
   - ✅ **"Create groups"**
   - ✅ **Target: BetterUWidget** (IMPORTANT - must be checked)
6. Click **Add**

### 5.2 Verify Files

Check that files appear under `BetterUWidget` target in Project Navigator.

---

## Step 6: Configure Widget Extension Target

### 6.1 Set Deployment Target

1. Select **BetterUWidget** target in Project Navigator (left sidebar)
2. Go to **General** tab
3. Under **"Deployment Info"**:
   - Set **iOS Deployment Target** to **16.1** (required for Live Activities)

### 6.2 Add ActivityKit Capability

1. With **BetterUWidget** target selected, go to **"Signing & Capabilities"** tab
2. Click **"+ Capability"** button (top left)
3. Search for and add **"ActivityKit"**
4. This enables Live Activities for the widget extension

### 6.3 Configure Signing

1. Still in **"Signing & Capabilities"** tab
2. Under **"Signing"**:
   - Check **"Automatically manage signing"**
   - Select your **Team** (same as main app)
   - **Bundle Identifier** should be: `com.enriqueortiz.betteru.BetterUWidget`

**Important:** The widget extension MUST be signed with the same team/certificate as the main app!

### 6.4 Update Info.plist (if needed)

The widget extension should have an `Info.plist`. Check that it includes:

```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

This should already be set from the plugin, but verify it's there.

---

## Step 7: Configure Main App Target

### 7.1 Add ActivityKit Capability to Main App

1. Select **BetterU** target (main app, not widget)
2. Go to **"Signing & Capabilities"** tab
3. Click **"+ Capability"**
4. Add **"ActivityKit"** capability

This enables the main app to create/update Live Activities.

---

## Step 8: Build Settings Check

### 8.1 Swift Language Version

1. Select **BetterUWidget** target
2. Go to **Build Settings** tab
3. Search for **"Swift Language Version"**
4. Set to **Swift 5** (or latest available)

### 8.2 Deployment Target Consistency

Make sure both targets have iOS 16.1+:
- **BetterU** target: iOS 16.1+
- **BetterUWidget** target: iOS 16.1+

---

## Step 9: Verify Setup

### 9.1 Check File Structure

Your Project Navigator should look like:

```
BetterU
├── BetterU (main app)
│   ├── ...
│   └── App files
└── BetterUWidget (widget extension)
    ├── WorkoutAttributes.swift
    ├── BetterUWorkoutLiveActivity.swift
    └── BetterUWidgetBundle.swift
```

### 9.2 Build Widget Extension

1. In Xcode, select **BetterUWidget** scheme (top toolbar, next to Play button)
2. Select a **physical device** (simulators don't fully support Live Activities)
3. Product → Build (⌘B)
4. Check for errors - fix any import or compilation issues

**Common issues:**
- Missing imports: Make sure all `import` statements are correct
- ActivityKit not found: Verify ActivityKit capability is added
- Bundle identifier issues: Check signing configuration

---

## Step 10: Build Main App

1. Select **BetterU** scheme (back to main app)
2. Product → Clean Build Folder (⇧⌘K)
3. Product → Build (⌘B)
4. Verify it builds successfully

---

## Step 11: Test on Device

### 11.1 Install on Physical Device

1. Connect your iPhone (iOS 16.1+)
2. Select your device in Xcode
3. Select **BetterU** scheme
4. Product → Run (⌘R)

### 11.2 Test Live Activity

1. Start a workout in the app
2. Lock your phone
3. Check lock screen - you should see the Live Activity!

**What to check:**
- ✅ Live Activity appears on lock screen
- ✅ Timer updates every second
- ✅ Exercise name updates when you complete exercises
- ✅ Sets progress updates
- ✅ Calories update
- ✅ Live Activity disappears when workout ends

---

## Troubleshooting

### "ActivityKit framework not found"

**Solution:**
- Make sure ActivityKit capability is added to both main app and widget extension
- Check iOS deployment target is 16.1+
- Clean build folder and rebuild

### "Widget extension doesn't appear"

**Solution:**
- Verify widget extension target is included in the build
- Check bundle identifier is correct format: `com.enriqueortiz.betteru.BetterUWidget`
- Ensure widget extension is signed with same team as main app

### "Live Activity not showing on lock screen"

**Solution:**
- Check device is iOS 16.1+
- Verify Live Activities are enabled in Settings → Face ID & Passcode (or Touch ID & Passcode)
- Make sure you're testing on a physical device, not simulator
- Check console logs for errors when starting Live Activity

### "Build errors in Swift files"

**Solution:**
- Make sure all files are added to BetterUWidget target
- Verify Swift version is set correctly
- Check imports are correct (ActivityKit, WidgetKit, SwiftUI)
- Clean build folder (⇧⌘K) and rebuild

### "Signing errors"

**Solution:**
- Widget extension MUST be signed with same team as main app
- Check bundle identifier doesn't conflict
- Ensure "Automatically manage signing" is checked
- Verify provisioning profiles are valid

---

## Verification Checklist

Before testing, verify:

- [ ] Widget Extension target created
- [ ] Swift files added to BetterUWidget target
- [ ] ActivityKit capability added to both targets
- [ ] iOS deployment target set to 16.1+ for both targets
- [ ] Both targets signed with same team
- [ ] Widget Extension builds without errors
- [ ] Main app builds without errors
- [ ] Physical iOS 16.1+ device connected

---

## Next Steps

Once Live Activities are working:

1. **Test thoroughly:**
   - Start/stop workouts
   - Complete exercises
   - Exit workouts early
   - Check lock screen updates

2. **TestFlight:**
   - Build with EAS: `eas build --platform ios --profile production`
   - Submit to TestFlight
   - Test with beta testers

3. **Polish:**
   - Adjust colors to match your app theme
   - Fine-tune layout and spacing
   - Add more visual polish if desired

---

## File Locations

Swift files created:
- `ios/BetterUWidget/WorkoutAttributes.swift`
- `ios/BetterUWidget/BetterUWorkoutLiveActivity.swift`
- `ios/BetterUWidget/BetterUWidgetBundle.swift`

These files need to be added to the Xcode project as described in Step 5.

---

## Summary

1. ✅ Run `npm install` and `npx expo prebuild --platform ios`
2. ✅ Open `ios/BetterU.xcworkspace` in Xcode
3. ✅ Create Widget Extension target named "BetterUWidget"
4. ✅ Add Swift files to the widget extension target
5. ✅ Configure ActivityKit capability for both targets
6. ✅ Set deployment target to iOS 16.1+
7. ✅ Sign both targets with same team
8. ✅ Build and test on physical device

Once complete, Live Activities will appear on the lock screen when users start workouts! 🎉

