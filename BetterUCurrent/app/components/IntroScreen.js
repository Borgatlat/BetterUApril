import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INTRO_SEEN_KEY } from '../../utils/storageKeys';

const IntroScreen = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const insets = useSafeAreaInsets();
  const finishingRef = useRef(false);

  const pages = [
    {
      title: 'Welcome to BetterU',
      description: 'Your personal AI-powered fitness and wellness companion',
      icon: 'fitness',
    },
    {
      title: 'AI Trainer',
      description: 'Get personalized workout and nutrition advice from your AI coach',
      icon: 'chatbubble-ellipses',
    },
    {
      title: 'Track Progress',
      description: 'Monitor your workouts, mental sessions, and personal records',
      icon: 'trending-up',
    },
    {
      title: 'Mental Wellness',
      description: 'Guided meditation and mental fitness sessions',
      icon: 'leaf',
    },
  ];

  // Dismiss immediately; persist in background so a slow AsyncStorage call cannot block the UI.
  const finishIntro = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (typeof onComplete === 'function') {
      onComplete();
    }
    AsyncStorage.setItem(INTRO_SEEN_KEY, 'true').catch(() => {});
  }, [onComplete]);

  const handleNext = () => {
    if (finishingRef.current) return;
    if (currentPage < pages.length - 1) {
      setCurrentPage((page) => page + 1);
    } else {
      finishIntro();
    }
  };

  const handleSkip = () => {
    finishIntro();
  };

  const isLastPage = currentPage === pages.length - 1;

  return (
    <LinearGradient colors={['#00131a', '#00334d', '#000']} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.skipContainer}>
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.pageContainer}>
          <View style={styles.iconContainer}>
            <LinearGradient colors={['#00ffff', '#0088ff']} style={styles.iconGradient}>
              <Ionicons name={pages[currentPage].icon} size={60} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>{pages[currentPage].title}</Text>
          <Text style={styles.description}>{pages[currentPage].description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {pages.map((_, index) => (
              <View
                key={index}
                style={[styles.paginationDot, index === currentPage && styles.paginationDotActive]}
              />
            ))}
          </View>

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isLastPage ? 'Get started' : 'Next slide'}
          >
            <LinearGradient colors={['#00ffff', '#0088ff']} style={styles.nextButtonGradient}>
              <Text style={styles.nextButtonText}>{isLastPage ? 'Get Started' : 'Next'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  skipContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
    zIndex: 2,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: '#00ffff',
    fontSize: 16,
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 40,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 18,
    color: '#00ffff',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 26,
  },
  footer: {
    paddingBottom: 40,
    zIndex: 2,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#00ffff',
    width: 20,
  },
  nextButton: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pressed: {
    opacity: 0.85,
  },
});

export default IntroScreen;
