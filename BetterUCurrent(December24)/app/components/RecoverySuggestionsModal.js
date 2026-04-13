/**
 * RecoverySuggestionsModal – "What should I do?" recovery activities.
 * Redesigned: bottom sheet with card-style options and clear hierarchy.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// app/components is one folder deeper than root components, so we need ../../ for utils.
import { addScheduledWorkout, getScheduledActivitiesForDate } from '../../utils/scheduledWorkoutHelpers';

const SUGGESTIONS = [
  {
    id: 'foam_rolling',
    title: 'Foam Rolling',
    duration: '15–20 min',
    subtitle: 'Release tension in legs and back',
    icon: 'body',
    action: 'workout',
    workoutType: 'Foam Rolling',
    accent: '#00e676',
  },
  {
    id: 'stretching',
    title: 'Stretching',
    duration: '15–20 min',
    subtitle: 'Static stretches for flexibility',
    icon: 'fitness',
    action: 'workout',
    workoutType: 'Stretching',
    accent: '#00e676',
  },
  {
    id: 'walk',
    title: 'Easy Walk',
    duration: '20–30 min',
    subtitle: 'Light movement to promote recovery',
    icon: 'walk',
    action: 'run',
    activityType: 'walk',
    accent: '#00b0ff',
  },
  {
    id: 'bike',
    title: 'Easy Bike',
    duration: '20–30 min',
    subtitle: 'Low-impact cardio',
    icon: 'bicycle',
    action: 'run',
    activityType: 'bike',
    accent: '#00b0ff',
  },
  {
    id: 'rest',
    title: 'Rest',
    duration: 'Today',
    subtitle: 'Take the day off. Sleep and hydrate.',
    icon: 'moon',
    action: 'rest',
    accent: '#b388ff',
  },
];

export function RecoverySuggestionsModal({ visible, onClose, userId, onRestDayAdded }) {
  const router = useRouter();
  const [restAdding, setRestAdding] = useState(false);

  const handlePress = async (item) => {
    if (item.action === 'rest') {
      if (!userId) {
        Alert.alert('Rest day', 'Sign in to schedule a rest day.');
        return;
      }
      setRestAdding(true);
      try {
        const { data: existing } = await getScheduledActivitiesForDate(userId, new Date());
        const hasRestDay = existing?.some((a) => a.activity_type === 'rest_day' || a.is_rest_day);
        if (hasRestDay) {
          Alert.alert('Already a rest day', 'Today is already scheduled as a rest day.');
          setRestAdding(false);
          return;
        }
        const { error } = await addScheduledWorkout(userId, new Date(), {
          activity_type: 'rest_day',
          is_rest_day: true,
          notes: 'Rest day',
        });
        if (error) throw error;
        onRestDayAdded?.();
        onClose?.();
        Alert.alert('Rest day added', "Today is now a rest day on your calendar.");
      } catch (e) {
        Alert.alert('Error', 'Could not add rest day. Please try again.');
      } finally {
        setRestAdding(false);
      }
      return;
    }
    onClose?.();
    if (item.action === 'workout') {
      router.push({ pathname: '/active-workout', params: { type: item.workoutType } });
    } else if (item.action === 'run') {
      router.push({
        pathname: '/(tabs)/workout',
        params: { tab: 'run', activityType: item.activityType },
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheetPress}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.title}>What should I do?</Text>
                <Text style={styles.subtitle}>Choose an activity that fits how you feel</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={16}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {SUGGESTIONS.map((item) => {
                  const isRest = item.action === 'rest';
                  const loading = isRest && restAdding;
                  return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.optionCard}
                    onPress={() => handlePress(item)}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <View style={[styles.optionIconWrap, { backgroundColor: item.accent + '22' }]}>
                      <Ionicons name={item.icon} size={24} color={item.accent} />
                    </View>
                    <View style={styles.optionBody}>
                      <Text style={styles.optionTitle}>{item.title}</Text>
                      <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
                      <View style={styles.optionMeta}>
                        <Ionicons name="time-outline" size={14} color="#666" />
                        <Text style={styles.optionDuration}>{item.duration}</Text>
                      </View>
                    </View>
                    {loading ? (
                      <ActivityIndicator size="small" color={item.accent} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                    )}
                  </TouchableOpacity>
                );})}
              </ScrollView>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    paddingTop: 48,
  },
  sheetWrap: {
    flex: 1,
    width: '100%',
  },
  sheetPress: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    position: 'relative',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 20,
    padding: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  optionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionDuration: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
});
