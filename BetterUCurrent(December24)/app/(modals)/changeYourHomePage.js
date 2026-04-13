import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HOME_PAGE_CUSTOMIZATION_KEY as STORAGE_KEY,
  HOME_PAGE_CUSTOMIZATION_DEFAULTS as DEFAULT_CUSTOMIZATION,
  sanitizeHomePageCustomization,
} from '../../utils/homePageCustomization';

const BACKGROUND_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'Dark', value: '#0a0a0a' },
  { label: 'Charcoal', value: '#111111' },
  { label: 'Slate', value: '#121212' },
];

const ACCENT_COLORS = [
  { label: 'Cyan', value: '#00ffff' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Green', value: '#00ff00' },
  { label: 'Orange', value: '#ff9800' },
  { label: 'Red', value: '#ff4444' },
  { label: 'Blue', value: '#00aaff' },
];

const VISIBILITY_OPTIONS = [
  { key: 'showQuote', label: 'Motivational quote', icon: 'chatbubble-ellipses-outline' },
  { key: 'showStreaks', label: 'Streak display', icon: 'flame-outline' },
  { key: 'showDailyNutrition', label: 'Daily nutrition ring', icon: 'nutrition-outline' },
  { key: 'showAIServices', label: 'AI services (Atlas & Eleos)', icon: 'sparkles-outline' },
  { key: 'showFutureU', label: 'Future U (FutureU guide)', icon: 'rocket-outline' },
  { key: 'showAnalyticsCard', label: 'Analytics dashboard card', icon: 'analytics-outline' },
  { key: 'showFoodScanner', label: 'Scan food card', icon: 'camera-outline' },
  { key: 'showSleepTracker', label: 'Sleep tracker', icon: 'bed-outline' },
  { key: 'showViewPlans', label: 'View plans card', icon: 'layers-outline' },

];

export default function ChangeYourHomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState(DEFAULT_CUSTOMIZATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPrefs(sanitizeHomePageCustomization(parsed));
      }
    } catch (e) {
      console.error('Error loading home customization:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeHomePageCustomization(prefs)));
      router.back();
    } catch (e) {
      console.error('Error saving home customization:', e);
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };



  const toggleVisibility = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setBackgroundColor = (value) => {
    setPrefs((prev) => ({ ...prev, homeBackgroundColor: value }));
  };

  const setAccentColor = (value) => {
    setPrefs((prev) => ({ ...prev, homeAccentColor: value }));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  const accentColor = prefs.homeAccentColor || '#00ffff';
  const textColor = '#ffffff';
  const textSecondary = '#999999';
  const cardBg = 'rgba(0, 255, 255, 0.08)';
  const cardBorder = 'rgba(0, 255, 255, 0.3)';
  const backgroundColor = '#000000';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: cardBorder }]}>
        <TouchableOpacity style={[styles.closeButton, { borderColor: cardBorder }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Change Your Home Page</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
       
        {/* What to show */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>What to show on Home</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {VISIBILITY_OPTIONS.map(({ key, label, icon }, index) => (
              <View
                key={key}
                style={[
                  styles.settingRow,
                  index === VISIBILITY_OPTIONS.length - 1 && styles.settingRowLast,
                ]}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name={icon} size={20} color={accentColor} style={styles.settingIcon} />
                  <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
                </View>
                <Switch
                  value={!!prefs[key]}
                  onValueChange={() => toggleVisibility(key)}
                  trackColor={{ false: '#333', true: `${accentColor}50` }}
                  thumbColor={prefs[key] ? accentColor : '#666'}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Background color */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>Background color</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.colorRow}>
              {BACKGROUND_COLORS.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: value },
                    prefs.homeBackgroundColor === value && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setBackgroundColor(value)}
                  activeOpacity={0.8}
                >
                  {prefs.homeBackgroundColor === value && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.colorHint, { color: textSecondary }]}>Tap a swatch to set home screen background</Text>
          </View>
        </View>

        {/* Accent / button color */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>Accent & button color</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.colorSwatch,
                    styles.accentSwatch,
                    { backgroundColor: value },
                    prefs.homeAccentColor === value && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setAccentColor(value)}
                  activeOpacity={0.8}
                >
                  {prefs.homeAccentColor === value && (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.colorHint, { color: textSecondary }]}>Affects buttons, cards, and highlights on home</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: accentColor }]}
            onPress={savePrefs}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#000" />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
    
  },
  scroll: {
    flex: 1,
    
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ffff',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  darkModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  card: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accentSwatch: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorSwatchSelected: {
    borderColor: '#00ffff',
    borderWidth: 3,
  },
  colorHint: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
    minWidth: 160,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000',
  },
});
