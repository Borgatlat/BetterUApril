import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

/**
 * HomeScrollContext lets the tutorial overlay scroll the home screen to the right section.
 * Home screen registers its ScrollView ref and scroll offsets per tutorial step;
 * TutorialOverlay calls scrollToY(offset) when the user advances to a step.
 *
 * To customize scroll positions: edit the scrollOffsets array below.
 * - Index 0 = step 1 (Daily Nutrition), index 1 = step 2 (AI Coach), index 2 = step 3 (Calorie Tracker).
 * - Values are in pixels. Increase a value if the spotlight is above the target; decrease if it's below.
 */
const HomeScrollContext = createContext(null);

export function HomeScrollProvider({ children }) {
  const scrollRef = useRef(null);
  // Scroll position (in pixels) for each tutorial step so the right section is in view.
  // [Step 0: Daily Nutrition, Step 1: AI Coach/Atlas, Step 2: Calorie Tracker]
  // If a step highlights the wrong area: increase = scroll further down, decrease = scroll less.
  const [scrollOffsets, setScrollOffsets] = useState([0, 280, 780]);

  const scrollToY = useCallback((y) => {
    if (scrollRef.current && typeof y === 'number') {
      scrollRef.current.scrollTo({ y, animated: true });
    }
  }, []);

  const registerScrollRef = useCallback((ref) => {
    scrollRef.current = ref;
  }, []);

  const value = {
    scrollToY,
    scrollOffsets,
    setScrollOffsets,
    registerScrollRef,
  };

  return (
    <HomeScrollContext.Provider value={value}>
      {children}
    </HomeScrollContext.Provider>
  );
}

export function useHomeScroll() {
  const ctx = useContext(HomeScrollContext);
  return ctx;
}
