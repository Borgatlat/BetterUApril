# Live Activities Implementation Guide for BetterU iOS App

## What Are Live Activities?

Live Activities are an iOS 16.1+ feature that allows apps to show **real-time, dynamic information** directly on:
- **Lock Screen** - Users see updates without unlocking their phone
- **Dynamic Island** (iPhone 14 Pro and later) - Updates appear in the cutout at the top
- **Lock Screen widgets** - Compact widgets that update in real-time

Think of it like a **persistent notification** that shows changing information, like:
- Active workout timer and progress
- Mental session countdown
- Order tracking
- Sports scores
- Ride-sharing ETAs

## Why Use Live Activities for BetterU?

Your app has perfect use cases for Live Activities:
1. **Active Workouts** - Show elapsed time, current exercise, sets completed while phone is locked
2. **Mental Sessions** - Display time remaining, current step/breathing phase
3. **Running/Activity Tracking** - Distance, pace, time on lock screen

**Benefits:**
- Users can check progress without opening the app
- Works great when phone is locked (during workouts!)
- Professional, native iOS experience
- Increases user engagement

---

## How React Native Expo Apps Implement Live Activities

### The Challenge

Live Activities use iOS's native **ActivityKit** framework, which requires:
- Native Swift code (not JavaScript)
- A Widget Extension (separate iOS target)
- ActivityKit entitlement in your app

### The Solution: Expo + Native Modules

Since Expo apps use React Native, we need to:
1. **Bridge** native iOS code with JavaScript using native modules
2. Use a **library** that handles this bridge for us
3. Create a **Widget Extension** in Xcode (Swift code)

### Available Libraries

#### Option 1: `@kingstinct/react-native-activity-kit` (Recommended)
- Modern library using Expo's new architecture
- Well-maintained and actively developed
- Good documentation
- Built specifically for Expo projects

#### Option 2: `expo-live-activity` 
- From Software Mansion Labs
- Works with Expo managed workflow
- Requires config plugin setup

#### Option 3: Custom Native Module
- Most control, but most complex
- Requires more native iOS knowledge

---

## Implementation Architecture

Here's how the pieces fit together:

```
┌─────────────────────────────────────────────────────────────┐
│  Your React Native App (JavaScript)                         │
│  - active-workout.js                                         │
│  - active-mental-session.js                                 │
│                                                              │
│  "Start Live Activity" →                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Native Bridge Module (JavaScript ↔ Swift)                  │
│  - @kingstinct/react-native-activity-kit                    │
│                                                              │
│  Converts JS calls to native ActivityKit API                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  iOS Native Code (Swift)                                    │
│  - ActivityKit Framework                                     │
│  - Widget Extension                                          │
│                                                              │
│  Creates and updates Live Activity on lock screen           │
└─────────────────────────────────────────────────────────────┘
```

### What Happens When:

**Starting a Workout:**
1. User starts workout in React Native app
2. App calls `LiveActivity.start()` with workout data
3. Native module creates ActivityKit activity
4. iOS shows Live Activity on lock screen
5. App can update it every second with timer changes

**Updating During Workout:**
1. React Native timer updates every second
2. App calls `LiveActivity.update()` with new time/progress
3. Native module pushes update to ActivityKit
4. Lock screen widget updates automatically

**Ending Workout:**
1. User finishes workout
2. App calls `LiveActivity.end()`
3. Native module ends ActivityKit activity
4. Live Activity disappears from lock screen

---

## Step-by-Step Implementation Guide

### Step 1: Install the Library

We'll use `@kingstinct/react-native-activity-kit` as it's modern and works well with Expo.

```bash
npm install @kingstinct/react-native-activity-kit
```

**What this does:**
- Adds the JavaScript bridge code
- Provides functions like `start()`, `update()`, `end()`
- Handles communication between React Native and iOS

### Step 2: Update app.config.js

Add the config plugin to enable Live Activities support:

```javascript
// app.config.js
export default {
  expo: {
    // ... existing config ...
    plugins: [
      // ... existing plugins ...
      [
        "@kingstinct/react-native-activity-kit/plugin",
        {
          // This tells Expo to set up the native iOS code
        }
      ],
    ],
    ios: {
      // ... existing iOS config ...
      infoPlist: {
        // ... existing infoPlist ...
        // Add this for ActivityKit support:
        NSSupportsLiveActivities: true,
      },
    },
  }
};
```

**Explanation:**
- `NSSupportsLiveActivities: true` tells iOS your app can create Live Activities
- The plugin configures the native iOS project automatically
- Expo will generate the necessary native code when you build

