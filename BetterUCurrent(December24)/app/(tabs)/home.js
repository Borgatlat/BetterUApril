"use client";

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useHomePageCustomization } from '../hooks/useHomePageCustomization';
import { hexToRgba } from '../../utils/homePageCustomization';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import NotificationBadge from '../../components/NotificationBadge';
import NotificationModal from '../../components/NotificationModal';
import { PremiumAvatar } from '../components/PremiumAvatar';
import TrainerModal from '../(modals)/trainer-modal';
import TherapistModal from '../(modals)/therapist-modal';
import { StreakDisplay } from '../../components/StreakDisplay';
import { StreakModal } from '../../components/StreakModal';
import { RecoveryScoreCard } from '../../components/RecoveryScoreCard';
import { RecoverySuggestionsModal } from '../../components/RecoverySuggestionsModal';
import { RecoveryBreakdownModal } from '../../components/RecoveryBreakdownModal';
import { computeRecoveryScore } from '../../utils/recoveryScore';
import WeeklyWellnessCalendar from '../../components/WeeklyWellnessCalendar';
import TodaysScheduleSection from '../../components/TodaysScheduleSection';

const motivationalQuotes = [
  { text: "The only bad workout is the one that didn't happen", author: 'Unknown' },
  { text: 'Strength does not come from the physical capacity. It comes from an indomitable will', author: 'Mahatma Gandhi' },
  { text: 'The body achieves what the mind believes', author: 'Napoleon Hill' },
  { text: 'Pain is temporary. Quitting lasts forever', author: 'Lance Armstrong' },
  { text: "Success isn't always about greatness. It's about consistency", author: 'Dwayne Johnson' },
  { text: 'The only person you are destined to become is the person you decide to be', author: 'Ralph Waldo Emerson' },
  { text: "Don't wish for it. Work for it", author: 'Unknown' },
  { text: "Your body can stand almost anything. It's your mind you have to convince", author: 'Unknown' },
  { text: 'The difference between try and triumph is just a little umph!', author: 'Marvin Phillips' },
  { text: 'Make yourself proud', author: 'Unknown' },
];

