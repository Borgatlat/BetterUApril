import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';

/**
 * Wraps a feature that requires Premium.
 * Free users see a lock + tappable upgrade CTA (goes straight to paywall).
 */
export default function PremiumFeature({ isPremium, onPress, children, style, upgradeReason }) {
  const router = useRouter();

  const goToPaywall = () => {
    navigateToPremiumPaywall(router, upgradeReason);
  };

  if (!isPremium) {
    return (
      <View style={[style, { position: 'relative', width: '100%', alignItems: 'center' }]}>
        {children}
        <TouchableOpacity
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
          onPress={goToPaywall}
          activeOpacity={0.85}
        >
          <Ionicons name="lock-closed" size={36} color="#fff" style={{ opacity: 0.85 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToPaywall} activeOpacity={0.85}>
          <Text
            style={{
              color: '#00ffff',
              fontSize: 13,
              textAlign: 'center',
              marginTop: 10,
              fontWeight: '600',
              letterSpacing: 0.1,
            }}
          >
            Tap to unlock with Premium — 7-day free trial
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[{ position: 'relative' }, style]}>
      <TouchableOpacity onPress={onPress} style={{ opacity: 1 }}>
        {children}
      </TouchableOpacity>
    </View>
  );
}
