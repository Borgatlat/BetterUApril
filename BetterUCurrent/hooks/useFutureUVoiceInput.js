import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

let ExpoSpeechRecognitionModule = null;

try {
  // Optional native module — requires dev build / TestFlight after `expo-speech-recognition` install.
  ExpoSpeechRecognitionModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  ExpoSpeechRecognitionModule = null;
}

/**
 * Microphone → text for Future U composer.
 * @param {{ onTranscript: (text: string) => void, disabled?: boolean }} options
 */
export function useFutureUVoiceInput({ onTranscript, disabled = false }) {
  const [listening, setListening] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    if (!ExpoSpeechRecognitionModule) return undefined;

    const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const transcript = event?.results?.[0]?.transcript ?? '';
      if (typeof transcript === 'string' && transcript.trim()) {
        onTranscriptRef.current(transcript);
      }
    });

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      setListening(false);
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      setListening(false);
      const message = event?.error ?? event?.message ?? 'Speech recognition failed';
      if (__DEV__) console.warn('[FutureU voice]', message);
    });

    return () => {
      resultSub?.remove?.();
      endSub?.remove?.();
      errorSub?.remove?.();
    };
  }, []);

  const stopListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) return;
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(
        'Voice input',
        Platform.OS === 'web'
          ? 'Voice input is not supported in the browser preview.'
          : 'Voice input needs a development build with expo-speech-recognition. You can still type your message.',
      );
      return;
    }

    const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!available) {
      Alert.alert('Voice input', 'Speech recognition is not available on this device.');
      return;
    }

    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms?.granted) {
      Alert.alert('Microphone', 'Allow microphone access to use voice input in Future U.');
      return;
    }

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
      setListening(true);
    } catch (e) {
      Alert.alert('Voice input', String(e?.message || e || 'Could not start listening'));
    }
  }, []);

  const toggleListening = useCallback(async () => {
    if (disabled) return;
    if (listening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [disabled, listening, startListening, stopListening]);

  useEffect(() => {
    if (disabled && listening) {
      stopListening();
    }
  }, [disabled, listening, stopListening]);

  return {
    listening,
    voiceAvailable: Boolean(ExpoSpeechRecognitionModule),
    toggleListening,
    stopListening,
  };
}
