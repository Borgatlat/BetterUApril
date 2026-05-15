/**
 * Nutrition Tab Design System
 * Matches app theme (cyan #00ffff, dark backgrounds) with modern, clean styling.
 * Use these tokens for consistent visuals across the Nutrition tab.
 */
import { Platform } from 'react-native';

export const NutritionTheme = {
  // Core palette (matches app)
  primary: '#00ffff',
  primaryMuted: 'rgba(0, 255, 255, 0.15)',
  primaryDark: 'rgba(0, 255, 255, 0.08)',
  background: '#000000',
  surface: '#111',
  surfaceElevated: '#1a1a1a',
  cardBg: 'rgba(255, 255, 255, 0.04)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#ffffff',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  error: '#ff4444',
  success: '#00ff00',
  warning: '#ffa500',
  premium: '#ffd700',

  // Macro accent colors (consistent with Home)
  calorie: '#ff4444',
  protein: '#00ff00',
  carbs: '#4ECDC4',
  fat: '#45B7D1',
  water: '#00ffff',

  // Spacing
  screenPadding: 20,
  cardPadding: 20,
  cardRadius: 20,
  inputRadius: 14,
  buttonRadius: 14,
  sectionGap: 16,

  // Typography
  titleSize: 24,
  titleWeight: '700',
  subtitleSize: 15,
  bodySize: 16,
  labelSize: 14,

  // Glows
  glowPrimary: {
    shadowColor: '#00ffff',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  glowCard: {
    shadowColor: '#00ffff',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
