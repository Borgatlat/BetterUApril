"use client";

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, SafeAreaView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTrainer } from '../context/TrainerContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';
import { LoadingDots } from '../components/LoadingDots';
import FeedbackCard from './components/FeedbackCard';
import { ensureApiKeyAvailable } from '../utils/apiConfig';
import { submitFeedback } from '../utils/feedbackService';
import Markdown from 'react-native-markdown-display';
import { atlasMarkdownStyles } from '../utils/aiChatMarkdownStyles';

const TrainerScreen = () => {
  const router = useRouter();
  const { isPremium } = useUser();
  console.warn('[TrainerScreen] isPremium:', isPremium);
  const { userProfile } = useUser();
  const { conversations, sendMessage, clearConversations, isLoading, messageCount } = useTrainer();
  const { stats, trackingData, mood } = useTracking();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    
    // API key is always available - no initialization needed
    console.log("[TrainerScreen] AI Trainer ready - hardcoded API key always available");
  }, []);

  useEffect(() => {
    if (loading) {
      Animated.timing(loadingOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(loadingOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || isLoading) return;

    setLoading(true);
    try {
      const result = await sendMessage(input.trim(), { stats, trackingData, mood });
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to send message');
      }
      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Test function to verify API key is working
  const testApiKey = async () => {
    try {
      console.log("[TrainerScreen] Testing API key...");
      const key = await ensureApiKeyAvailable();
      Alert.alert("API Key Test", "✅ API key is always available and ready to use!");
    } catch (error) {
      console.error("[TrainerScreen] API key test error:", error);
      Alert.alert("API Key Test", "❌ Error testing API key: " + error.message);
    }
  };

  const clearMessages = async () => {
    try {
      // Show confirmation dialog
      Alert.alert(
        "Clear Conversations",
        "Are you sure you want to clear all conversations? This cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear All",
            style: "destructive",
            onPress: async () => {
              await clearConversations();
              Alert.alert("Success", "All conversations have been cleared.");
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error clearing conversations:', error);
      Alert.alert('Error', 'Failed to clear conversations');
    }
  };

  const MAX_DAILY_MESSAGES = 50;
  const presetQuestions = [
    "How can I improve my form?",
    "What should I eat before a workout?",
    "Help me create a workout plan",
    "How do I prevent injuries?",
    "What's the best way to build muscle?",
    "How can I increase my strength?"
  ];

  const handlePresetQuestion = async (question) => {
    if (messageCount >= MAX_DAILY_MESSAGES) {
      Alert.alert('Daily Limit Reached', 'You have reached your daily message limit. Please try again tomorrow.');
      return;
    }
    setInput(question);
    // Automatically send the preset question
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  // TrainerContext uses sender ('user' | 'trainer') and message — same as trainer-modal.
  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
    <View style={[
      styles.message,
      isUser ? styles.userMessage : styles.aiMessage
    ]}>
      {isUser ? (
        <View style={styles.userMessageContent}>
          <Text style={styles.userMessageText}>{item.message}</Text>
        </View>
      ) : (
        <View style={styles.aiMessageWrapper}>
          <View style={styles.aiMessageRow}>
            <View style={styles.aiAvatarContainer}>
              <LinearGradient
                colors={['#00ffff', '#0088ff']}
                style={styles.aiAvatar}
              >
                <Ionicons name="fitness" size={16} color="#fff" />
              </LinearGradient>
            </View>
            <View style={[styles.messageContent, styles.aiMessageContent]}>
              <Markdown style={atlasMarkdownStyles}>{item.message || ''}</Markdown>
            </View>
          </View>
          <View style={styles.feedbackCardWrapper}>
            <FeedbackCard
              type="ai-response"
              contextId={item.id}
              compact
              onSubmit={async (data) => {
                const result = await submitFeedback(data);
                if (!result.success) {
                  console.warn('[TrainerScreen] Feedback submit failed:', result.error);
                }
              }}
            />
          </View>
        </View>
      )}
    </View>
    );
  };

  return (
    <LinearGradient
      colors={['#00131a', '#00334d', '#000']}
      style={styles.gradient}
    >
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Atlas</Text>
            <Text style={styles.subtitle}>Your Personalized Fitness Coach</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearMessages}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <Text style={[
            styles.messageCount,
            messageCount >= MAX_DAILY_MESSAGES && styles.messageCountLimit
          ]}>
            {`${messageCount}/${MAX_DAILY_MESSAGES}`}
          </Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={conversations}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
            </View>
          }
          ListFooterComponent={
            <Animated.View 
              style={[
                styles.message,
                styles.aiMessage,
                { opacity: loadingOpacity }
              ]}
            >
              <View style={styles.aiAvatarContainer}>
                <LinearGradient
                  colors={['#00ffff', '#0088ff']}
                  style={styles.aiAvatar}
                >
                  <Ionicons name="fitness" size={16} color="#fff" />
                </LinearGradient>
              </View>
              <View style={[styles.messageContent, styles.aiMessageContent]}>
                <LoadingDots size={10} color="#00ffff" />
              </View>
            </Animated.View>
          }
        />

        <BlurView intensity={40} tint="dark" style={styles.inputContainer}>
          {/* Horizontal Preset Questions */}
          <View style={styles.presetContainer}>
            <FlatList
              data={presetQuestions}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.presetQuestion}
                  onPress={() => handlePresetQuestion(item)}
                  disabled={messageCount >= MAX_DAILY_MESSAGES}
                >
                  <Text style={styles.presetQuestionText}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item, index) => `preset-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetList}
            />
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask Atlas anything..."
              placeholderTextColor="#666"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              editable={!loading && !isLoading && messageCount < MAX_DAILY_MESSAGES}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || loading || isLoading || messageCount >= MAX_DAILY_MESSAGES) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!input.trim() || loading || isLoading || messageCount >= MAX_DAILY_MESSAGES}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={(!input.trim() || loading || isLoading || messageCount >= MAX_DAILY_MESSAGES) ? "#666" : "#00ffff"} 
              />
            </TouchableOpacity>
          </View>
        </BlurView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  testButton: {
    padding: 8,
  },
  clearButton: {
    padding: 8,
  },
  statsContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  messageCount: {
    fontSize: 12,
    color: '#00ffff',
    fontWeight: '600',
  },
  messageCountLimit: {
    color: '#ff4444',
  },
  chatContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  message: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  userMessageContent: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '80%',
  },
  userMessageText: {
    color: '#000',
    fontSize: 16,
  },
  aiMessageWrapper: {
    flex: 1,
    maxWidth: '100%',
  },
  aiMessageRow: {
    flexDirection: 'row',
  },
  aiAvatarContainer: {
    marginRight: 10,
  },
  feedbackCardWrapper: {
    marginTop: 8,
    marginLeft: 42,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContent: {
    flex: 1,
    maxWidth: '80%',
  },
  aiMessageContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  aiMessageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  presetContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  presetList: {
    paddingVertical: 10,
  },
  presetQuestion: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  presetQuestionText: {
    color: '#00ffff',
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

export default TrainerScreen; 