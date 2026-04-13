import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHomeScroll } from '../../context/HomeScrollContext';

/**
 * Tutorial steps with spotlight positions as percentages of screen dimensions.
 * - left/top/width/height are 0–1 (e.g. 0.2 = 20% of screen width or height).
 * - Each step uses scrollOffsets in HomeScrollContext to scroll the home screen
 *   so the spotlight rectangle sits over the correct section.
 *
 * HOW TO CUSTOMIZE:
 * - If the spotlight is on the wrong thing: adjust scrollOffsets in context/HomeScrollContext.js
 *   (larger value = scroll further down for that step).
 * - If the highlight box is misaligned: change left/top/width/height here.
 *   top = where the spotlight starts from the top of the screen; height = how tall the cutout is.
 */
const TUTORIAL_STEPS = [
  {
    title: 'Your Daily Nutrition',
    tooltip: 'Track calories, water, and protein at a glance. Tap the rings for details.',
    spotlight: { left: 0.15, top: 0.22, width: 0.7, height: 0.18 }
  },
  {
    title: 'AI Coach & Therapist',
    tooltip: 'Tap Atlas for fitness advice or Eleos for mental wellness. Your AI is always here.',
    // Spotlight sized to fit just the Atlas/Eleos row (not the Analytics card below)
    spotlight: { left: 0.05, top: 0.24, width: 0.9, height: 0.12 }
  },
  {
    title: 'Calorie Tracker',
    tooltip: 'Log meals, use quick add buttons, or generate AI meal suggestions.',
    // Spotlight over the Calorie Tracker card (scroll offset brings it into view)
    spotlight: { left: 0.05, top: 0.20, width: 0.9, height: 0.26 }
  },
  {
    title: 'Navigate the App',
    tooltip: 'Use the tabs below: Workout, Mental, Community, League. Swipe or tap to switch.',
    spotlight: { left: 0, top: 0.88, width: 1, height: 0.12 }
  }
];

const TutorialOverlay = ({ visible, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const homeScroll = useHomeScroll();

  const step = TUTORIAL_STEPS[currentStep];
  const s = step.spotlight;

  // When step changes, scroll home so the spotlighted section is in view.
  // scrollOffsets[i] = pixels to scroll for step i (last step = tab bar, no scroll).
  useEffect(() => {
    if (!visible || !homeScroll?.scrollToY || !homeScroll?.scrollOffsets) return;
    const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
    if (isLastStep) return; // Tab bar is always visible
    const y = homeScroll.scrollOffsets[currentStep];
    if (typeof y === 'number') homeScroll.scrollToY(y);
  }, [visible, currentStep, homeScroll?.scrollToY, homeScroll?.scrollOffsets]);

  // Convert percentage to pixels
  const spotlightLeft = width * s.left;
  const spotlightTop = height * s.top;
  const spotlightWidth = width * s.width;
  const spotlightHeight = height * s.height;

  // Responsive sizing: scale down on small screens
  const isSmallScreen = height < 650;
  const tooltipMaxHeight = useMemo(() => Math.min(180, height * 0.28), [height]);
  const tooltipTitleSize = isSmallScreen ? 16 : 18;
  const tooltipTextSize = isSmallScreen ? 13 : 15;
  const tooltipLineHeight = tooltipTextSize * 1.4;

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onComplete?.();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Dark overlay with spotlight hole - 4 rectangles framing the cutout */}
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          {/* Top */}
          <View
            style={[
              styles.dim,
              {
                top: 0,
                left: 0,
                right: 0,
                height: spotlightTop
              }
            ]}
          />
          {/* Bottom */}
          <View
            style={[
              styles.dim,
              {
                top: spotlightTop + spotlightHeight,
                left: 0,
                right: 0,
                bottom: 0
              }
            ]}
          />
          {/* Left */}
          <View
            style={[
              styles.dim,
              {
                top: spotlightTop,
                left: 0,
                width: spotlightLeft,
                height: spotlightHeight
              }
            ]}
          />
          {/* Right */}
          <View
            style={[
              styles.dim,
              {
                top: spotlightTop,
                left: spotlightLeft + spotlightWidth,
                right: 0,
                height: spotlightHeight
              }
            ]}
          />

          {/* Spotlight highlight border */}
          <View
            style={[
              styles.spotlightBorder,
              {
                left: spotlightLeft,
                top: spotlightTop,
                width: spotlightWidth,
                height: spotlightHeight
              }
            ]}
          />
        </View>

        {/* Top bar: Skip */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <Text style={styles.stepIndicator}>
            {currentStep + 1} / {TUTORIAL_STEPS.length}
          </Text>
        </View>

        {/* Bottom panel: tooltip first, then Next button, then dots - so Next never overlaps text */}
        <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 16) + (isSmallScreen ? 12 : 20) }]}>
          <ScrollView
            style={[styles.tooltip, { maxHeight: tooltipMaxHeight, maxWidth: width - 40 }]}
            contentContainerStyle={styles.tooltipContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={[styles.tooltipTitle, { fontSize: tooltipTitleSize }]}>{step.title}</Text>
            <Text style={[styles.tooltipText, { fontSize: tooltipTextSize, lineHeight: tooltipLineHeight }]}>{step.tooltip}</Text>
          </ScrollView>
          <TouchableOpacity style={[styles.nextButton, isSmallScreen && styles.nextButtonCompact]} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentStep === TUTORIAL_STEPS.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={currentStep === TUTORIAL_STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={20}
              color="#000"
            />
          </TouchableOpacity>
          <View style={[styles.pagination, isSmallScreen && { paddingTop: 8 }]}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentStep && styles.dotActive
                ]}
              />
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
    justifyContent: 'space-between'
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)'
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
    elevation: 10
  },
  bottomPanel: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12
  },
  tooltip: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)'
  },
  tooltipContent: {
    paddingVertical: 4
  },
  tooltipTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  tooltipText: {
    color: '#00ffff',
    textAlign: 'center'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10
  },
  skipButton: {
    padding: 10
  },
  skipText: {
    color: '#00ffff',
    fontSize: 16
  },
  stepIndicator: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14
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
    elevation: 5
  },
  nextButtonCompact: {
    paddingVertical: 10,
    paddingHorizontal: 24
  },
  nextButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: 'bold'
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 255, 255, 0.3)'
  },
  dotActive: {
    backgroundColor: '#00ffff',
    width: 24
  }
});

export default TutorialOverlay;
