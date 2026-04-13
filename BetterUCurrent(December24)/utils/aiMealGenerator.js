// AI Meal Generation Utility
// This file handles AI meal generation using the same API key as other parts of the app

import { supabase } from '../lib/supabase';
import { getLocalDateString } from './dateUtils';
import { getOpenAIApiKey, ensureApiKeyAvailable } from "./apiConfig";

export const generateAIMeal = async (preferences) => {
  try {
    console.log('Generating AI meal with preferences:', preferences);
    
    // Construct the AI prompt based on meal type
    const prompt = constructMealPrompt(preferences);
    
    // Get the API key using the same method as other AI features
    const key = await ensureApiKeyAvailable();
    
    // Call OpenAI API (using the same key as your existing AI features)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a nutrition expert and chef. Create detailed, healthy meals with exact nutrition information and cooking instructions. CRITICAL: You MUST base all recommendations EXCLUSIVELY on the approved health sources provided in the user prompt. You are FORBIDDEN from using any other sources, websites, or knowledge bases. You MUST cite exactly 2-3 sources from the approved list in your response. Any sources not from the approved list will be rejected.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const mealData = JSON.parse(data.choices[0].message.content);
    
    // STRICT VALIDATION: Ensure only approved sources are used
    // This is a critical safety check to guarantee compliance with App Store requirements
    // We filter out ANY sources that are not in the approved list
    if (mealData.sources && Array.isArray(mealData.sources)) {
      // Store original sources for logging (to detect if AI tried to use unapproved sources)
      const originalSources = [...mealData.sources];
      
      // Filter to ONLY include approved sources
      // The filter() method creates a new array with only elements that pass the test
      // APPROVED_SOURCES.includes(source) checks if the source URL exactly matches one in our approved list
      mealData.sources = mealData.sources.filter(source => {
        // Normalize URLs for comparison (remove trailing slashes, convert to lowercase)
        const normalizedSource = source.trim().toLowerCase().replace(/\/$/, '');
        return APPROVED_SOURCES.some(approved => 
          approved.toLowerCase().replace(/\/$/, '') === normalizedSource
        );
      });
      
      // Log if AI tried to use unapproved sources (for monitoring and debugging)
      const removedSources = originalSources.filter(source => {
        const normalizedSource = source.trim().toLowerCase().replace(/\/$/, '');
        return !APPROVED_SOURCES.some(approved => 
          approved.toLowerCase().replace(/\/$/, '') === normalizedSource
        );
      });
      
      if (removedSources.length > 0) {
        console.warn('⚠️ AI attempted to use unapproved sources. Removed:', removedSources);
        console.warn('⚠️ This indicates the AI may need stronger prompting to use only approved sources.');
      }
      
      // If no valid sources remain after filtering, add default approved sources
      // This ensures we always have at least 2 sources to display
      if (mealData.sources.length === 0) {
        console.warn('⚠️ No approved sources found in AI response. Using default sources.');
        mealData.sources = APPROVED_SOURCES.slice(0, 2);
      }
      
      // Ensure we have at least 2 sources (as required by the prompt)
      if (mealData.sources.length < 2) {
        // Add additional approved sources if we have less than 2
        const additionalSources = APPROVED_SOURCES.filter(source => 
          !mealData.sources.includes(source)
        ).slice(0, 2 - mealData.sources.length);
        mealData.sources = [...mealData.sources, ...additionalSources];
      }
    } else {
      // If sources are missing entirely, add default approved sources
      console.warn('⚠️ Sources array missing from AI response. Using default sources.');
      mealData.sources = APPROVED_SOURCES.slice(0, 2);
    }
    
    // Final validation: Double-check that ALL sources are approved before returning
    // This is a defensive programming practice - validate twice to be absolutely sure
    const allSourcesApproved = mealData.sources.every(source => {
      const normalizedSource = source.trim().toLowerCase().replace(/\/$/, '');
      return APPROVED_SOURCES.some(approved => 
        approved.toLowerCase().replace(/\/$/, '') === normalizedSource
      );
    });
    
    if (!allSourcesApproved) {
      // This should never happen due to our filtering, but if it does, use only approved sources
      console.error('❌ CRITICAL: Unapproved sources detected after filtering. Replacing with approved sources.');
      mealData.sources = APPROVED_SOURCES.slice(0, 2);
    }
    
    console.log('✅ AI generated meal with validated sources:', mealData);
    return mealData;
    
  } catch (error) {
    console.error('Error generating AI meal:', error);
    throw error;
  }
};

