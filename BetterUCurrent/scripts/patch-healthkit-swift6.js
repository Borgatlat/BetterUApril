/**
 * Patch script to fix Swift 6 compatibility issues in @kingstinct/react-native-healthkit
 * 
 * Swift 6 doesn't allow trailing commas in certain contexts where Swift 5 did.
 * This script fixes the syntax errors in Helpers.swift and PredicateHelpers.swift
 */

const fs = require('fs');
const path = require('path');

const healthkitPath = path.join(__dirname, '../node_modules/@kingstinct/react-native-healthkit');

// File paths to patch
const helpersSwift = path.join(healthkitPath, 'ios/Helpers.swift');
const predicateHelpersSwift = path.join(healthkitPath, 'ios/PredicateHelpers.swift');

function patchFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${description}: File not found, skipping patch`);
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix Helpers.swift line 99: Remove trailing comma before closing paren
    // Swift 6 doesn't allow trailing commas in function call arguments before closing paren
    // Pattern: something,\n    ) { ... where the comma is trailing
    if (filePath.includes('Helpers.swift')) {
      const originalContent = content;
      
      // Fix trailing comma before closing paren followed by opening brace
      // Matches: ",\n    ) {" or ",\n      ) {"
      content = content.replace(/,\s*\n\s+\)\s*\{/g, '\n    ) {');
      
      // Also fix if on same line: ", ) {"
      content = content.replace(/,\s+\)\s*\{/g, ' ) {');
      
      if (content !== originalContent) {
        modified = true;
        console.log(`✅ Patched ${description}`);
      }
    }

    // Fix PredicateHelpers.swift line 79: Remove trailing comma before closing paren
    if (filePath.includes('PredicateHelpers.swift')) {
      const originalContent = content;
      
      // Fix trailing comma before closing paren (multiline function call)
      // Pattern: ",\n    )" or ",\n      )"
      content = content.replace(/,\s*\n\s+\)/g, '\n    )');
      
      // Also fix if on same line: ", )"
      content = content.replace(/,\s+\)/g, ' )');
      
      if (content !== originalContent) {
        modified = true;
        console.log(`✅ Patched ${description}`);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } else {
      console.log(`ℹ️  ${description}: No changes needed`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error patching ${description}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Patching HealthKit Swift 6 compatibility issues...\n');

let patched = false;

if (fs.existsSync(helpersSwift)) {
  patched = patchFile(helpersSwift, 'Helpers.swift') || patched;
} else {
  console.log('⚠️  Helpers.swift not found');
}

if (fs.existsSync(predicateHelpersSwift)) {
  patched = patchFile(predicateHelpersSwift, 'PredicateHelpers.swift') || patched;
} else {
  console.log('⚠️  PredicateHelpers.swift not found');
}

if (patched) {
  console.log('\n✅ HealthKit Swift 6 patches applied successfully!');
} else {
  console.log('\nℹ️  No patches needed or files not found');
}
