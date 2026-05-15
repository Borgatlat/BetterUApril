/**
 * Patch script to fix Google Maps iOS Utils @import issue
 * 
 * PROBLEM: @import GoogleMaps; fails when modules are disabled or mis-scoped in static builds
 * FIX: Replace @import with #import <GoogleMaps/GoogleMaps.h>
 */

const fs = require('fs');
const path = require('path');

// Path to GMUWeightedLatLng.m in Pods
const gmuFile = path.join(__dirname, '../ios/Pods/Google-Maps-iOS-Utils/Sources/GoogleMapsUtilsObjC/include/GMUWeightedLatLng.m');

console.log('Patching Google Maps iOS Utils...');

if (!fs.existsSync(gmuFile)) {
  console.log('⚠️  GMUWeightedLatLng.m not found. This is normal if Pods are not installed yet.');
  console.log('   The patch will be applied after running: cd ios && pod install');
  process.exit(0);
}

try {
  let content = fs.readFileSync(gmuFile, 'utf8');
  const originalContent = content;
  
  // Replace @import GoogleMaps; with #import <GoogleMaps/GoogleMaps.h>
  content = content.replace(/@import\s+GoogleMaps\s*;/g, '#import <GoogleMaps/GoogleMaps.h>');
  
  if (content !== originalContent) {
    fs.writeFileSync(gmuFile, content, 'utf8');
    console.log('✅ Patched GMUWeightedLatLng.m: Replaced @import GoogleMaps with #import');
  } else {
    console.log('ℹ️  GMUWeightedLatLng.m already patched or does not contain @import GoogleMaps');
  }
} catch (error) {
  console.error('❌ Error patching Google Maps Utils:', error.message);
  process.exit(1);
}
