/**
 * Runs "expo run:android" with ANDROID_HOME and PATH set so the Android SDK and adb are found.
 * Use this when you get "Failed to resolve the Android SDK path" or "adb is not recognized".
 * npm run android uses this script so you don't have to set system ANDROID_HOME.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';

// Default SDK locations per platform (Android Studio installs to these)
const defaultPaths = isWindows
  ? [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
    ].filter(Boolean)
  : [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      path.join(process.env.HOME || '', 'Library', 'Android', 'sdk'),
      '/usr/local/share/android-sdk',
    ].filter(Boolean);

function hasAdb(sdkRoot) {
  if (!sdkRoot) return false;
  const adb = path.join(sdkRoot, 'platform-tools', isWindows ? 'adb.exe' : 'adb');
  try {
    const fs = require('fs');
    return fs.existsSync(adb);
  } catch {
    return false;
  }
}

let sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdkRoot || !hasAdb(sdkRoot)) {
  for (const p of defaultPaths) {
    if (p && hasAdb(p)) {
      sdkRoot = p;
      break;
    }
  }
}

if (!sdkRoot || !hasAdb(sdkRoot)) {
  console.error('');
  console.error('Android SDK not found. To run the Android app/emulator:');
  console.error('1. Install Android Studio: https://developer.android.com/studio');
  console.error('2. Complete the setup (it installs the SDK).');
  if (isWindows) {
    const defaultPath = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\You\\AppData\\Local', 'Android', 'Sdk');
    console.error('3. Set ANDROID_HOME (optional): Win+R -> sysdm.cpl -> Advanced -> Environment Variables');
    console.error('   ANDROID_HOME = ' + defaultPath);
    console.error('   Add to PATH: %ANDROID_HOME%\\platform-tools');
  }
  console.error('');
  process.exit(1);
}

const platformTools = path.join(sdkRoot, 'platform-tools');
const pathSep = isWindows ? ';' : ':';
const newPath = platformTools + pathSep + (process.env.PATH || '');

const env = { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot, PATH: newPath };

const result = spawnSync('npx', ['expo', 'run:android'], {
  stdio: 'inherit',
  shell: true,
  env,
  cwd: path.resolve(__dirname, '..'),
});

process.exit(result.status ?? 1);
