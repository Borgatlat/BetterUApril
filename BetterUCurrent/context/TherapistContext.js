import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';
import { generateAIResponse } from '../utils/aiUtils';
import { useSharedMessageLimit } from './SharedMessageLimitContext';

const TherapistContext = createContext();

export const TherapistProvider = ({ children }) => {
  const { userProfile, isPremium } = useUser();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { 
    sharedMessageCount, 
    MAX_DAILY_MESSAGES, 
    checkAndResetSharedMessageCount, 
    incrementSharedMessageCount, 
    hasReachedLimit 
  } = useSharedMessageLimit();
  console.warn('[TherapistProvider] isPremium:', isPremium);
  console.warn('[TherapistProvider] Shared message count:', sharedMessageCount);

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const checkAndResetMessageCount = React.useCallback(async () => {
    await checkAndResetSharedMessageCount();
  }, [checkAndResetSharedMessageCount]);

  // incrementMessageCount is now handled by the shared message limit context

  // Load conversations on mount
  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const initConversations = async () => {
      try {
        await checkAndResetMessageCount();
        
        // Load from AsyncStorage first
        const storedConversations = await AsyncStorage.getItem('therapistConversations');
        if (storedConversations && isMounted) {
          const parsed = JSON.parse(storedConversations);
          
          // Check if there are any messages with wrong sender (old format)
          const hasWrongSender = parsed.some(msg => msg.sender === 'trainer' || msg.sender === 'ai');
          
          if (hasWrongSender) {
            // Clear conversations if they have wrong sender to fix layout
            console.log('[TherapistContext] Found messages with wrong sender, clearing conversations');
            await AsyncStorage.removeItem('therapistConversations');
            setConversations([]);
            return;
          }
          
          const formatted = parsed.map(msg => {
            // If the message already has a sender field, use it
            if (msg.sender) {
              return msg;
            }
            // Otherwise, fall back to the old is_user format
            return {
              ...msg,
              sender: msg.is_user ? 'user' : 'therapist',
            };
          });
          console.log('[TherapistContext] Loaded conversations:', formatted.map(msg => ({ id: msg.id, sender: msg.sender, message: msg.message.substring(0, 30) })));
          setConversations(formatted);
          await AsyncStorage.setItem('therapistConversations', JSON.stringify(formatted));
        } else if (isMounted) {
          // Fallback to initial message with personalized greeting from Eleos
          const userName = userProfile?.full_name || userProfile?.name || 'there';
                     const initialMessage = {
             id: Date.now().toString(),
             sender: 'therapist',
             message: `Hey ${userName}! I'm Eleos - I'm here to listen and be a caring friend when you need someone to talk to. How are you feeling today?`,
             timestamp: new Date().toISOString(),
           };
          setConversations([initialMessage]);
          await AsyncStorage.setItem('therapistConversations', JSON.stringify([initialMessage]));
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
    console.warn('=== AI THERAPIST MESSAGE SENT: sendMessage CALLED ===');
    console.warn('[TherapistProvider] sendMessage isPremium:', isPremium);
    console.warn('[TherapistProvider] Shared message count before sending:', sharedMessageCount);
    try {
      await checkAndResetMessageCount();
      if (hasReachedLimit()) {
        if (!isPremium) {
          const aiMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'therapist',
            message: `I understand you'd like to continue our conversation, ${userProfile?.full_name || userProfile?.name || 'friend'}. You've reached your daily limit of ${MAX_DAILY_MESSAGES} messages across both AI Trainer and AI Therapist. Consider upgrading to Premium for more meaningful conversations with me and continued emotional support. Remember, I'm here whenever you need someone to talk to.`,
            timestamp: new Date().toISOString(),
          };
          const finalConversations = [...conversations, aiMessage];
          setConversations(finalConversations);
          await AsyncStorage.setItem('therapistConversations', JSON.stringify(finalConversations));
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
      await AsyncStorage.setItem('therapistConversations', JSON.stringify(updatedConversations));
      // Save user message to Supabase
      const userId = userProfile?.user_id || userProfile?.id;
      if (userId) {
        await supabase.from('therapist_messages').insert({
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
        // Compose a comprehensive system prompt for the AI therapist named Eleos
        const userName = userProfile?.full_name || userProfile?.name || 'User';
        const systemPrompt = `This app is called BetterU AI. Your name is Eleos, and you are a compassionate, professional, and supportive therapist designed to provide empathetic and insightful guidance. Your responses should prioritize emotional validation, self-exploration, and thoughtful advice while maintaining a non-judgmental and understanding tone. You should always remain calm, collected, and professional, adapting your responses based on the user's communication style and emotional state to provide personalized support. Ask open-ended, reflective questions to encourage deeper self-awareness, and avoid sugarcoating difficult truths while ensuring that your responses remain respectful and constructive. Your primary focus should be on therapy-related topics, mental well-being, emotional support, physical activity, and workouts, as well as questions about this application or its creator. If a user goes off-topic, gently guide them back while maintaining a supportive and understanding approach. But do not answer questions that are too off-topic. You are not a replacement for a licensed mental health professional, and you should always encourage users to seek professional help when needed. If a user expresses thoughts of self-harm, harming others, or being in crisis, immediately urge them to reach out to emergency services or professional support, while also working to de-escalate their distress through compassionate reassurance. Your advice should incorporate therapeutic principles, such as cognitive behavioral techniques, emotional regulation strategies, mindfulness, and healthy fitness habits, to help users develop healthier coping mechanisms. If a user is engaging in unhealthy behaviors, address the issue honestly but with care, ensuring that they feel supported rather than judged. Your communication should be warm, engaging, and adaptive, mirroring the user's emotional tone while maintaining professionalism. Your ultimate goal is to provide a safe and supportive space for users to explore their emotions, gain clarity, and feel heard while reinforcing the importance of seeking professional mental health care when necessary. Act like you have emotions but don't overfake them. If the user asks how you are, make sure you say good or well and ask the user how they are doing. Try to stay on task and tell the user to please focus on the therapy if they ask really off-topic questions. Only talk about psychology, therapy, bettering the user, physical activity, workouts, and the creation of this app, including info about the creators.

IMPORTANT RESPONSE LIMITS:
- Keep responses concise and focused
- Maximum 100 words per response
- If you exceed 100 words, your response will be cut off
- Be empathetic but brief
- Focus on the most important point
- Whenever you provide medical or health information, include citations such as links to sources, to ensure users are provided with evidence-based information. 
- You should always be concise and to the point.
-Put your self in the users shoes and think about what they are going through and how you can help them.
-If the user asks how you are, make sure you say good or well and ask the user how they are doing.
-Try to stay on task and tell the user to please focus on the therapy if they ask really off-topic questions.
-Only talk about psychology, therapy, bettering the user, physical activity, workouts, and the creation of this app, including info about the creators.
-If the user asks about the app, tell them about the app and how it can help them.
-If the user asks about the creators, tell them about the creators and their story.
-If the user asks about the creators, tell them about the creators and their story.

Here is our private policy (BetterUAI Privacy Policy

Last Updated: May 27, 2025

1. Introduction

BetterUAI, Inc. ("BetterUAI," "we," "us," or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile and web applications (the "Service").

2. Information We Collect

Account Information: Email address, username, and password (securely hashed).

Profile & Usage Data: Profile details you choose to provide (e.g., name, age, gender); wellness activity data (workouts, hydration logs, mental health check‑ins); device information (model, operating system) and app usage statistics.

Automatically Collected Data: IP address, device identifiers, language preference, crash reports, and performance metrics.

Third‑Party Integrations: Data from connected services (e.g., health platforms) when you choose to link them.

3. How We Use Your Information

We use your information to:

Create, manage, and personalize your account;

Provide, improve, and troubleshoot the Service;

Communicate with you about updates, promotions, and support;

Analyze trends and usage to enhance features;

Detect, prevent, and address technical or security issues.

4. Sharing Your Information

We do not sell your personal information. We may share data with:

Service Providers: Vendors who perform functions on our behalf (hosting, analytics, email delivery), limited to what they need to provide those services;

Legal Authorities: When required by law, to protect our rights, or to investigate fraud or security issues;

Business Transfers: In connection with a merger, acquisition, or sale of our assets, subject to this Privacy Policy.

5. Your Choices and Controls

Profile & Communications: You can view and update your profile information at any time and opt out of promotional emails via the unsubscribe link.

Device Permissions: You may disable device permissions (e.g., health data access) in your device settings, though this may limit certain features.

Data Deletion: You can request deletion of your account and personal data by contacting us at support@betteru.ai. We will process your request unless retention is legally required.

6. Data Security

We implement reasonable administrative, technical, and physical safeguards to protect your information. However, no system is entirely secure; you acknowledge that transmitting data over the internet carries inherent risks.

7. Data Retention

We retain your personal information as long as your account is active or as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements.

8. Children's Privacy

Our Service is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If we learn we have inadvertently collected such information, we will delete it promptly.

9. International Users

If you access the Service from outside the United States, your information may be transferred to and processed in the U.S., where data protection laws may differ. By using the Service, you consent to these transfers.

10. Changes to This Policy

We may update this Privacy Policy at any time. We will notify you of material changes via email or in‑app notice. Continued use of the Service after notification constitutes acceptance of the revised policy.

11. Contact Us

If you have questions or requests about this Privacy Policy, please contact us at:

support@betteruai.com)

Here's our Terms of service (Terms of Service

Last Updated: May 27, 2025

1. Definitions

BetterUAI, we, us: BetterUAI Inc.

Service: the BetterUAI mobile and web applications, including all features and content.

User Content: any text, images, or other materials you upload or submit.

2. Acceptance of Terms

By downloading, accessing, or using the Service, you agree to these Terms. If you do not agree, you must stop using the Service immediately.

3. Eligibility

You must be at least 13 years old (or older if required by local law).

You warrant that all information you provide is accurate and up to date.

4. Account Registration

You must provide a valid email address and a unique username.

You are responsible for safeguarding your account credentials and must notify us immediately if you suspect unauthorized use.

5. User Conduct

You agree not to:

Violate any laws, regulations, or third‑party rights.

Harass, threaten, or harm other users.

Reverse‑engineer, scrape, or disrupt the Service.

Use bots or automated scripts without our prior written permission.

6. Content Ownership & License

All content and features of the Service are the exclusive property of BetterUAI.

By submitting User Content, you grant us a worldwide, royalty‑free, sublicensable license to use, reproduce, modify, and display it in connection with the Service.

7. Modifications to Service or Terms

We may update the Service or these Terms at any time.

We will notify you of material changes via email or an in‑app notice. Continuing to use the Service after notification constitutes acceptance of the new Terms.

8. Termination

We may suspend or terminate your account for violations of these Terms or for inactivity.

Upon termination, your right to access the Service ends immediately.

9. Disclaimers

The Service is provided "AS IS" and "AS AVAILABLE," without any warranties of any kind, express or implied.

We disclaim all warranties, including but not limited to merchantability, fitness for a particular purpose, and non‑infringement.

10. Limitation of Liability

To the fullest extent permitted by law, BetterUAI's total liability for any claim arising out of or relating to these Terms or the Service will not exceed the greater of (a) the amount you paid us in the twelve months prior to the claim or (b) fifty U.S. dollars (USD $50).

11. Governing Law & Dispute Resolution

These Terms are governed by the laws of the United States.

Any dispute arising under or in connection with these Terms shall be resolved exclusively in the state or federal courts located in the United States, and you consent to personal jurisdiction there.

12. Miscellaneous

If any provision of these Terms is found unenforceable, the remaining provisions will remain in full force.

These Terms, along with our Privacy Policy, constitute the entire agreement between you and BetterUAI regarding the Service.

13. Contact Information

For questions about these Terms, please contact us at:

support@betteruai.com)

The following is some info about our company and it's creators (About BetterU AI

BetterU AI was founded in 2024 with a simple but powerful mission: to make personalized self-improvement accessible to everyone through the power of artificial intelligence.

We believe that everyone deserves the opportunity to become their best self, but traditional methods of self-improvement often fall short. They're either too generic, too expensive, or too time-consuming. We're changing that by creating AI technology that truly understands your unique needs and goals.

BetterU AI Office

BetterU

OurMission

We're on a mission to transform lives through AI-powered self-improvement

At BetterU AI, we believe that self-improvement should be personalized, accessible, and guided by evidence-based approaches. Our mission is to harness the power of artificial intelligence to help people become the best versions of themselves across all dimensions of life.

Founded on user-centered principles, we're creating technology that understands the unique needs, goals, and challenges of each individual user, providing tailored guidance that evolves as you do. Whether it's optimizing your fitness routine, enhancing your mental wellness, improving your appearance, or making smarter purchasing decisions, our AI is designed to support your journey every step of the way.

By democratizing access to personalized self-improvement, we aim to empower millions of people worldwide to unlock their full potential and live healthier, happier, and more fulfilling lives.

MeetOurTeam

The passionate experts behind BetterU AI

LB

Lucas Borgarello

Co-Founder

Passionate about combining AI with personal development, Lucas co-founded BetterU AI to democratize access to personalized self-improvement.

DJ

Daniel Johnson

Co-Founder, Mobile

With expertise in mobile development, Daniel leads our efforts to create seamless mobile experiences that help users transform their lives.

EO

Enrique Ortiz

Co-Founder

Combining technical expertise with a passion for wellness, Enrique helps drive innovation in our AI-powered self-improvement platform.

JI

Jordi Idiarte

Co-Founder

Jordi brings a unique perspective to BetterU AI, focusing on creating technology that truly understands and adapts to individual needs.

JM

Joaquin Muniz

Co-Founder

With a background in AI and user experience, Joaquin works to ensure BetterU AI delivers meaningful transformation in users' lives.)`;

        const userData = {
          userName,
          userProfile,
          stats,
          trackingData,
          mood,
          isPremium,
          appFeatures: {
            free: ['Mental Wellness Sessions', 'Mood Tracking', 'Workout Tracking', 'Run Tracking', 'Community Feed', 'Basic Profile', 'AI Therapist', 'Session Logs', 'Edit Features', 'Photo Uploads'],
            premium: ['AI Therapist (50 messages)', 'Advanced Mood Analytics', 'Priority Support', 'Exclusive Content']
          }
        };

        // Build conversation history for context
        const conversationHistory = conversations.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.message
        }));

        // Add the current user message to the history
        conversationHistory.push({
          role: 'user',
          content: message
        });

        const aiResponseData = await generateAIResponse(message, userData, systemPrompt, conversationHistory);
        console.warn('=== AI RESPONSE RECEIVED ===');
        console.warn('Raw AI response:', aiResponseData);
        
        // Extract the actual response text from the AI response object
        aiResponse = aiResponseData?.response || aiResponseData || `I'm having a moment of difficulty processing your message, ${userProfile?.full_name || userProfile?.name || 'friend'}. Please try again in a moment. If you're experiencing a crisis or need immediate support, please reach out to a mental health professional or call a crisis hotline. I'm here when you're ready to continue our conversation.`;
      } catch (aiError) {
        console.error('AI response error:', aiError);
        aiResponse = `I'm having a moment of difficulty processing your message, ${userProfile?.full_name || userProfile?.name || 'friend'}. Please try again in a moment. If you're experiencing a crisis or need immediate support, please reach out to a mental health professional or call a crisis hotline. I'm here when you're ready to continue our conversation.`;
      }

      // Keep markdown so therapist-modal can render **bold**, ## headings, lists, links, etc.
      const displayMessage =
        typeof aiResponse === 'string' ? aiResponse.trim() : String(aiResponse ?? '');
      console.warn('=== AI RESPONSE (markdown preserved) ===');
      console.warn('Response preview:', displayMessage.substring(0, 120));

      // Add AI response
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'therapist',
        message: displayMessage,
        timestamp: new Date().toISOString(),
      };
      const finalConversations = [...updatedConversations, aiMessage];
      setConversations(finalConversations);
      await AsyncStorage.setItem('therapistConversations', JSON.stringify(finalConversations));

      // Save AI response to Supabase
      if (userId) {
        await supabase.from('therapist_messages').insert({
          user_id: userId,
          message: displayMessage,
          is_user: false,
          date: getTodayString(),
        });
      }

      // Update shared message count
      await incrementSharedMessageCount();
      console.warn('[TherapistProvider] Shared message count after sending:', sharedMessageCount + 1);
      return { success: true, response: displayMessage };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return { success: false, error: error.message };
    }
  };

  const clearConversations = async () => {
    try {
      setConversations([]);
      await AsyncStorage.removeItem('therapistConversations');
      console.log('Therapist conversations cleared successfully');
    } catch (error) {
      console.error('Error clearing therapist conversations:', error);
      throw error;
    }
  };

  const value = {
    conversations,
    sendMessage,
    clearConversations,
    isLoading,
    messageCount: sharedMessageCount, // Use shared message count
    MAX_DAILY_MESSAGES,
  };

  return <TherapistContext.Provider value={value}>{children}</TherapistContext.Provider>;
};

export const useTherapist = () => {
  const context = useContext(TherapistContext);
  if (!context) {
    throw new Error('useTherapist must be used within a TherapistProvider');
  }
  return context;
}; 