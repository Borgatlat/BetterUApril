"use client";

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';

const PRIVACY_POLICY_URL = 'https://www.betteruai.com/privacy-policy';

/**
 * Disclosure modal for Apple Guidelines 5.1.1(i) / 5.1.2(i):
 * - States what data is sent (messages, profile, fitness data, and for meal photos, images).
 * - Identifies OpenAI as the third party.
 * - Provides a link to the app's privacy policy.
 * - Continue = consent; Not now = decline (no data sent).
 */
export default function AIConsentModal({ visible, onAccept, onDecline }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, styles.overlayElevation]}>
        <View style={styles.card}>
          <Text style={styles.title}>AI features use OpenAI</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.body}>
              To power AI Trainer, AI Therapist, workout and mental session generation, meal suggestions, and food recognition from photos, we send relevant data to{' '}
              <Text style={styles.bold}>OpenAI</Text>. This may include your messages, profile, fitness and wellness data, and for meal photos, the image itself.
            </Text>
            <Text style={styles.body}>
              You can decline and still use the app without these AI features.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              activeOpacity={0.7}
            >
              <Text style={styles.link}>Privacy Policy</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDecline}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayElevation: {
    elevation: Platform.OS === 'android' ? 9999 : undefined,
    zIndex: Platform.OS === 'android' ? 9999 : undefined,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 220,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  body: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#fff',
  },
  link: {
    fontSize: 15,
    color: '#0ea5e9',
    fontWeight: '500',
    marginTop: 4,
  },
  buttons: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#888',
  },
});
