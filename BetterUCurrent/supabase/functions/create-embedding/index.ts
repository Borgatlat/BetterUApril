// @ts-ignore - Deno modules are resolved at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Supabase Edge Function: Create Embedding
 * 
 * WHAT THIS DOES:
 * - Takes text input from your app
 * - Calls OpenAI Embeddings API to convert text to a vector (embedding)
 * - Returns the embedding vector
 * 
 * WHY IT'S AN EDGE FUNCTION:
 * - Keeps your OpenAI API key secret (stored in Supabase secrets, not in the app)
 * - Runs on Supabase servers, not on user's device
 * - More secure than putting API keys in your React Native app
 * 
 * HOW IT WORKS:
 * 1. App sends text to this function
 * 2. This function calls OpenAI Embeddings API with secret key
 * 3. OpenAI returns a vector (array of 1536 numbers)
 * 4. This function returns the vector to your app
 * 
 * WHAT IS AN EMBEDDING?
 * An embedding is a mathematical representation of text as a vector (array of numbers).
 * Similar texts get similar vectors. This allows us to search for "similar" documents
 * by comparing vectors.
 * 
 * Example:
 * Text: "Bench Press, 3 sets of 10 at 185lbs"
 * Embedding: [0.23, -0.45, 0.67, 0.12, ...] (1536 numbers)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbeddingRequest {
  text: string; // The text to convert to an embedding
  model?: string; // Optional: which OpenAI embedding model to use
  apiKey?: string; // Optional: OpenAI key fallback (not recommended for production)
}

/**
 * Main handler function
 * This is called whenever your app makes a request to this Edge Function
 */
serve(async (req) => {
  // Handle CORS preflight requests (browsers send OPTIONS request first)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse the request body (the text to embed)
    const { text, model = 'text-embedding-3-small', apiKey }: EmbeddingRequest = await req.json();

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required and must be a non-empty string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get OpenAI API key from Supabase secrets (recommended).
    // Fallback: allow client to pass apiKey (useful for dev / when secrets aren't set).
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || apiKey;
    
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured',
          hint: 'Set OPENAI_API_KEY in Supabase → Edge Functions → Secrets (recommended).'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Call OpenAI Embeddings API
    // The API takes text and returns a vector (array of numbers)
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model, // 'text-embedding-3-small' (cheaper) or 'text-embedding-ada-002' (older but widely used)
        input: text, // The text to embed
      }),
    });

    // Check if the API call was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: `OpenAI API error: ${response.status}`, 
          details: errorText 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the response
    const data = await response.json();

    // OpenAI returns data in this format:
    // {
    //   "data": [
    //     {
    //       "embedding": [0.23, -0.45, 0.67, ...], // Array of 1536 numbers
    //       "index": 0
    //     }
    //   ],
    //   "model": "text-embedding-3-small",
    //   "usage": { "prompt_tokens": 8, "total_tokens": 8 }
    // }

    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      return new Response(
        JSON.stringify({ error: 'Invalid response format from OpenAI' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract the embedding vector (array of numbers)
    const embedding = data.data[0].embedding;

    // Return the embedding to your app
    return new Response(
      JSON.stringify({
        success: true,
        embedding: embedding, // The vector: array of 1536 numbers
        model: data.model,
        usage: data.usage, // Token usage for cost tracking
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    // Handle any unexpected errors
    console.error('Error in create-embedding function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * WHAT HAPPENS IF YOU CHANGE THINGS:
 * 
 * 1. Change the model from 'text-embedding-3-small' to 'text-embedding-ada-002':
 *    - Older model, but still works well
 *    - Different vector dimensions (1536 for ada-002, 1536 for 3-small)
 *    - Make sure your database column matches the dimensions!
 * 
 * 2. Change text-embedding-3-small to text-embedding-3-large:
 *    - Better quality embeddings, but more expensive
 *    - Different dimensions (3072 vs 1536)
 *    - Would need to update database schema
 * 
 * 3. Add batching (embedding multiple texts at once):
 *    - OpenAI API supports up to 2048 texts per request
 *    - More efficient for bulk operations
 *    - Change input from string to array of strings
 */
