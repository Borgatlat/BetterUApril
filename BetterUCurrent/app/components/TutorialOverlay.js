import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHomeScroll } from '../../context/HomeScrollContext';
import { HOME_TUTORIAL_STEPS } from '../../utils/homeTutorialSteps';
import { TAB_BAR_HEIGHT } from '../../utils/bottomChromeInsets';

const SPOTLIGHT_PAD = 8;
const SCROLL_SETTLE_MS = 380;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function boundsFromAnchor(anchorBounds, anchorKey, screenWidth, screenHeight) {
  const b = anchorBounds?.[anchorKey];
  if (!b?.width || !b?.height) return null;

  const left = clamp(b.x - SPOTLIGHT_PAD, 0, screenWidth);
  const top = clamp(b.y - SPOTLIGHT_PAD, 0, screenHeight);
  const right = clamp(b.x + b.width + SPOTLIGHT_PAD, 0, screenWidth);
  const bottom = clamp(b.y + b.height + SPOTLIGHT_PAD, 0, screenHeight);

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function boundsForTabBar(screenWidth, screenHeight) {
  const height = TAB_BAR_HEIGHT;
  const top = Math.max(0, screenHeight - height);
  return { left: 0, top, width: screenWidth, height };
}

const TutorialOverlay = ({ visible, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const finishingRef = useRef(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const homeScroll = useHomeScroll();

  const measuredCount = Object.keys(homeScroll?.anchorBounds || {}).length;

  const activeSteps = useMemo(() => {
    if (measuredCount === 0) return HOME_TUTORIAL_STEPS;
    return HOME_TUTORIAL_STEPS.filter((step) => {
      if (step.type === 'tabs') return true;
      const b = homeScroll?.anchorBounds?.[step.anchorKey];
      return b && b.width > 0 && b.height > 0;
    });
  }, [homeScroll?.anchorBounds, measuredCount]);

  const step = activeSteps[currentStep] || activeSteps[0];
  const spotlight = useMemo(() => {
    if (!step) return null;
    if (step.type === 'tabs') return boundsForTabBar(width, height);
    const measured = boundsFromAnchor(homeScroll?.anchorBounds, step.anchorKey, width, height);
    if (measured) return measured;
    // Brief fallback while Home anchors finish measuring after scroll.
    return {
      left: width * 0.08,
      top: height * 0.14,
      width: width * 0.84,
      height: Math.min(120, height * 0.14),
    };
  }, [step, homeScroll?.anchorBounds, width, height]);

  useEffect(() => {
    if (!visible) {
      finishingRef.current = false;
      setCurrentStep(0);
      return undefined;
    }

    homeScroll?.scrollToY?.(0);
    const measureTimers = [
      setTimeout(() => homeScroll?.remeasureAllAnchors?.(), 80),
      setTimeout(() => homeScroll?.remeasureAllAnchors?.(), 450),
    ];

    return () => {
      measureTimers.forEach(clearTimeout);
    };
  }, [visible, homeScroll]);

  useEffect(() => {
    if (!visible || !step || !homeScroll) return undefined;

    if (step.type === 'tabs') {
      homeScroll.scrollToY?.(0);
      const t = setTimeout(() => homeScroll.remeasureAllAnchors?.(), SCROLL_SETTLE_MS);
      return () => clearTimeout(t);
    }

    homeScroll.scrollToAnchor?.(step.anchorKey);
    const t = setTimeout(() => homeScroll.remeasureAnchor?.(step.anchorKey), SCROLL_SETTLE_MS);
    return () => clearTimeout(t);
  }, [visible, currentStep, step, homeScroll]);

  const isSmallScreen = height < 650;
  const tooltipMaxHeight = useMemo(() => Math.min(180, height * 0.28), [height]);
  const tooltipTitleSize = isSmallScreen ? 16 : 18;
  const tooltipTextSize = isSmallScreen ? 13 : 15;
  const tooltipLineHeight = tooltipTextSize * 1.4;

  const finishTutorial = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    onSkip?.();
    onComplete?.();
  }, [onComplete, onSkip]);

  const handleNext = () => {
    if (finishingRef.current || activeSteps.length === 0) return;
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      finishTutorial();
    }
  };

  const handleSkip = () => {
    finishTutorial();
  };

  if (!visible || !step) return null;

  const { left: spotlightLeft, top: spotlightTop, width: spotlightWidth, height: spotlightHeight } = spotlight;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          <View
            style={[
              styles.dim,
              { top: 0, left: 0, right: 0, height: spotlightTop },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                top: spotlightTop + spotlightHeight,
                left: 0,
                right: 0,
                bottom: 0,
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                top: spotlightTop,
                left: 0,
                width: spotlightLeft,
                height: spotlightHeight,
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                top: spotlightTop,
                left: spotlightLeft + spotlightWidth,
                right: 0,
                height: spotlightHeight,
              },
            ]}
          />
          <View
            style={[
              styles.spotlightBorder,
              {
                left: spotlightLeft,
                top: spotlightTop,
                width: spotlightWidth,
                height: spotlightHeight,
              },
            ]}
          />
        </View>

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip tutorial"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Text style={styles.stepIndicator}>
            {currentStep + 1} / {activeSteps.length}
          </Text>
        </View>

        <View
          style={[
            styles.bottomPanel,
            { paddingBottom: Math.max(insets.bottom, 16) + (isSmallScreen ? 12 : 20) },
          ]}
        >
          <ScrollView
            style={[styles.tooltip, { maxHeight: tooltipMaxHeight, maxWidth: width - 40 }]}
            contentContainerStyle={styles.tooltipContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={[styles.tooltipTitle, { fontSize: tooltipTitleSize }]}>{step.title}</Text>
            <Text
              style={[
                styles.tooltipText,
                { fontSize: tooltipTextSize, lineHeight: tooltipLineHeight },
              ]}
            >
              {step.tooltip}
            </Text>
          </ScrollView>
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              isSmallScreen && styles.nextButtonCompact,
              pressed && styles.pressed,
            ]}
            onPress={handleNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              currentStep === activeSteps.length - 1 ? 'Get started' : 'Next tutorial step'
            }
          >
            <Text style={styles.nextButtonText}>
              {currentStep === activeSteps.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={currentStep === activeSteps.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={20}
              color="#000"
            />
          </Pressable>
          <View style={[styles.pagination, isSmallScreen && { paddingTop: 8 }]}>
            {activeSteps.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00ffff',
    borderRadius: 12,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomPanel: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  tooltip: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  tooltipContent: {
    paddingVertical: 4,
  },
  tooltipTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  tooltipText: {
    color: '#00ffff',
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: '#00ffff',
    fontSize: 16,
  },
  stepIndicator: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonCompact: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: 'bold',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: '#00ffff',
    width: 24,
  },
});

export default TutorialOverlay;
