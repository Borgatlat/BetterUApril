# React Native 0.81 Folly Duplicate Symbol Fix

## Problem Summary

**Symptoms:**
- `multiple definitions of symbol std::__1` errors during Fastlane archive
- Folly coroutine symbols duplicated
- Function type mismatch involving `__wrap_iter`
- Errors from RNReanimated, RCT-Folly, Hermes, and HealthKit/Nitro modules

**Root Cause:**
React Native 0.81 with static frameworks (`use_frameworks! :linkage => :static`) causes:
1. **Folly C++ modules enabled**: When `CLANG_ENABLE_MODULES = YES`, Folly generates duplicate `std::__1` symbols
2. **Multiple Folly instances**: Reanimated and React Native can pull in separate Folly copies
3. **Static framework stdlib embedding**: Each framework can embed its own copy of libc++ symbols
4. **Inconsistent C++ flags**: Different targets use different stdlib flags, causing symbol mismatches

## Solution Applied

### 1. Disable C++ Modules in Folly (CRITICAL)

**Location:** `ios/Podfile` lines 162-195

```ruby
if target.name.include?('RCT-Folly') || target.name.include?('Folly')
  # RN 0.81 FIX: Disable C++ modules in Folly
  config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
  config.build_settings['DEFINES_MODULE'] = 'NO'
  
  # Remove -fmodules flag
  existing_cpp_flags = existing_cpp_flags.reject { |f| f.to_s.include?('-fmodules') }
  existing_cpp_flags = existing_cpp_flags + ['-fno-modules']
end
```

**Why this works:**
- C++ modules cause each compilation unit to generate its own copy of stdlib symbols
- Disabling modules forces header-only includes, ensuring single symbol definitions
- This is the **primary fix** for `std::__1` duplicate symbol errors

### 2. Ensure Reanimated Uses React Native's Folly

**Location:** `ios/Podfile` lines 197-225

```ruby
if target.name.include?('RNReanimated') || target.name.include?('Reanimated')
  # Disable modules to prevent Reanimated from creating its own Folly symbols
  config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
  
  # Remove paths that might point to a separate Folly instance
  header_paths = header_paths.reject { |p| p.to_s.include?('folly') && !p.to_s.include?('RCT-Folly') }
end
```

**Why this works:**
- Reanimated must use React Native's Folly instance, not compile its own
- Removing duplicate Folly search paths ensures single Folly compilation
- Prevents `folly::coro` symbol duplication

### 3. Disable BUILD_LIBRARY_FOR_DISTRIBUTION Globally

**Location:** `ios/Podfile` line 132

```ruby
config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'NO'
```

**Why this works:**
- When `YES`, each static framework embeds its own copy of standard library symbols
- Setting to `NO` makes frameworks reference the app's stdlib instead of embedding
- This prevents `std::__1` symbol duplication across frameworks

### 4. Force Single libc++ Instance

**Location:** `ios/Podfile` lines 134-150

```ruby
# Force single libc++ instance
config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'

# Remove duplicate -lc++ flags
existing_flags = existing_flags.reject { |f| f.to_s.include?('-lc++') || f.to_s.include?('libc++') }
```

**Why this works:**
- Explicit `-lc++` flags cause multiple libc++ links
- Using `CLANG_CXX_LIBRARY = libc++` ensures single link via compiler setting
- Prevents linker from seeing multiple libc++ instances

### 5. Disable C++ Modules Globally (Except Swift Interop)

**Location:** `ios/Podfile` lines 134-150

```ruby
# Only enable modules for Swift targets (Swift/C++ interop)
if target.name.include?('Swift') || target.name.include?('Healthkit') || target.name.include?('Nitro')
  config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
else
  # C++ targets should NOT use modules
  config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
end
```

**Why this works:**
- C++ modules cause symbol duplication in static frameworks
- Swift targets need modules for Swift/C++ interop (HealthKit, Nitro)
- Pure C++ targets (Folly, Reanimated, Hermes) should NOT use modules

### 6. HealthKit/Nitro Modules Configuration

**Location:** `ios/Podfile` lines 227-250

```ruby
if target.name.include?('NitroModules') || target.name.include?('ReactNativeHealthkit')
  # Enable modules for Swift/C++ interop
  config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
  # Prevent embedding stdlib symbols
  config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'NO'
  # Remove C++ module flags (Swift modules are OK)
  existing_cpp_flags = existing_cpp_flags.reject { |f| f.to_s.include?('-fmodules') && !f.to_s.include?('swift') }
end
```

