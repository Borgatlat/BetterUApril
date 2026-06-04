/**
 * Expo config plugin: inject production iOS keys into Info.plist at prebuild / config time.
 *
 * Bare-workflow EAS builds use the committed ios/ folder as-is unless you run prebuild.
 * This plugin runs whenever Expo evaluates app.config.js (including `expo prebuild` and
 * some EAS config passes), keeping GMSApiKey and build metadata aligned with env secrets.
 */
const { withInfoPlist } = require("@expo/config-plugins");

function withIosProductionPlist(config) {
  return withInfoPlist(config, (config) => {
    const mapsKey =
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      "";

    if (mapsKey) {
      config.modResults.GMSApiKey = mapsKey;
    }

    const buildNumber = config.ios?.buildNumber;
    if (buildNumber) {
      config.modResults.CFBundleVersion = String(buildNumber);
    }

    const marketingVersion = config.version;
    if (marketingVersion) {
      config.modResults.CFBundleShortVersionString = String(marketingVersion);
    }

    return config;
  });
}

module.exports = withIosProductionPlist;
