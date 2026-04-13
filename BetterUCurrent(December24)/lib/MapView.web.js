/**
 * Web stub for react-native-maps.
 * react-native-maps uses native-only modules (e.g. codegenNativeCommands) that don't exist
 * in the web bundle. This file is used when building for web (Metro/Expo resolves .web.js).
 * On native (iOS/Android), lib/MapView.js is used instead and loads the real react-native-maps.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder map view: a simple View so layout doesn't break. Real maps only work on native.
function MapView({ style, children, ...props }) {
  return (
    <View style={[styles.placeholder, style]} {...props}>
      <Text style={styles.placeholderText}>Map not available on web</Text>
      {children}
    </View>
  );
}

// Default export so "import MapView, { Polyline, Marker } from '../../lib/MapView'" works on web.
export default MapView;

// Polyline and Marker are no-ops on web (they render nothing). They're only used as children of MapView.
export function Polyline() {
  return null;
}
export function Marker() {
  return null;
}

// Same constant name the real library uses; value doesn't matter on web.
export const PROVIDER_GOOGLE = 1;

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  placeholderText: {
    color: '#888',
    fontSize: 14,
  },
});
