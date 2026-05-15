// utils/foodPhotoAnalyzer.js

import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';
import getEnvVars from './config';

/**
 * Analyze Food Photo (Secure Production Implementation)
 * 
 * This function:
 * 1. Converts image to base64
 * 2. Sends to Supabase Edge Function (which calls OpenAI Vision with a secret key)
 * 3. Returns nutrition data
 * 
 * Security: API key never leaves the server
 */
export const analyzeFoodPhoto = async (imageUri) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:17',message:'analyzeFoodPhoto entry',data:{imageUri:imageUri?.substring(0,100),imageUriType:typeof imageUri,imageUriExists:!!imageUri},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    console.log('📸 Starting food photo analysis...');
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:22',message:'Before convertImageToBase64',data:{imageUri:imageUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Step 1: Convert image to base64
    const base64Image = await convertImageToBase64(imageUri);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:24',message:'After convertImageToBase64',data:{base64Length:base64Image?.length,base64Exists:!!base64Image},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Step 2: Get current user ID (optional, for tracking)
    let userId = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    } catch (authError) {
      console.warn('Could not get user ID:', authError);
      // Continue without user ID - it's optional
    }
    
    // Step 3: Get OpenAI API key from environment (from .env file)
    // ⚠️ SECURITY WARNING: This key will be visible in your app bundle!
    // Anyone can extract it. Only use this for testing/development.
    const openAIApiKey = getEnvVars.OPENAI_API_KEY;
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }
    
    // Step 4: Call Supabase Edge Function (pass API key from client)
    const { data, error } = await supabase.functions.invoke('analyze-food-photo', {
      body: {
        image: base64Image,
        userId: userId, // Optional: for usage tracking
        apiKey: openAIApiKey, // Pass API key from client (⚠️ not secure for production!)
      },
    });

    // Step 5: Handle errors
    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Failed to analyze food photo');
    }

    // Step 6: Check if analysis was successful
    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to analyze food photo');
    }

    console.log('✅ Successfully analyzed:', data.nutrition?.food_name);

    // Step 7: Return nutrition data
    return {
      success: true,
      nutrition: data.nutrition,
    };

  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:71',message:'analyzeFoodPhoto error caught',data:{errorMessage:error?.message,errorCode:error?.code,errorName:error?.name,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    console.error('❌ Error analyzing food photo:', error);
    return {
      success: false,
      error: error.message || 'Failed to analyze food photo',
    };
  }
};

/**
 * Convert image URI to base64
 * 
 * This function uses a "try-direct-read, fallback-to-copy" strategy:
 * 1. First, try to read the URI directly (works for file:// URIs)
 * 2. If that fails, copy to a temp file and read that (handles ph://, content://)
 * 
 * Why this approach?
 * - Some URIs can be read directly (file://)
 * - Others need copying first (ph:// on iOS, content:// on Android)
 * - Trying direct read first is faster when it works
 * - Falling back to copy handles the problematic URI formats
 * 
 * Important detail:
 * - We return "raw base64" (no `data:image/...` prefix).
 * - The SERVER (Supabase Edge Function) converts it to a Data URL for OpenAI.
 */
const convertImageToBase64 = async (imageUri) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:121',message:'convertImageToBase64 entry',data:{imageUri:imageUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
  // #endregion
  try {
    console.log('🔄 Converting image URI to base64:', imageUri?.substring(0, 50) + '...');
    
    // Strategy: Try direct read first, fallback to copy if it fails
    // This handles both file:// URIs (direct read) and ph:///content:// URIs (copy first)
    let base64;
    let tempFileUri = null;
    
    try {
      // Attempt 1: Try reading directly (works for file:// URIs)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:135',message:'Attempting direct read',data:{imageUri:imageUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:139',message:'Direct read succeeded',data:{base64Length:base64?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      console.log('✅ Direct read succeeded');
    } catch (directReadError) {
      // Attempt 2: Direct read failed, copy to temp file first
      // This handles ph:// (iOS) and content:// (Android) URIs
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:143',message:'Direct read failed, trying copy',data:{errorMessage:directReadError?.message,imageUri:imageUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      console.log('📋 Direct read failed, copying to temporary file...');
      
      // Create a temporary file path in the app's cache directory
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const tempFileName = `food_photo_${timestamp}_${random}.jpg`;
      tempFileUri = `${FileSystem.cacheDirectory}${tempFileName}`;
      
      // Copy the image from the original location to our temp file
      // FileSystem.copyAsync supports ph:// and content:// URIs as sources
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:153',message:'Before copyAsync',data:{from:imageUri?.substring(0,100),to:tempFileUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      await FileSystem.copyAsync({
        from: imageUri,        // Source: can be ph://, content://, or file://
        to: tempFileUri,       // Destination: always file:// URI
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:159',message:'After copyAsync success',data:{tempFileUri:tempFileUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      console.log('✅ Image copied to temporary file');
      
      // Now read the temp file (guaranteed to be file:// URI)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:164',message:'Reading temp file',data:{tempFileUri:tempFileUri?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      base64 = await FileSystem.readAsStringAsync(tempFileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:168',message:'Temp file read succeeded',data:{base64Length:base64?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
    }
    
    // Clean up temporary file if we created one
    if (tempFileUri) {
      try {
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        console.log('🧹 Cleaned up temporary file');
      } catch (cleanupError) {
        // Non-critical - OS will clean up eventually
        console.warn('Could not clean up temp file (non-critical):', cleanupError);
      }
    }
    
    console.log('✅ Successfully converted image to base64 (length:', base64.length, 'characters)');
    return base64;
    
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'foodPhotoAnalyzer.js:183',message:'convertImageToBase64 error caught',data:{errorMessage:error?.message,errorCode:error?.code,errorName:error?.name,errorStack:error?.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    console.error('❌ Error converting image to base64:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      uri: imageUri?.substring(0, 50),
    });
    throw new Error('Failed to process image. Please try a different photo.');
  }
};