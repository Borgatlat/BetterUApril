import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Dimensions } from 'react-native';
import { TrainerProvider } from '../../context/TrainerContext';
import { TherapistProvider } from '../../context/TherapistContext';
import TutorialGate from '../components/TutorialGate';
import { useLanguage } from '../../context/LanguageContext';

const { height, width } = Dimensions.get('window');
const isIphoneX = Platform.OS === 'ios' && (height >= 812 || width >= 812);

/** Tab route name -> translation key (under "tabs.*") */
const tabConfig = {
  home: { key: 'home', icon: (focused) => focused ? 'home' : 'home-outline' },
  workout: { key: 'workout', icon: (focused) => focused ? 'barbell' : 'barbell-outline' },
  nutrition: { key: 'nutrition', icon: (focused) => focused ? 'restaurant' : 'restaurant-outline' },
  mental: { key: 'mental', icon: (focused) => focused ? 'leaf' : 'leaf-outline' },
  community: { key: 'community', icon: (focused) => focused ? 'people' : 'people-outline' },
  league: { key: 'league', icon: (focused) => focused ? 'trophy' : 'trophy-outline' },
  therapist: { key: 'therapist', icon: (focused) => focused ? 'heart' : 'heart-outline' },
  analytics: { key: 'analytics', icon: (focused) => focused ? 'analytics' : 'analytics-outline' },
};

export default function TabLayout() {
  const { t } = useLanguage();

  const screenOptions = React.useMemo(() => ({ route }) => {
    const config = tabConfig[route.name];
    const title = config ? t(`tabs.${config.key}`) : route.name;
    const icon = config?.icon ?? (() => (focused) => (focused ? 'help-circle' : 'help-circle-outline'));

    return {
      title,
      tabBarIcon: ({ focused, color, size }) => (
        <Ionicons name={typeof icon === 'function' ? icon(focused) : 'help-circle-outline'} size={size} color={color} />
      ),
      tabBarActiveTintColor: '#00ffff',
      tabBarInactiveTintColor: 'gray',
      tabBarStyle: {
        backgroundColor: '#000000',
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
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
  }, [t]);

  return (
    <TutorialGate>
      <TrainerProvider>
        <TherapistProvider>
          <Tabs screenOptions={screenOptions}>
          <Tabs.Screen name="home" />
          <Tabs.Screen name="workout" />
          <Tabs.Screen name="nutrition" />
          <Tabs.Screen name="mental" />
          <Tabs.Screen 
            name="therapist" 
            options={{
              href: null,
            }}
          />
          <Tabs.Screen name="community" />
          <Tabs.Screen
            name="league"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="workout-logs"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="active-workout"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="workout-summary"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="edit-workout"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="create-workout"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="training-plans"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="category-exercises"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              href: null,
              presentation: 'modal',
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="feed"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="pr"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="admin"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="analytics"
            options={{
              href: null,
            }}
          />
        </Tabs>
        </TherapistProvider>
      </TrainerProvider>
    </TutorialGate>
  );
}