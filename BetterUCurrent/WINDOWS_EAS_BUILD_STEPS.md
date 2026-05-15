# Live Activities Setup for Windows + EAS Build

## Quick Summary

You need **Mac access ONCE** (30 minutes) to create the Widget Extension target. After that, build entirely with EAS on Windows.

---

## Step 1: Try This First (Might Work Automatically)

### Check if Plugin Auto-Creates Widget Extension

```bash
# Install dependencies
npm install

# Generate iOS project
npx expo prebuild --platform ios --clean

# Check if widget extension folder exists
dir ios\BetterUWidget
```

**If you see the folder with Swift files:** Great! Skip to Step 3.

**If folder doesn't exist:** Continue to Step 2 (need Mac access).

---

## Step 2: Create Widget Extension Target (One-Time, Needs Mac)

### Option A: Borrow Mac Temporarily (30 min)
- Friend's Mac, library computer, coworker's Mac
- Just need Xcode installed

### Option B: Cloud Mac Service ($1-2/hour)
- MacStadium: https://www.macstadium.com/
- MacInCloud: https://www.macincloud.com/
- Rent for 1 hour, create target, done

### What to Do on Mac (30 minutes):

1. **Pull your project:**
   ```bash
   git clone [your-repo-url]
   cd BetterUCurrent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npx expo prebuild --platform ios
   ```

3. **Open in Xcode:**
   ```bash
   open ios/BetterU.xcworkspace
   ```

4. **Create Widget Extension:**
   - File → New → Target
   - Widget Extension → Next
   - Name: `BetterUWidget`
   - Bundle ID: `com.enriqueortiz.betteru.BetterUWidget`
   - Finish

5. **Delete default Swift files** Xcode created

6. **Add our files:**
   - Right-click `BetterUWidget` folder
   - Add Files to BetterU
   - Select all files in `ios/BetterUWidget/`
   - ✅ Check "BetterUWidget" target
   - Add

7. **Configure BetterUWidget target:**
   - Select BetterUWidget target (blue icon)
   - General tab: iOS 16.1 deployment target
   - Signing & Capabilities: Add ActivityKit capability
   - Signing: Auto sign, select your team

8. **Configure BetterU target (main app):**
   - Select BetterU target
   - Signing & Capabilities: Add ActivityKit capability

9. **Test build:**
   - Product → Build (⌘B)
   - Should build successfully

10. **Commit and push:**
    ```bash
    git add ios/
    git commit -m "Add Live Activities widget extension"
    git push
    ```

**Done!** Now back to Windows.

---

## Step 3: Build with EAS (Back on Windows)

Once the widget extension target exists (either auto-created or you created it on Mac):

```bash
# Build for iOS
eas build --platform ios --profile production

# Or for preview/TestFlight
eas build --platform ios --profile preview
```

EAS Build will:
- ✅ Automatically build the widget extension
- ✅ Include it in the app bundle
- ✅ Sign everything correctly
- ✅ Ready for TestFlight

---

## Step 4: Submit to TestFlight

```bash
eas submit --platform ios
```

---

## Verify Everything is Committed

Before building, make sure these are in your repo:

```
ios/
├── BetterUWidget/          ← Widget extension folder
│   ├── WorkoutAttributes.swift
│   ├── BetterUWorkoutLiveActivity.swift
│   ├── BetterUWidgetBundle.swift
│   └── Info.plist
└── [other iOS files]
```

---

## What Gets Built

Once the target exists:
- ✅ JavaScript code (already done)
- ✅ Swift widget extension (built by EAS)
- ✅ Both bundled together in the app

---

## Summary

1. ✅ Code is ready (JavaScript + Swift files created)
2. ⏭️ Need Mac access **once** to create Xcode target (30 min)
3. ✅ Commit the `ios/` folder
4. ✅ Build forever with `eas build` on Windows

**The key:** Widget Extension target creation is a one-time setup. After that, EAS Build handles everything from Windows!

---

## Quick Commands Reference

```bash
# Check if widget extension exists
dir ios\BetterUWidget

# Build with EAS (after target exists)
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

