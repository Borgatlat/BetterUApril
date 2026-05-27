/**
 * ScreenHeader — themed top bar for non-tab screens.
 *
 * Why this exists:
 *   The app's root layout uses `<Slot />` instead of a `<Stack />`,
 *   so Expo Router's automatic header (with its built-in back button)
 *   never renders. We draw our own header on every screen that needs
 *   one, and centralizing the markup here keeps the visual style
 *   consistent across screens.
 *
 * Visual recipe:
 *   - Cyan-tinted background + thin bottom border so it reads as
 *     a single unit separated from the page content.
 *   - Back button on the left that calls `router.back()` (or a custom
 *     `onBack` if the parent overrides it).
 *   - Centered title in the middle (clipped with ellipsis if it's
 *     too long for the available width).
 *   - Optional `rightAction` slot for a tertiary control (e.g. a
 *     "+" button to create something new).
 *
 * Padding math:
 *   `paddingTop = insets.top + 20` — that's 20 px BELOW whatever the
 *   device's safe area says. On a non-notched phone insets.top is
 *   small (~20), so total visual top padding is ~40. On notched
 *   devices the math automatically pushes the bar below the notch.
 *
 * Props:
 *   @param {string} title      Title shown centered in the bar.
 *   @param {string} [subtitle] Optional small line below the title.
 *   @param {string} [accent]   Hex color used for the back button + iconography. Default '#00ffff'.
 *   @param {Function} [onBack] Override for the back action. Defaults to router.back().
 *   @param {ReactNode} [rightAction] Element rendered on the right side.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const ScreenHeader = ({
  title,
  subtitle = null,
  accent = '#00ffff',
  onBack = null,
  rightAction = null,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // The default back behavior. We let the parent override (e.g. a
  // create-workout flow might want to confirm "discard changes?"
  // before actually navigating back).
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      // Fallback: send the user to the workout tab if there's no
      // history (e.g. they deep-linked into this screen).
      router.replace('/(tabs)/workout');
    }
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 20 }]}>
      <TouchableOpacity
        // hitSlop expands the tappable area without resizing the icon —
        // 8 px on every side prevents thumb-misses on a small target.
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={handleBack}
        style={[styles.backButton, { borderColor: `${accent}55` }]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={accent} />
      </TouchableOpacity>

      <View style={styles.titleColumn}>
        <Text
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/*
        Right slot is either a caller-provided action or a same-sized
        spacer. Keeping the spacer means the title stays optically
        centered even when no rightAction is passed.
      */}
      {rightAction ? (
        <View style={styles.rightSlot}>{rightAction}</View>
      ) : (
        <View style={styles.rightSlot} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 14,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderWidth: 1,
  },
  titleColumn: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  rightSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ScreenHeader;
