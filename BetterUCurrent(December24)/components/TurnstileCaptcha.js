import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TurnstileCaptcha = ({ 
  siteKey, 
  onVerify, 
  onError, 
  style,
  theme = 'dark'
}) => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [holdStartTime, setHoldStartTime] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);

  // Simple verification steps
  const verificationSteps = [
    { title: "Step 1: Click to verify", icon: "hand-left-outline", action: "click" },
    { title: "Step 2: Hold for 2 seconds", icon: "timer-outline", action: "hold" },
    { title: "Step 3: Complete verification", icon: "checkmark-circle-outline", action: "complete" }
  ];

  const handleVerificationStep = () => {
    if (verificationStep === 0) {
      // Step 1: Just click to advance
      console.log('Moving from step 0 to step 1');
      setVerificationStep(1);
    } else if (verificationStep === 2) {
      // Step 3: Complete verification
      console.log('Completing verification');
      setIsLoading(true);
      setTimeout(() => {
        setIsVerified(true);
        setIsLoading(false);
        onVerify('simple_captcha_completed');
      }, 1000);
    }
    // Step 2 is handled by onPressIn/onPressOut
  };

  const resetCaptcha = () => {
    setIsVerified(false);
    setVerificationStep(0);
    setIsLoading(false);
    setHoldStartTime(null);
    setHoldProgress(0);
  };

  // Handle hold timer for step 2
  useEffect(() => {
    if (verificationStep === 1 && holdStartTime) {
      console.log('Timer started - verificationStep:', verificationStep, 'holdStartTime:', holdStartTime);
      const interval = setInterval(() => {
        const elapsed = Date.now() - holdStartTime;
        const progress = Math.min((elapsed / 2000) * 100, 100); // 2 seconds = 2000ms
        
        console.log('Timer tick - elapsed:', elapsed, 'progress:', progress);
        setHoldProgress(progress);
        
        if (progress >= 100) {
          // Hold completed, move to next step
          console.log('Hold completed!');
          setHoldStartTime(null);
          setHoldProgress(0);
          setVerificationStep(2);
          clearInterval(interval);
        }
      }, 50); // Update every 50ms for smooth progress
      
      return () => clearInterval(interval);
    }
  }, [verificationStep, holdStartTime]);

  // Expose reset function to parent
  useEffect(() => {
    if (onVerify) {
      onVerify.reset = resetCaptcha;
    }
  }, [onVerify]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    shake();
    handleVerificationStep();
  };

  const handlePressIn = () => {
    if (verificationStep === 1) {
      // Start holding when button is pressed down
      console.log('Hold started at:', Date.now());
      setHoldStartTime(Date.now());
    }
  };

  const handlePressOut = () => {
    if (verificationStep === 1 && holdStartTime) {
      // Reset hold if button is released before completion
      console.log('Hold cancelled - button released too early');
      setHoldStartTime(null);
      setHoldProgress(0);
    }
  };

  if (isVerified) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={48} color="#00ff88" />
          <Text style={styles.successText}>Verification Complete!</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetCaptcha}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.captchaContainer}>
        <Text style={styles.subtitle}>
          Complete the verification steps to prove you're human
        </Text>

                 <View style={styles.stepsContainer}>
           {verificationSteps.map((step, index) => (
             <View key={index} style={styles.stepRow}>
               <View style={[
                 styles.stepIcon, 
                 index <= verificationStep ? styles.stepIconActive : styles.stepIconInactive
               ]}>
                 <Ionicons 
                   name={step.icon} 
                   size={20} 
                   color={index <= verificationStep ? "#00ffff" : "#666"} 
                 />
               </View>
               <Text style={[
                 styles.stepText, 
                 index <= verificationStep ? styles.stepTextActive : styles.stepTextInactive
               ]}>
                 {step.title}
               </Text>
               {index < verificationStep && (
                 <Ionicons name="checkmark-circle" size={20} color="#00ff88" />
               )}
             </View>
           ))}
         </View>

         {/* Hold Progress Bar for Step 2 */}
         {verificationStep === 1 && holdStartTime && (
           <View style={styles.progressContainer}>
             <View style={styles.progressBar}>
               <View 
                 style={[
                   styles.progressFill, 
                   { width: `${holdProgress}%` }
                 ]} 
               />
             </View>
             <Text style={styles.progressText}>
               Hold for {Math.ceil((2000 - (Date.now() - holdStartTime)) / 1000)}s
             </Text>
           </View>
         )}

         <Animated.View 
           style={[
             styles.verificationButton,
             { transform: [{ translateX: shakeAnimation }] }
           ]}
         >
                     <TouchableOpacity 
             style={[
               styles.button, 
               isLoading ? styles.buttonLoading : styles.buttonActive
             ]} 
             onPress={handlePress}
             onPressIn={handlePressIn}
             onPressOut={handlePressOut}
             disabled={isLoading}
           >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="sync" size={20} color="#000" style={styles.spinning} />
                <Text style={styles.buttonText}>Verifying...</Text>
              </View>
            ) : (
              <>
                <Ionicons name={verificationSteps[verificationStep].icon} size={24} color="#000" />
                                 <Text style={styles.buttonText}>
                   {verificationStep === 0 ? 'Click to Start' : 
                    verificationStep === 1 ? 'Hold Here' : 
                    'Complete Verification'}
                 </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

                 <Text style={styles.instructionText}>
           {verificationStep === 0 && "Click the button above to start verification"}
           {verificationStep === 1 && holdStartTime ? "Keep holding the button..." : "Press and hold the button for 2 seconds"}
           {verificationStep === 2 && "Click to complete the verification process"}
         </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 1,
  },
  captchaContainer: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    paddingBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
  },

  subtitle: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 14,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 5,
  },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepIconActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00ffff',
  },
  stepIconInactive: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#666',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    marginRight: 6,
  },
  stepTextActive: {
    color: '#00ffff',
    fontWeight: '500',
  },
  stepTextInactive: {
    color: '#666',
  },
  verificationButton: {
    marginBottom: 0,
  },
  button: {
    backgroundColor: '#00ffff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
    flexDirection: 'row',
    gap: 4,
  },
  buttonActive: {
    backgroundColor: '#00ffff',
  },
  buttonLoading: {
    backgroundColor: '#00ccff',
  },
  buttonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spinning: {
    transform: [{ rotate: '0deg' }],
  },
  instructionText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 0,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ffff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#00ffff',
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    padding: 20,
  },
  successText: {
    fontSize: 16,
    color: '#00ff88',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TurnstileCaptcha;
