import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const ActiveMentalSession = ({ route }) => {
  const router = useRouter();
  const { duration, type, steps } = route.params;
  const [timeLeft, setTimeLeft] = useState(duration * 60); // Convert to seconds
  const [isActive, setIsActive] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let interval;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    setIsActive(false);
    router.push({
      pathname: '/mental-summary',
      params: {
        type,
        duration,
        calmnessLevel: 0, // This should be user input
        notes: '' // This should be user input
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{type}</Text>
        <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
      </View>

      <View style={styles.stepsContainer}>
        <Text style={styles.stepTitle}>Current Step</Text>
        <Text style={styles.stepText}>{steps[currentStep]}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setCurrentStep(prev => Math.max(0, prev - 1))}
        >
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>

        {!isActive && (
          <TouchableOpacity 
            style={styles.finishButton}
            onPress={handleFinish}
          >
            <Text style={styles.finishButtonText}>Finish Session</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
        >
          <Ionicons name="arrow-forward" size={24} color="#00ffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  stepsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  stepText: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  controlButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  finishButton: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ActiveMentalSession; 