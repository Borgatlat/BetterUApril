// @ts-ignore - Deno modules are resolved at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * Supabase Edge Function: RAG Query
 * 
 * WHAT THIS DOES:
 * - Takes a user's question
 * - Converts the question to an embedding (vector)
 * - Searches the database for similar embeddings
 * - Returns the most relevant context chunks
 * 
 * HOW IT WORKS:
 * 1. User asks: "What workout should I do today?"
 * 2. Function embeds the question → vector
 * 3. Function searches database for similar vectors
 * 4. Returns top 3-5 relevant chunks (e.g., recent workouts, PRs, goals)
 * 5. Your app uses these chunks to augment the AI prompt
 * 
 * WHY THIS IS BETTER:
 * - Instead of sending ALL user data to AI, send only relevant pieces
 * - Saves tokens (costs less money)
 * - More accurate responses (AI has focused context)
 * - Works even when users have thousands of workout logs
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RAGQueryRequest {
  query: string; // The user's question
  userId: string; // The user's ID (from auth)
  documentType?: string; // Optional: filter by type ('workout_log', 'pr', 'goal', etc.)
  limit?: number; // Optional: how many chunks to return (default: 5)
  similarityThreshold?: number; // Optional: minimum similarity score (0-1, default: 0.7)
  apiKey?: string; // Optional: OpenAI key fallback (not recommended for production)
}

/**
 * Main handler function
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { 
      query, 
      userId, 
      documentType = null, 
      limit = 5,
      similarityThreshold = 0.7,
      apiKey
    }: RAGQueryRequest = await req.json();

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a non-empty string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // STEP 0: Verify the caller is authenticated.
    // We do NOT want someone to spoof userId in the request body.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: 'Supabase credentials not configured',
          hint: 'SUPABASE_URL and SUPABASE_ANON_KEY should be available in Edge Functions automatically.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Missing Authorization header',
          hint: 'Call this function from an authenticated Supabase client so it sends the user JWT.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({
          error: 'User not authenticated',
          details: authError?.message ?? 'No user in session',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (authData.user.id !== userId) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          hint: 'userId in the request must match the authenticated user.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Get OpenAI API key for embedding the query.
    // Best practice: set OPENAI_API_KEY in Supabase Edge Function secrets.
    // Fallback: allow client to pass apiKey (useful for dev / when secrets aren't set).
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || apiKey;
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'OpenAI API key not configured',
          hint: 'Set OPENAI_API_KEY in Supabase → Edge Functions → Secrets (recommended).',
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // STEP 1: Embed the user's question
    // Convert the question to a vector so we can search for similar vectors
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('OpenAI Embeddings API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create embedding: ${embeddingResponse.status}`,
          details: errorText 
        }),
        { 
          status: embeddingResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding; // The vector (array of 1536 numbers)

    // STEP 2: Search for similar embeddings using the database function
    // The search_similar_embeddings function uses cosine similarity to find the most similar vectors
    const { data: similarDocs, error: searchError } = await supabase.rpc('search_similar_embeddings', {
      query_embedding: queryEmbedding, // The vector we just created
      query_user_id: userId,
      query_document_type: documentType,
      match_count: limit,
      similarity_threshold: similarityThreshold,
    });

    if (searchError) {
      console.error('Database search error:', searchError);
      return new Response(
        JSON.stringify({ 
          error: 'Database search failed',
          details: searchError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // STEP 4: Format and return the results
    // Similar documents are already sorted by similarity (most similar first)
    const results = (similarDocs || []).map((doc: any) => ({
      content: doc.content, // The original text
      documentType: doc.document_type, // Type: 'workout_log', 'pr', etc.
      documentId: doc.document_id,
      documentDate: doc.document_date,
      metadata: doc.metadata, // Additional info (JSON object)
      similarity: doc.similarity, // How similar (0-1, higher = more similar)
    }));

    return new Response(
      JSON.stringify({
        success: true,
        query: query, // Echo back the original question
        results: results, // Array of relevant context chunks
        count: results.length, // How many results were found
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in rag-query function:', error);
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
 * 1. Change limit from 5 to 10:
 *    - Returns more context chunks
 *    - More tokens = higher cost, but might be more accurate
 *    - Test to find the sweet spot for your use case
 * 
 * 2. Change similarityThreshold from 0.7 to 0.5:
 *    - Lower threshold = more results (even less similar ones)
 *    - Might include irrelevant context
 *    - 0.7 is a good default, but adjust based on your data
 * 
 * 3. Remove documentType filter:
 *    - Searches across ALL document types
 *    - Might return mixed results (workouts + PRs + goals)
 *    - Can be useful for general queries
 * 
 * 4. Add date filtering:
 *    - Only search recent documents (e.g., last 30 days)
 *    - Useful for questions like "What did I do recently?"
 *    - Would need to modify the SQL function to add date filter
 */