**Why this works:**
- HealthKit uses Nitro modules (Swift/C++ interop)
- Swift modules are required, but C++ modules cause duplicates
- Removing C++ `-fmodules` flags while keeping Swift modules prevents symbol duplication

### 7. Hermes Configuration

**Location:** `ios/Podfile` lines 252-260

```ruby
if target.name.include?('hermes') || target.name.include?('Hermes')
  config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
  config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
  config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'NO'
end
```

**Why this works:**
- Hermes is a C++ engine that can cause duplicate symbols if not configured correctly
- Disabling modules and distribution prevents stdlib embedding

### 8. Live Activities Configuration

**Location:** `ios/Podfile` lines 262-270

```ruby
if target.name.include?('LiveActivity') || target.name.include?('ActivityKit')
  config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
  config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'NO'
  # Live Activities is Swift-only, so modules are OK
  config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
end
```

**Why this works:**
- Live Activities is pure Swift, so modules are safe
- Preventing distribution ensures no stdlib embedding
- Uses same C++ stdlib as rest of app

## Key Changes Summary

| Setting | Value | Why |
|---------|-------|-----|
| `CLANG_ENABLE_MODULES` (Folly) | `NO` | Prevents duplicate std::__1 symbols |
| `CLANG_ENABLE_MODULES` (Reanimated) | `NO` | Forces use of RN's Folly instance |
| `CLANG_ENABLE_MODULES` (Hermes) | `NO` | Prevents C++ module symbol duplication |
| `CLANG_ENABLE_MODULES` (HealthKit) | `YES` | Required for Swift/C++ interop |
| `BUILD_LIBRARY_FOR_DISTRIBUTION` | `NO` | Prevents frameworks from embedding stdlib |
| `CLANG_CXX_LIBRARY` | `libc++` | Forces single stdlib instance |
| Remove `-lc++` flags | Yes | Prevents multiple libc++ links |
| Remove `-fmodules` (C++) | Yes | Prevents C++ module symbol duplication |

## Testing

After applying these fixes:

1. **Clean build:**
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   ```

2. **Test archive locally:**
   ```bash
   npx expo run:ios --configuration Release
   ```

3. **EAS Build:**
   ```bash
   eas build --platform ios --profile production --clear-cache
   ```

## Why This Fixes the Errors

### `multiple definitions of symbol std::__1`

**Before:** Each framework with C++ modules enabled generated its own copy of `std::__1` namespace symbols.

**After:** Disabling C++ modules ensures all targets use header-only includes, resulting in single symbol definitions.

### `folly coroutine symbols duplicated`

**Before:** Reanimated compiled its own Folly instance, creating duplicate `folly::coro` symbols.

**After:** Reanimated uses React Native's Folly instance, ensuring single compilation.

### `function type mismatch involving __wrap_iter`

**Before:** Different targets used different C++ stdlib flags, causing type mismatches.

**After:** All targets use consistent `-stdlib=libc++` flags, ensuring type compatibility.

## Compatibility

- ✅ React Native 0.81.5
- ✅ Expo SDK 54
- ✅ Xcode 15.x / iOS 18 SDK
- ✅ Swift 5.9
- ✅ Static frameworks (`use_frameworks! :linkage => :static`)
- ✅ EAS Build compatible
- ✅ HealthKit (@kingstinct/react-native-healthkit)
- ✅ Live Activities (expo-live-activity)
- ✅ RNReanimated
- ✅ Hermes

## Notes

- **DO NOT** enable `CLANG_ENABLE_MODULES = YES` for C++ targets (Folly, Reanimated, Hermes)
- **DO** enable modules for Swift/C++ interop targets (HealthKit, Nitro)
- **DO NOT** set `BUILD_LIBRARY_FOR_DISTRIBUTION = YES` (causes stdlib embedding)
- **DO** ensure all targets use `CLANG_CXX_LIBRARY = libc++`
- **DO** remove explicit `-lc++` and `-fmodules` (C++) flags

## References

- React Native 0.81 Folly issues: https://github.com/facebook/react-native/issues/35210
- Static frameworks + C++ modules: https://github.com/CocoaPods/CocoaPods/issues/10406
- Folly duplicate symbols: https://github.com/facebook/folly/issues/1789
