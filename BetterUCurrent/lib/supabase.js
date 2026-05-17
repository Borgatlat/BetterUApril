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

    // Any real HTTP status (2xx–5xx) means we reached Supabase; `ok` alone is misleading.
    // Anon REST often returns **401 Unauthorized** — that still proves the gateway is reachable.
    const authStatusVal = typeof authResponse?.status === 'number' ? authResponse.status : 0;
    const mainStatusVal = typeof mainResponse?.status === 'number' ? mainResponse.status : 0;

    return {
      mainEndpoint: mainStatusVal > 0 && mainStatusVal < 600,
      authEndpoint: authStatusVal >= 200 && authStatusVal < 500,
      mainStatus: mainStatusVal,
      authStatus: authStatusVal,
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

const DB_PING_TIMEOUT_MS = 20000;

/** Races a promise against a timeout; does not cancel the underlying request. */
function withTimeout(promise, ms, timeoutMessage = 'Query timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms);
    }),
  ]);
}

/**
 * Startup / status check: ping REST + auth, then optionally one row from profiles.
 * Skips the table query when logged out (RLS often blocks anon reads and can look like a "timeout").
 */
const testConnection = async () => {
  const startTime = Date.now();
  try {
    if (__DEV__) {
      console.log('Testing Supabase connection...');
    }

    const reachability = await supabase.isUrlReachable();
    if (__DEV__) {
      console.log('Endpoint reachability check result:', reachability);
    }

    if (!reachability.mainEndpoint || !reachability.authEndpoint) {
      const msg = !reachability.authEndpoint
        ? `Authentication service check failed: ${reachability.authStatus} ${reachability.authStatusText}`
        : `Main service check failed: ${reachability.mainStatus} ${reachability.mainStatusText}`;
      console.warn('Supabase reachability check failed:', reachability);
      return { error: msg, details: reachability };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      const responseTime = Date.now() - startTime;
      if (__DEV__) {
        console.log(`Supabase reachable (${responseTime}ms); skipping profiles ping (not signed in).`);
      }
      return {
        success: true,
        responseTime,
        reachabilityOnly: true,
        endpoints: reachability,
      };
    }

    // Light query: `count` is not a column — use `id` and only the signed-in user's row.
    const queryPromise = supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    const { data, error } = await withTimeout(queryPromise, DB_PING_TIMEOUT_MS);

    const responseTime = Date.now() - startTime;

    if (error) {
      const isNetwork =
        error.message?.includes('network') || error.message?.includes('Failed to fetch');
      if (isNetwork) {
        console.warn('Supabase network error during profiles ping:', error.message);
        return {
          error: 'Network connectivity issues detected. Please check your internet connection.',
          details: error.message,
        };
      }
      // API is up; row missing or RLS message is not a full outage.
      console.warn('Supabase profiles ping:', error.message);
      return {
        success: true,
        responseTime,
        reachabilityOnly: true,
        endpoints: reachability,
        warning: error.message,
      };
    }

    if (__DEV__) {
      console.log(`Supabase connection OK (${responseTime}ms)`, data?.id ? 'profile found' : 'no profile row yet');
    }
    return {
      success: true,
      responseTime,
      data,
      endpoints: reachability,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const isTimeout = error?.message === 'Query timeout';

    // Reachability already passed — slow DB ping should not spam ERROR on every launch.
    if (isTimeout) {
      console.warn(
        `Supabase profiles ping timed out after ${DB_PING_TIMEOUT_MS}ms (API was reachable). App can still work; check Supabase dashboard if data never loads.`
      );
      return {
        success: true,
        responseTime,
        reachabilityOnly: true,
        warning: 'Profiles query timed out',
      };
    }

    console.warn('Supabase connection test:', error?.message || error);
    return {
      error: error?.message || 'Unable to connect to Supabase',
      details: error?.message,
    };
  }
};

// Startup smoke test — never throws; avoids red ERROR when only the optional ping is slow.
testConnection().catch((e) => {
  if (__DEV__) {
    console.warn('Supabase startup check failed:', e?.message);
  }
});

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

