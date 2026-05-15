# EAS Build Setup for Live Activities (Windows)

## The Challenge

Widget Extensions require Xcode to create the target, but once it's created, EAS Build can build it automatically.

## Solution: One-Time Mac Access

You need Mac access **just once** to create the widget extension target. After that, you can build entirely with EAS Build on Windows.

---

## Option 1: Use a Mac Temporarily (Easiest)

### Step 1: Get Mac Access (Choose One)

**A. Borrow a Mac temporarily**
- Friend's Mac, library computer, etc.
- Just need 30 minutes

**B. Use GitHub Codespaces with Mac runner** (if available)
- Cloud-based Mac access
- Paid service but very quick

**C. Use MacStadium or MacInCloud**
- Cloud Mac rental ($1-2/hour)
- Pay for just 1 hour, get access, create target, done

### Step 2: On the Mac, Follow These Steps

1. **Clone/Pull your project** on the Mac

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate iOS project:**
   ```bash
   npx expo prebuild --platform ios
   ```

4. **Open in Xcode:**
   ```bash
   open ios/BetterU.xcworkspace
   ```

5. **Create Widget Extension:**
   - File → New → Target
   - Widget Extension
   - Name: `BetterUWidget`
   - Bundle ID: `com.enriqueortiz.betteru.BetterUWidget`
   - Finish

6. **Delete default files** Xcode created

7. **Add our Swift files:**
   - Right-click BetterUWidget folder
   - Add Files to BetterU
   - Select files from `ios/BetterUWidget/`
   - ✅ Check "BetterUWidget" target
   - Add

8. **Configure target:**
   - Select BetterUWidget target
   - General: iOS 16.1 deployment target
   - Signing & Capabilities: Add ActivityKit
   - Signing: Auto sign, select team

9. **Configure main app:**
   - Select BetterU target
   - Signing & Capabilities: Add ActivityKit

10. **Build once** to verify:
    - Select BetterU scheme
    - Product → Build (⌘B)
    - Should build successfully

11. **Commit and push:**
    ```bash
    git add ios/
    git commit -m "Add Live Activities widget extension"
    git push
    ```

12. **Done!** Now you can build on Windows with EAS.

---

## Option 2: Check If Plugin Auto-Creates (Try This First)

The `@kingstinct/react-native-activity-kit` plugin might handle more automatically. Try this:

### Step 1: Prebuild and Check

```bash
npm install
npx expo prebuild --platform ios --clean
```

### Step 2: Check if Widget Extension Exists

Look in `ios/` folder - check if there's a `BetterUWidget` folder with the target already created.

### Step 3: If Not, Use Option 1

If the plugin didn't auto-create it, you'll need the one-time Mac access.

---

## After Target is Created (Back on Windows)

Once the widget extension target exists in your project:

### 1. Build with EAS

```bash
eas build --platform ios --profile production
```

EAS Build will:
- ✅ Build the widget extension automatically
- ✅ Include it in the app bundle
- ✅ Sign everything correctly

### 2. Submit to TestFlight

```bash
eas submit --platform ios
```

---

## Verify Setup (After Mac Step)

Before committing, verify on Mac:

```bash
# Check that widget extension exists
ls ios/BetterUWidget/

# Should see:
# - WorkoutAttributes.swift
# - BetterUWorkoutLiveActivity.swift  
# - BetterUWidgetBundle.swift
# - Info.plist
# - BetterUWidget.xcodeproj (or folder)
```

---

## Files That Need to Be in Git

Make sure these are committed:

```
ios/
├── BetterU.xcworkspace
├── BetterU/
│   └── ...
└── BetterUWidget/
    ├── WorkoutAttributes.swift
    ├── BetterUWorkoutLiveActivity.swift
    ├── BetterUWidgetBundle.swift
    └── Info.plist
```

**Don't commit:**
- `ios/Pods/` (add to .gitignore)
- `ios/build/` (build artifacts)
- `node_modules/`

---

## Quick Mac Access Services

If you need temporary Mac access:

1. **MacStadium**
   - https://www.macstadium.com/
   - ~$1-2/hour
   - Quick setup

2. **MacInCloud**
   - https://www.macincloud.com/
   - ~$1-2/hour
   - Good for one-time tasks

3. **Scaleway**
   - Cloud Mac instances
   - Pay per hour

---

## Summary

1. ✅ Swift files are already created
2. ⏭️ Need Mac access **once** to create Xcode target (30 min)
3. ✅ Commit the changes
4. ✅ Build with EAS on Windows forever after

The target creation is a one-time setup. After that, EAS Build handles everything!

---

## Alternative: Wait for Library Update

Some libraries are working on auto-creating widget extensions via config plugins. If the current plugin doesn't do it, you might wait for a future update, but the one-time Mac access is faster.

