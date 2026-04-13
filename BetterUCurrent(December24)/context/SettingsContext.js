import { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext({
  settings: null,
  isLoading: true,
  updateSettings: () => {},
});

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from AsyncStorage
  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('userSettings');
      const restTime = await AsyncStorage.getItem('rest_time_seconds');
      
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        // If we have a rest time in AsyncStorage, use that instead
        if (restTime !== null) {
          parsedSettings.rest_time_seconds = parseInt(restTime);
        }
        // Set default for spotify_enabled if not present (for backwards compatibility)
        // For existing users without this setting, default to false (hidden)
        if (parsedSettings.spotify_enabled === undefined) {
          parsedSettings.spotify_enabled = false;
        }
        // Stride length for indoor/treadmill timed distance (meters). Default 0.75m.
        if (parsedSettings.indoor_stride_length_meters === undefined) {
          parsedSettings.indoor_stride_length_meters = 0.75;
        }
        setSettings(parsedSettings);
      } else {
        // Default settings
        const defaultSettings = {
          use_imperial: false,
          calorie_goal: 2000,
          water_goal_ml: 2000,
          daily_reminders: true,
          rest_time_seconds: restTime ? parseInt(restTime) : 90,
          spotify_enabled: false, // Default to disabled (hidden)
          indoor_stride_length_meters: 0.75, // For timed distance indoor/treadmill mode
        };
        setSettings(defaultSettings);
        await AsyncStorage.setItem('userSettings', JSON.stringify(defaultSettings));
      }
    } catch (error) {
      console.error('Error loading settings from AsyncStorage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update settings in AsyncStorage
  const updateSettings = async (newSettings) => {
    try {
      if (!settings) {
        console.error('Settings not initialized');
        return { success: false, error: 'Settings not initialized' };
      }

      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('userSettings', JSON.stringify(updated));
      
      // If rest time is being updated, save it separately
      if (newSettings.rest_time_seconds !== undefined) {
        await AsyncStorage.setItem('rest_time_seconds', newSettings.rest_time_seconds.toString());
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating settings in AsyncStorage:', error);
      return { success: false, error: error.message };
    }
  };

  // Initialize settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 