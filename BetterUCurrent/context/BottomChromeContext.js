import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useUser } from './UserContext';
import {
  TAB_BAR_HEIGHT,
  FALLBACK_BANNER_HEIGHT,
  FLOATING_AI_SIZE,
  getScrollBottomPadding,
  getFloatingAIBottom,
} from '../utils/bottomChromeInsets';

const BottomChromeContext = createContext({
  tabBarHeight: TAB_BAR_HEIGHT,
  bannerHeight: 0,
  scrollPaddingBottom: getScrollBottomPadding({ bannerHeight: 0 }),
  floatingAIBottom: getFloatingAIBottom({ bannerHeight: 0 }),
  floatingAISize: FLOATING_AI_SIZE,
  setBannerHeight: () => {},
  clearBannerHeight: () => {},
});

export function BottomChromeProvider({ children }) {
  const { isPremium, isLoading } = useUser();
  const [measuredBannerHeight, setMeasuredBannerHeight] = useState(0);

  const bannerHeight = useMemo(() => {
    if (isLoading || isPremium) return 0;
    if (measuredBannerHeight > 0) return measuredBannerHeight;
    return FALLBACK_BANNER_HEIGHT;
  }, [isLoading, isPremium, measuredBannerHeight]);

  const setBannerHeight = useCallback((height) => {
    const h = Math.ceil(Number(height) || 0);
    if (h > 0) setMeasuredBannerHeight(h);
  }, []);

  const clearBannerHeight = useCallback(() => {
    setMeasuredBannerHeight(0);
  }, []);

  useEffect(() => {
    if (isPremium) clearBannerHeight();
  }, [isPremium, clearBannerHeight]);

  const value = useMemo(
    () => ({
      tabBarHeight: TAB_BAR_HEIGHT,
      bannerHeight,
      scrollPaddingBottom: getScrollBottomPadding({ bannerHeight }),
      floatingAIBottom: getFloatingAIBottom({ bannerHeight }),
      floatingAISize: FLOATING_AI_SIZE,
      setBannerHeight,
      clearBannerHeight,
    }),
    [bannerHeight, setBannerHeight, clearBannerHeight]
  );

  return (
    <BottomChromeContext.Provider value={value}>{children}</BottomChromeContext.Provider>
  );
}

export function useBottomChromeInsets() {
  return useContext(BottomChromeContext);
}