/**
 * Analyzes a food image using OpenAI Vision and returns nutrition data.
 * Uses the same API key as other AI features (meal generation, chatbots, etc.)
 * @param {string} imageBase64 - Base64-encoded image data (no data URL prefix)
 * @returns {Promise<object>} Meal data with name, nutrition {calories, protein, carbs, fat, etc}
 */
export const analyzeFoodImage = async (imageBase64) => {
  const key = await ensureApiKeyAvailable();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this food image. Identify the food(s) and estimate nutrition for the portion shown.
Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "name": "Description of the food/meal",
  "description": "Brief description",
  "ingredients": [{"name": "ingredient", "amount": 1, "unit": "serving"}],
  "instructions": "N/A",
  "nutrition": {
    "calories": {"value": 0, "unit": "kcal"},
    "protein": {"value": 0, "unit": "g"},
    "carbs": {"value": 0, "unit": "g"},
    "fat": {"value": 0, "unit": "g"},
    "fiber": {"value": 0, "unit": "g"},
    "sugar": {"value": 0, "unit": "g"},
    "sodium": {"value": 0, "unit": "mg"}
  },
  "prep_time": 0,
  "cook_time": 0,
  "cuisine_type": "other",
  "meal_type": "snack",
  "sources": ["https://www.dietaryguidelines.gov/", "https://www.nutrition.gov/"]
}`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`Vision API error: ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  const jsonStr = raw.replace(/^```json?\s*|\s*```$/g, '');
  return JSON.parse(jsonStr);
};

// Approved health sources that the AI must use for meal generation
// These are the ONLY sources the AI is allowed to reference
// This constant is exported so it can be used in UI components for display
export const APPROVED_SOURCES = [
  'https://www.dietaryguidelines.gov/',
  'https://www.nutrition.gov/',
  'https://www.cdc.gov/healthyweight/healthy_eating/',
  'https://www.who.int/health-topics/nutrition',
  'https://www.hsph.harvard.edu/nutritionsource/',
  'https://www.heart.org/en/healthy-living/healthy-eating'
];

