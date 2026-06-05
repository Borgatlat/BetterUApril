import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * VerifiedBadge — blue checkmark next to admin-verified usernames.
 * Returns null when isVerified is false (no empty layout space).
 */
const VerifiedBadge = ({ isVerified = false, size = 14, style }) => {
  if (!isVerified) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Ionicons name="checkmark-circle" size={size} color="#00ffff" style={styles.icon} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {},
});

export default VerifiedBadge;
