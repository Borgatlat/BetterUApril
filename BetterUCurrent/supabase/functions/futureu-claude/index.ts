// @ts-ignore — Deno runtime in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { error: jsonResponse({ error: 'Missing authorization header' }, 401) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: jsonResponse({ error: 'Server misconfigured (Supabase env)' }, 500) };
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: supabaseAnonKey,
    },
  });

  if (!userResponse.ok) {
    return { error: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const userData = await userResponse.json();
  if (!userData?.id) {
    return { error: jsonResponse({ error: 'Unauthorized: invalid user' }, 401) };
  }

  return { userId: userData.id as string };
}

function isModelError(message: string) {
  const msg = message.toLowerCase();
  return msg.includes('model') && (msg.includes('not_found') || msg.includes('not found') || msg.includes('invalid'));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey?.trim()) {
    return jsonResponse(
      {
        error:
          'ANTHROPIC_API_KEY is not set on Supabase. Add it under Project Settings → Edge Functions → Secrets.',
      },
      500,
    );
  }

  let body: {
    system?: string;
    messages?: Array<{ role: string; content: string }>;
    max_tokens?: number;
    models?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const system = typeof body.system === 'string' ? body.system : '';
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 2500;
  const models =
    Array.isArray(body.models) && body.models.length > 0
      ? body.models.filter((m) => typeof m === 'string')
      : DEFAULT_MODELS;

  if (!system || messages.length === 0) {
    return jsonResponse({ error: 'system and messages are required' }, 400);
  }

  let lastError = 'Claude request failed';

  for (const model of models) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          (data as { error?: { message?: string } })?.error?.message ||
          `HTTP ${response.status}`;
        lastError = message;
        if (isModelError(message)) continue;
        return jsonResponse({ error: message, model }, response.status);
      }

      const block = (data as { content?: Array<{ type?: string; text?: string }> })?.content?.[0];
      if (block?.type === 'text' && typeof block.text === 'string') {
        return jsonResponse({ text: block.text, model, userId: auth.userId });
      }

      lastError = 'Unexpected Claude response format';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return jsonResponse({ error: lastError }, 502);
});
