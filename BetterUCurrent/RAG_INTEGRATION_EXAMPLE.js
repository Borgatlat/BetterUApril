/**
 * RAG Integration Example
 * 
 * This file shows you HOW TO USE RAG in your existing AI functions.
 * It demonstrates integrating RAG into your generateAIResponse function.
 * 
 * BEFORE YOU START:
 * 1. Run the database migration (20250103000000_enable_pgvector_and_rag.sql)
 * 2. Deploy the Edge Functions (create-embedding and rag-query)
 * 3. Set OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY as Supabase secrets
 * 4. Start storing embeddings when data is created/updated
 * 
 * STEP-BY-STEP:
 * 1. When user creates/updates data → store embeddings
 * 2. When generating AI response → query RAG for context
 * 3. Use retrieved context in AI prompt
 */

import { queryRAGContext, chunkAndStoreWorkoutLog } from '../utils/ragUtils';

/**
 * EXAMPLE 1: Updated generateAIResponse with RAG
 * 
 * This is how you would modify your existing generateAIResponse function
 * to use RAG instead of sending all user data.
 * 
 * WHAT CHANGES:
 * - Instead of building a huge contextMessage with ALL user data,
 * - We query RAG to get only RELEVANT context chunks
 * - This saves tokens and gives better results
 */
