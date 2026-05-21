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
