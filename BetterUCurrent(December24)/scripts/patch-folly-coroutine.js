/**
 * Patch script to fix Folly coroutine header issues in React Native 0.81 + Reanimated
 * 
 * ROOT CAUSE: React Native 0.81's Folly distribution doesn't include coroutine headers,
 * but Reanimated may try to include them. This script:
 * 1. Creates stub coroutine headers if missing
 * 2. Patches Reanimated files to handle missing headers gracefully
 * 3. Disables coroutines in Folly if Portability.h exists
 */

const fs = require('fs');
const path = require('path');

const follyPath = path.join(__dirname, '../node_modules/react-native/third-party/folly');
const follyCoroPath = path.join(follyPath, 'folly/coro');

console.log('Patching React Native Reanimated for Folly coroutine compatibility...');

// Step 1: Create stub Folly coroutine headers if they don't exist
// This is the PRIMARY fix - create the missing headers that Reanimated expects
// Try multiple possible Folly locations (different in local vs EAS build)
const possibleFollyPaths = [
  path.join(__dirname, '../node_modules/react-native/third-party/folly'),
  path.join(__dirname, '../node_modules/react-native/ReactAndroid/src/main/jni/third-party/folly'),
];

let follyFound = false;
for (const testFollyPath of possibleFollyPaths) {
  if (fs.existsSync(testFollyPath)) {
    const testCoroPath = path.join(testFollyPath, 'folly/coro');
    
    // Create coro directory if it doesn't exist
    if (!fs.existsSync(testCoroPath)) {
      fs.mkdirSync(testCoroPath, { recursive: true });
      console.log(`Created Folly coro directory at ${testCoroPath}`);
    }

    // Create Coroutine.h stub header
    const coroutineHeaderPath = path.join(testCoroPath, 'Coroutine.h');
    if (!fs.existsSync(coroutineHeaderPath)) {
    const coroutineHeaderContent = `// Stub header for Folly coroutines
// React Native 0.81 doesn't include coroutine headers, so we provide stubs
#ifndef FOLLY_CORO_COROUTINE_H
#define FOLLY_CORO_COROUTINE_H

#include <folly/Portability.h>

#if FOLLY_HAS_COROUTINES
#include <folly/experimental/coro/Coroutine.h>
#else
// Stub implementations for when coroutines are not available
namespace folly {
namespace coro {
  template<typename Promise = void>
  struct coroutine_handle {
    static coroutine_handle from_address(void* addr) noexcept {
      return coroutine_handle{};
    }
    void* address() const noexcept { return nullptr; }
    void resume() const {}
    void destroy() const {}
    bool done() const { return true; }
    Promise& promise() const {
      static Promise p{};
      return p;
    }
  };
  
  template<typename Promise>
  bool operator==(coroutine_handle<Promise> const&, coroutine_handle<Promise> const&) {
    return true;
  }
  
  template<typename Promise>
  bool operator!=(coroutine_handle<Promise> const&, coroutine_handle<Promise> const&) {
    return false;
  }
}
}

#endif // FOLLY_HAS_COROUTINES
#endif // FOLLY_CORO_COROUTINE_H
`;
      fs.writeFileSync(coroutineHeaderPath, coroutineHeaderContent);
      console.log(`✅ Created stub Folly coroutine header at ${coroutineHeaderPath}`);
      follyFound = true;
      break; // Found and created, no need to check other paths
    } else {
      console.log(`✅ Folly coroutine header already exists at ${coroutineHeaderPath}`);
      follyFound = true;
      break;
    }
  }
}

if (!follyFound) {
  console.log('⚠️  Folly directory not found in expected locations - headers will be created by Podfile post_install hook');
}

// Step 2: Disable coroutines in Folly Portability.h if it exists
// Check multiple possible locations for Portability.h
const portabilityPaths = [
  path.join(follyPath, 'folly/Portability.h'),
  path.join(follyPath, 'folly/portability/Portability.h'),
];

portabilityPaths.forEach(portabilityPath => {
if (fs.existsSync(portabilityPath)) {
  let content = fs.readFileSync(portabilityPath, 'utf8');
    let modified = false;
  
    // Disable coroutines if enabled
  if (content.includes('#define FOLLY_HAS_COROUTINES 1')) {
      content = content.replace(/#define FOLLY_HAS_COROUTINES 1/g, '#define FOLLY_HAS_COROUTINES 0');
      modified = true;
    }
    
    // Also check for FOLLY_HAS_COROUTINES without explicit value
    if (content.includes('#define FOLLY_HAS_COROUTINES') && !content.includes('#define FOLLY_HAS_COROUTINES 0')) {
      // Add explicit 0 if not already set
      content = content.replace(/#define FOLLY_HAS_COROUTINES(?!\s+0)/g, '#define FOLLY_HAS_COROUTINES 0');
      modified = true;
    }
    
    if (modified) {
    fs.writeFileSync(portabilityPath, content);
      console.log(`✅ Disabled Folly coroutines in ${path.basename(portabilityPath)}`);
  }
}
});

// Step 3: Patch Reanimated files to handle missing headers gracefully
// Use correct paths for Reanimated 3.17.1
const reanimatedPath = path.join(__dirname, '../node_modules/react-native-reanimated');

if (fs.existsSync(reanimatedPath)) {
  // Correct file paths for Reanimated 3.17.1
  const filesToPatch = [
    'Common/cpp/worklets/WorkletRuntime/ReanimatedRuntime.cpp',
    'Common/cpp/worklets/WorkletRuntime/ReanimatedRuntime.h',
    // Also check other potential locations
    'Common/cpp/ReanimatedRuntime/ReanimatedRuntime.cpp',
    'Common/cpp/ReanimatedRuntime/ReanimatedRuntime.h',
  ];
  
  filesToPatch.forEach(file => {
    const fullPath = path.join(reanimatedPath, file);
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Only patch if file doesn't already have our fix and might need it
      if (!content.includes('// Stub header for Folly coroutines') && 
          !content.includes('folly/coro/Coroutine.h')) {
        // Add protective include guard at the top
        const follyFix = `// Folly coroutine compatibility fix
#ifndef FOLLY_CORO_COMPAT_FIX
#define FOLLY_CORO_COMPAT_FIX
#ifdef __has_include
#if __has_include(<folly/coro/Coroutine.h>)
#include <folly/coro/Coroutine.h>
#else
// Folly coroutines not available - using stubs
namespace folly {
namespace coro {
  template<typename Promise = void>
  struct coroutine_handle {
    static coroutine_handle from_address(void* addr) noexcept { return {}; }
    void* address() const noexcept { return nullptr; }
    void resume() const {}
    void destroy() const {}
    bool done() const { return true; }
  };
}
}
#endif
#endif
#endif

`;
        content = follyFix + content;
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Patched Reanimated file: ${file}`);
      }
    }
  });
}

console.log('✅ Folly coroutine patch completed');