### Step 3: Create the Widget Extension (Swift Code)

Live Activities need a Widget Extension - this is the **native iOS code** that defines what appears on the lock screen.

**Why we need this:**
- Widgets are written in Swift (not JavaScript)
- They define the visual layout and styling
- They receive data updates from your React Native app

#### File Structure:

```
ios/
└── BetterUWidget/
    ├── BetterUWidget.swift          # Main widget code
    ├── BetterUWidgetBundle.swift    # Widget bundle (iOS requirement)
    └── Assets.xcassets/             # Images/icons
```

#### BetterUWidget.swift:

```swift
import WidgetKit
import ActivityKit

// This defines the data structure that will be passed from React Native
// Think of this like a TypeScript interface - it defines the shape of data
struct WorkoutAttributes: ActivityAttributes {
    // ContentState is the data that changes frequently (timer, progress, etc.)
    struct ContentState: Codable, Hashable {
        var elapsedTime: String        // "45:23" - formatted time string
        var currentExercise: String    // "Bench Press"
        var setsCompleted: Int         // 3
        var totalSets: Int             // 12
        var calories: Int              // 125
    }
    
    // Static attributes that don't change (workout name, etc.)
    var workoutName: String            // "Push Day"
    var workoutId: String              // Unique ID
}

// This defines what the widget LOOKS LIKE on the lock screen
@available(iOS 16.1, *)
struct BetterUWorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            // Lock Screen Banner (compact view)
            LockScreenBanner {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.attributes.workoutName)
                            .font(.headline)
                            .foregroundColor(.white)
                        Text("\(context.state.currentExercise) • \(context.state.elapsedTime)")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    Spacer()
                    Text("\(context.state.calories) cal")
                        .font(.caption.bold())
                        .foregroundColor(.white)
                }
                .padding()
                .background(Color.blue)
            } dynamicIsland: { context in
                // Dynamic Island (iPhone 14 Pro+)
                DynamicIsland {
                    // Expanded view (when user taps/expands)
                    DynamicIslandExpandedRegion(.leading) {
                        VStack(alignment: .leading) {
                            Text(context.attributes.workoutName)
                                .font(.headline)
                            Text(context.state.currentExercise)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    DynamicIslandExpandedRegion(.trailing) {
                        VStack(alignment: .trailing) {
                            Text(context.state.elapsedTime)
                                .font(.title2.bold())
                            Text("\(context.state.calories) cal")
                                .font(.caption)
                        }
                    }
                    
                    DynamicIslandExpandedRegion(.bottom) {
                        HStack {
                            Text("Sets: \(context.state.setsCompleted)/\(context.state.totalSets)")
                            Spacer()
                            ProgressView(value: Double(context.state.setsCompleted), 
                                       total: Double(context.state.totalSets))
                                .frame(width: 100)
                        }
                        .padding(.top, 8)
                    }
                } compactLeading: {
                    // Compact leading (always visible on Dynamic Island)
                    Image(systemName: "figure.run")
                        .foregroundColor(.blue)
                } compactTrailing: {
                    // Compact trailing (always visible)
                    Text(context.state.elapsedTime)
                        .font(.caption.bold())
                } minimal: {
                    // Minimal view (when multiple activities active)
                    Image(systemName: "figure.run")
                        .foregroundColor(.blue)
                }
            }
        }
    }
}

// Similar structure for Mental Session
struct MentalSessionAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var timeLeft: String           // "12:45" - formatted countdown
        var currentStep: String        // "Breathe In" or step name
        var progress: Double           // 0.0 to 1.0
    }
    
    var sessionName: String
    var sessionId: String
}

@available(iOS 16.1, *)
struct BetterUMentalSessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MentalSessionAttributes.self) { context in
            // Similar structure as workout...
        }
    }
}
```

**Key Concepts Explained:**

1. **ActivityAttributes**: This is like defining a data model/interface. It has:
   - `ContentState`: Data that changes frequently (updates every second)
   - Static properties: Data that stays the same (workout name, ID)

2. **LockScreenBanner**: What users see on the lock screen (compact view)

3. **DynamicIsland**: Special views for iPhone 14 Pro and later - has multiple states:
   - `compactLeading/Trailing`: Always visible icons/text
   - `expanded`: Full view when user taps
   - `minimal`: Tiny view when multiple activities are active

4. **@available(iOS 16.1, *)**: This code only runs on iOS 16.1+ (Live Activities requirement)

### Step 4: Create a Live Activities Service (JavaScript)

Create a utility file to manage Live Activities from your React Native code:

