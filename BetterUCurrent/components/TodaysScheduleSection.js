import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getScheduledActivitiesForDate, getLocalDateString } from '../utils/scheduledWorkoutHelpers';
import {
  loadFutureuPlanArtifact,
  updateFutureuPlanChecklistItem,
  getFutureuChecklistByLocalDate,
} from '../utils/futureuPlanStorage';
import { NutritionTheme as T } from '../config/NutritionTheme';
import { openWorkoutDetail } from '../utils/navigateToWorkoutDetail';

const FUTURE_U_ACCENT = '#eab308';

const ACTIVITY_CONFIG = {
  run: { icon: 'walk', color: '#ff6b6b', label: 'Run' },
  walk: { icon: 'footsteps', color: '#4ecdc4', label: 'Walk' },
  bike: { icon: 'bicycle', color: '#45b7d1', label: 'Bike' },
  workout: { icon: 'barbell', color: '#00ffff', label: 'Workout' },
  mental_session: { icon: 'leaf', color: '#8b5cf6', label: 'Mental Session' },
};

/**
 * TodaysScheduleSection - Activity cards for today's scheduled items
 * Renders workout, mental session, run/walk/bike. Tapping starts that activity.
 */
const TodaysScheduleSection = ({
  refreshKey = 0,
  onFutureuChecklistChanged,
  accentColor = '#00ffff',
  compact = false,
  maxPreviewItems = 2,
  onSeeMore,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  /** Checklist rows from Future U plan mapped to today’s local date */
  const [futureTodayItems, setFutureTodayItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const activityConfig = useMemo(
    () => ({
      ...ACTIVITY_CONFIG,
      workout: { ...ACTIVITY_CONFIG.workout, color: accentColor },
    }),
    [accentColor]
  );

  const loadToday = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const today = new Date();
      const todayStr = getLocalDateString(today);
      const { data, error } = await getScheduledActivitiesForDate(user.id, today);
      if (error) throw error;
      const list = (data || []).filter(a => a.activity_type !== 'rest_day' && !a.is_rest_day);
      setActivities(list);

      const plan = await loadFutureuPlanArtifact();
      const byDate = getFutureuChecklistByLocalDate(plan);
      setFutureTodayItems(byDate[todayStr] || []);
    } catch (err) {
      console.error('Error loading today schedule:', err);
      setActivities([]);
      setFutureTodayItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadToday();
  }, [loadToday, refreshKey]);

  // Light refresh: Future U plan lives in AsyncStorage — sync checklist rows when Home regains focus.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const plan = await loadFutureuPlanArtifact();
        if (!alive) return;
        const todayStr = getLocalDateString(new Date());
        setFutureTodayItems(getFutureuChecklistByLocalDate(plan)[todayStr] || []);
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const handleUndoActivity = async (activity) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activity.id ? { ...a, completed: false, completed_at: null } : a
      )
    );
    try {
      await supabase
        .from('scheduled_workouts')
        .update({ completed: false, completed_at: null })
        .eq('id', activity.id)
        .eq('user_id', user.id);
    } catch (e) {
      console.error('Error undoing completion:', e);
      await loadToday();
    }
    onFutureuChecklistChanged?.();
  };

  const handleStartActivity = async (activity) => {
    const config = activityConfig[activity.activity_type];
    if (!config) return;

    if (activity.completed) {
      await handleUndoActivity(activity);
      return;
    }

    setActivities(prev =>
      prev.map(a =>
        a.id === activity.id
          ? { ...a, completed: true, completed_at: new Date().toISOString() }
          : a
      )
    );

    try {
      await supabase
        .from('scheduled_workouts')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', activity.id)
        .eq('user_id', user.id);
    } catch (e) {
      console.error('Error marking completed:', e);
    }

    if (activity.activity_type === 'workout') {
      openWorkoutDetail(router, {
        name: activity.workout_name,
        workout_name: activity.workout_name,
        exercises: activity.workout_exercises || [],
        isScheduled: true,
        scheduledWorkoutId: activity.id,
        scheduledDate: activity.scheduled_date,
      }, {
        startMode: 'custom',
        includeWorkoutId: false,
      });
      return;
    }

    if (activity.activity_type === 'mental_session') {
      let sessionData = null;
      if (activity.notes) {
        try {
          sessionData = JSON.parse(activity.notes);
        } catch (_) {}
      }

      if (sessionData?.type === 'custom' && sessionData.custom_session_id) {
        const { data: customSession } = await supabase
          .from('custom_mental_sessions')
          .select('*')
          .eq('id', sessionData.custom_session_id)
          .single();
        if (customSession) {
          const steps = Array.isArray(customSession.steps)
            ? customSession.steps.map(s => typeof s === 'string' ? s : (s.instruction || s.step || ''))
            : [];
          router.push({
            pathname: '/active-mental-session',
            params: {
              id: customSession.id,
              title: customSession.title,
              duration: String(customSession.duration_minutes || customSession.duration || 10),
              description: customSession.description || '',
              steps: JSON.stringify(steps),
              type: customSession.session_type || 'meditation'
            }
          });
          return;
        }
      }

      if (sessionData?.type === 'builtin' && sessionData.session) {
        const s = sessionData.session;
        router.push({
          pathname: '/active-mental-session',
          params: {
            id: s.id,
            title: s.title,
            duration: String(s.duration || 10),
            description: s.description || '',
            steps: JSON.stringify(s.steps || []),
            type: 'meditation'
          }
        });
        return;
      }

      router.push('/(tabs)/mental');
      return;
    }

    if (['run', 'walk', 'bike'].includes(activity.activity_type)) {
      router.push({
        pathname: '/(tabs)/workout',
        params: { tab: 'run', activityType: activity.activity_type }
      });
    }
  };

  const handleFutureItemPress = async (item) => {
    const id = item?.id != null ? String(item.id) : '';
    if (!id) return;
    const nextDone = !item.completed;
    setFutureTodayItems((prev) =>
      prev.map((row) => (String(row.id) === id ? { ...row, completed: nextDone } : row))
    );
    const updated = await updateFutureuPlanChecklistItem(id, nextDone);
    if (updated) {
      const todayStr = getLocalDateString(new Date());
      const byDate = getFutureuChecklistByLocalDate(updated);
      setFutureTodayItems(byDate[todayStr] || []);
    } else {
      await loadToday();
    }
    onFutureuChecklistChanged?.();
  };

  if (loading) return null;
  if (activities.length === 0 && futureTodayItems.length === 0) return null;

  const totalCount = activities.length + futureTodayItems.length;

  if (compact) {
    const previewActivities = activities.slice(0, maxPreviewItems);
    const remainingSlots = Math.max(0, maxPreviewItems - previewActivities.length);
    const previewFuture = remainingSlots > 0 ? futureTodayItems.slice(0, remainingSlots) : [];
    const shownCount = previewActivities.length + previewFuture.length;
    const hiddenCount = totalCount - shownCount;

    return (
      <View style={[styles.container, styles.containerCompact]}>
        <Text style={styles.compactSummary}>
          Today · {totalCount} scheduled
        </Text>
        {previewActivities.map((activity) => {
          const config = activityConfig[activity.activity_type];
          if (!config) return null;
          const isCompleted = activity.completed === true;
          const title = activity.title || activity.workout_name || config.label;

          return (
            <TouchableOpacity
              key={activity.id}
              style={[styles.card, styles.cardCompact, isCompleted && styles.cardCompleted]}
              onPress={() => handleStartActivity(activity)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, styles.iconWrapCompact, { backgroundColor: config.color + '25' }]}>
                <Ionicons
                  name={isCompleted ? 'checkmark-circle' : config.icon}
                  size={18}
                  color={isCompleted ? '#00ff00' : config.color}
                />
              </View>
              <View style={styles.compactContentCol}>
                <Text style={[styles.title, styles.titleCompact, isCompleted && styles.titleCompleted]} numberOfLines={1}>
                  {title}
                </Text>
                {isCompleted ? (
                  <Text style={styles.compactUndoHint}>Tap to undo</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        {previewFuture.map((item) => {
          const label = String(item.text || 'Plan step').trim();
          const done = !!item.completed;
          return (
            <TouchableOpacity
              key={String(item.id)}
              style={[styles.card, styles.cardCompact, styles.futureCard, done && styles.cardCompleted]}
              onPress={() => handleFutureItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, styles.iconWrapCompact, { backgroundColor: FUTURE_U_ACCENT + '25' }]}>
                <Ionicons
                  name={done ? 'checkmark-circle' : 'rocket-outline'}
                  size={18}
                  color={done ? '#00ff00' : FUTURE_U_ACCENT}
                />
              </View>
              <View style={styles.compactContentCol}>
                <Text style={[styles.title, styles.titleCompact, done && styles.titleCompleted]} numberOfLines={1}>
                  {label}
                </Text>
                {done ? (
                  <Text style={styles.compactUndoHint}>Tap to undo</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        {(hiddenCount > 0 || onSeeMore) ? (
          <TouchableOpacity style={styles.seeMoreBtn} onPress={onSeeMore} activeOpacity={0.75}>
            <Text style={[styles.seeMoreText, { color: accentColor }]}>
              {hiddenCount > 0 ? `See ${hiddenCount} more` : 'See full schedule'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={accentColor} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Today's Schedule</Text>
      {activities.map((activity) => {
        const config = activityConfig[activity.activity_type];
        if (!config) return null;
        const isCompleted = activity.completed === true;
        const title = activity.title || activity.workout_name || config.label;

        return (
          <TouchableOpacity
            key={activity.id}
            style={[styles.card, isCompleted && styles.cardCompleted]}
            onPress={() => handleStartActivity(activity)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: config.color + '25' }]}>
              {isCompleted ? (
                <Ionicons name="checkmark-circle" size={22} color="#00ff00" />
              ) : (
                <Ionicons name={config.icon} size={22} color={config.color} />
              )}
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle}>
                {isCompleted ? 'Completed — tap to undo' : `Tap to start ${config.label}`}
              </Text>
            </View>
            {!isCompleted && (
              <Ionicons name="play-circle" size={28} color={config.color} />
            )}
            {isCompleted ? (
              <Ionicons name="arrow-undo-outline" size={24} color={config.color} />
            ) : null}
          </TouchableOpacity>
        );
      })}

      {futureTodayItems.length > 0 ? (
        <>
          <Text style={[styles.header, styles.futureSubheader]}>Plans for the future (Future U)</Text>
          {futureTodayItems.map((item) => {
            const label = String(item.text || 'Plan step').trim();
            const done = !!item.completed;
            return (
              <TouchableOpacity
                key={String(item.id)}
                style={[styles.card, styles.futureCard, done && styles.cardCompleted]}
                onPress={() => handleFutureItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: FUTURE_U_ACCENT + '25' }]}>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={22} color="#00ff00" />
                  ) : (
                    <Ionicons name="rocket-outline" size={22} color={FUTURE_U_ACCENT} />
                  )}
                </View>
                <View style={styles.content}>
                  <Text style={[styles.title, done && styles.titleCompleted]} numberOfLines={2}>
                    {label}
                  </Text>
                  <Text style={styles.subtitle}>
                    {done ? 'Done — tap to undo' : 'Tap to mark done or open Future U for details'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/Futureuai')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color={FUTURE_U_ACCENT} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: T.sectionGap,
    marginBottom: T.sectionGap,
  },
  containerCompact: {
    marginTop: 8,
    marginBottom: 0,
  },
  compactSummary: {
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
    marginBottom: 8,
  },
  compactUndoHint: {
    fontSize: 11,
    color: T.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  compactContentCol: {
    flex: 1,
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    color: T.text,
    marginBottom: 12,
  },
  futureSubheader: {
    marginTop: 6,
    fontSize: 15,
    color: FUTURE_U_ACCENT,
  },
  futureCard: {
    borderColor: 'rgba(234, 179, 8, 0.35)',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.cardBg,
    borderRadius: T.cardRadius,
    padding: T.cardPadding,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  cardCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
  },
  cardCompleted: {
    opacity: 0.75,
    borderColor: 'rgba(0, 255, 0, 0.25)',
    backgroundColor: 'rgba(0, 255, 0, 0.04)',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: T.cardRadius - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapCompact: {
    width: 34,
    height: 34,
    borderRadius: 10,
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: T.text,
  },
  titleCompact: {
    fontSize: 14,
  },
  titleCompleted: {
    color: T.textMuted,
  },
  subtitle: {
    fontSize: 13,
    color: T.textMuted,
    marginTop: 4,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 2,
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
});

export default TodaysScheduleSection;
