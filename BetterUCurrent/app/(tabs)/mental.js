"use client";

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { supabase } from '../../lib/supabase';
import MoodGraph from '../components/MoodGraph';
import MentalSessionSummary from '../components/MentalSessionSummary';
import { FloatingAITherapist } from '../../components/FloatingAITherapist';
import { MentalSessionShareModal } from '../../components/MentalSessionShareModal';
import { SharedMentalSessionsList } from '../../components/SharedMentalSessionsList';

const mentalSessions = {
  meditation: [
    {
      id: 'beginner_meditation',
      title: 'Beginner Meditation',
      duration: 10,
      description: 'A gentle introduction to meditation practices',
      steps: [
        'Find a comfortable seated position',
        'Close your eyes and take a few deep breaths',
        'Focus on your breath, noticing the sensation of air moving in and out',
        'When your mind wanders, gently bring your attention back to your breath',
        'Continue for the duration of the session'
      ]
    },
    {
      id: 'body_scan',
      title: 'Body Scan',
      duration: 15,
      description: 'A relaxing body awareness meditation',
      steps: [
        'Lie down in a comfortable position',
        'Bring awareness to your breath',
        'Gradually scan your body from toes to head',
        'Release tension in each part of your body',
        'Stay present with any sensations you notice'
      ]
    },
    {
      id: 'mindful_awareness',
      title: 'Mindful Awareness',
      duration: 20,
      description: 'Develop present moment awareness',
      steps: [
        'Find a quiet space and sit comfortably',
        'Focus on the present moment',
        'Notice thoughts without judgment',
        'Return attention to your breath',
        'Practice accepting each moment as it comes'
      ]
    }
  ],
  breathing: [
    {
      id: 'box_breathing',
      title: 'Box Breathing',
      duration: 5,
      description: 'A simple technique to calm your nervous system (also called Four-Square Breathing)',
      benefits: [
        'Stress reduction',
        'Improved focus',
        'Better oxygen exchange'
      ],
      steps: [
        'Inhale for 4 counts',
        'Hold for 4 counts',
        'Exhale for 4 counts',
        'Hold for 4 counts',
        'Repeat the cycle'
      ]
    },
    {
      id: '478_breathing',
      title: '4-7-8 Breathing',
      duration: 8,
      description: 'A breathing pattern to help you fall asleep',
      benefits: [
        'Better sleep',
        'Reduced anxiety',
        'Calming effect'
      ],
      steps: [
        'Inhale for 4 counts',
        'Hold for 7 counts',
        'Exhale for 8 counts',
        'Repeat the cycle'
      ]
    },
    {
      id: 'alternate_nostril',
      title: 'Alternate Nostril Breathing',
      duration: 5,
      description: 'Balances left and right brain, reduces stress, and boosts focus (Nadi Shodhana)',
      benefits: [
        'Mental clarity',
        'Stress relief',
        'Enhanced focus'
      ],
      steps: [
        'Close right nostril, inhale left',
        'Close left nostril, exhale right',
        'Inhale right nostril',
        'Close right, exhale left',
        'Repeat the cycle'
      ]
    }
  ]
};

const moodOptions = [
  { value: 'great', icon: 'sunny', color: '#FFD700' },
  { value: 'good', icon: 'partly-sunny', color: '#98FB98' },
  { value: 'okay', icon: 'cloud', color: '#87CEEB' },
  { value: 'bad', icon: 'rainy', color: '#A9A9A9' },
  { value: 'awful', icon: 'thunderstorm', color: '#FF6B6B' }
];

const MentalScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { updateMood, incrementStat, mood } = useTracking();
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionInProgress, setSessionInProgress] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [moodHistory, setMoodHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true); // New state for AI analysis
  const [aiRecommendation, setAiRecommendation] = useState(null); // New state for AI recommendation
  const [isSharedSessionsCollapsed, setIsSharedSessionsCollapsed] = useState(false);
  // Keeps track of modal visibility and the exact session user wants to share.
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSessionForShare, setSelectedSessionForShare] = useState(null);

  useEffect(() => {
    fetchMoodHistory();
    analyzeMoodPatterns(); // Call analysis on mount
  }, []);

  const fetchMoodHistory = async () => {
    try {
      if (!user) return;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('mood_tracking')
        .select('*')
        .eq('profile_id', user.id)
        .gte('date', sevenDaysAgo.toISOString())
        .lte('date', now.toISOString())
        .order('date', { ascending: true });

      if (error) throw error;

      // Get the latest mood for each day
      const latestMoods = {};
      data?.forEach(mood => {
        const dateKey = new Date(mood.date).toISOString().split('T')[0];
        if (!latestMoods[dateKey] || new Date(mood.date) > new Date(latestMoods[dateKey].date)) {
          latestMoods[dateKey] = mood;
        }
      });

      // Convert to array and sort by date
      const sortedMoods = Object.values(latestMoods).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      console.log('Fetched mood history:', sortedMoods);
      setMoodHistory(sortedMoods);
    } catch (error) {
      console.error('Error fetching mood history:', error);
    }
  };

  const handleMoodSelect = async (mood) => {
    try {
      if (!user) return;

      const now = new Date();

      // Always insert a new mood entry
      const { error: insertError } = await supabase
        .from('mood_tracking')
        .insert({
          profile_id: user.id,
          mood: mood,
          date: now.toISOString()
        });

      if (insertError) throw insertError;

      // Update local state and AsyncStorage
      await updateMood(mood);
      
      // Fetch updated mood history immediately
      await fetchMoodHistory();
      
      setShowMoodModal(false);
      Alert.alert('Mood Updated', `You're feeling ${mood} today. Taking care of your mental health is important!`);
    } catch (error) {
      console.error('Error logging mood:', error);
      Alert.alert('Error', 'Failed to log mood');
    }
  };

  const startSession = (session) => {
    router.push({
      pathname: '/active-mental-session',
      params: {
        id: session.id,
        title: session.title,
        duration: session.duration,
        description: session.description,
        steps: JSON.stringify(session.steps),
        session_type: session.type || 'meditation'
      }
    });
  };

  const handleSessionComplete = async () => {
    try {
      if (!user) return;

      // Save detailed log
      const { error: logError } = await supabase
        .from('mental_session_logs')
        .insert({
          profile_id: user.id,
          session_name: selectedSession.title,
          session_type: selectedSession.id,
          duration: selectedSession.duration,
          completed_at: new Date().toISOString()
        });

      if (logError) throw logError;

      // Increment mental sessions count
      await incrementStat('mentalSessions');
      
      setShowSessionModal(false);
      setSelectedSession(null);
      setSessionInProgress(false);
      Alert.alert('Session Complete', 'Great job completing your mental wellness session!');
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save session');
    }
  };

  const handleFinishSession = () => {
    if (activeSession) {
      router.push({
        pathname: '/mental-session-summary',
        params: {
          sessionType: activeSession.session_type,
          duration: activeSession.duration,
        },
      });
    }
  };

  const handleSaveSession = async (sessionData) => {
    try {
      if (!user) return;

      // Save detailed log
      const { error: logError } = await supabase
        .from('mental_session_logs')
        .insert({
            profile_id: user.id,
          session_name: sessionData.type === 'meditation' ? 'Meditation Session' : 'Breathing Exercise',
          session_type: sessionData.type,
            duration: sessionData.duration,
            calmness_level: sessionData.calmnessLevel,
            notes: sessionData.notes,
          completed_at: new Date().toISOString()
        });

      if (logError) throw logError;

      // Update stats
      await incrementStat('mental_sessions');
      
      return true;
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  };

  const categories = [
    {
      id: 'breathing',
      title: 'Breathing Exercises',
      icon: 'leaf',
      color: '#4CAF50',
      description: 'Calm your mind with guided breathing techniques',
      exercises: [
        {
          id: 'box-breathing',
          title: 'Box Breathing',
          duration: 5,
          session_type: 'breathing',
          description: 'A simple but powerful breathing technique used by Navy SEALs',
          steps: JSON.stringify([
            'Breathe in slowly for 4 counts',
            'Hold your breath for 4 counts',
            'Exhale slowly for 4 counts',
            'Hold empty lungs for 4 counts',
          ])
        },
        {
          id: '478-breathing',
          title: '4-7-8 Breathing',
          duration: 5,
          session_type: 'breathing',
          description: 'A relaxing breath pattern to reduce anxiety',
          steps: JSON.stringify([
            'Breathe in quietly through your nose for 4 counts',
            'Hold your breath for 7 counts',
            'Exhale forcefully through the mouth for 8 counts',
            'Repeat the cycle',
          ])
        }
      ]
    },
    {
      id: 'meditation',
      title: 'Meditation',
      icon: 'moon',
      color: '#9C27B0',
      description: 'Find peace with guided meditation sessions',
      exercises: [
        {
          id: 'body-scan',
          title: 'Body Scan',
          duration: 10,
          session_type: 'meditation',
          description: 'Progressive relaxation through body awareness',
          steps: JSON.stringify([
            'Focus on your breath',
            'Notice sensations in your feet',
            'Move attention up through your legs',
            'Continue scanning up through your body',
            'Notice any areas of tension',
            'Release tension with each exhale',
          ])
        },
        {
          id: 'mindful-meditation',
          title: 'Mindful Meditation',
          duration: 10,
          session_type: 'meditation',
          description: 'Present moment awareness practice',
          steps: JSON.stringify([
            'Find a comfortable position',
            'Focus on your natural breath',
            'Notice thoughts without judgment',
            'Gently return focus to breath',
            'Expand awareness to sounds',
            'Include bodily sensations',
          ])
        }
      ]
    },
    {
      id: 'stress-relief',
      title: 'Stress Relief',
      icon: 'water',
      color: '#2196F3',
      description: 'Quick exercises to reduce stress and anxiety',
      exercises: [
        {
          id: 'progressive-relaxation',
          title: 'Progressive Relaxation',
          duration: 8,
          session_type: 'stress-relief',
          description: 'Release physical tension through muscle relaxation',
          steps: JSON.stringify([
            'Tense your feet for 5 seconds',
            'Release and feel the relaxation',
            'Move to your calves',
            'Continue with each muscle group',
            'Notice the feeling of relaxation',
            'Breathe deeply and slowly',
          ])
        },
        {
          id: 'visualization',
          title: 'Peaceful Place',
          duration: 8,
          session_type: 'stress-relief',
          description: 'Visualize a calm and peaceful place',
          steps: JSON.stringify([
            'Close your eyes gently',
            'Imagine a peaceful place',
            'Notice the colors and shapes',
            'Add sounds to your scene',
            'Feel the temperature',
            'Immerse in the peaceful feeling',
          ])
        }
      ]
    },
    {
      id: 'examen',
      title: 'Daily Examen',
      icon: 'search',
      color: '#FFB74D',
      description: 'A 3-minute reflection on your day',
      exercises: [
        {
          id: 'daily-examen',
          title: 'Daily Examen',
          duration: 3,
          session_type: 'examen',
          type: 'examen',
          description: 'Examination of conscience: find what went wrong, what went right, and how to improve—in 3 minutes.',
          steps: JSON.stringify([
            'Gratitude — What are you grateful for today? Recall one or two moments or people.',
            'Light — Pause and invite clarity. Ask to see your day honestly and without harsh judgment.',
            'Review — Look back at your day. What drew you toward your best self? What pulled you away?',
            'Sorrow — Where did you fall short? Acknowledge it with kindness, not self-criticism.',
            'Hope — What one thing will you do differently tomorrow? Set a gentle intention.',
          ])
        }
      ]
    },
  ]



  const handleCategoryPress = (category) => {
    router.push({
      pathname: '/category-exercises',
      params: {
        title: category.title,
        exercises: JSON.stringify(category.exercises),
        color: category.color
      }
    });
  };

  // Add useEffect to refresh mood history when mood changes
  useEffect(() => {
    if (mood) {
      fetchMoodHistory();
    }
  }, [mood]);

  const analyzeMoodPatterns = async () => {
    setIsAnalyzing(true);
    try {
      if (!user) return;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('mood_tracking')
        .select('mood, date')
        .eq('profile_id', user.id)
        .gte('date', sevenDaysAgo.toISOString())
        .lte('date', now.toISOString())
        .order('date', { ascending: true });

      if (error) throw error;

      const moodCounts = {};
      data.forEach(entry => {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      });

      const totalEntries = data.length;
      const moodDistribution = {};
      for (const mood in moodCounts) {
        moodDistribution[mood] = (moodCounts[mood] / totalEntries) * 100;
      }

      // Simple logic for recommendation (replace with actual AI logic)
      //reduece array into a callbakc fuunction to each element 
      if (totalEntries > 0) {
        const highestMood = Object.keys(moodDistribution).reduce((a, b) => 
          moodDistribution[a] > moodDistribution[b] ? a : b
        //return the key
      
        );

        let recommendation = null;
        if (highestMood === 'great') {
          recommendation = {
            title: 'Great Job!',
            description: 'You\'ve been feeling great lately. Keep up the positive vibes!',
            reason: 'Your mood has been consistently high, indicating a strong sense of well-being.',
            exerciseId: 'mindful_awareness',
            exerciseName: 'Mindful Awareness'
          };
        } else if (highestMood === 'good') {
          recommendation = {
            title: 'Good Job!',
            description: 'You\'ve been feeling good. Keep up the good vibes!',
            reason: 'Your mood has been stable, indicating a balanced mental state.',
            exerciseId: 'body_scan',
            exerciseName: 'Body Scan'
          };
        } else if (highestMood === 'okay') {
          recommendation = {
            title: 'Good Job!',
            description: 'You\'ve been feeling okay. Keep up the good vibes!',
            reason: 'Your mood has been moderate, indicating a manageable mental state.',
            exerciseId: 'box_breathing',
            exerciseName: 'Box Breathing'
          };
        } else if (highestMood === 'bad') {
          recommendation = {
            title: 'Take a Break!',
            description: 'You\'ve been feeling bad. It\'s okay to take a moment for yourself.',
            reason: 'Your mood has been low, suggesting a need for relaxation or a break.',
            exerciseId: '478_breathing',
            exerciseName: '4-7-8 Breathing'
          };
        } else if (highestMood === 'awful') {
          recommendation = {
            title: 'Take a Deep Breath!',
            description: 'You\'ve been feeling awful. It\'s important to take care of yourself.',
            reason: 'Your mood has been extremely low, indicating a need for immediate attention.',
            exerciseId: 'alternate_nostril',
            exerciseName: 'Alternate Nostril Breathing'
          };
        }
        setAiRecommendation(recommendation);
      } else {
        setAiRecommendation(null);
      }
    } catch (error) {
      console.error('Error analyzing mood patterns:', error);
      setAiRecommendation(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartRecommendedExercise = (exerciseId) => {
    const session = mentalSessions.meditation.find(s => s.id === exerciseId) ||
                     mentalSessions.breathing.find(s => s.id === exerciseId);
    if (session) {
      startSession(session);
    } else {
      Alert.alert('Error', 'Recommended exercise not found.');
    }
  };

  /**
   * Handles sharing a mental session with friends.
   * We store session object first, then open the share modal.
   */
  const handleShareMentalSession = (session) => {
    setSelectedSessionForShare(session);
    setShowShareModal(true);
  };

  /**
   * Starts a shared session from the "Shared Sessions" feed.
   * This normalizes field names so we can reuse the existing session runner route.
   */
  const handleStartSharedSession = (session) => {
    const parsedSteps = typeof session.steps === 'string'
      ? (() => {
          try {
            return JSON.parse(session.steps);
          } catch {
            return [];
          }
        })()
      : (session.steps || []);

    startSession({
      id: session.original_session_id || session.id,
      title: session.session_name || session.title || 'Shared Mental Session',
      duration: session.duration || 0,
      description: session.session_description || session.description || '',
      steps: parsedSteps,
      type: session.session_type || 'meditation',
    });
  };

  const handleShareSuccess = () => {
    setShowShareModal(false);
    setSelectedSessionForShare(null);
  };

  if (showSummary) {
    return (
      <MentalSessionSummary 
        sessionData={currentSession}
        onSave={handleSaveSession}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ paddingHorizontal: 20, paddingBottom: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header + two quick-action "tabs": Track Mood opens modal; History goes to session log */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Mental Wellness</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setShowMoodModal(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 255, 255, 0.15)' }]}>
                <Ionicons name="happy-outline" size={24} color="#00ffff" />
              </View>
              <Text style={styles.quickActionText}>Track Mood</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/mental-session-log')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="time-outline" size={24} color="#8b5cf6" />
              </View>
              <Text style={styles.quickActionText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Wellness Recommendation Banner */}
        <View style={styles.aiRecommendationBanner}>
          <View style={styles.aiBannerHeader}>
            <Ionicons name="sparkles" size={24} color="#00ffff" />
            <Text style={styles.aiBannerTitle}>Eleos, Your AI Therapist</Text>
          </View>
          
          {isAnalyzing ? (
            <Text style={styles.aiBannerSubtitle}>Analyzing your mood patterns...</Text>
          ) : aiRecommendation ? (
            <>
              <Text style={styles.aiBannerSubtitle}>
                Based on your mood patterns this week, here's what I recommend:
              </Text>
              
              <View style={styles.aiRecommendationCard}>
                <Text style={styles.recommendationTitle}>
                  {aiRecommendation.title}
                </Text>
                <Text style={styles.recommendationDescription}>
                  {aiRecommendation.description}
                </Text>
                <Text style={styles.recommendationReason}>
                  {aiRecommendation.reason}
                </Text>
                
                <TouchableOpacity 
                  style={styles.startExerciseButton}
                  onPress={() => handleStartRecommendedExercise(aiRecommendation.exerciseId)}
                >
                  <Text style={styles.startExerciseButtonText}>
                    Start {aiRecommendation.exerciseName}
                  </Text>
                  <Ionicons name="play" size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.aiBannerSubtitle}>
              Start tracking your mood to get personalized wellness recommendations!
            </Text>
          )}
        </View>
      
      {/* Quick share the AI recommendation session when available */}
      {aiRecommendation && (
        <TouchableOpacity
          style={styles.enhancedActionButtonSmall}
          onPress={() => {
            const session = mentalSessions.meditation.find(s => s.id === aiRecommendation.exerciseId) ||
              mentalSessions.breathing.find(s => s.id === aiRecommendation.exerciseId);
            if (session) {
              handleShareMentalSession({
                id: session.id,
                session_name: session.title,
                session_type: session.session_type || 'meditation',
                description: session.description,
                duration: session.duration,
                steps: session.steps
              });
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={16} color="#8b5cf6" />
          <Text style={styles.enhancedActionButtonSmallText}>Share Recommended Session</Text>
        </TouchableOpacity>
      )}

      {/* Shared Mental Sessions */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.enhancedSectionHeader}
          onPress={() => setIsSharedSessionsCollapsed(!isSharedSessionsCollapsed)}
          activeOpacity={0.7}
        >
          <View style={styles.enhancedHeaderLeft}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="people-outline" size={22} color="#00ffff" />
            </View>
            <Text style={styles.enhancedSectionTitle}>Shared Sessions</Text>
            <Ionicons
              name={isSharedSessionsCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color="#00ffff"
            />
          </View>
        </TouchableOpacity>
        {!isSharedSessionsCollapsed && (
          <View style={styles.sharedSessionsContainer}>
            <SharedMentalSessionsList onMentalSessionSelect={handleStartSharedSession} />
          </View>
        )}
      </View>

      {activeSession ? (
        <View style={styles.activeSessionContainer}>
          <Text style={styles.activeSessionTitle}>
            {activeSession.session_type === 'meditation'
              ? 'Meditation'
              : activeSession.session_type === 'breathing'
                ? 'Breathing Exercise'
                : activeSession.session_type === 'stress-relief'
                  ? 'Stress Relief'
                  : activeSession.session_type === 'examen'
                    ? 'Daily Examen'
                    : 'Mental Practice'}
          </Text>
          <Text style={styles.timer}>{formatTime(remainingTime)}</Text>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinishSession}
          >
            <Text style={styles.finishButtonText}>Finish Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Practice categories: three equal-width cards per row (main trio + optional extra row) */}
          {!activeSession && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Your Practice</Text>
              <View style={styles.categoriesRow}>
                {categories.slice(0, 3).map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryRowCard, { borderColor: category.color + '40' }]}
                    onPress={() => handleCategoryPress(category)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.categoryRowIcon, { backgroundColor: category.color + '20' }]}>
                      <Ionicons name={category.icon} size={28} color={category.color} />
                    </View>
                    <Text style={styles.categoryRowTitle}>{category.title}</Text>
                    <Text style={styles.categoryRowDescription} numberOfLines={2}>
                      {category.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {categories.length > 3 && (
                <View style={[styles.categoriesRow, styles.categoriesRowExtra]}>
                  {categories.slice(3).map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.categoryRowCard, { borderColor: category.color + '40' }]}
                      onPress={() => handleCategoryPress(category)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.categoryRowIcon, { backgroundColor: category.color + '20' }]}>
                        <Ionicons name={category.icon} size={28} color={category.color} />
                      </View>
                      <Text style={styles.categoryRowTitle}>{category.title}</Text>
                      <Text style={styles.categoryRowDescription} numberOfLines={2}>
                        {category.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.volunteerCard}
              onPress={() => router.push('/volunteer-oppurtunities')}
              activeOpacity={0.85}
            >
              <View style={styles.volunteerHeader}>
                <View style={styles.volunteerIconContainer}>
                  <Ionicons name="heart-circle" size={28} color="#00ffff" />
                </View>
                <View style={styles.volunteerTextContainer}>
                  <Text style={styles.volunteerTitle}>Volunteer Opportunities</Text>
                  <Text style={styles.volunteerSubtitle}>Give back and build social fitness</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#00ffff" />
              </View>

              <Text style={styles.volunteerDescription}>
                Find opportunities that match your skills and interests, and make a
                meaningful impact in your community.
              </Text>

              <View style={styles.volunteerStatBox}>
                <Ionicons name="analytics-outline" size={16} color="#00ffff" />
                <Text style={styles.volunteerStat}>
                  The Harvard Study of Adult Development found social connection and
                  contribution are strong predictors of long-term wellbeing.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Mood Tracking */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How are you feeling today?</Text>
            <TouchableOpacity 
              style={styles.moodButton}
              onPress={() => setShowMoodModal(true)}
            >
              <Text style={styles.moodButtonText}>Track Your Mood</Text>
              <Ionicons name="add-circle-outline" size={24} color="#00ffff" />
            </TouchableOpacity>

            {/* Mood Graph */}
            <MoodGraph moodHistory={moodHistory} />

            {/* Mood History */}
            <View style={styles.moodHistory}>
              <View style={styles.moodHistoryHeader}>
                <Text style={styles.moodHistoryTitle}>Recent Moods</Text>
                <TouchableOpacity onPress={() => router.push('/mood-history')}>
                  <Text style={styles.seeMoreText}>See More</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.moodHistoryList}
              >
                {moodHistory.map((entry, index) => (
                  <View key={index} style={styles.moodHistoryItem}>
                    <Ionicons 
                      name={moodOptions.find(m => m.value === entry.mood)?.icon || 'help-circle'} 
                      size={24} 
                      color={moodOptions.find(m => m.value === entry.mood)?.color || '#fff'} 
                    />
                    <Text style={styles.moodHistoryDate}>
                      {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Mental Health Resources */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mental Health Resources</Text>
            <TouchableOpacity style={styles.resourceCard} onPress={() => Linking.openURL('https://www.who.int/news-room/fact-sheets/detail/adolescent-mental-health')}>
              <Ionicons name="document-text" size={24} color="#00ffff" />
              <View style={styles.resourceContent}>
                <Text style={styles.resourceTitle}>Mental Health Articles</Text>
                <Text style={styles.resourceDescription}>Read expert articles on mental wellness topics</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceCard} onPress={() => Linking.openURL('https://www.samhsa.gov/')}>
              <Ionicons name="call" size={24} color="#ff4444" />
              <View style={styles.resourceContent}>
                <Text style={styles.resourceTitle}>Crisis Support</Text>
                <Text style={styles.resourceDescription}>Access emergency mental health resources</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceCard} onPress={() => Linking.openURL('https://www.psychologytoday.com/us/therapists')}>
              <Ionicons name="people" size={24} color="#44ff44" />
              <View style={styles.resourceContent}>
                <Text style={styles.resourceTitle}>Find a Therapist</Text>
                <Text style={styles.resourceDescription}>Connect with mental health professionals</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Mood Selection Modal */}
      <Modal
        visible={showMoodModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How are you feeling?</Text>
            <View style={styles.moodOptions}>
              {moodOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.moodOption}
                  onPress={() => handleMoodSelect(option.value)}
                >
                  <Ionicons name={option.icon} size={40} color={option.color} />
                  <Text style={styles.moodOptionText}>
                    {option.value.charAt(0).toUpperCase() + option.value.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMoodModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
                  </View>
        </Modal>
      </ScrollView>
      <FloatingAITherapist />

      <MentalSessionShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        mentalSession={selectedSessionForShare}
        onShareSuccess={handleShareSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerSection: {
    paddingTop: 60,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  /* flex: 1 lets both buttons share the row width evenly (like two tabs). */
  quickActionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
    
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  /* Row of practice cards: flex 1 on each card = equal widths in one horizontal row. */
  categoriesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoriesRowExtra: {
    marginTop: 10,
  },
  categoryRowCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryRowIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  categoryRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  categoryRowDescription: {
    fontSize: 11,
    color: '#999',
    lineHeight: 14,
    textAlign: 'center',
    flex: 1,
  },
  moodButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  moodButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  moodHistory: {
    marginTop: 20,
  },
  moodHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  moodHistoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  seeMoreText: {
    color: '#00ffff',
    fontSize: 14,
  },
  moodHistoryList: {
    flexDirection: 'row',
  },
  moodHistoryItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  moodHistoryDate: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resourceContent: {
    flex: 1,
    marginLeft: 15,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  resourceDescription: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  moodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  moodOption: {
    alignItems: 'center',
    margin: 10,
  },
  moodOptionText: {
    color: '#fff',
    marginTop: 5,
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
  },
  stepsContainer: {
    marginBottom: 20,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  stepText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  startSessionButton: {
    backgroundColor: '#00ffff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  startSessionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeSessionButton: {
    backgroundColor: '#44ff44',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  completeSessionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: '#00ffff',
    padding: 8,
    borderRadius: 5,
    marginLeft: 'auto',
  },
  finishButtonText: {
    color: '#000000',
    fontWeight: 'bold',
  },
  activeSessionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  activeSessionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 20,
  },
  aiRecommendationBanner: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  aiBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiBannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ffff',
    marginLeft: 10,
  },
  aiBannerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  aiRecommendationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
  },
  recommendationReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  startExerciseButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 8,
    padding: 10,
  },
  startExerciseButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 5,
  },
  volunteerCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  volunteerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  volunteerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    marginRight: 12,
  },
  volunteerTextContainer: {
    flex: 1,
  },
  volunteerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  volunteerSubtitle: {
    color: '#8ddddd',
    fontSize: 13,
  },
  volunteerDescription: {
    color: '#d7fefe',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  volunteerStatBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    gap: 8,
  },
  volunteerStat: {
    flex: 1,
    color: '#9ea9b1',
    fontSize: 12,
    lineHeight: 18,
  },
  enhancedSectionHeader: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
    padding: 12,
  },
  enhancedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  sharedSessionsContainer: {
    marginTop: 12,
    maxHeight: 520,
  },
  enhancedActionButtonSmall: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 8,
  },
  enhancedActionButtonSmallText: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MentalScreen; 