```javascript
// utils/liveActivities.js

import { startActivity, updateActivity, endActivity, isLiveActivitySupported } from '@kingstinct/react-native-activity-kit';
import { Platform } from 'react-native';

/**
 * Check if Live Activities are supported on this device
 * - Requires iOS 16.1+
 * - Only works on physical devices (not simulators for testing)
 */
export async function checkSupport() {
  if (Platform.OS !== 'ios') {
    return false;
  }
  
  try {
    const supported = await isLiveActivitySupported();
    return supported;
  } catch (error) {
    console.error('Error checking Live Activity support:', error);
    return false;
  }
}

/**
 * Start a Live Activity for an active workout
 * 
 * @param {Object} workoutData - The workout information
 * @param {string} workoutData.workoutId - Unique workout session ID
 * @param {string} workoutData.workoutName - Name of the workout
 * @param {string} currentExercise - Current exercise name
 * @param {number} setsCompleted - Number of sets completed
 * @param {number} totalSets - Total sets in workout
 * @returns {Promise<string|null>} - Activity ID if successful, null otherwise
 */
export async function startWorkoutLiveActivity({
  workoutId,
  workoutName,
  currentExercise,
  setsCompleted = 0,
  totalSets = 0,
}) {
  try {
    const supported = await checkSupport();
    if (!supported) {
      console.log('Live Activities not supported on this device');
      return null;
    }

    // Define the data structure that matches our Swift ActivityAttributes
    const attributes = {
      workoutName: workoutName,
      workoutId: workoutId,
    };

    const contentState = {
      elapsedTime: '00:00',           // Initial time
      currentExercise: currentExercise || 'Starting...',
      setsCompleted: setsCompleted,
      totalSets: totalSets,
      calories: 0,
    };

    // Start the Live Activity
    // This calls the native module, which creates the ActivityKit activity
    const activityId = await startActivity({
      activityType: 'WorkoutAttributes',  // Must match Swift struct name
      attributes: attributes,
      contentState: contentState,
    });

    console.log('Live Activity started:', activityId);
    return activityId;
  } catch (error) {
    console.error('Error starting workout Live Activity:', error);
    return null;
  }
}

/**
 * Update the Live Activity with new workout progress
 * 
 * @param {string} activityId - The ID returned from startWorkoutLiveActivity
 * @param {Object} updates - New state data
 */
export async function updateWorkoutLiveActivity(activityId, updates) {
  if (!activityId) {
    return;
  }

  try {
    // Update only the contentState (the changing data)
    // We don't update attributes (static data) - that's set when starting
    await updateActivity(activityId, {
      contentState: {
        elapsedTime: updates.elapsedTime || '00:00',
        currentExercise: updates.currentExercise || '',
        setsCompleted: updates.setsCompleted || 0,
        totalSets: updates.totalSets || 0,
        calories: updates.calories || 0,
      },
    });
  } catch (error) {
    console.error('Error updating workout Live Activity:', error);
  }
}

/**
 * End/stop the Live Activity
 * 
 * @param {string} activityId - The activity ID to end
 */
export async function endWorkoutLiveActivity(activityId) {
  if (!activityId) {
    return;
  }

  try {
    await endActivity(activityId);
    console.log('Live Activity ended');
  } catch (error) {
    console.error('Error ending workout Live Activity:', error);
  }
}

/**
 * Start a Live Activity for a mental session
 */
export async function startMentalSessionLiveActivity({
  sessionId,
  sessionName,
  duration,
  currentStep = 'Starting...',
}) {
  try {
    const supported = await checkSupport();
    if (!supported) {
      return null;
    }

    const attributes = {
      sessionName: sessionName,
      sessionId: sessionId,
    };

    const contentState = {
      timeLeft: formatTime(duration * 60),  // Convert minutes to seconds
      currentStep: currentStep,
      progress: 0.0,
    };

    const activityId = await startActivity({
      activityType: 'MentalSessionAttributes',
      attributes: attributes,
      contentState: contentState,
    });

    return activityId;
  } catch (error) {
    console.error('Error starting mental session Live Activity:', error);
    return null;
  }
}

/**
 * Update mental session Live Activity
 */
export async function updateMentalSessionLiveActivity(activityId, updates) {
  if (!activityId) return;

  try {
    await updateActivity(activityId, {
      contentState: {
        timeLeft: updates.timeLeft || '00:00',
        currentStep: updates.currentStep || '',
        progress: updates.progress || 0.0,
      },
    });
  } catch (error) {
    console.error('Error updating mental session Live Activity:', error);
  }
}

/**
 * Helper function to format seconds into MM:SS format
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

**How This Works:**

1. **startActivity()**: Calls the native module → Creates ActivityKit activity → Shows on lock screen
2. **updateActivity()**: Pushes new data to existing activity → Lock screen updates automatically
3. **endActivity()**: Ends the activity → Disappears from lock screen

The library handles all the complex native code communication for us!

### Step 5: Integrate into Active Workout Screen

Now let's add Live Activities to your existing workout screen:

```javascript
// app/(tabs)/active-workout.js

