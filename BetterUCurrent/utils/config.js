import Constants from 'expo-constants';

// Get the environment variables
const ENV = {
  dev: {
    OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || Constants.expoConfig?.extra?.openaiApiKey || Constants.expoConfig?.env?.EXPO_PUBLIC_OPENAI_API_KEY || '',
  },
  prod: {
    OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || Constants.expoConfig?.extra?.openaiApiKey || Constants.expoConfig?.env?.EXPO_PUBLIC_OPENAI_API_KEY || '',
  }
};

// Get the current environment
const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
};

export default getEnvVars(); 