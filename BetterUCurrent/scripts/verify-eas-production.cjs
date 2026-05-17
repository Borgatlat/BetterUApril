#!/usr/bin/env node
/**
 * Pre-flight checks before `eas build --profile production`.
 * Run: node scripts/verify-eas-production.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(msg) {
  console.error('FAIL:', msg);
  failed += 1;
}
function ok(msg) {
  console.log('OK:', msg);
}

const appConfigPath = path.join(root, 'app.config.js');
const appConfig = fs.readFileSync(appConfigPath, 'utf8');
const buildMatch = appConfig.match(/buildNumber:\s*"(\d+)"/);
const versionMatch = appConfig.match(/version:\s*"([^"]+)"/);
const runtimeMatch = appConfig.match(/runtimeVersion:\s*"([^"]+)"/);

if (!buildMatch) fail('app.config.js missing ios.buildNumber');
else ok(`iOS buildNumber = ${buildMatch[1]}`);

if (!versionMatch || !runtimeMatch) fail('app.config.js missing version or runtimeVersion');
else if (versionMatch[1] !== runtimeMatch[1]) {
  fail(`version (${versionMatch[1]}) must match runtimeVersion (${runtimeMatch[1]})`);
} else ok(`version & runtimeVersion = ${versionMatch[1]}`);

const easPath = path.join(root, 'eas.json');
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
if (eas?.build?.production?.ios?.env?.EXPO_NEW_ARCH_ENABLED === 'true') {
  fail('eas.json production has EXPO_NEW_ARCH_ENABLED=true (conflicts with app.config newArchEnabled:false)');
} else ok('EAS production New Arch aligned (false)');

if (eas?.build?.production?.autoIncrement && eas?.cli?.appVersionSource !== 'remote') {
  fail('autoIncrement requires cli.appVersionSource "remote" when using app.config.js');
} else if (eas?.build?.production?.autoIncrement) {
  ok('autoIncrement enabled with remote appVersionSource');
}

const livekitFn = path.join(root, 'supabase/functions/generate-livekit-token/index.ts');
const livekitSrc = fs.readFileSync(livekitFn, 'utf8');
if (livekitSrc.includes('127.0.0.1:7243')) fail('LiveKit edge function still has debug ingest URLs');
else ok('LiveKit edge function has no debug ingest');

if (/APIAxqoZRosQgSF|57gMB88avon7GGafTDpgeQzXaeFV7ab54mjenByiCS9B/.test(livekitSrc)) {
  fail('LiveKit edge function must not hardcode API secrets — use Supabase secrets only');
} else ok('LiveKit edge function has no hardcoded secrets');

function scanJs(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      scanJs(p);
      continue;
    }
    if (!/\.(js|jsx|ts|tsx)$/.test(name)) continue;
  }
}

const offenders = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (['node_modules', '.git', 'ios', 'android', 'supabase'].includes(name)) continue;
      walk(p);
      continue;
    }
    if (!/\.(js|jsx)$/.test(name)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (text.includes('127.0.0.1:7243')) offenders.push(path.relative(root, p));
  }
}
walk(path.join(root, 'app'));
walk(path.join(root, 'components'));
walk(path.join(root, 'context'));
walk(path.join(root, 'utils'));
if (offenders.length) fail(`Debug ingest still in: ${offenders.join(', ')}`);
else ok('No localhost debug ingest in app/components/context');

if (fs.existsSync(path.join(root, 'node_modules', 'expo-dev-client'))) {
  fail('expo-dev-client is installed — use production profile only for TestFlight/App Store');
} else ok('expo-dev-client not in dependencies');

console.log(failed ? `\n${failed} issue(s). Fix before EAS production build.` : '\nReady for EAS production build.');
process.exit(failed ? 1 : 0);
