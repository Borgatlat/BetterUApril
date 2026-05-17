// @ts-ignore — Deno runtime in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { AccessToken } from 'npm:livekit-server-sdk@2';

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const livekitUrl = requireEnv('LIVEKIT_URL');
    const livekitApiKey = requireEnv('LIVEKIT_API_KEY');
    const livekitApiSecret = requireEnv('LIVEKIT_API_SECRET');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authToken = authHeader.replace('Bearer ', '');
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: errorText || userResponse.statusText }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userData = await userResponse.json();
    if (!userData?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let requestBody: { roomName?: string; participantName?: string; userId?: string };
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { roomName, participantName, userId } = requestBody;
    if (!roomName) {
      return new Response(JSON.stringify({ error: 'roomName is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: participantName || `user-${userId || userData.id}`,
      ttl: '10h',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    const livekitToken = await at.toJwt();

    return new Response(JSON.stringify({ token: livekitToken, url: livekitUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
