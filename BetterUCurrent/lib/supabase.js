import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
-- Create trainer_messages table
CREATE TABLE trainer_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    message TEXT NOT NULL,
    is_user BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL
);

-- Create daily_message_count table to track message limits
CREATE TABLE daily_message_count (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    count INTEGER DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    UNIQUE(user_id, date)
);

-- Create index for faster queries
CREATE INDEX idx_trainer_messages_user_date ON trainer_messages(user_id, date);
CREATE INDEX idx_daily_message_count_user_date ON daily_message_count(user_id, date);
*/

const supabaseUrl = 'https://kmpufblmilcvortrfilp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttcHVmYmxtaWxjdm9ydHJmaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2Mjg2MzYsImV4cCI6MjA1OTIwNDYzNn0.JYJ5WSZWp04AGxfcX2GsiPrTn2QUStCfCHmdDNyxo04';

// Add detailed logging function
const logSupabaseError = (error, operation) => {
  console.error(`Supabase ${operation} error:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    status: error?.status,
    statusText: error?.statusText,
    timestamp: new Date().toISOString()
  });
};

// Add retry logic with exponential backoff
const retryOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting ${operation} (try ${attempt}/${maxRetries})`);
      const result = await operation();
      console.log(`${operation} successful on attempt ${attempt}`);
      return result;
    } catch (error) {
      logSupabaseError(error, operation);
      if (attempt === maxRetries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Create Supabase client with minimal config
// flowType: 'pkce' — password reset emails redirect with ?code=... in the query string.
// Tokens in the hash (#access_token=...) are often STRIPPED when opening custom URL
// schemes from mobile mail apps, which made reset links look "invalid". PKCE avoids that.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Add a method to check if the Supabase URL is reachable
supabase.isUrlReachable = async () => {
  try {
    // Test both the main endpoint and auth endpoint with correct paths
    const [mainResponse, authResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        timeout: 5000
      }),
      fetch(`${supabaseUrl}/auth/v1/health`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        timeout: 5000
      })
    ]);

    return {
      mainEndpoint: mainResponse.ok,
      authEndpoint: authResponse.ok,
      mainStatus: mainResponse.status,
      authStatus: authResponse.status,
      mainStatusText: mainResponse.statusText,
      authStatusText: authResponse.statusText
    };
  } catch (error) {
    console.error('URL reachability check failed:', error);
    return {
      mainEndpoint: false,
      authEndpoint: false,
      error: error.message
    };
  }
};

// Enhance test connection function
const testConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    const startTime = Date.now();
    
    // First check endpoint reachability
    const reachability = await supabase.isUrlReachable();
    console.log('Endpoint reachability check result:', reachability);
    
    if (!reachability.mainEndpoint || !reachability.authEndpoint) {
      console.error('Endpoint reachability check failed:', reachability);
      return {
        error: !reachability.authEndpoint 
          ? `Authentication service check failed: ${reachability.authStatus} ${reachability.authStatusText}`
          : `Main service check failed: ${reachability.mainStatus} ${reachability.mainStatusText}`,
        details: reachability
      };
    }
    
    // If endpoints are reachable, try the actual query
    const { data, error } = await Promise.race([
      supabase.from('profiles').select('count').limit(1),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      )
    ]);
    
    const responseTime = Date.now() - startTime;
    console.log(`Connection response time: ${responseTime}ms`);
    
    if (error) {
      if (error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        console.error('Network error:', error);
        return { 
          error: 'Network connectivity issues detected. Please check your internet connection.',
          details: error.message
        };
      }
      if (error.message?.includes('timeout')) {
        console.error('Query timeout:', error);
        return { 
          error: 'Server response timeout. Please try again.',
          details: error.message
        };
      }
      console.error('Query error:', error);
      return { 
        error: error.message,
        details: error
      };
    }
    
    console.log('Connection test successful');
    return { 
      success: true, 
      responseTime,
      data,
      endpoints: reachability
    };
  } catch (error) {
    console.error('Connection test error:', error);
    return { 
      error: error.message === 'Query timeout' 
        ? 'Server response timeout. Please try again.'
        : 'Unable to connect to Supabase',
      details: error.message
    };
  }
};

// Run initial test
testConnection();

// Attach checkSupabaseStatus to the supabase client instance
supabase.checkSupabaseStatus = async () => {
  try {
    const result = await testConnection();
    return {
      connected: result.success,
      error: result.error,
      details: result.details,
      responseTime: result.responseTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Status check error:', error);
    return {
      connected: false,
      error: 'Failed to check connection status',
      details: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Define Profile type as a JavaScript object with JSDoc comments
/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} user_id
 * @property {string|null} full_name
 * @property {string|null} email
 * @property {number|null} age
 * @property {number|null} weight
 * @property {string|null} fitness_goal
 * @property {string|null} gender
 * @property {number|null} height
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

