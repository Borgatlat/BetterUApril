import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HOME_PAGE_CUSTOMIZATION_KEY,
  HOME_PAGE_CUSTOMIZATION_DEFAULTS,
  sanitizeHomePageCustomization,
} from '../../utils/homePageCustomization';

/**
 * Loads saved “Change your home page” toggles from AsyncStorage.
 * `reload` lets the home tab refresh after the user saves in the modal (router.back).
 */
export function useHomePageCustomization() {
  const [prefs, setPrefs] = useState(HOME_PAGE_CUSTOMIZATION_DEFAULTS);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HOME_PAGE_CUSTOMIZATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPrefs(sanitizeHomePageCustomization(parsed));
      } else {
        setPrefs(HOME_PAGE_CUSTOMIZATION_DEFAULTS);
      }
    } catch (e) {
      console.error('Error loading home page customization:', e);
      setPrefs({ ...HOME_PAGE_CUSTOMIZATION_DEFAULTS });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { prefs, reload };
}
