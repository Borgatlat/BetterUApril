"use client";

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, SafeAreaView, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { useTherapist } from '../../context/TherapistContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTracking } from '../../context/TrackingContext';
import { LoadingDots } from '../../components/LoadingDots';
import { ensureApiKeyAvailable } from '../../utils/apiConfig';
import Markdown from 'react-native-markdown-display';
import { eleosMarkdownStyles } from '../../utils/aiChatMarkdownStyles';

const TherapistModal = ({ visible, onClose }) => {
  const router = useRouter();
  const { isPremium } = useUser();
  console.warn('[TherapistModal] isPremium:', isPremium);
  const { userProfile } = useUser();
  const { conversations, sendMessage, clearConversations, isLoading, messageCount, MAX_DAILY_MESSAGES } = useTherapist();
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
    
    console.log("[TherapistModal] AI Therapist ready - hardcoded API key always available");
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
                console.error("Error clearing conversations:", error);
                Alert.alert("Error", "Failed to clear conversations");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error in clearMessages:", error);
      Alert.alert("Error", "Failed to clear conversations");
    }
  };

  const presetQuestions = [
    "I'm feeling anxious today",
    "How can I manage stress better?",
    "I'm having trouble sleeping",
    "I feel overwhelmed with life",
    "How do I build self-confidence?",
    "I'm dealing with negative thoughts",
    "How can I practice mindfulness?"
    
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

  const renderMessage = ({ item }) => {
    const preview = typeof item.message === 'string' ? item.message.substring(0, 50) : '';
    console.log('[TherapistModal] Rendering message:', { id: item.id, sender: item.sender, message: preview });
    
    const isUserMessage = item.sender === 'user';
    
    return (
      <Animated.View 
        style={[
          styles.message,
          isUserMessage ? styles.userMessage : styles.therapistMessage,
        ]}
      >
        {!isUserMessage && (
          <View style={styles.therapistAvatarContainer}>
            <LinearGradient
              colors={['#8b5cf6', '#a855f7']}
              style={styles.therapistAvatar}
            >
              <Ionicons name="heart" size={16} color="#fff" />
            </LinearGradient>
          </View>
        )}
        <View style={[
          styles.messageContent,
          isUserMessage ? styles.userMessageContent : styles.therapistMessageContent
        ]}>
          {isUserMessage ? (
            <Text style={[styles.messageText, styles.userMessageText]}>{item.message}</Text>
          ) : (
            <Markdown style={eleosMarkdownStyles}>{item.message || ''}</Markdown>
          )}
        </View>
      </Animated.View>
    );
  };

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
          colors={['#1a0b2e', '#2d1b4e', '#000']}
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
                <Text style={styles.title}>Eleos</Text>
                <Text style={styles.subtitle}>Your Mental Health Companion</Text>
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
                    styles.therapistMessage,
                    { opacity: loadingOpacity }
                  ]}
                >
                  <View style={styles.therapistAvatarContainer}>
                    <LinearGradient
                      colors={['#8b5cf6', '#a855f7']}
                      style={styles.therapistAvatar}
                    >
                      <Ionicons name="heart" size={16} color="#fff" />
                    </LinearGradient>
                  </View>
                  <View style={[styles.messageContent, styles.therapistMessageContent]}>
                    <LoadingDots size={10} color="#8b5cf6" />
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
                  placeholder="Share your thoughts... (100 chars max)"
                  placeholderTextColor="#666"
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={100}
                  editable={!loading && !isLoading && messageCount < MAX_DAILY_MESSAGES}
                />
                <TouchableOpacity 
                  style={styles.voiceTherapyButton}
                  onPress={() => {
                    onClose();
                    router.push('/voice-therapy-session');
                  }}
                  disabled={loading || isLoading || messageCount >= MAX_DAILY_MESSAGES}
                >
                  <Ionicons name="mic" size={20} color={(loading || isLoading || messageCount >= MAX_DAILY_MESSAGES) ? "#666" : "#8b5cf6"} />
                </TouchableOpacity> 
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
                    color={(!input.trim() || loading || isLoading || messageCount >= MAX_DAILY_MESSAGES) ? "#666" : "#8b5cf6"} 
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
    borderBottomColor: 'rgba(139, 92, 246, 0.1)',
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
    color: '#8b5cf6',
    opacity: 0.8,
  },
  backButton: {
    padding: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 8,
  },
  voiceTherapyButton: {
    padding: 8,
    marginRight: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  messageCount: {
    color: '#8b5cf6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageCountLimit: {
    color: '#ff4444',
  },
  chatContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 120,
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
  therapistMessage: {
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
    backgroundColor: '#8b5cf6',
    borderRadius: 22,
    borderTopRightRadius: 8,
    padding: 18,
    marginBottom: 2,
  },
  therapistMessageContent: {
    backgroundColor: 'rgba(34, 34, 34, 0.85)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#8b5cf655',
    shadowColor: '#8b5cf6',
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
    color: '#fff',
    fontWeight: '500',
  },
  therapistMessageText: {
    color: '#fff',
  },
  therapistAvatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  therapistAvatar: {
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
    marginBottom: 8,
  },
  presetList: {
    paddingHorizontal: 5,
  },
  presetQuestion: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
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
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  sendButtonDisabled: {
    opacity: 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default TherapistModal; 