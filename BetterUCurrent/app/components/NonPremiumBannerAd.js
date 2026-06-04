import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useUser } from '../../context/UserContext';
import { useBottomChromeInsets } from '../../context/BottomChromeContext';
import {
  getBannerAdUnitId,
  isNativeMobileAdsSupported,
} from '../../lib/adMob';
import { useBannerAd } from '../../context/BannerAdContext';

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
  const { setBannerHeight, clearBannerHeight } = useBottomChromeInsets();
  const { suppressed } = useBannerAd();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  if (isLoading || isPremium || Platform.OS === 'web' || suppressed) {
    return null;
  }
  if (!isNativeMobileAdsSupported()) return null;
  if (adFailed) return null;

  const gma = loadBannerAdModule();
  if (!gma?.BannerAd || !gma?.BannerAdSize || !gma?.TestIds) return null;

  const { BannerAd, BannerAdSize, TestIds } = gma;

  const configuredUnitId = getBannerAdUnitId();
  const adUnitId = __DEV__ ? TestIds.BANNER : (configuredUnitId || TestIds.BANNER);

  const handleLayout = (e) => {
    const h = e.nativeEvent.layout.height;
    if (adLoaded && h > 0) setBannerHeight(h);
  };

  return (
    <View
      style={[styles.container, !adLoaded && styles.collapsed, style]}
      onLayout={handleLayout}
    >
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setAdLoaded(true)}
        onAdFailedToLoad={(error) => {
          setAdFailed(true);
          clearBannerHeight();
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
    zIndex: 8,
    elevation: 8,
  },
  collapsed: {
    height: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
});
