import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useUser } from '../../context/UserContext';
import { useBottomChromeInsets } from '../../context/BottomChromeContext';
import { FALLBACK_BANNER_HEIGHT } from '../../utils/bottomChromeInsets';
import {
  isNativeMobileAdsSupported,
  resolveBannerAdUnitId,
  whenAdMobReady,
} from '../../lib/adMob';
import { useBannerAd } from '../../context/BannerAdContext';

const MAX_LOAD_ATTEMPTS = 3;

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
  const [sdkReady, setSdkReady] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isNativeMobileAdsSupported()) return undefined;
    let cancelled = false;
    whenAdMobReady().finally(() => {
      if (!cancelled) setSdkReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || isPremium || Platform.OS === 'web' || suppressed) {
    return null;
  }
  if (!isNativeMobileAdsSupported() || !sdkReady) {
    return null;
  }
  if (adFailed) {
    return null;
  }

  const gma = loadBannerAdModule();
  if (!gma?.BannerAd || !gma?.BannerAdSize) return null;

  const { BannerAd, BannerAdSize, TestIds } = gma;
  const adUnitId = resolveBannerAdUnitId(TestIds);
  // Standard anchored adaptive (~50px). LARGE adaptive is ~2× tall and looked oversized in the tab footer.
  const bannerSize = BannerAdSize.ANCHORED_ADAPTIVE_BANNER ?? BannerAdSize.BANNER;

  const handleLayout = (e) => {
    if (!adLoaded) return;
    const h = Math.ceil(e.nativeEvent.layout.height || 0);
    if (h > 0) setBannerHeight(h);
  };

  const handleAdFailedToLoad = (error) => {
    clearBannerHeight();
    setAdLoaded(false);
    const nextAttempt = loadAttempt + 1;
    console.warn(
      '[AdMob] Banner failed to load:',
      error?.message || error,
      `(attempt ${nextAttempt}/${MAX_LOAD_ATTEMPTS})`
    );
    if (nextAttempt >= MAX_LOAD_ATTEMPTS) {
      setAdFailed(true);
    }
    setLoadAttempt(nextAttempt);
  };

  return (
    <View
      style={[styles.container, !adLoaded && styles.loading, style]}
      onLayout={handleLayout}
    >
      <BannerAd
        key={`banner-${loadAttempt}`}
        unitId={adUnitId}
        size={bannerSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          setAdLoaded(true);
          setAdFailed(false);
        }}
        onAdFailedToLoad={handleAdFailedToLoad}
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
    backgroundColor: '#000',
    overflow: 'hidden',
    zIndex: 8,
    elevation: 8,
  },
  // Reserve minimal space while the adaptive banner measures (height: 0 blocks loads).
  loading: {
    minHeight: FALLBACK_BANNER_HEIGHT,
    opacity: 0.02,
  },
});
