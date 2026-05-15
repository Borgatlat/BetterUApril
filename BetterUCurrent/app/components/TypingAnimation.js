import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import betterUMobile from '../../assets/images/betterumobile.png';

const TypingAnimation = ({ onComplete }) => {
  const [displayedTexts, setDisplayedTexts] = useState(['', '']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [allTextComplete, setAllTextComplete] = useState(false);

  const texts = [
    "BetterU",
    "Your personal fitness journey starts here."
  ];

  useEffect(() => {
    if (!isTyping) return;

    const currentFullText = texts[currentIndex];
    let charIndex = 0;

    const typingInterval = setInterval(() => {
      if (charIndex < currentFullText.length) {
        setDisplayedTexts(prev => {
          const newTexts = [...prev];
          newTexts[currentIndex] = currentFullText.substring(0, charIndex + 1);
          return newTexts;
        });
        charIndex++;
      } else {
        clearInterval(typingInterval);
        
        // Wait a bit before starting the next text
        setTimeout(() => {
          if (currentIndex < texts.length - 1) {
            setCurrentIndex(prev => prev + 1);
          } else {
            // All text is complete
            setAllTextComplete(true);
            // Wait longer before completing
            setTimeout(() => {
              setIsTyping(false);
              onComplete();
            }, 3000);
          }
        }, 1500);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [currentIndex, isTyping]);

  // Don't render anything if animation is complete
  if (!isTyping && allTextComplete) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={betterUMobile}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <View style={styles.textContainer}>
        {texts.map((text, index) => (
          <Animated.Text
            key={index}
            style={[
              styles.text,
              index === 0 ? styles.title : styles.subtitle,
              index <= currentIndex ? styles.visible : styles.hidden
            ]}
          >
            {displayedTexts[index]}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  logoContainer: {
    position: 'absolute',
    top: '15%',
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  textContainer: {
    alignItems: 'center',
    gap: 20,
    marginTop: 20,
  },
  text: {
    color: '#00ffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '600',
    opacity: 0.9,
    marginBottom: 10,
  },
  visible: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
  },
  logo: {
    width: 120,
    height: 120,
  }
});

export default TypingAnimation; 