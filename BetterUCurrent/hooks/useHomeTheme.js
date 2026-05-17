import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HOME_PREFS_KEY = 'homePageCustomization';

const defaultPrefs = {
  darkMode: true,
  homeBackgroundColor: '#000000',
  homeAccentColor: '#00ffff'
};

/**
 * Hook to load home page customization (dark/light mode, colors) and derive theme values.
 * Use in Settings, changeYourHomePage, and any modals that should match the home theme.
 */
export function useHomeTheme() {
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    async function loadPrefs() {
      try {
        const raw = await AsyncStorage.getItem(HOME_PREFS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setPrefs({ ...defaultPrefs, ...parsed });
        }
      } catch (e) {
        console.error('Error loading home theme:', e);
      }
    }
    loadPrefs();
  }, []);

  const isDark = prefs.darkMode !== false;
  const accentColor = prefs.homeAccentColor ?? '#00ffff';
  const backgroundColor = isDark
    ? (prefs.homeBackgroundColor ?? '#000000')
    : '#f5f5f5';
  const textColor = isDark ? '#ffffff' : '#111111';
  const textSecondary = isDark ? '#999999' : '#666666';
  const cardBg = isDark ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)';

  return {
    isDark,
    accentColor,
    backgroundColor,
    textColor,
    textSecondary,
    cardBg,
    cardBorder
  };
}
