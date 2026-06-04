import { Dimensions } from 'react-native';
import { getLocalDateString } from './scheduledWorkoutHelpers';
import { hexToRgba } from './homePageCustomization';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Section padding (20×2) + chart card padding (16×2). */
export const ANALYTICS_CHART_HORIZONTAL_INSET = 72;

/** Inner drawable width for react-native-chart-kit (avoids clipped labels). */
export function getAnalyticsChartWidth() {
  return Math.max(260, SCREEN_WIDTH - ANALYTICS_CHART_HORIZONTAL_INSET);
}

/** Dark chart surfaces that match Home / Analytics (react-native-chart-kit). */
export function getAnalyticsChartTheme(homeBg = '#000000', accent = '#00ffff') {
  const bg = (homeBg || '#000000').trim();
  return {
    backgroundColor: bg,
    backgroundGradientFrom: bg,
    backgroundGradientTo: bg,
    containerBg: hexToRgba(accent, 0.06),
    containerBorder: hexToRgba(accent, 0.2),
    accent,
    line: (opacity = 1) => hexToRgba(accent, opacity),
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${Math.min(1, opacity * 0.72)})`,
    gridStroke: hexToRgba(accent, 0.14),
    dotFill: bg,
    dotStroke: accent,
  };
}

const chartLabelProps = {
  fontSize: 11,
  fontWeight: '500',
};

function baseChartConfig(theme, decimalPlaces = 0) {
  return {
    backgroundColor: theme.backgroundColor,
    backgroundGradientFrom: theme.backgroundGradientFrom,
    backgroundGradientTo: theme.backgroundGradientTo,
    decimalPlaces,
    color: theme.line,
    labelColor: theme.labelColor,
    style: { borderRadius: 12 },
    propsForLabels: chartLabelProps,
    propsForVerticalLabels: { ...chartLabelProps, fontSize: 10 },
    propsForBackgroundLines: {
      strokeDasharray: '4 8',
      stroke: theme.gridStroke,
      strokeWidth: 1,
    },
    fillShadowGradientFrom: theme.backgroundGradientFrom,
    fillShadowGradientTo: theme.backgroundGradientTo,
    fillShadowGradientOpacity: 0,
    useShadowColorFromDataset: false,
  };
}

export function buildLineChartConfig(theme, decimalPlaces = 0) {
  return {
    ...baseChartConfig(theme, decimalPlaces),
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.dotStroke,
      fill: theme.dotFill,
    },
  };
}

export function buildBarChartConfig(theme, decimalPlaces = 0) {
  return {
    ...baseChartConfig(theme, decimalPlaces),
    barPercentage: 0.55,
    propsForBackgroundLines: {
      strokeDasharray: '4 8',
      stroke: theme.gridStroke,
      strokeWidth: 1,
    },
  };
}

/** Prevent chart-kit from breaking when every value is 0. */
export function sanitizeChartDataset(values = []) {
  const nums = values.map((v) => Number(v) || 0);
  if (nums.length === 0) return [0];
  if (nums.every((n) => n === 0)) return nums.map(() => 0);
  return nums;
}

export function sumChartValues(values = []) {
  return (values || []).reduce((s, v) => s + (Number(v) || 0), 0);
}

/**
 * Merge calorie_tracking + water_tracking rows into one series for charts.
 * Matches TrackingContext: water is stored as glasses × 250ml.
 */
export function mergeCalorieAndWaterTracking(calorieRows = [], waterRows = []) {
  const byDate = {};

  for (const row of calorieRows) {
    if (!row?.date) continue;
    byDate[row.date] = {
      date: row.date,
      calories_consumed: Number(row.consumed) || 0,
      water_consumed_ml: 0,
    };
  }

  for (const row of waterRows) {
    if (!row?.date) continue;
    if (!byDate[row.date]) {
      byDate[row.date] = {
        date: row.date,
        calories_consumed: 0,
        water_consumed_ml: 0,
      };
    }
    byDate[row.date].water_consumed_ml = (Number(row.glasses) || 0) * 250;
  }

  return Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Prefer live home-screen totals for today so rings and charts match. */
export function applyTodayTrackingFromContext(tracking, calories, water) {
  const today = getLocalDateString(new Date());
  const rows = [...(tracking || [])];
  const todayCalories = Number(calories?.consumed) || 0;
  const todayWaterMl = Number(water?.consumed) || 0;

  if (todayCalories === 0 && todayWaterMl === 0) {
    return rows;
  }

  const idx = rows.findIndex((r) => r.date === today);
  const todayRow = {
    date: today,
    calories_consumed: todayCalories,
    water_consumed_ml: todayWaterMl,
  };

  if (idx >= 0) {
    rows[idx] = {
      ...rows[idx],
      calories_consumed: Math.max(rows[idx].calories_consumed || 0, todayCalories),
      water_consumed_ml: Math.max(rows[idx].water_consumed_ml || 0, todayWaterMl),
    };
  } else {
    rows.push(todayRow);
  }

  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function getTrackingCalories(row) {
  return Number(row?.calories_consumed) || 0;
}

export function getTrackingWaterLiters(row) {
  const ml = Number(row?.water_consumed_ml) || 0;
  return ml / 1000;
}

/** Shared card surface — matches Home `actionCard` / `seeActivityCard` neutrals. */
export const ANALYTICS_CARD = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
};

export function parseWorkoutExercisesField(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Max weight per exercise per workout → first vs latest for progression UI.
 * @param {Array<{ completed_at: string, exercises: unknown }>} workouts
 * @param {number} [limit=8]
 */
export function calculateWeightProgressionFromWorkouts(workouts = [], limit = 8) {
  const exerciseData = {};

  workouts.forEach((workout) => {
    const exercises = parseWorkoutExercisesField(workout.exercises);
    if (!exercises?.length) return;
    const workoutDate = new Date(workout.completed_at);
    if (Number.isNaN(workoutDate.getTime())) return;

    exercises.forEach((exercise) => {
      const exerciseName = exercise.name || exercise.exerciseName || exercise.title;
      if (!exerciseName || !exercise.sets?.length) return;

      const completedSets = exercise.sets.filter((set) => {
        if (!set) return false;
        const weight = parseFloat(set.weight) || 0;
        if (weight <= 0) return false;
        const repsRaw = set.reps;
        const reps =
          typeof repsRaw === 'string' && repsRaw.includes('-')
            ? parseInt(repsRaw.split('-')[0], 10) || 0
            : parseInt(repsRaw, 10) || 0;
        if (set.completed === true) return true;
        return reps > 0;
      });
      if (completedSets.length === 0) return;

      const maxWeight = Math.max(...completedSets.map((set) => parseFloat(set.weight) || 0));
      if (maxWeight <= 0) return;

      if (!exerciseData[exerciseName]) {
        exerciseData[exerciseName] = {
          firstWeight: maxWeight,
          firstDate: workoutDate,
          latestWeight: maxWeight,
          latestDate: workoutDate,
          allWeights: [],
          workoutCount: 0,
        };
      }

      if (workoutDate > exerciseData[exerciseName].latestDate) {
        exerciseData[exerciseName].latestWeight = maxWeight;
        exerciseData[exerciseName].latestDate = workoutDate;
      } else if (workoutDate.getTime() === exerciseData[exerciseName].latestDate.getTime()) {
        if (maxWeight > exerciseData[exerciseName].latestWeight) {
          exerciseData[exerciseName].latestWeight = maxWeight;
        }
      }

      exerciseData[exerciseName].allWeights.push({
        weight: maxWeight,
        date: workoutDate,
        volume:
          maxWeight *
          completedSets
            .filter((set) => parseFloat(set.weight) === maxWeight)
            .reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0),
      });
      exerciseData[exerciseName].workoutCount += 1;
    });
  });

  return Object.entries(exerciseData)
    .map(([name, data]) => {
      const weightIncrease = data.latestWeight - data.firstWeight;
      const percentIncrease =
        data.firstWeight > 0 ? parseFloat(((weightIncrease / data.firstWeight) * 100).toFixed(1)) : 0;
      const daysDiff = (data.latestDate - data.firstDate) / (1000 * 60 * 60 * 24);
      const weeksDiff = daysDiff / 7;
      const weeklyIncrease = weeksDiff > 0 ? parseFloat((weightIncrease / weeksDiff).toFixed(1)) : 0;

      return {
        name,
        firstWeight: data.firstWeight,
        latestWeight: data.latestWeight,
        weightIncrease,
        percentIncrease,
        weeklyIncrease,
        workoutCount: data.workoutCount,
        allWeights: data.allWeights.sort((a, b) => a.date - b.date),
      };
    })
    .filter((ex) => ex.workoutCount >= 1)
    .sort((a, b) => {
      if (a.workoutCount >= 2 && b.workoutCount >= 2) {
        return b.weightIncrease - a.weightIncrease;
      }
      return b.latestWeight - a.latestWeight;
    })
    .slice(0, limit);
}

/** Totals for the selected analytics window (workouts / mental / runs already filtered). */
export function buildPeriodActivityTotals(workouts = [], mental = [], runs = []) {
  const runDistanceM = runs.reduce((sum, r) => sum + (Number(r.distance_meters) || 0), 0);
  const runDurationSec = runs.reduce((sum, r) => sum + (Number(r.duration_seconds) || 0), 0);
  const liftProgression = calculateWeightProgressionFromWorkouts(workouts, 99);
  const liftsTracked = liftProgression.length;
  const liftsProgressing = liftProgression.filter(
    (e) => e.workoutCount >= 2 && e.weightIncrease !== 0,
  ).length;

  return {
    workouts: workouts.length,
    mental: mental.length,
    runs: runs.length,
    runDistanceMiles: runDistanceM / 1609.34,
    runDurationMinutes: Math.round(runDurationSec / 60),
    liftsTracked,
    liftsProgressing,
  };
}

export function formatPrValue(record) {
  if (record?.weight_kg != null && Number(record.weight_kg) > 0) {
    const lbs = Number(record.weight_kg) * 2.20462;
    return `${lbs.toFixed(lbs >= 100 ? 0 : 1)} lbs`;
  }
  if (record?.time_minutes != null && Number(record.time_minutes) > 0) {
    const m = Number(record.time_minutes);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rem = Math.round(m % 60);
      return `${h}h ${rem}m`;
    }
    return `${m.toFixed(m >= 10 ? 0 : 1)} min`;
  }
  return '—';
}
