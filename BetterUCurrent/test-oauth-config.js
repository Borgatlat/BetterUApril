// Test script to verify OAuth configuration
// Run this to check if your Google OAuth setup is correct

const testOAuthConfig = () => {
  console.log('🔍 Testing OAuth Configuration...\n');
  
  // Test 1: Check if the redirect URIs are correct
  console.log('✅ Expected Redirect URIs:');
  console.log('1. https://auth.expo.io/@easbetteru/betterU_TestFlight_v7');
  console.log('2. https://auth.expo.io/@easbetteru/betterU_TestFlight_v7/google-auth');
  console.log('3. https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback\n');
  
  // Test 2: Check for common issues
  console.log('❌ Common Issues to Check:');
  console.log('1. Make sure betteruai.com is NOT in your redirect URIs');
  console.log('2. Make sure all URIs are exactly as shown above');
  console.log('3. Make sure there are no extra spaces or characters');
  console.log('4. Make sure the URIs are in the correct order\n');
  
  // Test 3: Supabase configuration
  console.log('🔧 Supabase Configuration:');
  console.log('1. Go to Supabase Dashboard → Authentication → Providers');
  console.log('2. Click on Google provider');
  console.log('3. Verify redirect URL is: https://kmpufblmilcvortrfilp.supabase.co/auth/v1/callback');
  console.log('4. Make sure Google provider is enabled\n');
  
  // Test 4: Google Cloud Console
  console.log('🌐 Google Cloud Console:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Navigate to APIs & Services → Credentials');
  console.log('3. Find your OAuth 2.0 Client ID');
  console.log('4. Click to edit and check Authorized redirect URIs');
  console.log('5. Remove any incorrect URIs (like betteruai.com)');
  console.log('6. Add the correct URIs if missing\n');
  
  console.log('📝 Next Steps:');
  console.log('1. Fix the redirect URIs in Google Cloud Console');
  console.log('2. Test the sign-in flow again');
  console.log('3. Check the console logs for detailed information');
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testOAuthConfig };
} else {
  // Run the test
  testOAuthConfig();
} 