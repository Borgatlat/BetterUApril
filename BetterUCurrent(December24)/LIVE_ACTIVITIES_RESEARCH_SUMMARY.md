# Live Activities Research Summary: How React Native Expo Apps Implement It

## Research Findings

After examining how React Native Expo apps incorporate Live Activities, here's what we discovered:

---

## How React Native Expo Apps Handle Live Activities

### The Challenge
**Live Activities are iOS-native** (ActivityKit framework), but React Native is **JavaScript-based**. This requires bridging between two different worlds.

### The Solution Pattern

Most React Native Expo apps use this architecture:

```
┌─────────────────────────────────────────┐
│  JavaScript Layer (React Native)        │
│  - Your React components                │
│  - Business logic                       │
│  - State management                     │
└──────────────┬──────────────────────────┘
               │
               │ Calls library functions
               │
┌──────────────▼──────────────────────────┐
│  Native Bridge Library                   │
│  - @kingstinct/react-native-activity-kit│
│  - expo-live-activity                   │
│  - Custom native modules                │
└──────────────┬──────────────────────────┘
               │
               │ Converts to native calls
               │
┌──────────────▼──────────────────────────┐
│  Native iOS Layer (Swift/Objective-C)   │
│  - ActivityKit framework                │
│  - Widget Extension                     │
│  - ActivityAttributes definitions       │
└──────────────┬──────────────────────────┘
               │
               │ Renders on device
               │
┌──────────────▼──────────────────────────┐
│  iOS Lock Screen / Dynamic Island       │
│  - Live Activity widget                 │
│  - Real-time updates                    │
└─────────────────────────────────────────┘
```

---

## Common Implementation Approaches

### Approach 1: Third-Party Library (Most Common)

**Libraries Used:**
1. **@kingstinct/react-native-activity-kit**
   - Modern, built with Expo's new architecture
   - Active maintenance
   - Good documentation
   - Recommended for new projects

2. **expo-live-activity** (Software Mansion Labs)
   - Official Expo ecosystem
   - Works with managed workflow
   - Requires config plugin

3. **Custom Native Module**
   - Full control
   - Most complex
   - Requires deep iOS knowledge

**Why This Approach:**
- ✅ Libraries handle the complex native bridging
- ✅ JavaScript API is simple to use
- ✅ Works with Expo managed workflow
- ✅ Community support and examples

---

### Approach 2: Config Plugins + Native Code

**What This Means:**
- Expo config plugin automatically sets up native iOS project
- You still write Swift code for the widget extension
- Plugin handles configuration and linking

**Example:**
```javascript
// app.config.js
plugins: [
  "@kingstinct/react-native-activity-kit/plugin",
]
```

This plugin:
- Adds ActivityKit capability
- Configures Info.plist
- Sets up native module linking
- Prepares project for widget extension

---

## The Widget Extension Requirement

**Critical Discovery:** Every Live Activity implementation requires:

1. **Widget Extension Target** in Xcode
   - Separate iOS app target
   - Contains Swift/Objective-C code
   - Defines Live Activity appearance

2. **ActivityAttributes Struct**
   - Defines data structure
   - Static vs. dynamic data separation
   - Codable for JSON serialization

3. **ActivityConfiguration**
   - Lock screen views
   - Dynamic Island views (iPhone 14 Pro+)
   - Styling and layout

**Why This Can't Be Pure JavaScript:**
- iOS Widgets are native SwiftUI/UIKit components
- They need direct access to ActivityKit framework
- Performance requirements (native rendering)
- iOS security model restrictions

---

## Typical Implementation Steps

Based on research of existing Expo apps with Live Activities:

### Step 1: Library Installation
```bash
npm install @kingstinct/react-native-activity-kit
```

### Step 2: Configuration
- Add plugin to `app.config.js`
- Configure Info.plist entries
- Set iOS deployment target to 16.1+

### Step 3: Native Code Setup
- Run `npx expo prebuild` to generate iOS project
- Create Widget Extension in Xcode
- Write Swift code for widget views

### Step 4: JavaScript Integration
- Create utility functions (start, update, end)
- Integrate into React Native components
- Sync with existing app state

### Step 5: Testing
- Test on physical device (not simulator)
- Verify iOS 16.1+ requirement
- Test update frequency and performance

---

## Patterns Found in Production Apps

### Pattern 1: Utility Service Layer
Most apps create a service/utility layer:
```javascript
// utils/liveActivities.js
- startActivity()
- updateActivity()
- endActivity()
- checkSupport()
```

**Why:** Encapsulates complexity, reusable across screens, easier testing

