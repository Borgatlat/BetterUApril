import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PremiumFeature({ isPremium, onPress, children, style }) {
  if (!isPremium) {
    return (
      <View style={[style, { position: 'relative', width: '100%', alignItems: 'center' }]}> 
        {children}
        <View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }} pointerEvents="none">
          <Ionicons name="lock-closed" size={36} color="#fff" style={{ opacity: 0.85 }} />
        </View>
        {/* Message below locked feature */}
        <Text style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginTop: 10, fontWeight: '500', letterSpacing: 0.1 }}>
          Upgrade to Premium in the settings
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ position: 'relative' }, style]}>
      <TouchableOpacity
        onPress={isPremium ? onPress : () => alert('Upgrade to Premium to unlock this feature!')}
        disabled={!isPremium}
        style={{ opacity: isPremium ? 1 : 0.5 }}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
} 