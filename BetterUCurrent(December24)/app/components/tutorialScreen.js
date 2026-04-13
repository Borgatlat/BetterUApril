import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Base dimensions for scaling (designed around ~390x844 iPhone)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const TutorialScreen = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Scale factors: clamp so small screens don't crush content, large screens don't overblow
  const scale = useMemo(() => Math.min(width / BASE_WIDTH, height / BASE_HEIGHT, 1.2), [width, height]);
  const isSmallScreen = height < 650;
  const iconSize = Math.round(Math.max(70, Math.min(120, 100 * scale)));
  const titleSize = Math.round(Math.max(22, Math.min(32, 28 * scale)));
  const descSize = Math.round(Math.max(14, Math.min(18, 16 * scale)));
  const lineHeight = Math.round(descSize * 1.45);
  const horizontalPadding = Math.max(16, Math.min(24, width * 0.05));

  const pages = [
    {
      title: 'Your Home Dashboard',
      description: 'Track your calories, water, and protein with the activity rings. Your daily progress at a glance.',
      icon: 'speedometer-outline'
    },
    {
      title: 'AI Coach & Therapist',
      description: 'Get personalized fitness and wellness advice from your AI coach and therapist. Your AI coach is always there to help you achieve your goals.',
      icon: 'chatbubble-ellipses-outline'
    },
    {
      title: 'Workouts & Progress',
      description: 'Plan workouts, track sets, and watch your personal records improve over time.',
      icon: 'barbell-outline'
    },
    {
      title: 'Mental Wellness',
      description: 'Access guided meditation and mental fitness sessions to improve your mental health.',
      icon: 'leaf-outline'
    },
    {
      title: 'Explore More',
      description: 'Join the community, compete in leagues, and customize your experience in settings.',
      icon: 'compass-outline'
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: horizontalPadding,
            minHeight: height
          }
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.skipContainer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.pageContainer, isSmallScreen && styles.pageContainerCompact]}>
          <View style={[styles.iconContainer, { width: iconSize, height: iconSize, borderRadius: iconSize / 2, marginBottom: isSmallScreen ? 20 : 32 }]}>
            <LinearGradient
              colors={['#00ffff', '#0088ff']}
              style={[styles.iconGradient, { borderRadius: iconSize / 2 }]}
            >
              <Ionicons name={pages[currentPage].icon} size={iconSize * 0.5} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={[styles.title, { fontSize: titleSize, marginBottom: isSmallScreen ? 12 : 20 }]}>
            {pages[currentPage].title}
          </Text>
          <Text
            style={[
              styles.description,
              {
                fontSize: descSize,
                lineHeight,
                paddingHorizontal: horizontalPadding,
                maxWidth: width - horizontalPadding * 4
              }
            ]}
          >
            {pages[currentPage].description}
          </Text>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
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
            style={[styles.nextButton, { height: isSmallScreen ? 44 : 50 }]}
            onPress={handleNext}
          >
            <LinearGradient
              colors={['#00ffff', '#0088ff']}
              style={styles.nextButtonGradient}
            >
              <Text style={[styles.nextButtonText, { fontSize: isSmallScreen ? 16 : 18 }]}>
                {currentPage === pages.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between'
  },
  skipContainer: {
    alignItems: 'flex-end',
    marginBottom: 16
  },
  skipButton: {
    padding: 10
  },
  skipText: {
    color: '#00ffff',
    fontSize: 16
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20
  },
  pageContainerCompact: {
    paddingVertical: 12
  },
  iconContainer: {
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  description: {
    color: '#00ffff',
    textAlign: 'center'
  },
  footer: {
    paddingTop: 8
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 255, 255, 0.3)',
    marginHorizontal: 4
  },
  paginationDotActive: {
    backgroundColor: '#00ffff',
    width: 20
  },
  nextButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  nextButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});

export default TutorialScreen;
