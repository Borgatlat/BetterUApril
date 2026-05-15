import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useUser } from '../../context/UserContext';
import { getBannerAdUnitId } from '../../lib/adMob';

/**
 * Small, reusable banner that only renders for free users.
 * Place this near low-intent edges (bottom of feed/list screens) to stay unobtrusive.
 *
 * The "GADBannerView" you see in Google's iOS docs is exactly what `<BannerAd />`
 * renders under the hood — react-native-google-mobile-ads bridges to it natively.
 */
export default function NonPremiumBannerAd({ style }) {
  const { isPremium, isLoading } = useUser();
  // `useState` lets us hide the wrapper if the ad fails to load, so we don't render an empty 50px gap above the tab bar.
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  // Wait for user entitlement state, then skip ads for premium users.
  if (isLoading || isPremium || Platform.OS === 'web') return null;
  if (adFailed) return null;

  const configuredUnitId = getBannerAdUnitId();
  // In development we *always* use Google's sample test unit. Tapping your own production ads
  // is an AdMob policy violation that can suspend your account, so this guard matters.
  // `__DEV__` is a global Metro/RN bundler injects: true in `expo start`, false in release builds.
  const adUnitId = __DEV__ ? TestIds.BANNER : (configuredUnitId || TestIds.BANNER);

  return (
    <View style={[styles.container, !adLoaded && styles.collapsed, style]}>
      {/* ANCHORED_ADAPTIVE_BANNER resizes width with the device safe area (recommended by Google for footer docks). */}
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          // If you collect GDPR consent elsewhere, flip this based on consent state instead of hard-coding `true`.
          requestNonPersonalizedAdsOnly: true,
        }}
        // Equivalents to GADBannerViewDelegate methods from the iOS docs you pasted:
        onAdLoaded={() => setAdLoaded(true)}            // bannerViewDidReceiveAd
        onAdFailedToLoad={(error) => {                   // bannerView:didFailToReceiveAdWithError
          setAdFailed(true);
          if (__DEV__) console.warn('[AdMob] Banner failed to load:', error?.message || error);
        }}
        onAdOpened={() => {}}                             // bannerViewWillPresentScreen
        onAdClosed={() => {}}                             // bannerViewDidDismissScreen
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
  // Hide the dock entirely until an ad is actually rendered, so we don't show an empty bar.
  collapsed: {
    height: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
});
