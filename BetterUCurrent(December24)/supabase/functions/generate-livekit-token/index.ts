// Deno Edge Function - TypeScript errors for Deno imports are expected in IDE
// These will work correctly when deployed to Supabase Edge Functions
// @ts-ignore - Deno runtime types
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Use npm: specifier - esm.sh fails during Supabase bundling
import { AccessToken } from 'npm:livekit-server-sdk@2';

// Type declaration for Deno global (available in Supabase Edge Functions runtime)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:20',message:'Edge function invoked',data:{method:req.method,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion

    // Get environment variables
    // ⚠️ WARNING: Hardcoded values for local development only!
    // Remove these and use Deno.env.get() with Supabase secrets for production deployment
    const livekitUrl = Deno.env.get('LIVEKIT_URL') || "wss://betteruaitheraphist1-zatqw2it.livekit.cloud";
    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY') || "APIAxqoZRosQgSF";
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET') || "57gMB88avon7GGafTDpgeQzXaeFV7ab54mjenByiCS9B";
    const websocketUrl = Deno.env.get('WEBSOCKET_URL') || "wss://betteruaitheraphist1-zatqw2it.livekit.cloud";

    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:28',message:'Environment variables check',data:{hasLivekitUrl:!!livekitUrl,hasApiKey:!!livekitApiKey,hasApiSecret:!!livekitApiSecret,urlLength:livekitUrl.length,keyLength:livekitApiKey.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:32',message:'Missing LiveKit config',data:{missingUrl:!livekitUrl,missingKey:!livekitApiKey,missingSecret:!livekitApiSecret},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw new Error('LiveKit configuration missing');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:37',message:'Auth header check',data:{hasAuthHeader:!!authHeader,authHeaderLength:authHeader?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!authHeader) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:40',message:'401 - Missing auth header',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user is authenticated via Supabase
    const authToken = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:51',message:'Supabase auth check',data:{hasSupabaseUrl:!!supabaseUrl,hasAnonKey:!!supabaseAnonKey,authTokenLength:authToken.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: supabaseAnonKey,
        },
      }
    );

    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:63',message:'User auth response',data:{status:userResponse.status,statusText:userResponse.statusText,ok:userResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!userResponse.ok) {
      // #region agent log
      const errorText = await userResponse.clone().text().catch(() => 'Could not read error');
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:89',message:'401 - Auth failed',data:{status:userResponse.status,statusText:userResponse.statusText,errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: `Auth check failed with status ${userResponse.status}: ${errorText}` }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userData = await userResponse.json();
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:75',message:'User data parsed',data:{hasUserData:!!userData,hasUserId:!!userData?.id,userId:userData?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!userData || !userData.id) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:77',message:'401 - Invalid user data',data:{userData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No user data or user ID' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:124',message:'Request body parsed',data:{requestBody,hasRoomName:!!requestBody?.roomName,hasParticipantName:!!requestBody?.participantName,hasUserId:!!requestBody?.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    } catch (parseError) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:130',message:'400 - JSON parse error',data:{error:parseError instanceof Error ? parseError.message : String(parseError),errorName:parseError instanceof Error ? parseError.name : typeof parseError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parseError instanceof Error ? parseError.message : String(parseError) }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const { roomName, participantName, userId } = requestBody;

    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:145',message:'Validating roomName',data:{roomName,hasRoomName:!!roomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!roomName) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:148',message:'400 - roomName missing',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return new Response(
        JSON.stringify({ error: 'roomName is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate LiveKit access token
    try {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:163',message:'Creating AccessToken',data:{participantName,userId,userDataId:userData.id,identity:participantName || `user-${userId || userData.id}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      const at = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: participantName || `user-${userId || userData.id}`,
        ttl: '10h', // Token valid for 10 hours
      });

      // Grant permissions
      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false, // We only need audio, not data
      });

      const livekitToken = await at.toJwt();
      
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:181',message:'Token generated successfully',data:{tokenLength:livekitToken?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return new Response(
        JSON.stringify({ token: livekitToken }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (tokenError) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:194',message:'500 - Token generation error',data:{error:tokenError instanceof Error ? tokenError.message : String(tokenError),errorName:tokenError instanceof Error ? tokenError.name : typeof tokenError,stack:tokenError instanceof Error ? tokenError.stack : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      throw tokenError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : null;
    
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:203',message:'500 - Exception handler',data:{errorMessage,errorStack,errorName:error instanceof Error ? error.name : typeof error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion
    
    return new Response(
      JSON.stringify({ error: errorMessage, details: errorStack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

