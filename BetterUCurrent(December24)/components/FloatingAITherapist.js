import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import TherapistModal from '../app/(modals)/therapist-modal';

export const FloatingAITherapist = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onPress={() => setIsModalVisible(true)}
      >
      <LinearGradient
        colors={['#8b5cf6', '#a855f7']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.therapistFace}>
          {/* Therapist eyes */}
          <View style={styles.eyeContainer}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </View>
          {/* Therapist mouth */}
          <View style={styles.mouth} />
        </View>
      </LinearGradient>
      </TouchableOpacity>
      
      {isModalVisible && (
        <TherapistModal 
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 1000,
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  gradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  therapistFace: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  eyeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 32,
    marginBottom: 8,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  mouth: {
    width: 12,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 1,
    elevation: 1,
  },
}); 