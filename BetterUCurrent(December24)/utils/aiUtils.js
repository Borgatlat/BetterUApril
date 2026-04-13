import { getOpenAIApiKey, ensureApiKeyAvailable } from "./apiConfig"
import { useUser } from "../context/UserContext"
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from "../lib/supabase";
import {queryRAGContext} from "./ragUtils";
/**
 * Suggests a weight for an exercise based on PRs and profile data
 * @param {string} exerciseName - Name of the exercise
 * @param {Array} personalRecords - User's personal records
 * @param {object} userProfile - User's profile data
 * @param {number} targetReps - Target reps for the set (to calculate appropriate weight)
 * @returns {Promise<{weight: string, source: string}>} - Suggested weight and source
 */
export const suggestWeightForExercise = async (exerciseName, personalRecords, userProfile, targetReps = 10, userId = null) => {
  try {
    // Enhanced normalization for better matching
    const normalizeName = (name) => {
      return name.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
    };
    
    // Check if exercise is bodyweight-only
    const isBodyweightExercise = (name) => {
      const normalized = normalizeName(name);
      const bodyweightKeywords = [
        'burpee', 'push up', 'pushup', 'sit up', 'situp', 'pull up', 'pullup', 'chin up', 'chinup',
        'dip', 'plank', 'mountain climber', 'jumping jack', 'jump jack', 'lunge', 'squat jump',
        'air squat', 'box jump', 'pistol squat', 'handstand', 'muscle up', 'wall sit',
        'crunches', 'abs', 'abdominal', 'leg raise', 'flutter kick', 'bicycle crunch',
        'v up', 'russian twist', 'hip thrust', 'bridge', 'superman', 'bird dog',
        'bear crawl', 'crab walk', 'shrimp squat', 'nordic curl', 'single leg',
        'bodyweight squat', 'bodyweight', 'calisthenics', 'stretch', 'yoga'
      ];
      
      // Check if any bodyweight keyword is in the exercise name
      return bodyweightKeywords.some(keyword => normalized.includes(keyword));
    };
    
    // Return early for bodyweight exercises
    if (isBodyweightExercise(exerciseName)) {
      return {
        weight: '0',
        source: 'Bodyweight exercise (no weight needed)',
        isBodyweight: true
      };
    }
    
    // Extract exercise type (bench press, squat, etc.)
    const getExerciseKeywords = (name) => {
      const normalized = normalizeName(name);
      const keywords = [];
      if (normalized.includes('bench')) keywords.push('bench', 'press');
      if (normalized.includes('squat')) keywords.push('squat');
      if (normalized.includes('deadlift') || normalized.includes('dead')) keywords.push('deadlift');
      if (normalized.includes('press') && !normalized.includes('bench')) keywords.push('press');
      if (normalized.includes('row')) keywords.push('row');
      if (normalized.includes('curl')) keywords.push('curl');
      if (normalized.includes('pull') || normalized.includes('chin')) keywords.push('pull', 'chin');
      if (normalized.includes('raise')) keywords.push('raise');
      return keywords.length > 0 ? keywords : [normalized];
    };
    
    const exerciseKeywords = getExerciseKeywords(exerciseName);
    const normalizedExercise = normalizeName(exerciseName);
    
    // Find matching PR with better matching logic
    const matchingPR = personalRecords?.find(pr => {
      if (pr.exercise_type !== 'weight') return false;
      const normalizedPR = normalizeName(pr.exercise_name);
      const prKeywords = getExerciseKeywords(pr.exercise_name);
      
      // Exact match
      if (normalizedPR === normalizedExercise) return true;
      
      // Keyword match (at least 2 keywords match)
      const matchingKeywords = exerciseKeywords.filter(k => 
        prKeywords.some(pk => pk.includes(k) || k.includes(pk))
      );
      if (matchingKeywords.length >= 2) return true;
      
      // Substring match for similar exercises
      if (normalizedPR.includes(normalizedExercise) || normalizedExercise.includes(normalizedPR)) {
        return true;
      }
      
      return false;
    });
    
    // Helper function to fetch recent workout history for learning
    const fetchRecentWorkoutHistory = async () => {
      if (!userId) return [];
      try {
        // Fetch last 10 workouts to analyze performance
        const { data, error } = await supabase
          .from('user_workout_logs')
          .select('exercises, completed_at')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.warn('[suggestWeightForExercise] Error fetching workout history:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('[suggestWeightForExercise] Error fetching workout history:', err);
        return [];
      }
    };
    
    // Helper function to analyze recent performance for the exercise
    const analyzeRecentPerformance = (workoutHistory) => {
      const normalizedExercise = normalizeName(exerciseName);
      let recentWeights = [];
      
      // Loop through workout history to find this exercise
      workoutHistory.forEach(workout => {
        if (!workout.exercises || !Array.isArray(workout.exercises)) return;
        
        workout.exercises.forEach(ex => {
          const exName = normalizeName(ex.name || '');
          if (exName === normalizedExercise || exName.includes(normalizedExercise) || normalizedExercise.includes(exName)) {
            // Extract weight and reps from sets
            if (ex.sets && Array.isArray(ex.sets)) {
              ex.sets.forEach(set => {
                if (set.completed && set.weight && set.reps) {
                  const weight = parseFloat(set.weight);
                  const reps = parseInt(set.reps) || parseInt(set.reps.split('-')[0]);
                  if (!isNaN(weight) && !isNaN(reps) && weight > 0) {
                    recentWeights.push({ weight, reps, date: workout.completed_at });
                    // Estimate RPE from completion (if we had RPE data, we'd use it)
                    // For now, if they completed all sets easily, assume lower RPE
                    // This is a simplified approach - in reality, we'd need RPE data
                  }
                }
              });
            }
          }
        });
      });
      
      // Calculate average weight trend (if weights increased, adjust up; if decreased, adjust down)
      if (recentWeights.length >= 2) {
        const sortedWeights = recentWeights.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recent = sortedWeights[0].weight;
        const previous = sortedWeights[1].weight;
        const trend = recent > previous ? 0.02 : recent < previous ? -0.02 : 0;
        return { trend, recentWeight: recent };
      }
      
      return { trend: 0, recentWeight: null };
    };
    
    if (matchingPR && matchingPR.current_weight_kg) {
      // Convert kg to lbs (assuming app uses lbs)
      const prWeightLbs = (matchingPR.current_weight_kg * 2.20462);
      
      // Step 1: Estimate 1RM using Epley formula
      // Assume PR is for 1-3 reps (close to 1RM), estimate true 1RM
      // If we had exact rep data: 1RM = weight × (1 + reps/30)
      // For now, assume PR is conservative (around 95% of 1RM)
      let estimated1RM = prWeightLbs / 0.95;
      
      // Step 2: Map fitness goal to training type and get goal-based percentage
      const fitnessGoal = userProfile?.fitness_goal || userProfile?.goal || 'muscle_growth';
      const trainingGoal = {
        'strength': 'strength',
        'muscle_growth': 'hypertrophy',
        'athleticism': 'endurance',
        'wellness': 'endurance'
      }[fitnessGoal] || 'hypertrophy';
     
      // Goal-based percentage of 1RM (research-based)
      // Strength: 85-95% (1RM), Hypertrophy: 65-80%, Endurance: 55-70%
      const targetRepsNum = typeof targetReps === 'string' ? parseInt(targetReps) || 10 : targetReps;
      let goalPercentage = 0.75; // Default hypertrophy
      
      if (trainingGoal === 'strength') {
        if (targetRepsNum <= 3) goalPercentage = 0.95;
        else if (targetRepsNum <= 5) goalPercentage = 0.90;
        else goalPercentage = 0.85;
      } else if (trainingGoal === 'hypertrophy') {
        if (targetRepsNum <= 8) goalPercentage = 0.80;
        else if (targetRepsNum <= 12) goalPercentage = 0.75;
        else goalPercentage = 0.70;
      } else { // endurance
        if (targetRepsNum <= 15) goalPercentage = 0.65;
        else goalPercentage = 0.60;
      }
      
      // Step 3: Calculate target weight based on 1RM and goal
      const targetWeight = estimated1RM * goalPercentage;
      
      // Step 4: Apply experience level correction factor
      const trainingLevel = userProfile?.training_level || userProfile?.trainingLevel || 'intermediate';
      const experienceFactor = {
        'beginner': 0.90,
        'intermediate': 1.0,
        'advanced': 1.05
      }[trainingLevel] || 1.0;
      
      let adjustedWeight = targetWeight * experienceFactor;
      
      // Step 5: Fetch workout history and apply AI adaptive modifier
      let aiAdjustment = 0;
      try {
        const workoutHistory = await fetchRecentWorkoutHistory();
        const performance = analyzeRecentPerformance(workoutHistory);
        
        // Use trend from recent workouts (if weight increased, suggest slightly more)
        aiAdjustment = performance.trend;
        
        // If we have recent weight data for this exercise, use it as reference
        if (performance.recentWeight) {
          // Blend recent weight (70%) with calculated weight (30%) for better adaptation
          adjustedWeight = adjustedWeight * 0.3 + performance.recentWeight * 0.7;
        }
      } catch (err) {
        console.warn('[suggestWeightForExercise] Error analyzing performance:', err);
      }
      
      // Apply AI adjustment
      adjustedWeight = adjustedWeight * (1 + aiAdjustment);
      
      // Step 6: Add small randomized variation (±1%) for periodization
      const variation = (Math.random() * 0.02 - 0.01); // ±1%
      adjustedWeight = adjustedWeight * (1 + variation);
      
      // Step 7: Round to nearest 5 lbs (standard plate increments)
      const roundedWeight = Math.round(adjustedWeight / 5) * 5;
      
      // Step 8: Apply safety bounds (25-95% of PR)
      const minWeight = Math.round(prWeightLbs * 0.25);
      const maxWeight = Math.round(prWeightLbs * 0.95);
      const finalWeight = Math.max(minWeight, Math.min(roundedWeight, maxWeight));
      
      return {
        weight: finalWeight.toString(),
        source: 'PR-based (enhanced)'
      };
    }
    
    // No PR found - use AI to suggest based on profile
    if (userProfile) {
      const trainingLevel = userProfile.training_level || userProfile.trainingLevel || 'intermediate';
      const gender = userProfile.gender || 'unknown';
      const age = userProfile.age || 25;
      const weight = userProfile.weight || 70; // Body weight in kg
      
      const key = await getOpenAIApiKey();
      if (!key) {
        // Fallback calculation based on body weight and exercise type
        return calculateFallbackWeight(exerciseName, weight, trainingLevel, targetReps);
      }
      
      // Get body weight in lbs for better context
      const bodyWeightLbs = (weight * 2.20462).toFixed(1);
      
      const systemPrompt = `You are an expert strength and conditioning coach. Suggest an appropriate starting weight in pounds for a working set.

Exercise: ${exerciseName}
User profile:
- Training level: ${trainingLevel}
- Gender: ${gender}
- Age: ${age} years old
- Body weight: ${bodyWeightLbs} lbs (${weight} kg)
- Target reps: ${targetReps}

Use scientifically-validated strength standards (NSCA guidelines):
1. Bench Press: Beginners 0.5x, Intermediate 0.7x, Advanced 0.9x bodyweight
2. Squat: Beginners 0.7x, Intermediate 0.9x, Advanced 1.3x bodyweight
3. Deadlift: Beginners 0.9x, Intermediate 1.2x, Advanced 1.6x bodyweight
4. Overhead Press: Beginners 0.35x, Intermediate 0.5x, Advanced 0.65x bodyweight
5. Row: Beginners 0.45x, Intermediate 0.6x, Advanced 0.8x bodyweight
6. Rep range adjustments: 1-5 reps (100% of estimated max), 6-8 reps (95%), 9-10 reps (90%), 11-12 reps (85%), 12+ reps (75%)
7. Be conservative for working sets - suggest 90% of calculated max for safety and multiple sets
8.Return ONLY a JSON object with the weight: {"weight": 135}

No explanation, just the number.`;
      
      const payload = {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Suggest a weight for: ${exerciseName}` }
        ],
        max_tokens: 50,
        temperature: 0.3,
      };
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.weight) {
            // Round to nearest 5 lbs (standard plate increments)
            const roundedWeight = Math.round(parsed.weight / 5) * 5;
            return {
              weight: roundedWeight.toString(),
              source: 'AI-suggested'
            };
          }
        } catch (e) {
          // Try to extract number from text
          const match = content.match(/(\d+)/);
          if (match) {
            // Round to nearest 5 lbs
            const weightNum = parseInt(match[1]);
            const roundedWeight = Math.round(weightNum / 5) * 5;
            return {
              weight: roundedWeight.toString(),
              source: 'AI-suggested'
            };
          }
        }
      }
    }
    
    // Final fallback
    return calculateFallbackWeight(exerciseName, userProfile?.weight || 70, 
                                   userProfile?.training_level || 'intermediate', targetReps);
    
  } catch (error) {
    console.error('[Weight Suggestion] Error:', error);
    return calculateFallbackWeight(exerciseName, userProfile?.weight || 70, 
                                   userProfile?.training_level || 'intermediate', targetReps);
  }
};

/**
 * Fallback weight calculation based on body weight percentages
 */
const calculateFallbackWeight = (exerciseName, bodyWeightKg, trainingLevel, targetReps) => {
  const bodyWeightLbs = bodyWeightKg * 2.20462;
  const normalizedExercise = exerciseName.toLowerCase();
  
  // Research-based bodyweight percentages for intermediate lifters (8-10 rep range)
  // Based on strength training research and NSCA guidelines
  let basePercentage = 0.50; // Default 50% of body weight
  
  // Lower body compound (these incorporate bodyweight contribution in squat/deadlift)
  if (normalizedExercise.includes('squat')) {
    // Squat: bodyweight contributes ~77% of total load, typical intermediate lifts 0.8-1.2x bodyweight
    basePercentage = 0.90;
  } else if (normalizedExercise.includes('deadlift')) {
    // Deadlift: bodyweight contributes less, typical intermediate lifts 1.0-1.5x bodyweight
    basePercentage = 1.20;
  } else if (normalizedExercise.includes('leg press')) {
    // Leg press: no bodyweight contribution, typically 2-3x bodyweight
    basePercentage = 2.00;
  } else if (normalizedExercise.includes('leg curl')) {
    basePercentage = 0.25;
  } else if (normalizedExercise.includes('leg extension')) {
    basePercentage = 0.35;
  
  // Upper body compound - pushing
  } else if (normalizedExercise.includes('bench') && !normalizedExercise.includes('incline')) {
    // Bench press: typical intermediate lifts 0.6-0.85x bodyweight
    basePercentage = 0.70;
  } else if (normalizedExercise.includes('incline') || normalizedExercise.includes('dumbbell press')) {
    // Incline/DB press: slightly less than flat bench
    basePercentage = 0.55;
  } else if ((normalizedExercise.includes('press') || normalizedExercise.includes('shoulder')) && !normalizedExercise.includes('dumbbell') && !normalizedExercise.includes('bench')) {
    // Overhead press: typical intermediate lifts 0.4-0.6x bodyweight
    basePercentage = 0.50;
  } else if (normalizedExercise.includes('dumbbell') && (normalizedExercise.includes('press') || normalizedExercise.includes('shoulder'))) {
    // DB shoulder press: per dumbbell
    basePercentage = 0.30;
  
  // Upper body compound - pulling
  } else if (normalizedExercise.includes('row') && !normalizedExercise.includes('upright')) {
    // Barbell/dumbbell row: typical intermediate lifts 0.5-0.7x bodyweight
    basePercentage = 0.60;
  } else if (normalizedExercise.includes('pull') || normalizedExercise.includes('chin') || normalizedExercise.includes('lat')) {
    // Pull-up variations: bodyweight exercise
    return { weight: '0', source: 'Calculated (bodyweight)' };
  
  // Isolation exercises
  } else if (normalizedExercise.includes('curl')) {
    // Bicep curls: typical 0.10-0.20x bodyweight
    basePercentage = 0.14;
  } else if (normalizedExercise.includes('tricep')) {
    // Tricep extensions: typical 0.12-0.22x bodyweight
    basePercentage = 0.18;
  } else if (normalizedExercise.includes('raise') && (normalizedExercise.includes('lateral') || normalizedExercise.includes('front') || normalizedExercise.includes('side'))) {
    // Lateral/front raises: very light
    basePercentage = 0.08;
  } else if (normalizedExercise.includes('fly')) {
    // Chest fly: typical 0.15-0.25x bodyweight
    basePercentage = 0.20;
  }
  
  // Training level multipliers (based on NSCA strength standards)
  // Beginner = ~60-70% of intermediate, Advanced = ~110-120% of intermediate
  const levelMultiplier = {
    'beginner': 0.65,
    'intermediate': 0.85,
    'advanced': 1.10
  }[trainingLevel] || 0.85;
  
  // Rep range adjustment using research-based percentages
  // Higher reps require lower percentage of max capacity
  const targetRepsNum = typeof targetReps === 'string' ? parseInt(targetReps) || 10 : targetReps;
  let repMultiplier = 1.0;
  
  if (targetRepsNum <= 5) repMultiplier = 1.10; // Can lift more for fewer reps
  else if (targetRepsNum <= 8) repMultiplier = 1.05; // Slightly more for 6-8 reps
  else if (targetRepsNum <= 10) repMultiplier = 1.0; // Baseline for 9-10 reps
  else if (targetRepsNum <= 12) repMultiplier = 0.93; // Less for 11-12 reps
  else repMultiplier = 0.87; // Even less for 12+ reps
  
  // Calculate suggested weight
  let suggestedWeight = bodyWeightLbs * basePercentage * levelMultiplier * repMultiplier;
  
  // Round to nearest 5 lbs (standard plate increments)
  let roundedWeight = Math.round(suggestedWeight / 5) * 5;
  
  // Ensure minimum of 5lbs for weighted exercises
  const finalWeight = Math.max(5, roundedWeight);
  
  return {
    weight: finalWeight.toString(),
    source: 'Calculated'
  };
};

/**
 * Format personal records for AI context (so the model can mention e.g. max bench).
 * Handles common shapes: { exercise_name, value, reps, unit, exercise_type }.
 */
function formatPRsForContext(prs) {
  if (!prs || !Array.isArray(prs) || prs.length === 0) return 'No personal records';
  return prs.map(pr => {
    const name = pr.exercise_name || pr.name || 'Unknown';
    const val = pr.value != null ? pr.value : pr.weight;
    const reps = pr.reps != null ? ` × ${pr.reps} reps` : '';
    const unit = pr.unit || (pr.exercise_type === 'weight' ? 'lbs' : '');
    return val != null ? `${name}: ${val}${unit ? ' ' + unit : ''}${reps}` : name;
  }).join(', ');
}

/**
 * Generates an AI response using the OpenAI API
 * @param {string} userMessage - The user's message to generate a response for
 * @param {object} userData - The user's full data (profile, stats, history, PRs, goals, mood, etc)
 * @param {string} systemPrompt - The system prompt for the AI
 * @returns {Promise<{success: boolean, response?: string, error?: string}>} - The result object
 */
export const generateAIResponse = async (userMessage, userData = {}, systemPrompt = '', conversationHistory = []) => {
  console.warn('=== AI TRAINER MESSAGE SENT: generateAIResponse CALLED ===');
  console.warn('[AI] generateAIResponse called');
  console.log("[AI] Generating AI response for:", userMessage)

  try {
    // Fallback responses for development/demo
    const fallbackResponses = [
      "I understand you want to know about fitness. Let me help you with that!",
      "That's a great question about health and wellness. Here's what I think...",
      "I can help you with your fitness journey. Let's work on that together!",
      "Thanks for asking! Here's my suggestion for your workout routine...",
      "I'm here to support your fitness goals. Let's break this down..."
    ];

    // Get a random fallback response
    const fallbackResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    // Get the API key - always available from hardcoded source
    let key = await ensureApiKeyAvailable();
    console.log("[AI] API Key status: Always available (hardcoded)");

    // Use passed conversation history or fallback to AsyncStorage
    let conversationMessages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      conversationMessages = conversationHistory;
    } else {
      // Fallback to loading from AsyncStorage (for backward compatibility)
      try {
        const storedConversations = await AsyncStorage.getItem('trainerConversations');
        if (storedConversations) {
          const history = JSON.parse(storedConversations);
          conversationMessages = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.message
          }));
        }
      } catch (error) {
        console.error("[AI] Error loading conversation history:", error);
      }
    }

    /**
     * RAG (Retrieval-Augmented Generation) CONTEXT BUILDING
     * 
     * WHAT IS RAG?
     * RAG is like having a smart filing system. Instead of giving the AI ALL your data 
     * (which is expensive and overwhelming), RAG searches for ONLY the MOST RELEVANT 
     * pieces of information based on the user's question.
     * 
     * HOW IT WORKS:
     * 1. User asks: "What workout should I do today?"
     * 2. RAG searches your database for similar questions/data
     * 3. Returns only 3-5 relevant chunks (e.g., recent workouts, PRs, goals)
     * 4. AI uses these chunks to give a specific, personalized response
     * 
     * WHY USE RAG?
     * - Saves money (fewer tokens = lower cost)
     * - More accurate (focused context, not everything)
     * - References specific data ("Last week you did 185lbs bench press")
     * - Works even with thousands of workout logs
     */

    // Initialize variables to track context building
    let contextMessage = ''; // This will hold the context we send to the AI
    let ragContextUsed = false; // Flag to track if we successfully used RAG

    // STEP 1: Try to use RAG (Retrieval-Augmented Generation)
    // This searches for ONLY relevant context chunks instead of sending all data
    try {
      // Query RAG to find relevant context chunks
      // queryRAGContext takes 4 parameters:
      // 1. userMessage - The user's question (used to find similar/relevant data)
      // 2. null - documentType filter (null = search all types: workouts, PRs, goals, etc.)
      // 3. 5 - How many chunks to return (top 5 most relevant)
      // 4. 0.7 - Similarity threshold (0-1, higher = more strict matching)
      const ragResult = await queryRAGContext(
        userMessage, // The user's question
        null,        // Search all document types
        5,           // Return top 5 most relevant chunks
        0.7          // Minimum similarity score (70% similarity required)
      );

      // Check if RAG query was successful AND found results
      if (ragResult.success && ragResult.results && ragResult.results.length > 0) {//
        // Format the RAG results into a readable context string
        // Map through each result and format it nicely
        const ragContextParts = ragResult.results.map((doc, index) => {//cdco
          // Extract date if available and format it nicely
          const date = doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : '';//maps the date fo the doc
          
          // Return formatted string: "1. [workout_log] Bench Press: 3 sets of 10 at 185lbs (1/1/2025)"
          return `${index + 1}. [${doc.documentType}] ${doc.content}${date ? ` (${date})` : ''}`;
        });

        // Build the final context message from RAG results
        contextMessage = `Relevant User Context (from ${ragResult.results.length} documents):
        
${ragContextParts.join('\n\n')}

Use this context to provide personalized, specific responses. Reference specific workouts, PRs, or goals from the context when relevant. Don't make up data - only use what's provided in the context.`;
        
        // Mark that we successfully used RAG
        ragContextUsed = true;
        console.log('[AI] Using RAG context:', ragResult.results.length, 'chunks found');
      } else {
        console.log('[AI] RAG query returned no results, will use fallback');
      }
    } catch (ragError) {
      // If RAG fails (e.g., Edge Function not deployed, database error, etc.)
      // Log the error but don't crash - we'll use fallback instead
      console.warn('[AI] RAG query failed, falling back to full context:', ragError.message);
      // ragContextUsed stays false, so we'll use fallback
    }

    // STEP 2: Fallback to old method (send all user data)
    // Only use this if RAG didn't work or returned no results
    if (!ragContextUsed && userData && Object.keys(userData).length > 0) {
      const prsText = formatPRsForContext(userData.prs);
      contextMessage = `Detailed User Profile Context (use this data to personalize responses):

User Name: ${userData.userName || 'User'}
Age: ${userData.age || 'Not specified'}
Gender: ${userData.gender || 'Not specified'}
Weight: ${userData.weight || 'Not specified'} ${userData.weight ? 'kg' : ''}
Height: ${userData.height || 'Not specified'} ${userData.height ? 'cm' : ''}
Training Level: ${userData.trainingLevel || 'Not specified'}
Fitness Goal: ${userData.goals || 'Not specified'}
Bio: ${userData.bio || 'Not specified'}
Current Mood: ${userData.mood || 'Not specified'}

Workout History: ${userData.allTimeWorkoutHistory ? userData.allTimeWorkoutHistory.length + ' sessions' : 'No data'}
Mental Session History: ${userData.allTimeMentalHistory ? userData.allTimeMentalHistory.length + ' sessions' : 'No data'}
Personal Records (use these when discussing strength/progress): ${prsText}

Full Profile Data: ${JSON.stringify(userData.profile, null, 2)}`;

      console.log('[AI] Using fallback context (all user data)');
    }

    // Prepare the request payload
    const systemPrompt = `You are a personalized fitness and wellness AI coach. Your responses should be highly personalized, detailed, structured, and actionable. Follow these guidelines:

1. ALWAYS address the user by their name when appropriate
2. Start with a brief, empathetic introduction that acknowledges the user's question/concern
3. Break down your response into clear, numbered sections with descriptive headers
4. Use bullet points for specific recommendations or steps
5. Include specific numbers, ranges, and actionable advice tailored to their profile
6. Reference the user's specific data when relevant (age, weight, height, training level, goals, history, PRs, mood)
7. End with a motivating conclusion and next steps
8. Keep responses comprehensive but well-organized
9. Use markdown formatting for better readability
10. Make recommendations specific to their training level and fitness goals

Example structure:
- Brief intro acknowledging the question and using their name
- Main sections with numbered headers
- Bullet points for specific recommendations tailored to their profile
- Specific numbers and ranges appropriate for their level
- Actionable steps considering their current situation
- Motivating conclusion

IMPORTANT: Always personalize your responses based on the user's specific profile data, training level, and goals. Reference their actual data when discussing progress, making recommendations, or providing motivation.`;

    const payload = {
      model: process.env.EXPO_PUBLIC_FINETUNED_TRAINER_MODEL || "gpt-3.5-turbo",
      messages: [
        systemPrompt ? { role: "system", content: systemPrompt } : { role: "system", content: "You are an AI fitness trainer assistant. You provide helpful, encouraging, and accurate advice about workouts, nutrition, and fitness goals. Keep your responses concise and focused on fitness advice. Always maintain context from previous messages in the conversation." },
        contextMessage ? { role: "system", content: contextMessage } : null,
        ...conversationMessages,
        { role: "user", content: userMessage },
      ].filter(Boolean),
      max_tokens: 1000,
      temperature: 0.7,
    };
    console.log("[AI] OpenAI request payload:", JSON.stringify(payload, null, 2));

    // Create the request to OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    })

    console.log("[AI] OpenAI API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("[AI] OpenAI API error:", errorText);
      return {
        success: false,
        error: `API request failed: ${response.status} - ${errorText}`
      }
    }

    const data = await response.json()
    console.log("[AI] OpenAI API raw response:", JSON.stringify(data, null, 2));
    if (!data.choices || !data.choices[0]?.message?.content) {
      console.log("[AI] Invalid API response format")
      return {
        success: false,
        error: "Invalid response format from AI service"
      }
    }

    return {
      success: true,
      response: data.choices[0].message.content
    }
  } catch (error) {
    console.error("[AI] Error in generateAIResponse:", error)
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    }
  }
};

/**
 * Generates a personalized workout using the OpenAI API
 * @param {object} userData - The user's profile data (training level, goals, etc)
 * @returns {Promise<{success: boolean, workout?: object, error?: string}>} - The result object
 */
export const generateWorkout = async (userData = {}) => {
  console.log("[AI] Generating workout for user:", userData);

  try {
    // Get the API key
    const key = await getOpenAIApiKey();
    if (!key) {
      console.log("[AI] No API key available for workout generation");
      return {
        success: false,
        error: "API key not available"
      };
    }

    // Engagement-aware prompt: when engagement is low, ask for short/easy "get back on track" workouts
    const engagementContext = userData.engagementContext || {};
    const isLowEngagement = engagementContext.level === 'low';

    let systemPrompt = `You are an expert fitness trainer creating personalized workouts. 
    Create a workout based on the user's profile data and their specific request. 
    The workout should include:
    - A name
    - A list of 5-6 exercises
    - For each exercise: name, target muscles, detailed step-by-step instructions, and sets/reps
    - Format the response as a JSON object with this exact structure:
    {
      "name": "Workout Name",
      "exercises": [
        {
          "name": "Exercise Name",
          "target_muscles": "Primary Muscles (e.g., Chest, Shoulders, Triceps)",
          "instructions": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
          "sets": 3,
          "reps": "8-12"
        }
      ]
    }
    - Instructions MUST be an array of clear, step-by-step strings (3-6 steps)
    - Each instruction should be a complete sentence describing one specific action
    - Include proper form cues and safety tips
    - Keep exercises appropriate for the user's training level
    - Use rep ranges that match the user's fitness_goal: strength → 3-6 reps per set, heavy weight, compound-focused; muscle_growth → 8-12 reps (hypertrophy), moderate weight; athleticism → mixed rep ranges (e.g. 6-10), power and conditioning; wellness → 10-15+ reps, lower intensity, mobility-friendly. If no fitness_goal is given, default to 8-12 reps (hypertrophy).
    - Return ONLY the JSON object, no other text`;

    if (isLowEngagement) {
      systemPrompt += `

    IMPORTANT: The user has been inconsistent recently. Create a SHORT, ACHIEVABLE workout to help them get back on track: 3-4 exercises, about 20-25 minutes total, moderate intensity. Emphasize that any movement counts and this is about building the habit back. Prefer bodyweight or minimal equipment if possible.`;
    }

    const customPrompt = userData.custom_prompt || 'a personalized workout';
    const userMessage = `fitness_goal: ${userData.fitness_goal || 'general fitness'}. Generate a workout with rep ranges and intensity appropriate for this goal. User profile: ${JSON.stringify(userData)}. The user specifically wants: ${customPrompt}`;

    // Prepare the request payload
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    };

    // Make the API call
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
      console.error("[AI] Workout generation failed:", errorText);
      return {
        success: false,
        error: "Failed to generate workout"
      };
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return {
        success: false,
        error: "Invalid response from AI"
      };
    }

    // Parse the workout data from the response
    try {
      const workoutData = JSON.parse(data.choices[0].message.content);
      
      // Normalize exercise data - ensure instructions is an array and targetMuscles is set
      if (workoutData.exercises && Array.isArray(workoutData.exercises)) {
        workoutData.exercises = workoutData.exercises.map(exercise => ({
          ...exercise,
          // Handle both target_muscles and targetMuscles
          targetMuscles: exercise.targetMuscles || exercise.target_muscles || 'Various',
          // Ensure instructions is always an array
          instructions: Array.isArray(exercise.instructions) 
            ? exercise.instructions 
            : exercise.instructions 
            ? [exercise.instructions]
            : ['Start position', 'Perform movement with proper form', 'Return to start']
        }));
      }
      
      return {
        success: true,
        workout: workoutData
      };
    } catch (parseError) {
      console.error("[AI] Failed to parse workout data:", parseError);
      return {
        success: false,
        error: "Failed to parse workout data"
      };
    }
  } catch (error) {
    console.error("[AI] Error in generateWorkout:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generates exercise instructions for exercises not in the library
 * @param {string} exerciseName - The name of the exercise
 * @returns {Promise<{success: boolean, exercise?: object, error?: string}>}
 */
export const generateExerciseInstructions = async (exerciseName) => {
  try {
    const key = await getOpenAIApiKey();
    if (!key) {
      return {
        success: false,
        error: "API key not available"
      };
    }

    const systemPrompt = `You are an expert fitness trainer providing clear, step-by-step exercise instructions.
    For the given exercise, provide:
    - Target muscles (main muscles worked)
    - 4-6 detailed step-by-step instructions
    
    Format as JSON:
    {
      "name": "Exercise Name",
      "targetMuscles": "Primary Muscles",
      "instructions": ["Step 1", "Step 2", "Step 3", "Step 4"]
    }
    
    Instructions should be clear, actionable, and include form cues. Return ONLY the JSON object.`;

    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Provide instructions for: ${exerciseName}` }
      ],
      max_tokens: 500,
      temperature: 0.7,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to generate instructions" };
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return { success: false, error: "Invalid response from AI" };
    }

    try {
      const exerciseData = JSON.parse(data.choices[0].message.content);
      return { success: true, exercise: exerciseData };
    } catch (parseError) {
      console.error("[AI] Failed to parse exercise instructions:", parseError);
      return { success: false, error: "Failed to parse instructions" };
    }
  } catch (error) {
    console.error("[AI] Error generating exercise instructions:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Generates a personalized mental session using the OpenAI API
 * @param {object} userData - The user's profile data and preferences
 * @returns {Promise<{success: boolean, session?: object, error?: string}>} - The result object
 */
export const generateMentalSession = async (userData = {}) => {
  console.log("[AI] Generating mental session for user:", userData);

  try {
    // Get the API key
    const key = await getOpenAIApiKey();
    if (!key) {
      console.log("[AI] No API key available for mental session generation");
      return {
        success: false,
        error: "API key not available"
      };
    }

    // Engagement-aware: when engagement is low, prefer short beginner sessions
    const engagementContext = userData.engagementContext || {};
    const isLowEngagement = engagementContext.level === 'low';

    let systemPrompt = `You are an expert mental wellness coach creating personalized meditation and mindfulness sessions. 
    Create a mental session based on the user's preferences and needs. 
    The session should include:
    - A descriptive title
    - A brief description of what the session offers
    - A session type (meditation, breathing, mindfulness, relaxation)
    - A difficulty level (beginner, intermediate, advanced)
    - Duration in minutes (5-30 minutes)
    - 5-8 step-by-step instructions for the session
    - 3-5 benefits the user will gain from this session
    
    Format the response as a JSON object with this exact structure:
    {
      "title": "Session Title",
      "description": "Brief description of the session",
      "session_type": "meditation|breathing|mindfulness|relaxation",
      "difficulty": "beginner|intermediate|advanced",
      "duration": 15,
      "steps": [
        "Step 1 instruction",
        "Step 2 instruction",
        "Step 3 instruction",
        "Step 4 instruction",
        "Step 5 instruction"
      ],
      "benefits": [
        "Benefit 1",
        "Benefit 2", 
        "Benefit 3"
      ]
    }
    
    - Make the session appropriate for the user's experience level
    - Focus on the user's specific needs and goals
    - Keep instructions clear and actionable
    - Return ONLY the JSON object, no other text`;

    if (isLowEngagement) {
      systemPrompt += `

    IMPORTANT: The user is getting back into the habit. Create a SHORT, LOW-BARRIER session: 5-10 minutes, beginner difficulty, simple breathing or body-scan. Focus on feeling good and building the habit, not intensity.`;
    }

    // Prepare the request payload
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a mental wellness session for this user profile: ${JSON.stringify(userData)}. The user specifically wants: ${userData.custom_prompt || 'a personalized mental wellness session'}` }
      ],
      max_tokens: 1200,
      temperature: 0.7,
    };

    // Make the API call
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
      console.error("[AI] Mental session generation failed:", errorText);
      return {
        success: false,
        error: "Failed to generate mental session"
      };
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return {
        success: false,
        error: "Invalid response from AI"
      };
    }

    // Parse the session data from the response
    try {
      const sessionData = JSON.parse(data.choices[0].message.content);
      return {
        success: true,
        session: sessionData
      };
    } catch (parseError) {
      console.error("[AI] Failed to parse mental session data:", parseError);
      return {
        success: false,
        error: "Failed to parse mental session data"
      };
    }
  } catch (error) {
    console.error("[AI] Error in generateMentalSession:", error);
    return {
      success: false,
      error: error.message
    };
  }
};