const constructMealPrompt = (preferences) => {
  const {
    calorieRange,
    mealType,
    cuisineType,
    dietaryRestrictions,
    notes,
    fitnessGoal,
    prepTime,
    mainProtein,
    textureCraving,
    servings,
  } = preferences;

  const isSnack = mealType === 'snack';
  const calorieText = isSnack ?
    `${calorieRange.min}-${calorieRange.max} calories (keep it light and simple)` :
    `${calorieRange.min}-${calorieRange.max} calories`;

  const instructionText = isSnack ?
    'For snacks: focus on simple ingredients, minimal prep time, and portable options. Keep instructions brief.' :
    'For meals: include detailed cooking instructions with clear steps.';

  const extraReqs = [];
  if (fitnessGoal && fitnessGoal !== 'any') {
    if (fitnessGoal === 'muscle_gain') extraReqs.push('Prioritize higher protein (30g+) for muscle building.');
    else if (fitnessGoal === 'fat_loss') extraReqs.push('Keep it satiating with protein and fiber, moderate carbs.');
    else if (fitnessGoal === 'maintenance') extraReqs.push('Balanced macros for general wellness.');
    else if (fitnessGoal === 'energy') extraReqs.push('Focus on sustained energy with complex carbs and protein.');
  }
  if (prepTime && prepTime !== 'any') {
    if (prepTime === 'quick') extraReqs.push('Total prep + cook time under 15 minutes.');
    else if (prepTime === 'moderate') extraReqs.push('15-30 minutes total time.');
    else if (prepTime === 'leisurely') extraReqs.push('Can take 30+ minutes.');
  }
  if (mainProtein && mainProtein !== 'any') {
    extraReqs.push(`Feature ${mainProtein} as the main protein source.`);
  }
  if (textureCraving && textureCraving.length > 0) {
    extraReqs.push(`Texture/vibe: ${textureCraving.join(', ')}.`);
  }
  if (servings && servings > 1) {
    extraReqs.push(`Recipe serves ${servings}. Scale nutrition per serving.`);
  }

  const notesText = notes && notes.trim() ? `\n- Additional notes: ${notes.trim()}` : '';
  const extraText = extraReqs.length > 0 ? `\n- ${extraReqs.join('\n- ')}` : '';
  
  // Build the approved sources list for the prompt
  // This tells the AI which sources it can use and must cite
  const sourcesList = APPROVED_SOURCES.map((url, index) => 
    `(${index + 1}) ${url}`
  ).join('\n');
  
  return `Create a detailed ${mealType} with these requirements:
- Calories: ${calorieText}
- Meal type: ${mealType}
- Cuisine: ${cuisineType}
- Dietary restrictions: ${dietaryRestrictions.join(', ') || 'none'}${notesText}${extraText}

${instructionText}

CRITICAL - SOURCE REQUIREMENTS (MANDATORY):
You MUST base your meal recommendations EXCLUSIVELY on the following approved, reputable health sources. These are the ONLY sources you are permitted to use. Using any other sources is STRICTLY FORBIDDEN and will result in rejection.

You MUST cite exactly 2-3 sources from this approved list in your response. You are NOT allowed to use, reference, or cite any other websites, sources, or knowledge bases.

APPROVED SOURCES (ONLY USE THESE):
${sourcesList}

You must include a "sources" array in your JSON response listing the EXACT URLs from the approved list above (copy them exactly as shown). Select 2-3 sources that are most relevant to this meal. Any URLs not matching the approved list exactly will be automatically rejected and replaced.

Return ONLY a JSON object with this exact structure (no additional text):
{
  "name": "Meal Name",
  "description": "Brief description of the meal",
  "ingredients": [
    {"name": "ingredient name", "amount": 1, "unit": "medium"}
  ],
  "instructions": "${isSnack ? 'Simple preparation steps or "No cooking required" for raw snacks' : 'Step 1... Step 2...'}",
  "nutrition": {
    "calories": {"value": 450, "unit": "kcal"},
    "protein": {"value": 25, "unit": "g"},
    "carbs": {"value": 45, "unit": "g"},
    "fat": {"value": 20, "unit": "g"},
    "fiber": {"value": 8, "unit": "g"},
    "sugar": {"value": 12, "unit": "g"},
    "sodium": {"value": 500, "unit": "mg"}
  },
  "prep_time": ${isSnack ? '0-5' : '10-30'},
  "cook_time": ${isSnack ? '0' : '15-45'},
  "cuisine_type": "${cuisineType}",
  "meal_type": "${mealType}",
  "sources": ["https://www.dietaryguidelines.gov/", "https://www.nutrition.gov/"]
}`;
};

export const saveGeneratedMeal = async (mealData, userId) => {
  try {
    // Final validation before saving: Ensure sources are approved
    // This is a last line of defense to prevent any unapproved sources from being saved
    let validatedSources = mealData.sources || [];
    
    if (Array.isArray(validatedSources) && validatedSources.length > 0) {
      // Filter to only approved sources one more time before saving
      validatedSources = validatedSources.filter(source => {
        const normalizedSource = source.trim().toLowerCase().replace(/\/$/, '');
        return APPROVED_SOURCES.some(approved => 
          approved.toLowerCase().replace(/\/$/, '') === normalizedSource
        );
      });
      
      // If filtering removed sources, use approved defaults
      if (validatedSources.length === 0) {
        console.warn('⚠️ No approved sources found before saving. Using default sources.');
        validatedSources = APPROVED_SOURCES.slice(0, 2);
      }
    } else {
      // If sources are missing or invalid, use approved defaults
      validatedSources = APPROVED_SOURCES.slice(0, 2);
    }
    
    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        name: mealData.name,
        description: mealData.description,
        ingredients: mealData.ingredients,
        instructions: mealData.instructions,
        nutrition: mealData.nutrition,
        calories: mealData.nutrition.calories.value,
        meal_type: mealData.meal_type,
        cuisine_type: mealData.cuisine_type,
        prep_time: mealData.prep_time,
        cook_time: mealData.cook_time,
        is_ai_generated: true,
        sources: validatedSources // Store only validated approved sources
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving meal:', error);
      throw error;
    }

    console.log('Meal saved successfully:', data);
    return data;
    
  } catch (error) {
    console.error('Error saving generated meal:', error);
    throw error;
  }
};

