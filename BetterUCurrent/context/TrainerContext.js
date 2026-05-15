import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage"
import { generateAIResponse } from "../utils/aiUtils"
import { generateFineTunedSystemPrompt, validateTrainerResponse } from "../utils/trainerFineTuning"
import { useUser } from '../context/UserContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useSharedMessageLimit } from './SharedMessageLimitContext';

// Timeout for AI response (e.g. 30s) so we don't load forever on web or slow networks
const AI_RESPONSE_TIMEOUT_MS = 30000;

const TrainerContext = createContext();

export const TrainerProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userProfile } = useUser();
  const { isPremium } = useUser();
  const { 
    sharedMessageCount, 
    MAX_DAILY_MESSAGES, 
    checkAndResetSharedMessageCount, 
    incrementSharedMessageCount, 
    hasReachedLimit 
  } = useSharedMessageLimit();
  console.warn('[TrainerProvider] isPremium:', isPremium);
  console.warn('[TrainerProvider] Shared message count:', sharedMessageCount);

  // Helper to get today's date string
  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Function to check if we need to reset message count (now uses shared limit)
  const checkAndResetMessageCount = React.useCallback(async () => { //useCallback is used to memoize the function and prevent unncessary re-renders
    await checkAndResetSharedMessageCount();
  }, [checkAndResetSharedMessageCount]);

  // Load today's conversations from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 5000);

    const initConversations = async () => {
      try {
        await checkAndResetMessageCount();
        // Fetch today's messages from Supabase
        const userId = userProfile?.user_id || userProfile?.id;
        if (userId) {
          const { data, error } = await supabase
            .from('trainer_messages')
            .select('*')
            .eq('user_id', userId)
            .eq('date', getTodayString())
            .order('created_at', { ascending: true });
          if (!error && data && data.length > 0) {
            const formatted = data.map(msg => ({
              id: msg.id,
              sender: msg.is_user ? 'user' : 'trainer',
              message: msg.message,
              timestamp: msg.created_at,
            }));
            setConversations(formatted);
            await AsyncStorage.setItem('trainerConversations', JSON.stringify(formatted));
          } else if (isMounted) {
            // Fallback to initial message with personalized greeting
            const userName = userProfile?.full_name || userProfile?.name || 'there';
            const initialMessage = {
              id: Date.now().toString(),
              sender: 'trainer',
              message: `Hello ${userName}! I'm Atlas, your AI fitness trainer. Like the Titan who held up the sky, I'm here to help you build strength and endurance. I have access to your profile data including your fitness goals, workout history, and personal records. How can I help you achieve your fitness goals today?`,
              timestamp: new Date().toISOString(),
            };
            setConversations([initialMessage]);
            await AsyncStorage.setItem('trainerConversations', JSON.stringify([initialMessage]));
          }
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    initConversations();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [userProfile?.user_id, userProfile?.id, checkAndResetMessageCount]);

  const sendMessage = async (message, { stats = {}, trackingData = {}, mood = '' } = {}) => {
    console.warn('=== AI TRAINER MESSAGE SENT: sendMessage CALLED ===');
    console.warn('[TrainerProvider] sendMessage isPremium:', isPremium);
    console.warn('[TrainerProvider] Shared message count before sending:', sharedMessageCount);
    try {
      await checkAndResetMessageCount();
      if (hasReachedLimit()) {
        if (!isPremium) {
          const aiMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'trainer',
            message: `You've reached your daily limit of ${MAX_DAILY_MESSAGES} messages across both AI Trainer and AI Therapist. Upgrade to Premium for more messages!`,
            timestamp: new Date().toISOString(),
          };
          const finalConversations = [...conversations, aiMessage];
          setConversations(finalConversations);
          await AsyncStorage.setItem('trainerConversations', JSON.stringify(finalConversations));
        }
        return { success: false, error: 'Message limit reached' };
      }
      // Add user message
      const userMessage = {
        id: Date.now().toString(),
        sender: 'user',
        message: message,
        timestamp: new Date().toISOString(),
      };
      const updatedConversations = [...conversations, userMessage];
      setConversations(updatedConversations);
      await AsyncStorage.setItem('trainerConversations', JSON.stringify(updatedConversations));
      // Save user message to Supabase
      const userId = userProfile?.user_id || userProfile?.id;
      if (userId) {
        await supabase.from('trainer_messages').insert({
          user_id: userId,
          message: message,
          is_user: true,
          date: getTodayString(),
        });
      }
      // Get AI response with all user data
      let aiResponse;
      console.warn('=== ENTERING AI RESPONSE TRY BLOCK ===');
      try {
        // Compose a comprehensive system prompt for the AI
        const userName = userProfile?.full_name || userProfile?.name || 'User';
        const prs = trackingData?.personalRecords;
        const prsFormatted = (!prs || !Array.isArray(prs) || prs.length === 0)
          ? 'No data'
          : prs.map(pr => {
              const name = pr.exercise_name || pr.name || 'Unknown';
              const val = pr.value != null ? pr.value : pr.weight;
              const repsStr = pr.reps != null ? ` × ${pr.reps} reps` : '';
              const unit = pr.unit || (pr.exercise_type === 'weight' ? 'lbs' : '');
              return val != null ? `${name}: ${val}${unit ? ' ' + unit : ''}${repsStr}` : name;
            }).join(', ');
        const systemPrompt = `You are a personalized fitness and wellness AI coach for ${userName} using the BetterU app. You have access to their complete profile data and should use it to provide highly personalized responses.

IMPORTANT: Always address the user by their name (${userName}) when appropriate and reference their specific data.

BETTERU APP FEATURES & CAPABILITIES:
You are integrated into the BetterU fitness app, which has the following features:

FREE FEATURES (Available to all users):
- Workout Tracking: Users can log and track their workouts
- Mental Wellness Sessions: Guided meditation and mental health tracking
- Run Tracking: GPS-based run tracking with pace, distance, and route mapping
- Community Feed: Share workouts, runs, and mental sessions with friends
- Basic Profile: Track personal stats, goals, and progress
- AI Trainer: Basic AI coaching (limited messages for free users)
- Workout Logs: View workout history and progress
- Run Logs: View run history and statistics
- Edit Features: Edit workouts, runs, and mental sessions
- Photo Uploads: Add photos to activities
- Map Visibility: Control who can see your run routes

PREMIUM FEATURES (Available to premium users):
- AI Trainer: 100 messages per day (vs 10 for free users)
- Personalized Workout Generation: AI creates custom workouts based on user's goals, level, and preferences
- Advanced Analytics: Detailed progress tracking and insights
- Priority Support: Enhanced customer support
- Exclusive Content: Premium workout plans and content

APP NAVIGATION & LOCATIONS:
- Home Tab: Main dashboard with quick stats and recent activities
- Workout Tab: Generate workouts (premium), track workouts, view workout logs
- Run Tab: Start runs, view run history, access run logs
- Mental Tab: Mental wellness sessions and mood tracking
- Community Tab: Social feed with friends' activities
- Profile Tab: Personal stats, settings, and profile management
- Trainer Tab: AI coaching (where you are now)

User Profile Data Available:
- Name: ${userName}
- Age: ${userProfile?.age || 'Not specified'}
- Gender: ${userProfile?.gender || 'Not specified'}
- Weight: ${userProfile?.weight || 'Not specified'} ${userProfile?.weight ? 'kg' : ''}
- Height: ${userProfile?.height || 'Not specified'} ${userProfile?.height ? 'cm' : ''}
- Training Level: ${userProfile?.training_level || 'Not specified'}
- Fitness Goal: ${userProfile?.fitness_goal || 'Not specified'}
- Bio: ${userProfile?.bio || 'Not specified'}
- Premium Status: ${isPremium ? 'Premium' : 'Free'}

Additional Data:
- Workout History: ${trackingData.workoutHistory ? trackingData.workoutHistory.length + ' sessions' : 'No data'}
- Mental Session History: ${trackingData.mentalHistory ? trackingData.mentalHistory.length + ' sessions' : 'No data'}
- Personal Records: ${prsFormatted}
- Current Mood: ${mood || 'Not specified'}

RESPONSE GUIDELINES:
1. Use the user's name (${userName}) in your responses
2. Reference their specific fitness goals, training level, and history
3. Mention their personal records when discussing progress. Reference specific numbers from their Personal Records above (e.g. max bench, squat) when discussing strength or programming.
4. Consider their age, weight, and height for exercise recommendations
5. Reference their workout and mental session history for context
6. Be encouraging and motivational while being specific to their situation
7. If they ask about progress, reference their actual data
8. If they ask for recommendations, consider their current fitness level and goals
9. ALWAYS mention BetterU app features when relevant:
   - For workout requests: "Go to the Workouts tab and click 'Generate Workout' for a personalized workout (Premium feature)"
   - For run tracking: "Use the Run tab to track your runs with GPS and see your route"
   - For mental wellness: "Check out the Mental tab for guided meditation sessions"
   - For community: "Share your progress in the Community tab to stay motivated"
   - For premium features: "Upgrade to Premium to unlock personalized workout generation and more AI messages"
10. Direct users to specific app locations when appropriate
11. Mention premium vs free features clearly
12. Encourage use of the app's tracking features for better progress
13. Whenever you provide medical or health information, include citations such as links to sources, to ensure users are provided with evidence-based information. 

FORMATTING & STYLE:
- Provide detailed, comprehensive responses based on exercise science research
- Use evidence-based information from peer-reviewed studies
- Include specific numbers, ranges, and actionable advice
- Break down complex topics into clear sections when needed
- Reference scientific principles and research when appropriate
- Be thorough but well-organized
- Use bullet points for lists of recommendations
- Prioritize safety and proper form in all advice
- Aim for 150-300 words for complex questions, 50-150 for simpler ones
- Always emphasize safety and proper technique
-Ask follow up questions to the user to get more information and thus provide a more tailored response
-use bold for section headers and subtitles. Use markdown formatting for better readability.
`;


        // Generate fine-tuned system prompt with training examples
        const fineTunedSystemPrompt = generateFineTunedSystemPrompt(systemPrompt);
        
        // Add log before calling generateAIResponse
        console.warn('=== ABOUT TO CALL generateAIResponse WITH FINE-TUNING ===');
        const aiPromise = generateAIResponse(
          message,
          {
            userName: userName,
            profile: userProfile,
            stats,
            allTimeWorkoutHistory: trackingData.workoutHistory,
            allTimeMentalHistory: trackingData.mentalHistory,
            prs: trackingData.personalRecords,
            goals: userProfile?.fitness_goal || stats?.goal || '',
            bio: userProfile?.bio || '',
            mood,
            age: userProfile?.age,
            gender: userProfile?.gender,
            weight: userProfile?.weight,
            height: userProfile?.height,
            trainingLevel: userProfile?.training_level,
          },
          fineTunedSystemPrompt
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out. Check your connection or try again.')), AI_RESPONSE_TIMEOUT_MS)
        );
        const aiResult = await Promise.race([aiPromise, timeoutPromise]);
        if (aiResult.success) {
          // Keep markdown intact so trainer-modal can render **bold**, ## headings, lists, etc.
          aiResponse = typeof aiResult.response === 'string' ? aiResult.response.trim() : String(aiResult.response ?? '');
          
          // Validate the response using fine-tuning system
          const validation = validateTrainerResponse(message, aiResponse);
          console.log('[Trainer] Response validation:', validation);
          
          // Log validation feedback for monitoring
          if (validation.score < 0.6) {
            console.warn('[Trainer] Low validation score:', validation.feedback);
          }
        } else {
          console.error('=== AI RESPONSE FAILED ===', aiResult.error);
          aiResponse = `Sorry, I'm having trouble connecting to my AI service right now. Error: ${aiResult.error}`;
        }
      } catch (aiError) {
        console.error('=== ERROR IN AI RESPONSE TRY BLOCK ===', aiError);
        aiResponse = `Sorry, I encountered an unexpected error: ${aiError.message}`;
      }
      // Add AI message
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'trainer',
        message: aiResponse,
        timestamp: new Date().toISOString(),
      };
      const finalConversations = [...updatedConversations, aiMessage];
      setConversations(finalConversations);
      await AsyncStorage.setItem('trainerConversations', JSON.stringify(finalConversations));
      // Save AI message to Supabase
      if (userId) {
        await supabase.from('trainer_messages').insert({
          user_id: userId,
          message: aiResponse,
          is_user: false,
          date: getTodayString(),
        });
      }
      // Update shared message count
      await incrementSharedMessageCount();
      console.warn('[TrainerProvider] Shared message count after sending:', sharedMessageCount + 1);
      return { success: true, response: aiResponse };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const clearConversations = async () => {
    try {
      const userName = userProfile?.full_name || userProfile?.name || 'there';
      const initialMessage = {
        id: Date.now().toString(),
        sender: 'trainer',
                      message: `Hello ${userName}! I'm Atlas, your AI fitness trainer. Like the Titan who held up the sky, I'm here to help you build strength and endurance. I have access to your profile data including your fitness goals, workout history, and personal records. How can I help you achieve your fitness goals today?`,
        timestamp: new Date().toISOString(),
      };
      setConversations([initialMessage]);
      await AsyncStorage.setItem('trainerConversations', JSON.stringify([initialMessage]));
      // Delete today's messages from Supabase
      const userId = userProfile?.user_id || userProfile?.id;
      if (userId) {
        await supabase.from('trainer_messages')
          .delete()
          .eq('user_id', userId)
          .eq('date', getTodayString());
        // Insert the initial message
        await supabase.from('trainer_messages').insert({
          user_id: userId,
          message: initialMessage.message,
          is_user: false,
          date: getTodayString(),
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    conversations,
    setConversations,
    sendMessage,
    clearConversations,
    isLoading,
    messageCount: sharedMessageCount, // Use shared message count
    MAX_DAILY_MESSAGES, // Add the MAX_DAILY_MESSAGES to the context value
  };

  return <TrainerContext.Provider value={value}>{children}</TrainerContext.Provider>;
};

export const useTrainer = () => {
  const context = useContext(TrainerContext);
  if (!context) {
    throw new Error('useTrainer must be used within a TrainerProvider');
  }
  return context;
};
