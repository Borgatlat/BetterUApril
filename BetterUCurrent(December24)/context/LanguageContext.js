import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Translation bundles: keys like "tabs.home", "settings.title"
// require() is used so Metro bundles the JSON files; in React Native we don't use dynamic imports for assets.
const translations = {
  en: require('../locales/en.json'),
  es: require('../locales/es.json'),
};

const STORAGE_KEY = 'betteru_app_locale';

/** Supported app locales. Add new codes here and add a file in locales/<code>.json */
export const SUPPORTED_LOCALES = ['en', 'es'];

/**
 * Gets a nested value from an object using a dot-separated path.
 * Example: getByPath({ a: { b: 'hi' } }, 'a.b') => 'hi'
 * If you change this to use a different separator, update the key format in the JSON files.
 */
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    current = current?.[part];
  }
  return current;
}

const LanguageContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  isReady: false,
});

export const LanguageProvider = ({ children }) => {
  const [locale, setLocaleState] = useState('en');
  const [isReady, setIsReady] = useState(false);

  // Load saved locale from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && saved && SUPPORTED_LOCALES.includes(saved)) {
          setLocaleState(saved);
        }
      } catch (e) {
        console.warn('[LanguageContext] Failed to load locale:', e);
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const setLocale = useCallback(async (newLocale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setLocaleState(newLocale);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLocale);
    } catch (e) {
      console.warn('[LanguageContext] Failed to save locale:', e);
    }
  }, []);

  // Translate: t('settings.title') => "Settings" or "Ajustes"
  const t = useCallback((key) => {
    const value = getByPath(translations[locale], key);
    if (value != null) return value;
    // Fallback to English if key missing in current locale
    const enValue = getByPath(translations.en, key);
    return enValue != null ? enValue : key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isReady }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
