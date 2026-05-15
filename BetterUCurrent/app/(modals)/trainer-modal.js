"use client";

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, SafeAreaView, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { useTrainer } from '../../context/TrainerContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTracking } from '../../context/TrackingContext';
import { LoadingDots } from '../../components/LoadingDots';
import { ensureApiKeyAvailable } from '../../utils/apiConfig';
import Markdown from 'react-native-markdown-display';
import { atlasMarkdownStyles } from '../../utils/aiChatMarkdownStyles';

const TrainerModal = ({ visible, onClose }) => {
  const router = useRouter();
  const { isPremium } = useUser();
  console.warn('[TrainerModal] isPremium:', isPremium);
  const { userProfile } = useUser();
  const { conversations, sendMessage, clearConversations, isLoading, messageCount, MAX_DAILY_MESSAGES } = useTrainer();
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
    
    console.log("[TrainerModal] AI Trainer ready - hardcoded API key always available");
  }, []);

  // Scroll to bottom when modal opens or conversations change
  useEffect(() => {
    if (visible && conversations.length > 0) {
      // Multiple attempts with different methods to ensure full scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 600);
      setTimeout(() => {
        // Force scroll to a very high offset to ensure we reach the bottom
        flatListRef.current?.scrollToOffset({ offset: 999999, animated: true });
      }, 900);
    }
  }, [visible, conversations.length]);

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

  const testApiKey = async () => {
    try {
      console.log("[TrainerModal] Testing API key...");
      const key = await ensureApiKeyAvailable();
      Alert.alert("API Key Test", "✅ API key is always available and ready to use!");
    } catch (error) {
      console.error("[TrainerModal] API key test error:", error);
      Alert.alert("API Key Test", "❌ Error testing API key: " + error.message);
    }
  };

  const clearMessages = async () => {
    try {
      Alert.alert(
        "Clear Conversations",
        "Are you sure you want to clear all conversations? This cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear",
            style: "destructive",
            onPress: async () => {
              try {
                await clearConversations();
                Alert.alert("Success", "Conversations cleared successfully");
              } catch (error) {
                console.error('Error clearing conversations:', error);
                Alert.alert("Error", "Failed to clear conversations");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in clearMessages:', error);
    }
  };

  const presetQuestions = [
    "What's a good workout for beginners?",
    "How can I improve my running pace?",
    "What should I eat before a workout?",
    "How do I stay motivated to exercise?",
    "What's the best way to build muscle?",
    "How often should I work out?",
    "What exercises help with weight loss?",
    "How do I prevent workout injuries?",
    "What's a good warm-up routine?",
    "How can I track my progress better?"
  ];

  const handlePresetQuestion = async (question) => {
    if (loading || isLoading || messageCount >= MAX_DAILY_MESSAGES) return;
    
    setLoading(true);
    try {
      const result = await sendMessage(question, { stats, trackingData, mood });
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = ({ item }) => (
    <Animated.View 
      style={[
        styles.message,
        item.sender === 'user' ? styles.userMessage : styles.aiMessage,
      ]}
    >
      {item.sender === 'trainer' && (
        <View style={styles.aiAvatarContainer}>
          <LinearGradient
            colors={['#00ffff', '#0088ff']}
            style={styles.aiAvatar}
          >
            <Ionicons name="fitness" size={16} color="#fff" />
          </LinearGradient>
        </View>
      )}
      <View style={[
        styles.messageContent,
        item.sender === 'user' ? styles.userMessageContent : styles.aiMessageContent
      ]}>
        {item.sender === 'user' ? (
          <Text style={[styles.messageText, styles.userMessageText]}>{item.message}</Text>
        ) : (
          <Markdown style={atlasMarkdownStyles}>{item.message || ''}</Markdown>
        )}
      </View>
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <LinearGradient
          colors={['#00131a', '#00334d', '#000']}
          style={styles.gradient}
        >
          <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#fff" />
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

            <View style={styles.disclaimerContainer}>
              <Ionicons name="information-circle-outline" size={10} color="#888" />
              <Text style={styles.disclaimerText}>
                AI-generated advice only. Verify with professionals. Not a substitute for medical/fitness consultation. 
                We are not liable for any damages.
              </Text>
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
              onContentSizeChange={(contentWidth, contentHeight) => {
                if (conversations.length > 0) {
                  // Use scrollToOffset to ensure we scroll past the content
                  flatListRef.current?.scrollToOffset({ 
                    offset: contentHeight + 200, 
                    animated: true 
                  });
                }
              }}
              onLayout={() => {
                if (conversations.length > 0) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }
              }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No messages yet</Text>
                </View>
              }
              ListFooterComponent={
                <View>
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
                  {/* Bottom spacer to ensure scroll reaches the very bottom */}
                  <View style={{ height: 50 }} />
                </View>
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
                  placeholder="Ask Atlas... (100 chars max)"
                  placeholderTextColor="#666"
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={100}
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
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.1)',
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#00ffff',
    opacity: 0.8,
  },
  backButton: {
    padding: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButton: {
    padding: 8,
    marginRight: 8,
  },
  clearButton: {
    padding: 8,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  disclaimerText: {
    flex: 1,
    color: '#888',
    fontSize: 9,
    lineHeight: 13,
    marginLeft: 6,
    fontWeight: '400',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  messageCount: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageCountLimit: {
    color: '#ff4444',
  },
  chatContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 150, // Increased from 120 to 150 to ensure full scroll
  },
  message: {
    flexDirection: 'row',
    marginVertical: 10,
    paddingHorizontal: 8,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    padding: 14,
    borderRadius: 20,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userMessageContent: {
    backgroundColor: '#00ffff',
    borderRadius: 22,
    borderTopRightRadius: 8,
    padding: 18,
    marginBottom: 2,
  },
  aiMessageContent: {
    backgroundColor: 'rgba(34, 34, 34, 0.85)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#00ffff55',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
    padding: 18,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#000',
    fontWeight: '500',
  },
  aiMessageText: {
    color: '#fff',
  },
  aiAvatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  presetContainer: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginBottom: 12,
  },
  presetList: {
    paddingHorizontal: 5,
  },
  presetQuestion: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    minWidth: 120,
    maxWidth: 200,
  },
  presetQuestionText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 5,
  },
  sendButton: {
    padding: 10,
    marginLeft: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  sendButtonDisabled: {
    opacity: 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default TrainerModal; 