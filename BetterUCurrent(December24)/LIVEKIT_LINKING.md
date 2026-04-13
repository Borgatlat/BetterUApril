# LiveKit native linking

If you see: **"The package '@livekit/react-native' doesn't seem to be linked"**, do the following.

## Option 1: App still runs (graceful fallback)

The app now catches this and logs a warning instead of crashing. Voice/therapy features that use LiveKit may be unavailable until you complete the steps below.

## Option 2: Full fix so LiveKit works

You must use a **development build** (not Expo Go), and rebuild the native app after installing the package.

### Android

From the project root:

```bash
npx expo prebuild --clean
npx expo run:android
```

### iOS (Mac only)

From the project root:

```bash
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
npx expo run:ios
```

- **`pod install`** must be run on macOS (CocoaPods). It installs the LiveKit native iOS dependencies.
- After changing native dependencies, always **rebuild** the app (`npx expo run:ios` or `npx expo run:android`); a JS-only reload is not enough.

### EAS / cloud builds

If you build with EAS Build, run `npx expo prebuild --clean` and commit the updated `ios/` and `android/` (or let EAS run prebuild). No extra steps needed for linking.
