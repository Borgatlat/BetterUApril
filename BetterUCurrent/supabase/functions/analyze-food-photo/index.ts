// @ts-ignore - Deno modules are resolved at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Supabase Edge Function: Analyze Food Photo (OpenAI Vision)
 *
 * IMPORTANT SECURITY IDEA (super important):
 * - The mobile app NEVER talks to OpenAI directly.
 * - The mobile app sends the photo (base64) to THIS server function.
 * - THIS server function uses the secret `OPENAI_API_KEY` to call OpenAI.
 *
 * Why we do it this way:
 * - If you put an API key in the app, anyone can extract it and steal your money.
 * - Supabase "secrets" live on the server, so users can't see them.
 *
 * Flow:
 * 1) App sends base64 image to this function
 * 2) This function calls OpenAI Vision with a secret key
 * 3) Returns structured nutrition data back to the app
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FoodAnalysisRequest {
  image: string; // base64 encoded image
  userId?: string; // Optional: for tracking usage
  apiKey?: string; // API key passed from client (⚠️ not secure - for testing only!)
}

/**
 * The app sends "raw base64" (no prefix). OpenAI expects an image URL.
 * A Data URL is just a string that *contains the image bytes*:
 *
 *   data:image/jpeg;base64,AAAA...
 *
 * If we already got a data URL, we keep it. Otherwise we assume jpeg.
 *
 * What if you change `image/jpeg` to `image/png`?
 * - If the photo is actually jpeg but you label it png, some services may reject it.
 * - If you KNOW your images are png, switching to png is fine.
 */
function toImageDataUrl(base64OrDataUrl: string): string {
  if (base64OrDataUrl.startsWith("data:")) return base64OrDataUrl;
  return `data:image/jpeg;base64,${base64OrDataUrl}`;
}

/**
 * Safely parse model JSON. If parsing fails, throw a helpful error.
 * (Models sometimes return extra text; we try to keep the prompt strict anyway.)
 */
function parseJsonOrThrow(text: string): any {
  try {
    return JSON.parse(text);
  } catch (_e) {
    throw new Error("AI returned non-JSON output. Try a clearer photo or retry.");
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Parse request body
    const requestData = (await req.json()) as FoodAnalysisRequest;
    const { image, userId, apiKey } = requestData;

    // Validate image is provided
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'Image is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Get OpenAI API key from Supabase secrets (secure - never exposed to app)
    // Deno.env is available in Supabase Edge Functions runtime.
    // Priority: 1) Supabase secret (secure), 2) Client-provided key (fallback, less secure)
    // ⚠️ SECURITY WARNING: Using client-provided API keys is NOT secure!
    // The key will be visible in the app bundle and can be extracted.
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || apiKey;
    const openAIBaseUrl = Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const openAIModel = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o-mini';

    // Check if API key is configured
    if (!openAIApiKey) {
      console.error('OpenAI API key not provided (neither from Supabase secrets nor client)');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'OpenAI API key not configured. Please set OPENAI_API_KEY secret in Supabase (recommended) OR set EXPO_PUBLIC_OPENAI_API_KEY in .env'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log(`📸 Analyzing food photo (OpenAI) for user: ${userId || 'anonymous'}`);

    const imageUrl = toImageDataUrl(image);
    const endpoint = `${openAIBaseUrl}/chat/completions`;

    // We ask the model to output STRICT JSON. Then we parse it on the server.
    // If you change the prompt, you MUST keep it JSON-only or parsing will fail.
    const prompt = [
      "You are a nutrition analyst.",
      "Given ONE food photo, identify the food(s) and estimate nutrition for the whole plate/serving shown.",
      "Return ONLY valid JSON (no markdown, no backticks).",
      "Use these fields exactly:",
      "{",
      '  "food_name": string,',
      '  "calories": number,',
      '  "protein_g": number,',
      '  "carbs_g": number,',
      '  "fats_g": number,',
      '  "fiber_g": number,',
      '  "sugar_g": number,',
      '  "sodium_mg": number,',
      '  "calcium_mg": number,',
      '  "iron_mg": number,',
      '  "vitamin_c_mg": number,',
      '  "vitamin_a_iu": number,',
      '  "serving_size": string,',
      '  "confidence": "low" | "medium" | "high",',
      '  "allergens": string[]',
      "}",
      "All numbers must be >= 0. If unsure, give best estimate.",
    ].join("\n");

    const openAIResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: openAIModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              // OpenAI API format per documentation:
              // - type: "input_image" (not "image_url")
              // - image_url: string (data URL format: data:image/jpeg;base64,<base64>)
              { type: 'input_image', image_url: imageUrl },
            ],
          },
        ],
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', openAIResponse.status, errorText);

      let errorMessage = 'Failed to analyze food photo';
      if (openAIResponse.status === 401) {
        errorMessage = 'Invalid OpenAI API key configured on server';
      } else if (openAIResponse.status === 429) {
        errorMessage = 'AI rate limit exceeded. Please try again later.';
      } else if (openAIResponse.status === 400) {
        errorMessage = 'Invalid image or request format';
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: openAIResponse.status
        }),
        {
          status: openAIResponse.status >= 500 ? 500 : openAIResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const openAIData = await openAIResponse.json();
    const contentText: string | undefined = openAIData?.choices?.[0]?.message?.content;
    if (!contentText) {
      console.error('OpenAI response missing content:', openAIData);
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const nutrition = parseJsonOrThrow(contentText);

    // Validate we got valid data
    if (!nutrition.calories || nutrition.calories <= 0) {
      console.warn('Received invalid nutrition data:', nutrition);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid nutrition data received from API',
          details: 'Could not extract valid calorie information'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log(`✅ Successfully analyzed: ${nutrition.food_name} (${nutrition.calories} cal)`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        nutrition: nutrition,
        // Optional: include raw response for debugging (remove in production)
        // raw_data: calAiData,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('❌ Error in analyze-food-photo function:', error);
    
    // Handle error type safely
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