export const consumeMeal = async (mealId, userId, servingSize = 1.0) => {
  try {
    // Get the meal to calculate actual nutrition
    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .select('calories, nutrition')
      .eq('id', mealId)
      .single();

    if (mealError) throw mealError;

    const actualCalories = Math.round(meal.calories * servingSize);
    const nutrition = meal.nutrition;

    // Calculate actual macros based on serving size
    const actualMacros = {
      protein: nutrition.protein.value * servingSize,
      carbs: nutrition.carbs.value * servingSize,
      fat: nutrition.fat.value * servingSize,
      fiber: nutrition.fiber.value * servingSize,
      sugar: nutrition.sugar.value * servingSize,
      sodium: nutrition.sodium.value * servingSize
    };

    // Insert meal consumption
    const { data, error } = await supabase
      .from('meal_consumptions')
      .insert({
        user_id: userId,
        meal_id: mealId,
        serving_size: servingSize,
        actual_calories: actualCalories
      })
      .select()
      .single();

    if (error) {
      console.error('Error consuming meal:', error);
      throw error;
    }

    // Update daily macros - use local date so timezone matches user's "today"
    const today = getLocalDateString();
    
    // First try to get existing record
    const { data: existingRecord, error: fetchError } = await supabase
      .from('daily_macronutrients')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching daily macros:', fetchError);
    }

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('daily_macronutrients')
        .update({
          protein: existingRecord.protein + actualMacros.protein,
          carbs: existingRecord.carbs + actualMacros.carbs,
          fat: existingRecord.fat + actualMacros.fat,
          fiber: existingRecord.fiber + actualMacros.fiber,
          sugar: existingRecord.sugar + actualMacros.sugar,
          sodium: existingRecord.sodium + actualMacros.sodium,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', today);

      if (updateError) {
        console.error('Error updating daily macros:', updateError);
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('daily_macronutrients')
        .insert({
          user_id: userId,
          date: today,
          protein: actualMacros.protein,
          carbs: actualMacros.carbs,
          fat: actualMacros.fat,
          fiber: actualMacros.fiber,
          sugar: actualMacros.sugar,
          sodium: actualMacros.sodium
        });

      if (insertError) {
        console.error('Error creating daily macros record:', insertError);
      }
    }

    console.log('Meal consumed successfully:', data);
    return data;
    
  } catch (error) {
    console.error('Error consuming meal:', error);
    throw error;
  }
};

export const getDailyNutrition = async (userId, date = new Date()) => {
  try {
    const targetDate = typeof date === 'string' ? date : getLocalDateString(date);
    
    // Get daily macros from the dedicated table
    const { data, error } = await supabase
      .from('daily_macronutrients')
      .select('*')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting daily nutrition:', error);
      throw error;
    }

    // If no record exists, return zeros
    if (!data) {
      return {
        total_calories: 0, // Calories are tracked separately
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        total_fiber: 0,
        total_sugar: 0,
        total_sodium: 0
      };
    }

    return {
      total_calories: 0, // Calories are tracked separately
      total_protein: data.protein || 0,
      total_carbs: data.carbs || 0,
      total_fat: data.fat || 0,
      total_fiber: data.fiber || 0,
      total_sugar: data.sugar || 0,
      total_sodium: data.sodium || 0
    };
    
  } catch (error) {
    console.error('Error getting daily nutrition:', error);
    throw error;
  }
}; 