import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import {
  addScheduledWorkout,
  addScheduledRun,
  addScheduledWalk,
  addScheduledBike,
  addScheduledMentalSession,
  addRestDay,
  deleteScheduledWorkout,
} from '../utils/scheduledWorkoutHelpers';
import ScheduledWorkoutModal from './ScheduledWorkoutModal';

const ACTIVITY_META = {
  run: { icon: 'walk', color: '#ff6b6b', label: 'Run' },
  walk: { icon: 'footsteps', color: '#4ecdc4', label: 'Walk' },
  bike: { icon: 'bicycle', color: '#45b7d1', label: 'Bike' },
  workout: { icon: 'barbell', color: '#00ffff', label: 'Workout' },
  mental_session: { icon: 'leaf', color: '#8b5cf6', label: 'Mental' },
  rest_day: { icon: 'bed', color: '#ffa500', label: 'Rest day' },
};

function activityTitle(row) {
  if (row.is_rest_day || row.activity_type === 'rest_day') return 'Rest day';
  return row.title || row.workout_name || ACTIVITY_META[row.activity_type]?.label || 'Activity';
}

/**
 * Plan all activity types for one day. Gym scheduling uses nested ScheduledWorkoutModal
 * (same workout_id / workout_exercises linkage as before).
 */
export default function DayScheduleModal({
  visible,
  onClose,
  selectedDate,
  existingActivities = [],
  scheduleContext = null,
  onScheduleUpdated,
}) {
  const { userProfile } = useUser();
  const [activities, setActivities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);

  useEffect(() => {
    if (visible) {
      setActivities(Array.isArray(existingActivities) ? existingActivities : []);
    }
  }, [visible, existingActivities]);

  const workoutActivity = useMemo(
    () => activities.find((a) => a.activity_type === 'workout' && !a.is_rest_day),
    [activities]
  );

  const accent = '#00ffff';

  const promptTitle = (label, defaultTitle, onSubmit) => {
    Alert.prompt(
      `Schedule ${label}`,
      'Title (optional)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (text) => onSubmit((text || '').trim() || defaultTitle),
        },
      ],
      'plain-text',
      defaultTitle
    );
  };

  const handleAddCardio = async (type, defaultTitle) => {
    if (!userProfile?.id || !selectedDate) return;
    promptTitle(ACTIVITY_META[type].label, defaultTitle, async (title) => {
      setSaving(true);
      try {
        const fn =
          type === 'run' ? addScheduledRun : type === 'walk' ? addScheduledWalk : addScheduledBike;
        const { error } = await fn(userProfile.id, selectedDate, title);
        if (error) throw error;
        onScheduleUpdated?.();
        onClose();
      } catch (e) {
        Alert.alert('Error', 'Could not schedule activity');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleAddMental = () => {
    if (!userProfile?.id || !selectedDate) return;
    promptTitle('Mental session', 'Mental session', async (title) => {
      setSaving(true);
      try {
        const { error } = await addScheduledMentalSession(userProfile.id, selectedDate, title);
        if (error) throw error;
        onScheduleUpdated?.();
        onClose();
      } catch (e) {
        Alert.alert('Error', 'Could not schedule session');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleRestDay = () => {
    if (!userProfile?.id || !selectedDate) return;
    Alert.alert(
      'Rest day',
      'Mark this day as rest? Existing items for this day will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rest day',
          onPress: async () => {
            setSaving(true);
            try {
              for (const a of activities) {
                await deleteScheduledWorkout(a.id);
              }
              const { error } = await addRestDay(userProfile.id, selectedDate);
              if (error) throw error;
              onScheduleUpdated?.();
              onClose();
            } catch (e) {
              Alert.alert('Error', 'Could not mark rest day');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (row) => {
    Alert.alert('Remove', `Remove "${activityTitle(row)}" from this day?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await deleteScheduledWorkout(row.id);
            if (error) throw error;
            setActivities((prev) => prev.filter((a) => a.id !== row.id));
            onScheduleUpdated?.();
          } catch (e) {
            Alert.alert('Error', 'Could not remove');
          }
        },
      },
    ]);
  };

  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <>
      <Modal visible={visible && !showWorkoutModal} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Plan this day</Text>
                <Text style={styles.subtitle}>{dateLabel}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close-circle" size={32} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {activities.length === 0 ? (
                <Text style={styles.empty}>Nothing scheduled yet. Add an activity below.</Text>
              ) : (
                activities.map((row) => {
                  const meta = ACTIVITY_META[row.activity_type] || ACTIVITY_META.workout;
                  return (
                    <View key={row.id} style={styles.row}>
                      <Ionicons name={meta.icon} size={22} color={meta.color} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{activityTitle(row)}</Text>
                        <Text style={styles.rowType}>{meta.label}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(row)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={20} color="#ff6666" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              <Text style={styles.addLabel}>Add</Text>
              <View style={styles.addGrid}>
                <TouchableOpacity
                  style={[styles.addBtn, { borderColor: accent }]}
                  onPress={() => setShowWorkoutModal(true)}
                  disabled={saving}
                >
                  <Ionicons name="barbell" size={22} color={accent} />
                  <Text style={[styles.addBtnText, { color: accent }]}>
                    {workoutActivity ? 'Change workout' : 'Workout'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleAddCardio('run', 'Run')}
                  disabled={saving}
                >
                  <Ionicons name="walk" size={22} color="#ff6b6b" />
                  <Text style={styles.addBtnText}>Run</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleAddCardio('walk', 'Walk')}
                  disabled={saving}
                >
                  <Ionicons name="footsteps" size={22} color="#4ecdc4" />
                  <Text style={styles.addBtnText}>Walk</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleAddCardio('bike', 'Bike')}
                  disabled={saving}
                >
                  <Ionicons name="bicycle" size={22} color="#45b7d1" />
                  <Text style={styles.addBtnText}>Bike</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleAddMental} disabled={saving}>
                  <Ionicons name="leaf" size={22} color="#8b5cf6" />
                  <Text style={styles.addBtnText}>Mental</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleRestDay} disabled={saving}>
                  <Ionicons name="bed" size={22} color="#ffa500" />
                  <Text style={styles.addBtnText}>Rest</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {saving && (
              <View style={styles.saving}>
                <ActivityIndicator color={accent} />
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ScheduledWorkoutModal
        visible={showWorkoutModal}
        onClose={() => setShowWorkoutModal(false)}
        selectedDate={selectedDate}
        existingWorkout={workoutActivity || null}
        scheduleContext={scheduleContext}
        onWorkoutUpdated={() => {
          setShowWorkoutModal(false);
          onScheduleUpdated?.();
          onClose();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.15)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  empty: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    marginBottom: 8,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rowType: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  addLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  addGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addBtn: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 6,
  },
  addBtnText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  saving: {
    padding: 16,
    alignItems: 'center',
  },
});
