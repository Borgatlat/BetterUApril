/**
 * Streak Modal Component
 * 
 * This modal displays detailed streak information when the user clicks
 * on their streak display. Shows current streak, longest streak, and
 * motivational messages.
 * 
 * Props:
 * - visible: Whether modal is visible
 * - onClose: Callback to close modal
 * - userId: User ID to fetch streak for
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getStreakStatus } from '../utils/streakHelpers';

// Get screen dimensions to make the modal responsive
// We get both width and height to ensure the modal fits on screen
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate modal height - 85% of screen height or max 700px, whichever is smaller
// This ensures the modal fits on all screen sizes while not being too tall on large screens
const MODAL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.85, 700);

export function StreakModal({ visible, onClose, userId }) {
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    longestStreak: 0,
    hasActivityToday: false,
    isAtRisk: false
  });
  const [loading, setLoading] = useState(true);

  // Load streak data when modal opens
  useEffect(() => {
    if (visible && userId) {
      loadStreak();
    }
  }, [visible, userId]);

  const loadStreak = async () => {
    try {
      setLoading(true);
      const data = await getStreakStatus(userId);
      setStreakData(data);
    } catch (error) {
      console.error('[StreakModal] Error loading streak:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get motivational message based on streak
  const getMotivationalMessage = () => {
    const streak = streakData.currentStreak;
    if (streak === 0) {
      return "Start your journey today! Complete a workout, mental session, walk, run, or bike ride to begin your streak.";
    } else if (streak < 7) {
      return "You're building momentum! Keep it up!";
    } else if (streak < 30) {
      return "Amazing progress! You're forming a great habit.";
    } else if (streak < 100) {
      return "Incredible dedication! You're a streak champion!";
    } else {
      return "Legendary! You're an inspiration to us all!";
    }
  };

  // Calculate progress percentage for visual progress indicator
  // This shows progress toward next milestone (7, 30, 100, etc.)
  const getProgressPercentage = () => {
    const streak = streakData.currentStreak;
    if (streak === 0) return 0;
    if (streak < 7) return (streak / 7) * 100;
    if (streak < 30) return ((streak - 7) / 23) * 100;
    if (streak < 100) return ((streak - 30) / 70) * 100;
    return 100;
  };

  // Get next milestone
  const getNextMilestone = () => {
    const streak = streakData.currentStreak;
    if (streak < 7) return 7;
    if (streak < 30) return 30;
    if (streak < 100) return 100;
    return streak + 50; // After 100, milestones every 50
  };

  // Render multiple flame icons for visual effect (more flames = higher streak)
  const renderFlames = () => {
    const streak = streakData.currentStreak;
    const flameCount = Math.min(Math.max(Math.floor(streak / 5), 1), 5); // 1-5 flames
    const flames = [];
    
    for (let i = 0; i < flameCount; i++) {
      flames.push(
        <Ionicons 
          key={i}
          name="flame" 
          size={streak > 0 ? 50 : 40} 
          color={streak > 0 ? "#ff6b35" : "#666"}
          style={styles.flameIcon}
        />
      );
    }
    return flames;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          {/* Header with gradient background - Fixed at top */}
          <LinearGradient
            colors={['rgba(255, 107, 53, 0.2)', 'rgba(255, 107, 53, 0.05)']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <Ionicons name="flame" size={28} color="#ff6b35" style={styles.titleIcon} />
                <Text style={styles.title}>Activity Streak</Text>
              </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
                <View style={styles.closeButtonCircle}>
                  <Ionicons name="close" size={20} color="#fff" />
                </View>
            </TouchableOpacity>
          </View>
          </LinearGradient>

          {/* Scrollable Content Area */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff6b35" />
            </View>
          ) : (
            <>
                  {/* Main Streak Display with gradient glow effect */}
                  <View style={styles.streakDisplayContainer}>
                    <LinearGradient
                      colors={streakData.currentStreak > 0 
                        ? ['rgba(255, 107, 53, 0.3)', 'rgba(255, 107, 53, 0.1)', 'transparent']
                        : ['rgba(100, 100, 100, 0.2)', 'rgba(100, 100, 100, 0.05)', 'transparent']
                      }
                      style={styles.streakGlow}
                    >
                      <View style={styles.flameContainer}>
                        {renderFlames()}
                      </View>
                <Text style={styles.streakNumber}>
                  {streakData.currentStreak}
                </Text>
                <Text style={styles.streakLabel}>
                        {streakData.currentStreak === 1 ? 'Day' : 'Days'} on Fire
                      </Text>
                    </LinearGradient>
                  </View>

                  {/* Progress Bar to Next Milestone */}
                  {streakData.currentStreak > 0 && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Next Milestone</Text>
                        <Text style={styles.progressValue}>
                          {streakData.currentStreak} / {getNextMilestone()}
                </Text>
              </View>
                      <View style={styles.progressBarBackground}>
                        <LinearGradient
                          colors={['#ff6b35', '#ff8c42', '#ffa366']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.progressBarFill, { width: `${getProgressPercentage()}%` }]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Status Badge with modern card design */}
                  <View style={styles.statusCardContainer}>
              {streakData.hasActivityToday ? (
                      <LinearGradient
                        colors={['rgba(0, 255, 0, 0.15)', 'rgba(0, 200, 0, 0.05)']}
                        style={styles.statusCard}
                      >
                        <View style={styles.statusCardContent}>
                          <View style={styles.statusIconContainer}>
                            <Ionicons name="checkmark-circle" size={24} color="#00ff88" />
                          </View>
                  <Text style={styles.statusText}>Streak maintained today!</Text>
                </View>
                      </LinearGradient>
              ) : streakData.isAtRisk ? (
                      <LinearGradient
                        colors={['rgba(255, 107, 53, 0.15)', 'rgba(255, 107, 53, 0.05)']}
                        style={styles.statusCard}
                      >
                        <View style={styles.statusCardContent}>
                          <View style={styles.statusIconContainer}>
                            <Ionicons name="heart" size={24} color="#ff6b35" />
                          </View>
                  <Text style={styles.statusText}>Your streak is still alive — one activity today keeps it going.</Text>
                </View>
                      </LinearGradient>
                    ) : streakData.currentStreak <= 1 && streakData.longestStreak > 0 ? (
                      <LinearGradient
                        colors={['rgba(0, 200, 255, 0.12)', 'rgba(0, 150, 200, 0.05)']}
                        style={styles.statusCard}
                      >
                        <View style={styles.statusCardContent}>
                          <View style={styles.statusIconContainer}>
                            <Ionicons name="heart" size={24} color="#00d4ff" />
                          </View>
                  <Text style={styles.statusText}>You did {streakData.longestStreak} day{streakData.longestStreak === 1 ? '' : 's'} in a row — that's real progress. Today is a fresh start.</Text>
                </View>
                      </LinearGradient>
                    ) : (
                      <LinearGradient
                        colors={['rgba(0, 200, 255, 0.15)', 'rgba(0, 150, 200, 0.05)']}
                        style={styles.statusCard}
                      >
                        <View style={styles.statusCardContent}>
                          <View style={styles.statusIconContainer}>
                            <Ionicons name="rocket" size={24} color="#00d4ff" />
                          </View>
                  <Text style={styles.statusText}>Start your streak today!</Text>
                </View>
                      </LinearGradient>
              )}
                  </View>

                  {/* Stats Cards */}
              <View style={styles.statsContainer}>
                    <LinearGradient
                      colors={['rgba(0, 200, 255, 0.1)', 'rgba(0, 150, 200, 0.05)']}
                      style={styles.statCard}
                    >
                      <Ionicons name="trophy" size={32} color="#00d4ff" />
                  <Text style={styles.statValue}>{streakData.longestStreak}</Text>
                  <Text style={styles.statLabel}>Longest Streak</Text>
                    </LinearGradient>
              </View>

                  {/* Motivational Message Card */}
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
                    style={styles.messageCard}
                  >
                    <Ionicons name="bulb" size={20} color="#ffd700" style={styles.messageIcon} />
                <Text style={styles.messageText}>
                  {getMotivationalMessage()}
                </Text>
                  </LinearGradient>

                  {/* Info Card */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                      <Ionicons name="information-circle" size={18} color="#00d4ff" />
                      <Text style={styles.infoTitle}>How to Maintain</Text>
              </View>
                <Text style={styles.infoText}>
                      Complete a workout, mental session, walk, run, or bike ride each day to keep your streak alive! 🔥
                </Text>
              </View>

                  {/* Close Button with gradient - Inside scroll view but at bottom */}
          <TouchableOpacity
            style={styles.closeButtonBottom}
            onPress={onClose}
                    activeOpacity={0.8}
          >
                    <View style={styles.closeButtonGradient}>
                      <Text style={styles.closeButtonText}>Got it!</Text>
                    </View>
          </TouchableOpacity>
                </>
              )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Overlay: Dark semi-transparent background that covers the entire screen
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  // Overlay Touchable: Invisible touchable area that closes modal when tapped
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  // Modal Content: Main container with very dark background to match app theme
  // We use MODAL_HEIGHT constant calculated above to ensure the modal fits on screen
  modalContent: {
    borderRadius: 24,
    padding: 0,
    width: SCREEN_WIDTH - 40,
    maxWidth: 420,
    height: MODAL_HEIGHT, // Calculated height that fits on screen
    backgroundColor: '#000', // Very dark black background
    borderWidth: 1,
    borderColor: '#1a1a1a', // Very subtle dark border
    overflow: 'hidden',
    // Shadow for depth (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    // Elevation for Android shadow
    elevation: 20,
    // Flex layout to stack header and ScrollView
    flexDirection: 'column'
  },
  // ScrollView: Container for scrollable content
  // flex: 1 makes it take up all available space after the header
  scrollView: {
    flex: 1
  },
  // Scroll Content: Inner container that holds all scrollable items
  // paddingBottom adds space at the bottom so content doesn't get cut off
  // Content should determine its own size - if it exceeds ScrollView height, it will scroll
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 10
  },
  // Header: Top section with title and close button
  // Uses a gradient background with orange tint to match the fire theme
  // This header stays fixed at the top while content scrolls
  header: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 53, 0.2)'
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  titleIcon: {
    // Adds a subtle glow effect through shadow
    textShadowColor: 'rgba(255, 107, 53, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5
  },
  // Close Button: Circular button in the header
  closeButton: {
    padding: 4
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    minHeight: 200
  },
  // Streak Display: Main visual centerpiece showing the streak number
  streakDisplayContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 20
  },
  // Streak Glow: Gradient background that creates a glowing effect around the streak number
  streakGlow: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 20
  },
  // Flame Container: Holds multiple flame icons for visual impact
  // FlexDirection row arranges flames horizontally, gap adds spacing between them
  flameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10
  },
  flameIcon: {
    // Text shadow creates a glow effect around each flame
    textShadowColor: 'rgba(255, 107, 53, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15
  },
  // Streak Number: Large, bold number displaying current streak
  streakNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    marginTop: 8,
    letterSpacing: -2,
    // Text shadow for depth and readability
    textShadowColor: 'rgba(255, 107, 53, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10
  },
  // Streak Label: Text below the number
  streakLabel: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  // Progress Container: Shows progress toward next milestone
  progressContainer: {
    marginHorizontal: 24,
    marginBottom: 20
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  progressLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  progressValue: {
    fontSize: 12,
    color: '#ff6b35',
    fontWeight: '700'
  },
  // Progress Bar: Visual indicator of progress
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden'
  },
  // Progress Bar Fill: The filled portion, uses gradient for visual appeal
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    // Shadow creates a glow effect on the progress bar
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8
  },
  // Status Card Container: Wrapper for status messages
  statusCardContainer: {
    marginHorizontal: 24,
    marginBottom: 20
  },
  // Status Card: Card showing current streak status
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden'
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  statusText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  // Stats Container: Holds stat cards
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginBottom: 20
  },
  // Stat Card: Individual card showing a statistic
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    minHeight: 120,
    justifyContent: 'center'
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00d4ff',
    marginTop: 8,
    // Text shadow for glow effect
    textShadowColor: 'rgba(0, 212, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  statLabel: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  // Message Card: Card displaying motivational message
  messageCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#000', // Very dark black for card background
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  messageIcon: {
    marginTop: 2,
    // Glow effect on icon
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  messageText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500'
  },
  // Info Card: Information card at the bottom
  infoCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#000', // Very dark black for card background
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)'
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  infoTitle: {
    fontSize: 13,
    color: '#00d4ff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  infoText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18
  },
  // Close Button: Bottom button to close modal
  // marginTop adds space above the button, marginBottom ensures it's not cut off when scrolling
  closeButtonBottom: {
    marginHorizontal: 24,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#0a0a0a', // Very dark background
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  closeButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  }
});

