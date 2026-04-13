# Live Activities Quick Start Guide

## What You Need to Know

**Live Activities** = Real-time updates on iOS lock screen and Dynamic Island (iPhone 14 Pro+)

**Your Use Cases:**
- Active workouts (timer, exercise, progress)
- Mental sessions (countdown, current step)

---

## The 3 Main Components

### 1. Library (JavaScript Bridge)
```bash
npm install @kingstinct/react-native-activity-kit
```
**What it does:** Lets JavaScript code talk to iOS native code

### 2. Widget Extension (Swift Code)
**What it does:** Defines how the Live Activity looks on the lock screen
- Written in Swift (native iOS language)
- Created in Xcode
- Contains the visual design/layout

### 3. Your React Native Code
**What it does:** Controls when to start/update/end Live Activities
- Uses utility functions to manage activities
- Integrates into existing workout/mental session screens

---

## The Flow

```
1. User starts workout
   ↓
2. React Native: startWorkoutLiveActivity()
   ↓
3. Native Bridge: Creates iOS ActivityKit activity
   ↓
4. iOS: Shows Live Activity on lock screen
   ↓
5. Every second: React Native updates the activity
   ↓
6. iOS: Lock screen updates automatically
   ↓
7. User finishes: React Native ends the activity
   ↓
8. iOS: Live Activity disappears
```

---

## Minimum Viable Implementation

### Step 1: Install Library
```bash
npm install @kingstinct/react-native-activity-kit
```

### Step 2: Update app.config.js
```javascript
plugins: [
  "@kingstinct/react-native-activity-kit/plugin",
],
ios: {
  infoPlist: {
    NSSupportsLiveActivities: true,
  },
}
```

### Step 3: Create Widget Extension (Swift)
- Open Xcode after `npx expo prebuild`
- Create Widget Extension target
- Write Swift code (see full guide for template)

### Step 4: Add to Active Workout Screen
```javascript
import { startWorkoutLiveActivity, updateWorkoutLiveActivity, endWorkoutLiveActivity } from '../../utils/liveActivities';

// When workout starts:
const activityId = await startWorkoutLiveActivity({
  workoutId: workoutSessionId,
  workoutName: workout.name,
  currentExercise: 'Starting...',
});

// Update every second:
updateWorkoutLiveActivity(activityId, {
  elapsedTime: formatTime(elapsedTime),
  calories: calories,
});

// When workout ends:
endWorkoutLiveActivity(activityId);
```

---

## Key Concepts Explained Simply

### ActivityAttributes (Swift)
Think of this as a **data model** - it defines:
- **Static data** (doesn't change): workout name, ID
- **Dynamic data** (changes): timer, current exercise, progress

### LockScreenBanner (Swift)
The **compact view** that appears on the lock screen. Like a mini version of your app.

### DynamicIsland (Swift)
Special views for iPhone 14 Pro+. Has 3 states:
- **Compact**: Always visible (tiny icon + text)
- **Expanded**: Full view when tapped
- **Minimal**: Tiny icon when multiple activities active

### Native Bridge
The **translator** between JavaScript and Swift. When you call `startActivity()` in JavaScript, it tells Swift to create the native iOS activity.

---

## TestFlight Checklist

- [ ] iOS 16.1+ device required (Live Activities don't work on older versions)
- [ ] Physical device required (won't work in simulator)
- [ ] Widget extension properly signed
- [ ] Deployment target set to iOS 16.1+
- [ ] Test that Live Activity appears on lock screen
- [ ] Test that updates work every second
- [ ] Test that ending workout removes Live Activity

---

## Common Issues

**"Live Activity not showing"**
- Check iOS version (must be 16.1+)
- Check that widget extension is properly built
- Verify activityType matches Swift struct name exactly

**"Updates not appearing"**
- Don't update more than once per second
- Make sure you're keeping track of the activityId

**"Widget won't build"**
- Check Xcode for errors
- Verify signing certificates
- Make sure deployment target is iOS 16.1+

---

## Start Small, Then Expand

**Phase 1: Simple Timer**
- Just show elapsed time
- Update every 5 seconds
- No Dynamic Island views

**Phase 2: Full Workout**
- Add exercise name, sets, calories
- Update every second
- Add Dynamic Island views

**Phase 3: Mental Sessions**
- Add countdown timer
- Show current step

---

## Full Documentation

See `LIVE_ACTIVITIES_IMPLEMENTATION_GUIDE.md` for:
- Detailed code examples
- Complete Swift widget code
- Full integration examples
- Troubleshooting guide
- Architecture diagrams

