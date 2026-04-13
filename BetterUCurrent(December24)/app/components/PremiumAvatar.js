import React from 'react';
import { View, Image, StyleSheet, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isUserPremium } from '../utils/premiumStatus';

export function PremiumAvatar({ userId, size = 40, style, isPremium: propIsPremium, username, fullName, ...props }) {
  const [isPremium, setIsPremium] = React.useState(propIsPremium || false);
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // If isPremium prop is provided, use it directly
    if (propIsPremium !== undefined) {
      setIsPremium(propIsPremium);
    } else if (userId) {
      // Otherwise check if user is premium
      isUserPremium(userId).then(setIsPremium);
    }

    // Create pulsing animation for premium users - commented out
    // if (isPremium) {
    //   Animated.loop(
    //     Animated.sequence([
    //       Animated.timing(glowAnim, {
    //         toValue: 1,
    //         duration: 2000,
    //         useNativeDriver: true,
    //       }),
    //       Animated.timing(glowAnim, {
    //         toValue: 0.3,
    //         duration: 2000,
    //         useNativeDriver: true,
    //       }),
    //     ])
    //   ).start();
    // }
  }, [userId, isPremium, propIsPremium]);

  const glowStyle = {
    opacity: glowAnim,
    transform: [
      {
        scale: glowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.15],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Glow effect commented out */}
      {/* {isPremium && (
        <>
          <Animated.View
            style={[
              styles.glow,
              {
                width: size + 16,
                height: size + 16,
                borderRadius: (size + 16) / 2,
              },
              glowStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.innerGlow,
              {
                width: size + 8,
                height: size + 8,
                borderRadius: (size + 8) / 2,
              },
              glowStyle,
            ]}
          />
        </>
      )} */}
      {props.source ? (
        <Image
          {...props}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              // Gold outline commented out
              // borderColor: isPremium ? '#FFD700' : '#ffffff',
              borderColor: '#ffffff',
              borderWidth: 2,
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
              // Gold outline commented out
              // borderColor: isPremium ? '#FFD700' : '#ffffff',
              borderColor: '#ffffff',
              borderWidth: 2,
            },
          ]}
        >
          {fullName ? (
            <Text style={[styles.defaultAvatarText, { fontSize: size * 0.4 }]}>
              {fullName.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2)}
            </Text>
          ) : username ? (
            <Text style={[styles.defaultAvatarText, { fontSize: size * 0.4 }]}>
              {username.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Ionicons 
              name="person" 
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
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 1,
  },
  innerGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 1,
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