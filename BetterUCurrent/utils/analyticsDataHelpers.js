import { getLocalDateString } from './scheduledWorkoutHelpers';
import { hexToRgba } from './homePageCustomization';

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

export function buildLineChartConfig(theme) {
  return {
    backgroundColor: theme.backgroundColor,
    backgroundGradientFrom: theme.backgroundGradientFrom,
    backgroundGradientTo: theme.backgroundGradientTo,
    decimalPlaces: 0,
    color: theme.line,
    labelColor: theme.labelColor,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: theme.dotStroke,
      fill: theme.dotFill,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: theme.gridStroke,
      strokeWidth: 1,
    },
    fillShadowGradientFrom: theme.backgroundGradientFrom,
    fillShadowGradientTo: theme.backgroundGradientTo,
    fillShadowGradientOpacity: 0,
    useShadowColorFromDataset: false,
  };
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
