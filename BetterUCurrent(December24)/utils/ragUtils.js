/**
 * RAG Utility Functions
 * 
 * These functions help you store and retrieve embeddings for RAG (Retrieval-Augmented Generation).
 * 
 * WHAT IS RAG?
 * RAG (Retrieval-Augmented Generation) makes AI responses smarter by:
 * 1. Storing your data as embeddings (vectors) in a database
 * 2. When user asks a question, searching for relevant chunks
 * 3. Using those chunks to augment the AI prompt
 * 
 * KEY FUNCTIONS:
 * - storeDocumentEmbedding: Stores a piece of text as an embedding in the database
 * - queryRAGContext: Searches for relevant context chunks for a question
 * - chunkAndStoreWorkoutLog: Breaks down a workout log into chunks and stores them
 * 
 * HOW TO USE:
 * 1. When a user creates/updates data (workout, PR, goal), call storeDocumentEmbedding
 * 2. When generating AI responses, call queryRAGContext to get relevant context
 * 3. Use the retrieved context in your AI prompt instead of sending all data
 */

import { supabase } from '../lib/supabase';
import { getOpenAIApiKey } from './apiConfig';

/**
 * Stores a document as an embedding in the database
 * 
 * @param {string} content - The text content to store (e.g., "Bench Press, 3 sets of 10 at 185lbs")
 * @param {string} documentType - Type of document: 'workout_log', 'pr', 'goal', 'preference', 'conversation'
 * @param {string} documentId - ID of the original document (e.g., workout log ID)
 * @param {object} metadata - Additional metadata (e.g., { workout_name: "Push Day", date: "2025-01-01" })
 * @returns {Promise<{success: boolean, error?: string, embeddingId?: string}>}
 * 
 * HOW IT WORKS:
 * 1. Calls Supabase Edge Function to convert text → embedding (vector)
 * 2. Stores the embedding in the document_embeddings table
 * 3. The embedding can then be searched later using similarity search
 * 
 * EXAMPLE:
 * ```javascript
 * await storeDocumentEmbedding(
 *   "Bench Press, 3 sets of 10 at 185lbs on 2025-01-01",
 *   "workout_log",
 *   "workout-123",
 *   { workout_name: "Push Day", exercise: "Bench Press" }
 * );
 * ```
 */
