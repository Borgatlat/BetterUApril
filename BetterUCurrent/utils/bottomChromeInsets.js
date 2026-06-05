import { Platform, Dimensions } from 'react-native';

const { height, width } = Dimensions.get('window');
const isIphoneX = Platform.OS === 'ios' && (height >= 812 || width >= 812);

/** Matches tab bar height in app/(tabs)/_layout.js */
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? (isIphoneX ? 80 : 60) : 60;

/** Typical standard adaptive banner height until onLayout reports actual size */
export const FALLBACK_BANNER_HEIGHT = 50;

export const FLOATING_AI_SIZE = 64;
export const SCROLL_EXTRA_GAP = 28;
export const FAB_ABOVE_CHROME_GAP = 20;

export function getScrollBottomPadding({
  tabBarHeight = TAB_BAR_HEIGHT,
  bannerHeight = 0,
  extra = SCROLL_EXTRA_GAP,
} = {}) {
  return tabBarHeight + bannerHeight + extra;
}

export function getFloatingAIBottom({
  tabBarHeight = TAB_BAR_HEIGHT,
  bannerHeight = 0,
  gap = FAB_ABOVE_CHROME_GAP,
} = {}) {
  return tabBarHeight + bannerHeight + gap;
}

export function getBannerDockBottom(tabBarHeight = TAB_BAR_HEIGHT) {
  return tabBarHeight;
}