import { useState, useEffect, useRef } from 'react';
import {
  startWorkoutLiveActivity,
  updateWorkoutLiveActivity,
  endWorkoutLiveActivity,
} from '../../utils/liveActivities';

const ActiveWorkoutScreen = () => {
  // ... existing state ...
  
  // Add state to store the Live Activity ID
  // We need this ID to update or end the activity later
  const [liveActivityId, setLiveActivityId] = useState(null);

  // ... existing code ...

  // When workout starts, create the Live Activity
  useEffect(() => {
    if (workout && workoutSessionId && !liveActivityId) {
      // Calculate total sets across all exercises
      const totalSets = workout.exercises.reduce((sum, exercise) => {
        return sum + (exercise.sets?.length || 0);
      }, 0);

      // Start the Live Activity
      startWorkoutLiveActivity({
        workoutId: workoutSessionId,
        workoutName: workout.name,
        currentExercise: workout.exercises[0]?.name || 'Starting...',
        setsCompleted: 0,
        totalSets: totalSets,
      }).then((activityId) => {
        if (activityId) {
          setLiveActivityId(activityId);
        }
      });
    }

    // Cleanup: End Live Activity when workout ends
    return () => {
      if (liveActivityId) {
        endWorkoutLiveActivity(liveActivityId);
        setLiveActivityId(null);
      }
    };
  }, [workout, workoutSessionId]);

  // Update Live Activity whenever timer or progress changes
  useEffect(() => {
    if (!liveActivityId || !workout) return;

    // Find current exercise (first incomplete exercise)
    const currentExercise = workout.exercises.find((exercise) =>
      exercise.sets?.some((set) => !set.completed)
    ) || workout.exercises[0];

    // Count completed sets
    const setsCompleted = workout.exercises.reduce((count, exercise) => {
      return count + (exercise.sets?.filter((set) => set.completed).length || 0);
    }, 0);

    const totalSets = workout.exercises.reduce((sum, exercise) => {
      return sum + (exercise.sets?.length || 0);
    }, 0);

    // Format elapsed time
    const formattedTime = formatTime(elapsedTime);

    // Update the Live Activity every second
    updateWorkoutLiveActivity(liveActivityId, {
      elapsedTime: formattedTime,
      currentExercise: currentExercise?.name || 'Workout Complete',
      setsCompleted: setsCompleted,
      totalSets: totalSets,
      calories: calories,
    });
  }, [elapsedTime, calories, workout, liveActivityId]);

  // When workout is finished
  const handleFinishWorkout = async () => {
    // ... existing finish logic ...
    
    // End the Live Activity
    if (liveActivityId) {
      await endWorkoutLiveActivity(liveActivityId);
      setLiveActivityId(null);
    }
  };

  // ... rest of component ...
};
```

**What Changed:**

1. **Import the utility functions** we created
2. **State to track activity ID** - Need this to update/end it later
3. **Start on workout start** - Creates Live Activity when workout begins
4. **Update every second** - Syncs timer, progress, current exercise
5. **End on workout finish** - Cleans up when workout completes

### Step 6: Integrate into Mental Session Screen

Similar integration for mental sessions:

```javascript
// app/active-mental-session.js

import {
  startMentalSessionLiveActivity,
  updateMentalSessionLiveActivity,
  endMentalSessionLiveActivity,
} from '../utils/liveActivities';

