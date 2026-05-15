import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const IntroScreen = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const insets = useSafeAreaInsets();

  const pages = [
    {
      title: "Welcome to BetterU",
      description: "Your personal AI-powered fitness and wellness companion",
      icon: "fitness"
    },
    {
      title: "AI Trainer",
      description: "Get personalized workout and nutrition advice from your AI coach",
      icon: "chatbubble-ellipses"
    },
    {
      title: "Track Progress",
      description: "Monitor your workouts, mental sessions, and personal records",
      icon: "trending-up"
    },
    {
      title: "Mental Wellness",
      description: "Guided meditation and mental fitness sessions",
      icon: "leaf"
    }
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <LinearGradient
      colors={['#00131a', '#00334d', '#000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.skipContainer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pageContainer}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#00ffff', '#0088ff']}
              style={styles.iconGradient}
            >
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
                style={[
                  styles.paginationDot,
                  index === currentPage && styles.paginationDotActive
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <LinearGradient
              colors={['#00ffff', '#0088ff']}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>
                {currentPage === pages.length - 1 ? "Get Started" : "Next"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
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
});

export default IntroScreen; 