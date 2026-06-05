import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import WeeklyWellnessCalendar from '../../components/WeeklyWellnessCalendar';
import TodaysScheduleSection from '../../components/TodaysScheduleSection';
import HomeActivePlanCard from '../../components/HomeActivePlanCard';
import { useHomePageCustomization } from '../../hooks/useHomePageCustomization';
import { useScheduleRefresh } from '../../context/ScheduleRefreshContext';

export default function PlanYourWeekModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefs: homePrefs } = useHomePageCustomization();
  const accent = homePrefs.homeAccentColor || '#00ffff';
  const { refreshKey: scheduleRefreshKey, notifyScheduleUpdated } = useScheduleRefresh();
  const showPlanCard = homePrefs.showFutureU || homePrefs.showViewPlans;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Your Week</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <WeeklyWellnessCalendar accentColor={accent} />

        {showPlanCard ? (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Your plan</Text>
            <HomeActivePlanCard
              accentColor={accent}
              onViewAll={
                homePrefs.showViewPlans
                  ? () => router.push('/(modals)/ViewPlansModal')
                  : undefined
              }
            />
          </View>
        ) : null}

        <View style={styles.block}>
          <TodaysScheduleSection
            refreshKey={scheduleRefreshKey}
            accentColor={accent}
            onFutureuChecklistChanged={notifyScheduleUpdated}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  block: {
    marginBottom: 8,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