const ActiveMentalSession = () => {
  // ... existing state ...
  const [liveActivityId, setLiveActivityId] = useState(null);

  // Start Live Activity when session starts
  useEffect(() => {
    if (session && isActive && !liveActivityId) {
      startMentalSessionLiveActivity({
        sessionId: session.id,
        sessionName: session.title,
        duration: session.duration,
        currentStep: session.steps[0]?.text || 'Starting...',
      }).then((activityId) => {
        if (activityId) {
          setLiveActivityId(activityId);
        }
      });
    }

    return () => {
      if (liveActivityId) {
        endMentalSessionLiveActivity(liveActivityId);
      }
    };
  }, [session, isActive]);

  // Update Live Activity as time progresses
  useEffect(() => {
    if (!liveActivityId || !isActive) return;

    const formattedTime = formatTime(timeLeft);
    const progress = 1 - (timeLeft / (session.duration * 60));
    const currentStep = session.steps[currentStepIndex]?.text || '';

    updateMentalSessionLiveActivity(liveActivityId, {
      timeLeft: formattedTime,
      currentStep: currentStep,
      progress: progress,
    });
  }, [timeLeft, currentStepIndex, liveActivityId, isActive, session]);

  // ... rest of component ...
};
```

---

## TestFlight Considerations

### Building for TestFlight

1. **Prebuild the iOS project:**
   ```bash
   npx expo prebuild --platform ios
   ```
   This generates the native iOS project with your widget extension.

2. **Open in Xcode:**
   ```bash
   open ios/BetterU.xcworkspace
   ```

3. **Configure the Widget Extension:**
   - Select the BetterUWidget target
   - Set deployment target to iOS 16.1+
   - Configure signing (same team as main app)

4. **Build with EAS:**
   ```bash
   eas build --platform ios --profile production
   ```

### Important Notes for TestFlight

1. **iOS Version Requirements:**
   - Live Activities require iOS 16.1+
   - TestFlight testers need devices running iOS 16.1+
   - Older devices won't see Live Activities (but app still works)

2. **Testing:**
   - Live Activities **don't work in iOS Simulator**
   - Must test on **physical devices**
   - TestFlight is perfect for this!

3. **App Store Review:**
   - Live Activities are approved by Apple
   - No special review process needed
   - Just ensure they're useful and not spammy

4. **Privacy:**
   - Live Activities are visible on lock screen
   - Don't show sensitive information (passwords, personal data)
   - Your workout/mental session data is fine

5. **Performance:**
   - Update frequency: Don't update more than once per second
   - Too many updates can drain battery
   - Our implementation updates every second (appropriate)

---

## Troubleshooting

### Live Activity Not Showing

1. **Check iOS version**: Must be 16.1+
   ```javascript
   // Add this check in your code
   const supported = await checkSupport();
   if (!supported) {
     console.log('Device not supported');
   }
   ```

2. **Check permissions**: Live Activities don't require special permissions, but:
   - User must have notifications enabled for your app
   - ActivityKit must be enabled in your app capabilities

3. **Check Activity Type**: The `activityType` in JavaScript must **exactly match** the Swift struct name:
   ```javascript
   // JavaScript
   activityType: 'WorkoutAttributes'
   
   // Swift - must match!
   struct WorkoutAttributes: ActivityAttributes {
   ```

### Updates Not Appearing

1. **Too frequent updates**: iOS throttles updates if you send them too fast
   - Limit to max 1 update per second (we're doing this)

2. **Activity ID lost**: If you lose the activity ID, you can't update it
   - Store it in state (we're doing this)
   - Consider storing in AsyncStorage for persistence

### Widget Not Building

1. **Xcode setup**: Make sure widget extension target is properly configured
2. **Signing**: Widget extension needs same signing certificate as main app
3. **Deployment target**: Both app and widget must target iOS 16.1+

---

## Alternative: Simpler Implementation

If the full implementation seems complex, you can start simpler:

1. **Start with just workout timer** (no exercise names, just time)
2. **Update less frequently** (every 5 seconds instead of every second)
3. **Skip Dynamic Island views** (just lock screen banner)

This reduces complexity while still providing value.

---

## Next Steps

1. **Install the library**: `npm install @kingstinct/react-native-activity-kit`
2. **Create widget extension**: Follow Step 3 above
3. **Create utility functions**: Use Step 4 as template
4. **Integrate gradually**: Start with one screen (workout), then add mental sessions
5. **Test on device**: Build and test on physical iOS 16.1+ device
6. **TestFlight**: Submit to TestFlight once working locally

---

## Resources

- [ActivityKit Documentation](https://developer.apple.com/documentation/activitykit)
- [@kingstinct/react-native-activity-kit GitHub](https://github.com/kingstinct/react-native-activity-kit)
- [Expo Native Modules Guide](https://docs.expo.dev/modules/overview/)
- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)

---

## Summary

Live Activities let your users see workout/mental session progress on their lock screen without opening the app. This is implemented by:

1. **Installing a library** that bridges JavaScript to native iOS code
2. **Creating a Widget Extension** (Swift code) that defines the lock screen appearance
3. **Using utility functions** in your React Native code to start/update/end activities
4. **Integrating into existing screens** to sync with your current timers

The result: A professional, native iOS experience that enhances user engagement! 🎉

