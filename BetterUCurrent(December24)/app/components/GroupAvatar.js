import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function GroupAvatar({ groupName, size = 40, style, source, ...props }) {
  // Extract initials from group name (first letter of each word, up to 2 letters)
  const getInitials = (name) => {
    if (!name) return 'G';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {source ? (
        <Image
          {...props}
          source={source}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.defaultAvatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          {groupName ? (
            <Text style={[styles.defaultAvatarText, { fontSize: size * 0.4 }]}>
              {getInitials(groupName)}
            </Text>
          ) : (
            <Ionicons 
              name="people" 
              size={size * 0.5} 
              color="#666" 
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    zIndex: 2,
  },
  defaultAvatar: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  defaultAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 