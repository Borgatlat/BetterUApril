import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from 'react';

const HomeScrollContext = createContext(null);

/**
 * Connects the Home ScrollView to the tutorial overlay.
 * Anchors report screen coordinates via `measureInWindow`; the overlay draws
 * the spotlight from those bounds instead of guessing with percentages.
 */
export function HomeScrollProvider({ children }) {
  const scrollRef = useRef(null);
  const scrollContentRef = useRef(null);
  const anchorsRef = useRef({});
  const [anchorBounds, setAnchorBounds] = useState({});

  const registerScrollRef = useCallback((ref) => {
    scrollRef.current = ref;
  }, []);

  const registerScrollContentRef = useCallback((ref) => {
    scrollContentRef.current = ref;
  }, []);

  const reportAnchorBounds = useCallback((key, bounds) => {
    setAnchorBounds((prev) => {
      const existing = prev[key];
      if (
        existing &&
        Math.abs(existing.x - bounds.x) < 1 &&
        Math.abs(existing.y - bounds.y) < 1 &&
        Math.abs(existing.width - bounds.width) < 1 &&
        Math.abs(existing.height - bounds.height) < 1
      ) {
        return prev;
      }
      return { ...prev, [key]: bounds };
    });
  }, []);

  const registerAnchor = useCallback((key, viewRef, measureFn) => {
    anchorsRef.current[key] = { viewRef, measure: measureFn };
    measureFn();
    // Cleanup only removes the ref — avoid setState here. setState in effect cleanup
    // re-ran whenever context value identity changed and caused infinite update loops.
    return () => {
      delete anchorsRef.current[key];
    };
  }, []);

  const remeasureAnchor = useCallback((key) => {
    anchorsRef.current[key]?.measure?.();
  }, []);

  const remeasureAllAnchors = useCallback(() => {
    Object.values(anchorsRef.current).forEach((entry) => entry.measure?.());
  }, []);

  const scrollToY = useCallback((y) => {
    if (scrollRef.current && typeof y === 'number') {
      scrollRef.current.scrollTo({ y, animated: true });
    }
  }, []);

  /** Scroll so the anchored section sits below the tutorial top bar (~120px). */
  const scrollToAnchor = useCallback((key) => {
    const entry = anchorsRef.current[key];
    const content = scrollContentRef.current;
    const scroll = scrollRef.current;
    const anchorNode = entry?.viewRef?.current;

    if (!anchorNode?.measureLayout || !content) {
      entry?.measure?.();
      return;
    }

    anchorNode.measureLayout(content, (_x, y) => {
      scroll?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    });
  }, []);

  const value = useMemo(
    () => ({
      scrollRef,
      anchorBounds,
      registerScrollRef,
      registerScrollContentRef,
      reportAnchorBounds,
      registerAnchor,
      remeasureAnchor,
      remeasureAllAnchors,
      scrollToY,
      scrollToAnchor,
    }),
    [
      anchorBounds,
      registerScrollRef,
      registerScrollContentRef,
      reportAnchorBounds,
      registerAnchor,
      remeasureAnchor,
      remeasureAllAnchors,
      scrollToY,
      scrollToAnchor,
    ],
  );

  return <HomeScrollContext.Provider value={value}>{children}</HomeScrollContext.Provider>;
}

export function useHomeScroll() {
  return useContext(HomeScrollContext);
}
