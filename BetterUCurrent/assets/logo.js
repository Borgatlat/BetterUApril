import React from 'react';
import { View } from 'react-native';

export const LogoFallback = ({ size = 100, style }) => {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          backgroundColor: '#000000',
          borderRadius: size / 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    />
  );
}; 