const HomeScreen = () => {
  const router = useRouter();
  const { userProfile } = useUser();
  // Toggles from “Change your home page” — reload when returning from that modal so switches apply immediately
  const { prefs: homePrefs, reload: reloadHomePrefs } = useHomePageCustomization();
  useFocusEffect(
    React.useCallback(() => {
      reloadHomePrefs();
    }, [reloadHomePrefs])
  );
  const homeBg = homePrefs.homeBackgroundColor || '#000000';
  const accent = homePrefs.homeAccentColor || '#00ffff';

  const [currentQuote, setCurrentQuote] = useState(() => motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [showTherapistModal, setShowTherapistModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [streakRefreshKey, setStreakRefreshKey] = useState(0);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [recoveryScore, setRecoveryScore] = useState(null);
  const [recoveryHoursLabel, setRecoveryHoursLabel] = useState('Fully recovered');
  const [recoveryBreakdown, setRecoveryBreakdown] = useState({ draggingDown: [], bringingUp: [] });
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [showRecoverySuggestions, setShowRecoverySuggestions] = useState(false);
  const [showRecoveryBreakdown, setShowRecoveryBreakdown] = useState(false);

  useEffect(() => {
    // No need to rotate quotes when that block is hidden (saves a timer + state updates)
    if (!homePrefs.showQuote) return undefined;
    const intervalId = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * motivationalQuotes.length);
        } while (motivationalQuotes[newIndex] === currentQuote);
        setCurrentQuote(motivationalQuotes[newIndex]);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 10000);
    return () => clearInterval(intervalId);
  }, [currentQuote, fadeAnim, homePrefs.showQuote]);

  useEffect(() => {
    let cancelled = false;
    const uid = userProfile?.id;
    if (!uid) {
      setRecoveryLoading(false);
        return;
      }
    setRecoveryLoading(true);
    computeRecoveryScore(uid)
      .then((res) => {
        if (cancelled) return;
        setRecoveryScore(res.score);
        setRecoveryHoursLabel(res.hoursToRecoverLabel);
        setRecoveryBreakdown(res.breakdown || { draggingDown: [], bringingUp: [] });
      })
      .catch(() => {
        if (!cancelled) setRecoveryScore(75);
      })
      .finally(() => {
        if (!cancelled) setRecoveryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userProfile?.id]);

  useFocusEffect(
    React.useCallback(() => {
      if (!userProfile?.id) return;
      computeRecoveryScore(userProfile.id)
        .then((res) => {
          setRecoveryScore(res.score);
          setRecoveryHoursLabel(res.hoursToRecoverLabel);
          setRecoveryBreakdown(res.breakdown || { draggingDown: [], bringingUp: [] });
        })
        .catch(() => {});
    }, [userProfile?.id])
  );

  const showNutritionSection = homePrefs.showDailyNutrition || homePrefs.showFoodScanner;
  const showAiSection = homePrefs.showAIServices || homePrefs.showFutureU;

  return (
    <ScrollView style={[styles.container, { backgroundColor: homeBg }]} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {userProfile?.full_name?.split(' ')[0] || userProfile?.username || 'there'}! 👋</Text>
          <Text style={styles.subtitle}>Let's crush your goals today</Text>
        </View>
        <View style={styles.headerRight}>
          <NotificationBadge
            onPress={() => setShowNotificationModal(true)}
            size="medium"
            showCount={true}
            iconColor={accent}
            style={[
              styles.notificationButton,
              { backgroundColor: hexToRgba(accent, 0.05), borderColor: hexToRgba(accent, 0.1) },
            ]}
          />
          <TouchableOpacity
            style={[
              styles.profileButton,
              { backgroundColor: hexToRgba(accent, 0.05), borderColor: hexToRgba(accent, 0.1) },
            ]}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <PremiumAvatar userId={userProfile?.id} source={userProfile?.avatar_url ? { uri: userProfile.avatar_url } : null} size={40} />
          </TouchableOpacity>
        </View>
      </View>

      {homePrefs.showQuote && (
        <View style={styles.quoteSection}>
          <Animated.View
            style={[
              styles.quoteCard,
              {
                opacity: fadeAnim,
                backgroundColor: hexToRgba(accent, 0.03),
                borderColor: hexToRgba(accent, 0.1),
              },
            ]}
          >
            <Text style={styles.quoteText}>"{currentQuote.text}"</Text>
            <Text style={styles.quoteAuthor}>- {currentQuote.author}</Text>
          </Animated.View>
        </View>
      )}

      {homePrefs.showStreaks && userProfile?.id && (
        <View style={styles.streakContainer}>
          <StreakDisplay userId={userProfile.id} size="medium" onPress={() => setShowStreakModal(true)} refreshKey={streakRefreshKey} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Recovery</Text>
        <RecoveryScoreCard
          score={recoveryScore ?? 75}
          hoursToRecoverLabel={recoveryHoursLabel}
          loading={recoveryLoading}
          accentColor={accent}
          onPress={() => setShowRecoveryBreakdown(true)}
          onWhatShouldIDo={() => setShowRecoverySuggestions(true)}
          />
        </View>

      {showNutritionSection && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Nutrition</Text>
          <View style={styles.actionRow}>
            {homePrefs.showFoodScanner && (
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push({ pathname: '/(tabs)/nutrition', params: { openScan: '1' } })}>
                <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}><Ionicons name="camera" size={22} color={accent} /></View>
                <Text style={styles.actionLabel}>Scan Meal</Text>
              </TouchableOpacity>
            )}
            {homePrefs.showDailyNutrition && (
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/nutrition/saved-meals')}>
                <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}><Ionicons name="restaurant" size={22} color={accent} /></View>
                <Text style={styles.actionLabel}>Log Food</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Plan Your Week</Text>
        <WeeklyWellnessCalendar
          refreshKey={scheduleRefreshKey}
          accentColor={accent}
          onScheduleUpdated={() => setScheduleRefreshKey((k) => k + 1)}
        />
        <TodaysScheduleSection
          refreshKey={scheduleRefreshKey}
          accentColor={accent}
          onFutureuChecklistChanged={() => setScheduleRefreshKey((k) => k + 1)}
        />
            </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Wellness</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/workout')}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(0,255,100,0.15)' }]}><Ionicons name="barbell" size={22} color="#00ff64" /></View>
            <Text style={styles.actionLabel}>Workout</Text>
      </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push({ pathname: '/(tabs)/workout', params: { tab: 'run' } })}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(255,100,100,0.15)' }]}><Ionicons name="walk" size={22} color="#ff6464" /></View>
            <Text style={styles.actionLabel}>Run</Text>
      </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/mental')}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(139,92,246,0.15)' }]}><Ionicons name="leaf" size={22} color="#8b5cf6" /></View>
            <Text style={styles.actionLabel}>Mental</Text>
      </TouchableOpacity>
          </View>
          </View>

      {homePrefs.showAnalyticsCard && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Analytics</Text>
          <TouchableOpacity
            style={[
              styles.seeActivityCard,
              /* Same surface as “See All Activity” — do not override with white/04 or the card looks “off” vs other rows */
              { backgroundColor: hexToRgba(accent, 0.06), borderColor: hexToRgba(accent, 0.1) },
            ]}
            onPress={() => router.push('/(tabs)/analytics')}
            activeOpacity={0.85}
          >
            <View style={[styles.analyticsEntryIcon, { backgroundColor: hexToRgba(accent, 0.12) }]}>
              <Ionicons name="analytics" size={22} color={accent} />
            </View>
            <View style={styles.analyticsEntryTextCol}>
              <Text style={styles.analyticsEntryTitle}>Analytics dashboard</Text>

            </View>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {showAiSection && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Assistants</Text>
          <View style={styles.actionRow}>
            {homePrefs.showAIServices && (
              <>
                <TouchableOpacity style={styles.actionCard} onPress={() => setShowTrainerModal(true)}>
                  <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}><Ionicons name="fitness" size={22} color={accent} /></View>
                  <Text style={styles.actionLabel}>Atlas</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => setShowTherapistModal(true)}>
                  <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(139,92,246,0.15)' }]}><Ionicons name="heart" size={22} color="#8b5cf6" /></View>
                  <Text style={styles.actionLabel}>Eleos</Text>
                </TouchableOpacity>
              </>
            )}
            {homePrefs.showFutureU && (
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/Futureuai')}>
                <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.15) }]}><Ionicons name="rocket" size={22} color={accent} /></View>
                <Text style={styles.actionLabel}>Future U</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
        
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Customize</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(modals)/changeYourHomePage')}>
            <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}><Ionicons name="color-palette" size={22} color={accent} /></View>
            <Text style={styles.actionLabel}>Home Page</Text>
          </TouchableOpacity>
          {homePrefs.showViewPlans && (
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(modals)/ViewPlansModal')}>
              <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.15) }]}><Ionicons name="layers" size={22} color={accent} /></View>
              <Text style={styles.actionLabel}>View Plans</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
            
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Community</Text>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push({ pathname: '/(tabs)/community', params: { openSearch: '1' } })}>
          <View style={[styles.actionIconWrap, { backgroundColor: hexToRgba(accent, 0.12) }]}><Ionicons name="people" size={22} color={accent} /></View>
          <Text style={styles.actionLabel}>Find Friends</Text>
          </TouchableOpacity>
        </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[
            styles.seeActivityCard,
            { backgroundColor: hexToRgba(accent, 0.06), borderColor: hexToRgba(accent, 0.1) },
          ]}
          onPress={() => router.push('/profile/activity')}
        >
          <Ionicons name="list" size={22} color={accent} />
          <Text style={styles.seeActivityText}>See All Activity</Text>
          <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>

      <NotificationModal visible={showNotificationModal} onClose={() => setShowNotificationModal(false)} />
      <RecoverySuggestionsModal visible={showRecoverySuggestions} onClose={() => setShowRecoverySuggestions(false)} userId={userProfile?.id} onRestDayAdded={() => setScheduleRefreshKey((k) => k + 1)} />
      <RecoveryBreakdownModal
        visible={showRecoveryBreakdown}
        onClose={() => setShowRecoveryBreakdown(false)}
        score={recoveryScore ?? 75}
        hoursToRecoverLabel={recoveryHoursLabel}
        breakdown={recoveryBreakdown}
        onWhatShouldIDo={() => {
          setShowRecoveryBreakdown(false);
          setShowRecoverySuggestions(true);
        }}
      />
      {showTrainerModal && <TrainerModal visible={showTrainerModal} onClose={() => setShowTrainerModal(false)} />}
      {showTherapistModal && <TherapistModal visible={showTherapistModal} onClose={() => setShowTherapistModal(false)} />}
      {userProfile?.id && (
        <StreakModal
          visible={showStreakModal}
          onClose={() => {
            setShowStreakModal(false);
            setTimeout(() => setStreakRefreshKey((prev) => prev + 1), 300);
          }}
          userId={userProfile.id}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { paddingBottom: 80 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 4 },
  notificationButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(0,255,255,0.1)' },
  profileButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(0,255,255,0.1)' },
  quoteSection: { paddingHorizontal: 20, alignItems: 'center' },
  quoteCard: { backgroundColor: 'rgba(0,255,255,0.03)', borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: 'rgba(0,255,255,0.1)' },
  quoteText: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  quoteAuthor: { fontSize: 14, color: '#666' },
  streakContainer: { alignItems: 'center', marginTop: 12, marginBottom: 16, paddingHorizontal: 20, width: '100%' },
  section: { width: '100%', paddingHorizontal: 20, marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 12, letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  actionCard: { flex: 1, minWidth: 100, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16, alignItems: 'center' },
  actionIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  seeActivityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,255,255,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,255,255,0.1)', padding: 16 },
  seeActivityText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 12 },
  analyticsEntryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  analyticsEntryTextCol: { flex: 1, marginRight: 8 },
  analyticsEntryTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  analyticsEntryHint: { fontSize: 13, color: '#888', marginTop: 2 },
});

export default HomeScreen;
