module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Reanimated plugin must be listed last
      // This is required for react-native-reanimated v4
      'react-native-reanimated/plugin',
    ],
  };
};