export const storeDocumentEmbedding = async (
  content,
  documentType,
  documentId = null,
  metadata = {}
) => {
  try {
    // We (optionally) pass an OpenAI key to the Edge Function as a fallback.
    // Best practice is to configure OPENAI_API_KEY as a Supabase secret, but your app already
    // has a fallback key, so this keeps things working in dev / misconfigured environments.
    const apiKey = await getOpenAIApiKey();

    // Validate inputs
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        success: false,
        error: 'Content must be a non-empty string'
      };
    }

    if (!documentType) {
      return {
        success: false,
        error: 'documentType is required'
      };
    }

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // STEP 1: Call Supabase Edge Function to create embedding
    // This converts the text to a vector (array of numbers)
    // Using supabase.functions.invoke() is the proper way to call Edge Functions from the client
    const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('create-embedding', {
      body: {
        text: content,
        model: 'text-embedding-3-small', // OpenAI embedding model
        apiKey,
      },
    });

    if (embeddingError) {
      console.error('Failed to create embedding:', embeddingError);
      return {
        success: false,
        error: `Failed to create embedding: ${embeddingError.message}`
      };
    }

    if (!embeddingData || !embeddingData.success || !embeddingData.embedding) {
      return {
        success: false,
        error: 'Invalid response from embedding function'
      };
    }

    const embedding = embeddingData.embedding; // Array of 1536 numbers

    // STEP 2: Store the embedding in the database
    // pgvector expects the embedding as a PostgreSQL array format
    // In Supabase, we can pass it directly as an array and it will be converted
    const { data, error } = await supabase
      .from('document_embeddings')
      .insert({
        user_id: user.id,
        content: content,
        embedding: embedding, // Pass as array - Supabase will handle the conversion
        document_type: documentType,
        document_id: documentId,
        document_date: metadata.date ? new Date(metadata.date).toISOString() : new Date().toISOString(),
        metadata: metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error storing embedding:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }

    return {
      success: true,
      embeddingId: data.id
    };

  } catch (error) {
    console.error('Error in storeDocumentEmbedding:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * Queries the RAG system for relevant context chunks
 * 
 * @param {string} query - The user's question (e.g., "What workout should I do today?")
 * @param {string} documentType - Optional: filter by type ('workout_log', 'pr', 'goal', etc.)
 * @param {number} limit - How many chunks to return (default: 5)
 * @param {number} similarityThreshold - Minimum similarity score 0-1 (default: 0.7)
 * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
 * 
 * HOW IT WORKS:
 * 1. Calls Supabase Edge Function with the user's question
 * 2. Edge Function embeds the question and searches for similar embeddings
 * 3. Returns the most relevant context chunks
 * 
 * EXAMPLE:
 * ```javascript
 * const { results } = await queryRAGContext(
 *   "What did I do for chest last week?",
 *   "workout_log",
 *   5
 * );
 * // Returns array of relevant workout logs
 * ```
 */
export const queryRAGContext = async (
  query,
  documentType = null,
  limit = 5,
  similarityThreshold = 0.7
) => {
  try {
    const apiKey = await getOpenAIApiKey();

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        error: 'Query must be a non-empty string'
      };
    }

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Call Supabase Edge Function to perform RAG query
    // Using supabase.functions.invoke() is the proper way to call Edge Functions from the client
    const { data, error } = await supabase.functions.invoke('rag-query', {
      body: {
        query: query,
        userId: user.id,
        documentType: documentType,
        limit: limit,
        similarityThreshold: similarityThreshold,
        apiKey,
      },
    });

    if (error) {
      // Supabase Functions errors can include useful HTTP info.
      // NOTE: In Expo, console.error can show as a big red error overlay even when we recover.
      // We intentionally use warn here because the app cleanly falls back to non-RAG context.
      console.warn('RAG query failed:', {
        message: error.message,
        name: error.name,
        context: error.context,
        stack: error.stack,
      });
      return {
        success: false,
        error: `RAG query failed: ${error.message}`
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'RAG query returned invalid response'
      };
    }

    return {
      success: true,
      results: data.results || [], // Array of relevant context chunks
      count: data.count || 0,
    };

  } catch (error) {
    console.error('Error in queryRAGContext:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * Chunks a workout log into smaller pieces and stores them as embeddings
 * 
 * @param {object} workoutLog - The workout log object from the database
 * @returns {Promise<{success: boolean, chunksStored?: number, error?: string}>}
 * 
 * WHY CHUNK?
 * Workout logs can be long (many exercises, sets, reps). Breaking them into chunks:
 * - Makes embeddings more precise
 * - Allows retrieval of specific parts (e.g., "bench press sets" from a full workout)
 * - Better similarity matching
 * 
 * EXAMPLE:
 * ```javascript
 * const workoutLog = {
 *   id: "workout-123",
 *   workout_name: "Push Day",
 *   exercises: [
 *     { name: "Bench Press", sets: [{ weight: 185, reps: 10 }] },
 *     { name: "Shoulder Press", sets: [{ weight: 135, reps: 8 }] }
 *   ],
 *   completed_at: "2025-01-01T10:00:00Z"
 * };
 * 
 * await chunkAndStoreWorkoutLog(workoutLog);
 * ```
 */
export const chunkAndStoreWorkoutLog = async (workoutLog) => {
  try {
    if (!workoutLog || !workoutLog.id) {
      return {
        success: false,
        error: 'Workout log must have an id'
      };
    }

    let chunksStored = 0;
    const workoutId = workoutLog.id;
    const workoutDate = workoutLog.completed_at || workoutLog.date || new Date().toISOString();

    // CHUNK 1: Workout summary
    // Example: "Push Day workout on 2025-01-01: 2 exercises, 45 minutes"
    const summaryChunk = `${workoutLog.workout_name || 'Workout'} on ${new Date(workoutDate).toLocaleDateString()}: ${
      workoutLog.exercise_count || (workoutLog.exercises?.length || 0)
    } exercises, ${workoutLog.duration || 0} minutes`;
    
    const summaryResult = await storeDocumentEmbedding(
      summaryChunk,
      'workout_log',
      `${workoutId}_summary`,
      {
        workout_name: workoutLog.workout_name,
        date: workoutDate,
        type: 'summary',
      }
    );

    if (summaryResult.success) chunksStored++;

    // CHUNK 2-N: Each exercise as its own chunk
    // This allows queries like "What did I do for bench press?" to find specific exercises
    if (workoutLog.exercises && Array.isArray(workoutLog.exercises)) {
      for (const exercise of workoutLog.exercises) {
        if (!exercise.name) continue;

        // Build exercise description
        // Example: "Bench Press: 3 sets of 10 at 185lbs"
        let exerciseChunk = `${exercise.name}: `;
        if (exercise.sets && Array.isArray(exercise.sets)) {
          const setDescriptions = exercise.sets
            .filter(set => set.weight && set.reps)
            .map(set => `${set.reps} reps at ${set.weight}${set.weight_unit || 'lbs'}`)
            .join(', ');
          
          exerciseChunk += `${exercise.sets.length} sets (${setDescriptions})`;
        }

        const exerciseResult = await storeDocumentEmbedding(
          exerciseChunk,
          'workout_log',
          `${workoutId}_exercise_${exercise.name}`,
          {
            workout_name: workoutLog.workout_name,
            exercise_name: exercise.name,
            date: workoutDate,
            type: 'exercise',
            sets: exercise.sets,
          }
        );

        if (exerciseResult.success) chunksStored++;
      }
    }

    return {
      success: true,
      chunksStored: chunksStored
    };

  } catch (error) {
    console.error('Error in chunkAndStoreWorkoutLog:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * Deletes embeddings for a specific document
 * Useful when updating a document - delete old embeddings and create new ones
 * 
 * @param {string} documentType - Type of document
 * @param {string} documentId - ID of the document
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export const deleteDocumentEmbeddings = async (documentType, documentId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    const { data, error } = await supabase.rpc('delete_document_embeddings', {
      p_user_id: user.id,
      p_document_type: documentType,
      p_document_id: documentId,
    });

    if (error) {
      console.error('Error deleting embeddings:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      deletedCount: data || 0
    };

  } catch (error) {
    console.error('Error in deleteDocumentEmbeddings:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * WHAT HAPPENS IF YOU CHANGE THINGS:
 * 
 * 1. Change embedding model in storeDocumentEmbedding:
 *    - Different models have different dimensions
 *    - Make sure database column matches (vector(1536) for most models)
 * 
 * 2. Change chunking strategy in chunkAndStoreWorkoutLog:
 *    - Smaller chunks = more precise but more database rows
 *    - Larger chunks = fewer rows but less precise matching
 *    - Test to find the right balance
 * 
 * 3. Add batching to storeDocumentEmbedding:
 *    - OpenAI supports up to 2048 texts per request
 *    - More efficient for bulk operations
 *    - Would need to modify Edge Function to accept arrays
 */
// store mood history in rag 


