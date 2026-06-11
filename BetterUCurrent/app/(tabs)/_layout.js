import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Dimensions, View, StyleSheet } from 'react-native';
import { TrainerProvider } from '../../context/TrainerContext';
import { TherapistProvider } from '../../context/TherapistContext';
import TutorialGate from '../components/TutorialGate';
import { useLanguage } from '../../context/LanguageContext';
import NonPremiumBannerAd from '../components/NonPremiumBannerAd';
import { useAuthSession } from '../../hooks/useAuthSession';
import { ScheduleRefreshProvider } from '../../context/ScheduleRefreshContext';
import { BottomChromeProvider } from '../../context/BottomChromeContext';
import { getBannerDockBottom } from '../../utils/bottomChromeInsets';
import { BannerAdProvider } from '../../context/BannerAdContext';

const { height, width } = Dimensions.get('window');
const isIphoneX = Platform.OS === 'ios' && (height >= 812 || width >= 812);

/** Tab route name -> translation key (under "tabs.*") */
const tabConfig = {
  home: { key: 'home', icon: (focused) => focused ? 'home' : 'home-outline' },
  workout: { key: 'workout', icon: (focused) => focused ? 'barbell' : 'barbell-outline' },
  nutrition: { key: 'nutrition', icon: (focused) => focused ? 'restaurant' : 'restaurant-outline' },
  mental: { key: 'mental', icon: (focused) => focused ? 'leaf' : 'leaf-outline' },
  spiritual: {
    key: 'home',
    icon: (focused) => (focused ? 'compass' : 'compass-outline'),
  },
  'school-wellness': { key: 'home', icon: (focused) => focused ? 'school' : 'school-outline' },
  community: { key: 'community', icon: (focused) => focused ? 'people' : 'people-outline' },
  league: { key: 'league', icon: (focused) => focused ? 'trophy' : 'trophy-outline' },
  therapist: { key: 'therapist', icon: (focused) => focused ? 'heart' : 'heart-outline' },
  analytics: { key: 'analytics', icon: (focused) => focused ? 'analytics' : 'analytics-outline' },
};

export default function TabLayout() {
  const { t } = useLanguage();
  const { workspace } = useAuthSession();
  const hideNutritionForStudent = workspace === 'student';
  const showSpiritualTab = workspace === 'student';
  const isCampusStudent = workspace === 'student';

  const screenOptions = React.useMemo(() => ({ route }) => {
    const config = tabConfig[route.name];
    let title = config ? t(`tabs.${config.key}`) : route.name;
    if (route.name === 'spiritual') title = 'Spiritual';
    const icon = config?.icon ?? (() => (focused) => (focused ? 'help-circle' : 'help-circle-outline'));

    return {
      title,
      tabBarIcon: ({ focused, color, size }) => (
        <Ionicons name={typeof icon === 'function' ? icon(focused) : 'help-circle-outline'} size={size} color={color} />
      ),
      tabBarActiveTintColor: isCampusStudent ? '#2563eb' : '#00ffff',
      tabBarInactiveTintColor: isCampusStudent ? '#94a3b8' : 'gray',
      tabBarStyle: {
        backgroundColor: isCampusStudent ? '#ffffff' : '#000000',
        borderTopColor: isCampusStudent ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
        paddingTop: 5,
        paddingBottom: Platform.OS === 'ios' ? (isIphoneX ? 25 : 5) : 5,
        height: Platform.OS === 'ios' ? (isIphoneX ? 80 : 60) : 60,
        position: 'absolute',
        elevation: 8,
        shadowColor: '#000',
      },
      headerShown: false,
      tabBarItemStyle: {
        flex: 1,
      }
    };
  }, [t, isCampusStudent]);

  const studentInitialTab = isCampusStudent ? 'spiritual' : 'home';

  return (
    <TutorialGate>
      <ScheduleRefreshProvider>
      <BottomChromeProvider>
      <TrainerProvider>
        <TherapistProvider>
          <View style={styles.container}>
            <BannerAdProvider>
            <Tabs screenOptions={screenOptions} initialRouteName={studentInitialTab}>
            <Tabs.Screen name="home" />
            <Tabs.Screen name="workout" />
            <Tabs.Screen
              name="nutrition"
              options={hideNutritionForStudent ? { href: null } : undefined}
            />
            <Tabs.Screen name="mental" />
            <Tabs.Screen name="community" />
            <Tabs.Screen
              name="spiritual"
              options={
                showSpiritualTab
                  ? { title: 'Spiritual' }
                  : { href: null }
              }
            />
            <Tabs.Screen name="school-wellness" options={{ href: null }} />
            <Tabs.Screen name="therapist" options={{ href: null }} />
            <Tabs.Screen name="league" options={{ href: null }} />
            <Tabs.Screen name="workout-logs" options={{ href: null }} />
            <Tabs.Screen name="active-workout" options={{ href: null }} />
            <Tabs.Screen name="workout-summary" options={{ href: null }} />
            <Tabs.Screen name="edit-workout" options={{ href: null }} />
            <Tabs.Screen name="create-workout" options={{ href: null }} />
            <Tabs.Screen name="training-plans" options={{ href: null }} />
            <Tabs.Screen name="category-exercises" options={{ href: null }} />
            <Tabs.Screen
              name="settings"
              options={{ href: null, presentation: 'modal' }}
            />
            <Tabs.Screen name="profile" options={{ href: null }} />
            <Tabs.Screen name="feed" options={{ href: null }} />
            <Tabs.Screen name="pr" options={{ href: null }} />
            <Tabs.Screen name="admin" options={{ href: null }} />
            <Tabs.Screen name="analytics" options={{ href: null }} />
          </Tabs>
            <NonPremiumBannerAd style={styles.bannerDock} />
            </BannerAdProvider>
          </View>
        </TherapistProvider>
      </TrainerProvider>
      </BottomChromeProvider>
      </ScheduleRefreshProvider>
    </TutorialGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bannerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: getBannerDockBottom(),
    zIndex: 8,
    elevation: 8,
  },
});