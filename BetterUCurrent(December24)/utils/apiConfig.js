import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Anthropic (Claude) for Future U and other Claude features.
 * Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env or `extra.anthropicApiKey` in app.config — never commit real keys.
 */
export const getAnthropicApiKey = () => {
  const key =
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ||
    Constants.expoConfig?.extra?.anthropicApiKey ||
    '';
  return String(key).trim();
};

/**
 * OpenAI for meal / workout / trainer flows.
 * Set EXPO_PUBLIC_OPENAI_API_KEY or `extra.openaiApiKey` in app.config.
 * Optionally reads AsyncStorage key `openai_api_key` if your app lets users paste a key (dev only).
 */
export const getOpenAIApiKey = async () => {
  const fromEnv =
    process.env.EXPO_PUBLIC_OPENAI_API_KEY || Constants.expoConfig?.extra?.openaiApiKey || '';
  if (fromEnv) {
    return String(fromEnv).trim();
  }
  try {
    const cached = await AsyncStorage.getItem('openai_api_key');
    if (cached && String(cached).trim()) {
      return String(cached).trim();
    }
  } catch {
    /* ignore */
  }
  return '';
};

/** @returns {Promise<string>} API key or throws if missing (strict, for flows that must not call OpenAI without a key). */
export const ensureApiKeyAvailable = async () => {
  const key = await getOpenAIApiKey();
  if (!key) {
    throw new Error(
      'OpenAI API key is not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env (or extra.openaiApiKey in app.config) and rebuild.'
    );
  }
  return key;
};

export const testApiKeyAvailability = async () => {
  const key = await getOpenAIApiKey();
  return key;
};
