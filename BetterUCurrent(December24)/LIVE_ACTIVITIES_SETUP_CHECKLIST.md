# Live Activities Setup Checklist

Quick reference checklist for setting up Live Activities in your BetterU app.

---

## ✅ Completed Steps

- [x] Library added to `package.json`
- [x] Plugin configured in `app.config.js`
- [x] Utility service created (`utils/liveActivities.js`)
- [x] Active workout screen integrated
- [x] Swift files created

---

## 🔧 Next Steps (In Order)

### 1. Install Dependencies
```bash
npm install
```
- [ ] Dependencies installed

### 2. Generate iOS Project
```bash
npx expo prebuild --platform ios
```
- [ ] iOS project generated
- [ ] `ios/` folder exists

### 3. Open in Xcode
```bash
open ios/BetterU.xcworkspace
```
- [ ] Xcode opens successfully
- [ ] Project loads without errors

### 4. Create Widget Extension Target

In Xcode:
- [ ] File → New → Target
- [ ] Selected "Widget Extension"
- [ ] Named it "BetterUWidget"
- [ ] Bundle ID: `com.enriqueortiz.betteru.BetterUWidget`
- [ ] Language: Swift
- [ ] Target created successfully

### 5. Add Swift Files

- [ ] Deleted default widget files Xcode created
- [ ] Added `WorkoutAttributes.swift` to BetterUWidget target
- [ ] Added `BetterUWorkoutLiveActivity.swift` to BetterUWidget target
- [ ] Added `BetterUWidgetBundle.swift` to BetterUWidget target
- [ ] Added `Info.plist` to BetterUWidget target (if needed)

### 6. Configure Widget Extension Target

- [ ] Deployment target set to **iOS 16.1**
- [ ] ActivityKit capability added
- [ ] Signing configured (same team as main app)
- [ ] Bundle identifier correct

### 7. Configure Main App Target

- [ ] ActivityKit capability added to main app
- [ ] Deployment target is iOS 16.1+

### 8. Build Widget Extension

- [ ] Selected BetterUWidget scheme
- [ ] Selected physical device (iOS 16.1+)
- [ ] Product → Build (⌘B)
- [ ] Build succeeded with no errors

### 9. Build Main App

- [ ] Selected BetterU scheme
- [ ] Product → Clean Build Folder (⇧⌘K)
- [ ] Product → Build (⌘B)
- [ ] Build succeeded with no errors

### 10. Test on Device

- [ ] Connected physical iOS 16.1+ device
- [ ] Installed app on device
- [ ] Started a workout
- [ ] Locked phone
- [ ] ✅ Live Activity appears on lock screen!
- [ ] Timer updates every second
- [ ] Exercise name updates correctly
- [ ] Sets progress updates correctly
- [ ] Calories update correctly
- [ ] Live Activity disappears when workout ends

---

## 🐛 Common Issues Checklist

If something doesn't work:

- [ ] Checked iOS version (16.1+ required)
- [ ] Using physical device (not simulator)
- [ ] ActivityKit capability added to both targets
- [ ] Deployment target is 16.1+ for both targets
- [ ] Both targets signed with same team
- [ ] Widget extension included in build
- [ ] Clean build folder and rebuild
- [ ] Checked Xcode console for errors
- [ ] Verified Swift files are in correct target

---

## 📁 Files Created

Swift files location:
- `ios/BetterUWidget/WorkoutAttributes.swift`
- `ios/BetterUWidget/BetterUWorkoutLiveActivity.swift`
- `ios/BetterUWidget/BetterUWidgetBundle.swift`
- `ios/BetterUWidget/Info.plist`

JavaScript files:
- `utils/liveActivities.js`

Modified files:
- `package.json`
- `app.config.js`
- `app/(tabs)/active-workout.js`

---

## 📚 Documentation

- Full setup guide: `LIVE_ACTIVITIES_SWIFT_SETUP.md`
- Implementation status: `LIVE_ACTIVITIES_IMPLEMENTATION_STATUS.md`
- Complete guide: `LIVE_ACTIVITIES_IMPLEMENTATION_GUIDE.md`
- Quick start: `LIVE_ACTIVITIES_QUICK_START.md`

---

## 🎯 Final Verification

Before considering complete:

- [ ] Live Activity appears on lock screen
- [ ] Updates in real-time (every second)
- [ ] Shows correct workout data
- [ ] Disappears when workout ends
- [ ] Works on iOS 16.1+ devices
- [ ] No console errors
- [ ] Ready for TestFlight

---

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Generate iOS project
npx expo prebuild --platform ios

# Open in Xcode
open ios/BetterU.xcworkspace

# Build with EAS (for TestFlight)
eas build --platform ios --profile production
```

---

**Status:** Swift files created ✅ | Next: Setup in Xcode

