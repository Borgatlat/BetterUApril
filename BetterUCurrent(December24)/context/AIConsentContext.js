"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'AI_THIRD_PARTY_CONSENT';
const PRIVACY_POLICY_URL = 'https://www.betteruai.com/privacy-policy';

const AIConsentContext = createContext();

const DISCLOSURE_MESSAGE =
  'To power AI Trainer, AI Therapist, workout and mental session generation, meal suggestions, and food recognition from photos, we send relevant data to OpenAI. This may include your messages, profile, fitness and wellness data, and for meal photos, the image itself.\n\n' +
  'You can decline and still use the app without these AI features.\n\n' +
  `Privacy Policy: ${PRIVACY_POLICY_URL}`;

/**
 * Provider that manages AI third-party consent state and exposes requestAIConsent().
 * Uses Alert.alert for the consent dialog so it always appears on top (avoids Modal stacking issues).
 */
export const AIConsentProvider = ({ children }) => {
  const [consented, setConsented] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const consentedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted) {
          const hasConsented = value === 'true';
          consentedRef.current = hasConsented;
          hydratedRef.current = true;
          setConsented(hasConsented);
          setHydrated(true);
        }
      } catch (e) {
        if (isMounted) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const requestAIConsent = () => {
    return new Promise((resolve) => {
      const hydrationTimeout = 3000;
      const start = Date.now();
      const waitThenShow = async () => {
        while (!hydratedRef.current && Date.now() - start < hydrationTimeout) {
          await new Promise((r) => setTimeout(r, 50));
        }
        if (consentedRef.current) {
          resolve(true);
          return;
        }
        Alert.alert(
          'AI features use OpenAI',
          DISCLOSURE_MESSAGE,
          [
            {
              text: 'Not now',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  await AsyncStorage.setItem(STORAGE_KEY, 'true');
                } catch (e) {
                  console.warn('AIConsent: failed to persist consent', e);
                }
                consentedRef.current = true;
                setConsented(true);
                resolve(true);
              },
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      };
      waitThenShow();
    });
  };

  const value = {
    requestAIConsent,
    consented,
    hydrated,
  };

  return (
    <AIConsentContext.Provider value={value}>
      {children}
    </AIConsentContext.Provider>
  );
};

export const useAIConsent = () => {
  const context = useContext(AIConsentContext);
  if (!context) {
    throw new Error('useAIConsent must be used within an AIConsentProvider');
  }
  return context;
};