### Pattern 2: State Synchronization
Apps sync React Native state with Live Activities:
```javascript
useEffect(() => {
  if (liveActivityId && timer) {
    updateActivity(liveActivityId, { time: formatTime(timer) });
  }
}, [timer, liveActivityId]);
```

**Why:** Keeps lock screen in sync with app state automatically

### Pattern 3: Graceful Degradation
Apps check support before using:
```javascript
const supported = await isLiveActivitySupported();
if (!supported) {
  // App works fine, just no Live Activity
  return;
}
```

**Why:** Works on older iOS versions, better user experience

---

## TestFlight Considerations

### What We Learned:

1. **Physical Devices Required**
   - Live Activities don't work in iOS Simulator
   - TestFlight perfect for testing
   - Real-world device testing essential

2. **iOS Version Requirements**
   - iOS 16.1+ for Live Activities
   - Apps still work on older versions (feature just disabled)
   - Check support before using

3. **Widget Extension Deployment**
   - Extension must be included in build
   - Same signing certificate as main app
   - Separate target in Xcode project

4. **Update Frequency**
   - iOS throttles excessive updates
   - Best practice: 1 update per second max
   - Too frequent = battery drain + throttling

5. **Privacy & Security**
   - Live Activities visible on lock screen
   - Don't show sensitive data
   - Public information only (workouts, sessions are fine)

---

## Architecture Insights

### Why This Architecture Works:

1. **Separation of Concerns**
   - JavaScript: Business logic, state management
   - Native: UI rendering, system integration
   - Bridge: Communication layer

2. **Performance**
   - Native rendering = smooth, battery-efficient
   - JavaScript handles logic, not rendering
   - Updates pushed efficiently to iOS

3. **Developer Experience**
   - Simple JavaScript API
   - Native complexity abstracted away
   - Familiar React patterns (hooks, state)

4. **Expo Compatibility**
   - Works with managed workflow
   - Config plugins automate setup
   - No need to eject from Expo

---

## Comparison: Different Approaches

### Pure Native iOS App
- ✅ Direct ActivityKit access
- ✅ No bridging needed
- ❌ Not cross-platform
- ❌ More iOS-specific code

### React Native with Library
- ✅ Cross-platform (Android coming)
- ✅ Simple JavaScript API
- ✅ Works with Expo
- ⚠️ Requires native code (widget extension)
- ⚠️ iOS-specific feature

### Hybrid Approach (Your App)
- ✅ React Native for main app
- ✅ Native widget extension for Live Activities
- ✅ Best of both worlds
- ⚠️ Need to maintain both codebases

---

## Key Takeaways for BetterU

Based on this research, here's what makes sense for your app:

1. **Use a Library**: Don't build native bridge from scratch
   - `@kingstinct/react-native-activity-kit` recommended
   - Handles complexity for you

2. **Start Simple**: Begin with basic timer
   - Just elapsed time
   - Then add more features
   - Iterate based on feedback

3. **Widget Extension is Inevitable**: 
   - You'll need Swift code
   - But library makes it manageable
   - Follow templates/examples

4. **TestFlight is Perfect**: 
   - Physical device testing required anyway
   - TestFlight provides real devices
   - Get user feedback early

5. **Update Strategy**: 
   - Sync with existing timers
   - Once per second is perfect
   - Don't over-engineer

---

## Resources Found

1. **Documentation:**
   - ActivityKit official docs
   - WidgetKit documentation
   - Expo native modules guide

2. **Libraries:**
   - @kingstinct/react-native-activity-kit
   - expo-live-activity
   - react-native-widget-extension (config plugin)

3. **Examples:**
   - Video tutorials on YouTube
   - GitHub repositories
   - Expo community forums

---

## Next Steps for Implementation

1. ✅ Research complete (this document)
2. ⏭️ Choose library (recommend @kingstinct/react-native-activity-kit)
3. ⏭️ Install and configure
4. ⏭️ Create widget extension
5. ⏭️ Integrate into active-workout.js
6. ⏭️ Test on physical device
7. ⏭️ Add to mental session screen
8. ⏭️ TestFlight deployment

---

## Summary

React Native Expo apps implement Live Activities by:
1. **Using a bridging library** (handles JavaScript ↔ Swift communication)
2. **Creating a Widget Extension** (native Swift code for UI)
3. **Synchronizing React Native state** with Live Activity updates
4. **Testing on physical devices** (iOS 16.1+)

The architecture is elegant: JavaScript for logic, Swift for rendering, bridge for communication. This gives you the best of both worlds: React Native development speed with native iOS features.

For BetterU specifically, this is a perfect fit since you already have:
- Active workout tracking with timers
- Mental session countdowns
- Real-time state updates

Live Activities will enhance these existing features with native iOS lock screen integration! 🚀

