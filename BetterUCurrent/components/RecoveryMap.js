import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Body from 'react-native-body-highlighter';
import {
  fetchRecoveryWorkouts,
  computeMuscleRecovery,
  buildBodyHighlighterData,
} from '../utils/recoveryEngine';

const { width: screenWidth } = Dimensions.get('window');

/** Legend grouped by region; each item uses the original pill + label chip style. */
const LEGEND_SECTIONS = [
  {
    title: 'Upper body',
    groups: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs'],
  },
  {
    title: 'Lower body',
    groups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  },
];

/** Pill fill — solid core with a minimal recovery tint (same layout as before). */
function getRecoveryPillStyle(recoveryPct) {
  if (recoveryPct >= 90) {
    return { backgroundColor: '#2d2d2d', borderColor: 'rgba(255, 255, 255, 0.12)' };
  }
  if (recoveryPct >= 70) {
    return { backgroundColor: '#5a4d78', borderColor: 'rgba(107, 91, 149, 0.55)' };
  }
  if (recoveryPct >= 50) {
    return { backgroundColor: '#7a3333', borderColor: 'rgba(139, 58, 58, 0.55)' };
  }
  return { backgroundColor: '#8b3a3a', borderColor: 'rgba(200, 80, 80, 0.5)' };
}

/**
 * Recovery Map Component
 *
 * Shows muscle group recovery status using react-native-body-highlighter.
 * Displays front/back body views with upper- and lower-body muscle highlighting and
 * color-coded muscle highlighting and percentage pills.
 *
 * @param {string} userId - Supabase user id; used to fetch user_workout_logs. Required when workouts is not passed.
 * @param {Array|null} workouts - Optional pre-fetched workout logs (e.g. from Analytics). If provided, no fetch is done.
 * @param {number} refreshKey - Optional. When this value changes, the map refetches from the server. Parents can pass a key they bump on focus so the map updates when the user returns to the screen.
 */
const RecoveryMap = ({
  userId,
  workouts: workoutsProp,
  refreshKey,
  accentColor = '#00ffff',
  /** Set false when the parent already shows a Home-style section label above this card. */
  showSectionTitle = true,
}) => {
  const [workouts, setWorkouts] = useState(workoutsProp ?? null);
  const [loading, setLoading] = useState(!workoutsProp && !!userId);
  const [error, setError] = useState(null);
  const [showRecoveryDetails, setShowRecoveryDetails] = useState(false);

  useEffect(() => {
    if (workoutsProp != null) {
      setWorkouts(workoutsProp);
      setLoading(false);
      return;
    }
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setError(null);
        const data = await fetchRecoveryWorkouts(userId);
        if (cancelled) return;
        setWorkouts(data);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load recovery data');
          setWorkouts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, workoutsProp, refreshKey]);

  const { recoveryPct } = computeMuscleRecovery(workouts || []);

  if (loading) {
    return (
      <View style={styles.container}>
        {showSectionTitle ? <Text style={styles.sectionTitle}>Recovery Map</Text> : null}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.loadingText}>Loading recovery…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {showSectionTitle ? <Text style={styles.sectionTitle}>Recovery Map</Text> : null}
        <View style={styles.loadingBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const colors = ['#8b3a3a', '#6b5b95', '#2d2d2d'];
  const scale = Math.min(0.6, (screenWidth - 60) / 400);
  const { frontData, backData } = buildBodyHighlighterData(recoveryPct);

  return (
    <View style={styles.container}>
      {showSectionTitle ? <Text style={styles.sectionTitle}>Recovery Map</Text> : null}

      <View style={styles.bodyRow}>
        <View style={styles.bodyColumn}>
          <Text style={styles.bodyLabel}>Front</Text>
          <View style={styles.bodyWrapper}>
            <Body
              data={frontData}
              colors={colors}
              side="front"
              scale={scale}
              border="#555"
              defaultFill="#333"
            />
          </View>
        </View>
        <View style={styles.bodyColumn}>
          <Text style={styles.bodyLabel}>Back</Text>
          <View style={styles.bodyWrapper}>
            <Body
              data={backData}
              colors={colors}
              side="back"
              scale={scale}
              border="#555"
              defaultFill="#333"
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.seeRecoveryBtn, { borderColor: `${accentColor}44` }]}
        onPress={() => setShowRecoveryDetails((v) => !v)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={showRecoveryDetails ? 'Hide muscle recovery percentages' : 'See muscle recovery percentages'}
      >
        <Text style={[styles.seeRecoveryText, { color: accentColor }]}>
          {showRecoveryDetails ? 'Hide recovery' : 'See recovery'}
        </Text>
        <Ionicons
          name={showRecoveryDetails ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={accentColor}
        />
      </TouchableOpacity>

      {showRecoveryDetails && (
        <View style={styles.legend}>
          {LEGEND_SECTIONS.map((section) => (
            <View key={section.title} style={styles.legendSection}>
              <Text style={styles.legendSectionTitle}>{section.title}</Text>
              <View style={styles.legendRow}>
                {section.groups.map((group) => {
                  const pct = recoveryPct[group] ?? 100;
                  return (
                    <View key={group} style={styles.legendItem}>
                      <View style={[styles.pill, getRecoveryPillStyle(pct)]}>
                        <Text style={styles.pillText}>{pct}%</Text>
                      </View>
                      <Text style={styles.legendLabel}>{group}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 8,
  },
  errorText: {
    color: '#cc6666',
    fontSize: 14,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bodyColumn: {
    alignItems: 'center',
  },
  bodyLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  bodyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeRecoveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  seeRecoveryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    marginTop: 8,
    gap: 12,
  },
  legendSection: {
    gap: 6,
  },
  legendSectionTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  legendLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default RecoveryMap;
