/** Block native linking for Live Activity (extension disabled for personal-team Xcode signing). */
module.exports = {
  dependencies: {
    'expo-live-activity': {
      platforms: {
        ios: null,
        android: null
      }
    }
  }
};
