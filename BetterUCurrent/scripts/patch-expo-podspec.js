const fs = require('fs');
const path = require('path');

const podspecPath = path.join(__dirname, '..', 'node_modules', 'expo', 'Expo.podspec');

try {
  // Check if the file exists
  if (!fs.existsSync(podspecPath)) {
    console.log('Expo.podspec not found, skipping patch');
    process.exit(0);
  }

  let content = fs.readFileSync(podspecPath, 'utf8');
  
  // Replace the problematic line
  content = content.replace(
    /compiler_flags = get_folly_config\(\)\[:compiler_flags\]/g,
    'compiler_flags = Pod.respond_to?(:get_folly_config) ? Pod.get_folly_config[:compiler_flags] : []'
  );
  
  fs.writeFileSync(podspecPath, content);
  console.log('Successfully patched Expo.podspec');
  process.exit(0);
} catch (error) {
  console.error('Error patching Expo.podspec:', error);
  // Don't fail the build if the patch fails
  console.log('Continuing build despite patch failure');
  process.exit(0);
} 