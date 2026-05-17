import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useUser } from '../../context/UserContext';
import {
  getBannerAdUnitId,
  isNativeMobileAdsSupported,
} from '../../lib/adMob';

function loadBannerAdModule() {
  try {
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

/**
 * Footer banner for non-premium users. No top-level import of `react-native-google-mobile-ads`:
 * importing it eagerly crashes Expo Go (TurboModule missing). We only require() after guards pass.
 */
export default function NonPremiumBannerAd({ style }) {
  const { isPremium, isLoading } = useUser();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  if (isLoading || isPremium || Platform.OS === 'web') return null;
  if (!isNativeMobileAdsSupported()) return null;
  if (adFailed) return null;

  const gma = loadBannerAdModule();
  if (!gma?.BannerAd || !gma?.BannerAdSize || !gma?.TestIds) return null;

  const { BannerAd, BannerAdSize, TestIds } = gma;

  const configuredUnitId = getBannerAdUnitId();
  const adUnitId = __DEV__ ? TestIds.BANNER : (configuredUnitId || TestIds.BANNER);

  return (
    <View style={[styles.container, !adLoaded && styles.collapsed, style]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setAdLoaded(true)}
        onAdFailedToLoad={(error) => {
          setAdFailed(true);
          if (__DEV__) console.warn('[AdMob] Banner failed to load:', error?.message || error);
        }}
        onAdOpened={() => {}}
        onAdClosed={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 4,
    backgroundColor: '#000',
  },
  collapsed: {
    height: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
});