export const generateAIResponseWithRAG = async (
  userMessage, 
  userData = {}, 
  systemPrompt = '', 
  conversationHistory = []
) => {
  console.log("[AI] Generating AI response with RAG for:", userMessage);

  try {
    // Get API key (same as before)
    const key = await ensureApiKeyAvailable(); // Your existing function

    // NEW: Query RAG for relevant context
    // Instead of sending ALL user data, get only what's relevant to this question
    const ragResult = await queryRAGContext(
      userMessage, // The user's question
      null, // documentType filter (null = search all types)
      5, // Return top 5 most relevant chunks
      0.7 // Minimum similarity score (0-1)
    );

    if (!ragResult.success) {
      console.warn("[AI] RAG query failed, falling back to full context:", ragResult.error);
      // Fallback: if RAG fails, use old method (send all data)
      // This ensures your app still works even if RAG has issues
    }

    // Build context from RAG results
    // Format the retrieved chunks into a readable context string
    let ragContextMessage = '';
    if (ragResult.success && ragResult.results && ragResult.results.length > 0) {
      ragContextMessage = `Relevant User Context (from ${ragResult.results.length} documents):
      
${ragResult.results.map((doc, index) => 
  `${index + 1}. [${doc.documentType}] ${doc.content}`
).join('\n\n')}

Use this context to provide personalized, specific responses.`;
    } else {
      // Fallback: if no RAG results, use basic user profile
      ragContextMessage = `User Profile:
- Name: ${userData.userName || 'User'}
- Training Level: ${userData.trainingLevel || 'Not specified'}
- Goal: ${userData.goals || 'Not specified'}`;
    }

    // Build conversation messages (same as before)
    let conversationMessages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      conversationMessages = conversationHistory;
    } else {
      // Your existing AsyncStorage fallback logic
      // ... (keep your existing code)
    }

    // System prompt (same structure, but now references RAG context)
    const systemPromptText = systemPrompt || `You are a personalized fitness and wellness AI coach. 
Your responses should be highly personalized, detailed, structured, and actionable.

IMPORTANT: Use the provided context chunks to give specific, personalized advice.
Reference specific workouts, PRs, or goals from the context when relevant.
Don't make up data - only use what's provided in the context.`;

    // Build the prompt with RAG context
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPromptText },
        { role: "system", content: ragContextMessage }, // RAG context instead of all data
        ...conversationMessages,
        { role: "user", content: userMessage },
      ].filter(Boolean),
      max_tokens: 1000,
      temperature: 0.7,
    };

    // Call OpenAI (same as before)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API request failed: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return {
        success: false,
        error: "Invalid response format from AI service"
      };
    }

    return {
      success: true,
      response: data.choices[0].message.content
    };

  } catch (error) {
    console.error("[AI] Error in generateAIResponseWithRAG:", error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

/**
 * EXAMPLE 2: Store workout log as embeddings
 * 
 * Call this AFTER a workout is completed and saved to the database.
 * This stores the workout as searchable embeddings.
 * 
 * WHERE TO CALL THIS:
 * - In your workout completion handler
 * - After saving workout to user_workout_logs table
 */
export const storeWorkoutLogEmbedding = async (workoutLog) => {
  try {
    // Delete old embeddings for this workout (if updating)
    if (workoutLog.id) {
      await deleteDocumentEmbeddings('workout_log', workoutLog.id);
    }

    // Chunk and store the workout log
    // This breaks it into pieces (summary + each exercise) and stores each as an embedding
    const result = await chunkAndStoreWorkoutLog(workoutLog);
    
    if (result.success) {
      console.log(`[RAG] Stored ${result.chunksStored} chunks for workout log`);
    } else {
      console.warn(`[RAG] Failed to store workout log embeddings:`, result.error);
      // Don't throw error - RAG is optional, app should still work without it
    }

    return result;
  } catch (error) {
    console.error('[RAG] Error storing workout log embedding:', error);
    // Don't throw - RAG failures shouldn't break the app
    return { success: false, error: error.message };
  }
};

/**
 * EXAMPLE 3: Store PR as embedding
 * 
 * Call this when a user sets or updates a Personal Record.
 */
export const storePREmbedding = async (prData) => {
  try {
    const { storeDocumentEmbedding, deleteDocumentEmbeddings } = await import('../utils/ragUtils');

    // Delete old embedding if updating
    if (prData.id) {
      await deleteDocumentEmbeddings('pr', prData.id);
    }

    // Build PR description
    // Example: "Bench Press PR: 225lbs on 2025-01-01"
    const prContent = `${prData.exercise_name || prData.exercise} PR: ${prData.weight || prData.value}${prData.unit || 'lbs'} on ${new Date(prData.date || new Date()).toLocaleDateString()}`;

    const result = await storeDocumentEmbedding(
      prContent,
      'pr',
      prData.id?.toString() || `pr-${prData.exercise_name || prData.exercise}`,
      {
        exercise: prData.exercise_name || prData.exercise,
        weight: prData.weight || prData.value,
        unit: prData.unit || 'lbs',
        date: prData.date || new Date().toISOString(),
      }
    );

    if (result.success) {
      console.log(`[RAG] Stored PR embedding: ${prContent}`);
    }

    return result;
  } catch (error) {
    console.error('[RAG] Error storing PR embedding:', error);
    return { success: false, error: error.message };
  }
};

/**
 * EXAMPLE 4: Store goal as embedding
 * 
 * Call this when user sets or updates their fitness goal.
 */
export const storeGoalEmbedding = async (goalData) => {
  try {
    const { storeDocumentEmbedding, deleteDocumentEmbeddings } = await import('../utils/ragUtils');

    // Delete old embedding if updating
    await deleteDocumentEmbeddings('goal', 'user-goal');

    // Build goal description
    const goalContent = `Fitness Goal: ${goalData.goal || goalData.description}. Training Level: ${goalData.training_level || 'Not specified'}.`;

    const result = await storeDocumentEmbedding(
      goalContent,
      'goal',
      'user-goal',
      {
        goal: goalData.goal || goalData.description,
        training_level: goalData.training_level,
        date: new Date().toISOString(),
      }
    );

    return result;
  } catch (error) {
    console.error('[RAG] Error storing goal embedding:', error);
    return { success: false, error: error.message };
  }
};

/**
 * INTEGRATION CHECKLIST:
 * 
 * ✅ Step 1: Database migration run
 * ✅ Step 2: Edge Functions deployed
 * ✅ Step 3: Secrets configured
 * 
 * Step 4: Update workout completion handler
 *   - After saving workout log, call storeWorkoutLogEmbedding()
 * 
 * Step 5: Update PR creation/update handlers
 *   - After saving PR, call storePREmbedding()
 * 
 * Step 6: Update goal creation/update handlers
 *   - After saving goal, call storeGoalEmbedding()
 * 
 * Step 7: Update generateAIResponse
 *   - Replace context building with queryRAGContext()
 *   - Use retrieved chunks in prompt
 * 
 * Step 8: Test!
 *   - Complete a workout
 *   - Ask AI: "What workout should I do today?"
 *   - Check if AI references your recent workouts
 */

/**
 * WHAT HAPPENS IF YOU CHANGE THINGS:
 * 
 * 1. Change limit from 5 to 10 in queryRAGContext:
 *    - More context chunks = more tokens = higher cost
 *    - But might give better, more comprehensive responses
 *    - Test to find the sweet spot
 * 
 * 2. Change similarityThreshold from 0.7 to 0.5:
 *    - Lower threshold = more results (even less similar ones)
 *    - Might include irrelevant context
 *    - Higher threshold (0.8) = fewer, more precise results
 * 
 * 3. Store embeddings in background vs. immediately:
 *    - Immediate: User waits for embedding to complete (slower UX)
 *    - Background: Store async, don't block user (better UX)
 *    - Recommendation: Store in background, handle errors gracefully
 * 
 * 4. Batch embedding creation:
 *    - OpenAI supports up to 2048 texts per request
 *    - More efficient for bulk operations
 *    - Useful when migrating existing data to RAG
 */
