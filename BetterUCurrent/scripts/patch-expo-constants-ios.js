/**
 * Patch expo-constants iOS scripts so builds work when project paths contain
 * spaces/parentheses (for example: BetterUCurrent(December24)).
 *
 * We patch two places:
 * 1) get-app-config-ios.sh: quote PROJECT_DIR in basename call.
 * 2) EXConstants.podspec script_phase: quote script path passed to bash -c.
 */
const fs = require('fs');
const path = require('path');

const constantsScriptPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-constants',
  'scripts',
  'get-app-config-ios.sh'
);

const constantsPodspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-constants',
  'ios',
  'EXConstants.podspec'
);

let changedAny = false;

if (fs.existsSync(constantsScriptPath)) {
  let src = fs.readFileSync(constantsScriptPath, 'utf8');
  const before = src;
  src = src.replace(
    /PROJECT_DIR_BASENAME=\$\(basename \$PROJECT_DIR\)/,
    'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")'
  );
  if (src !== before) {
    fs.writeFileSync(constantsScriptPath, src, 'utf8');
    changedAny = true;
    console.log('patch-expo-constants-ios: patched', path.relative(process.cwd(), constantsScriptPath));
  }
} else {
  console.warn('patch-expo-constants-ios: script file not found, skip:', constantsScriptPath);
}

if (fs.existsSync(constantsPodspecPath)) {
  let podspec = fs.readFileSync(constantsPodspecPath, 'utf8');
  const beforePodspec = podspec;
  podspec = podspec.replace(
    ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",',
    ':script => "bash -l -c \\"#{env_vars}\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\"",'
  );
  if (podspec !== beforePodspec) {
    fs.writeFileSync(constantsPodspecPath, podspec, 'utf8');
    changedAny = true;
    console.log('patch-expo-constants-ios: patched', path.relative(process.cwd(), constantsPodspecPath));
  }
} else {
  console.warn('patch-expo-constants-ios: podspec file not found, skip:', constantsPodspecPath);
}

if (!changedAny) {
  console.log('patch-expo-constants-ios: already patched or patch pattern not found');
}
