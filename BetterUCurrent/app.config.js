// SKAdNetwork IDs list recommended by Google for AdMob (Apple install attribution + bidding partners).
// `.map(...)` below turns each string into `{ SKAdNetworkIdentifier: "..." }` for Expo's Info.plist merge.
const GOOGLE_MOBILE_ADS_SKADNETWORK_IDS = [
  'cstr6suwn9.skadnetwork',
  '4fzdc2evr5.skadnetwork',
  '2fnua5tdw4.skadnetwork',
  'ydx93a7ass.skadnetwork',
  'p78axxw29g.skadnetwork',
  'v72qych5uu.skadnetwork',
  'ludvb6z3bs.skadnetwork',
  'cp8zw746q7.skadnetwork',
  '3sh42y64q3.skadnetwork',
  'c6k4g5qg8m.skadnetwork',
  's39g8k73mm.skadnetwork',
  'wg4vff78zm.skadnetwork',
  '3qy4746246.skadnetwork',
  'f38h382jlk.skadnetwork',
  'hs6bdukanm.skadnetwork',
  'mlmmfzh3r3.skadnetwork',
  'v4nxqhlyqp.skadnetwork',
  'wzmmz9fp6w.skadnetwork',
  'su67r6k2v3.skadnetwork',
  'yclnxrl5pm.skadnetwork',
  't38b2kh725.skadnetwork',
  '7ug5zh24hu.skadnetwork',
  'gta9lk7p23.skadnetwork',
  'vutu7akeur.skadnetwork',
  'y5ghdn5j9k.skadnetwork',
  'v9wttpbfk9.skadnetwork',
  'n38lu8286q.skadnetwork',
  '47vhws6wlr.skadnetwork',
  'kbd757ywx3.skadnetwork',
  '9t245vhmpl.skadnetwork',
  'a2p9lx4jpn.skadnetwork',
  '22mmun2rn5.skadnetwork',
  '44jx6755aq.skadnetwork',
  'k674qkevps.skadnetwork',
  '4468km3ulz.skadnetwork',
  '2u9pt9hc89.skadnetwork',
  '8s468mfl3y.skadnetwork',
  'klf5c3l5u5.skadnetwork',
  'ppxm28t8ap.skadnetwork',
  'kbmxgpxpgc.skadnetwork',
  'uw77j35x4d.skadnetwork',
  '578prtvx9j.skadnetwork',
  '4dzt52r2t5.skadnetwork',
  'tl55sbb4fm.skadnetwork',
  'c3frkrj4fj.skadnetwork',
  'e5fvkxwrpn.skadnetwork',
  '8c4e2ghe7u.skadnetwork',
  '3rd42ekr43.skadnetwork',
  '97r2b46745.skadnetwork',
  '3qcr597p9d.skadnetwork'
];

export default {
  expo: {
    name: "BetterU",
    slug: "betterutestflightv8",
    version: "1.1.6",
    orientation: "portrait",
    // iOS app icons must be fully opaque (no transparency). Repo includes this 1024 source;
    // (If you regenerate a flattened PNG, replace this path.)
    icon: "./assets/images/Icon-iOS-Dark-1024x1024@1x.png",
    userInterfaceStyle: "light",
    scheme: "betteru",
    jsEngine: "hermes",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.enriqueortiz.betteru",
      // Bump buildNumber so iOS/TestFlight treats the next build as a new binary
      // (otherwise you can keep seeing the old app icon due to caching / same build).
      // Note: the LiveActivity extension target reads its version from
      // `CURRENT_PROJECT_VERSION` in `ios/BetterU.xcodeproj/project.pbxproj`,
      // so that file MUST be kept in sync with this number, or Apple rejects
      // the upload with `ITMS-90478` (extension/parent CFBundleVersion mismatch).
      buildNumber: "12",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to let you take profile pictures.",
        NSPhotoLibraryUsageDescription: "This app uses the photo library to let you select profile pictures.",
        NSPhotoLibraryAddUsageDescription: "This app uses the photo library to save workout progress images.",
        NSLocationWhenInUseUsageDescription: "This app uses your location to track your runs and show your position on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app uses your location to track your runs in the background.",
        NSLocationAlwaysUsageDescription: "This app uses your location to track your runs in the background.",
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["remote-notification", "location"],
        // NSSupportsLiveActivities: true,  // Temporarily disabled for TestFlight
        // NSHealthShareUsageDescription: "This app reads health data to display your health statistics.",  // Temporarily disabled for TestFlight
        // NSHealthUpdateUsageDescription: "This app writes workout data to Apple Health.",  // Temporarily disabled for TestFlight
        CFBundleAllowMixedLocalizations: true,
        // Required by Google Mobile Ads on iOS — must match the AdMob *application* ID (with ~), not an ad unit (/).
        GADApplicationIdentifier:
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || 'ca-app-pub-9221552597487164~4144394214',
        SKAdNetworkItems: GOOGLE_MOBILE_ADS_SKADNETWORK_IDS.map((id) => ({
          SKAdNetworkIdentifier: id
        }))
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
      },
      entitlements: {
        // "com.apple.developer.healthkit": true,  // Temporarily disabled for TestFlight
        "aps-environment": "production",
        "com.apple.developer.applesignin": ["Default"],
        "com.apple.developer.usernotifications.time-sensitive": true
        // "com.apple.developer.activity-kit": true  // Temporarily disabled for TestFlight
      }
    },
    android: {
      package: "com.enriqueortiz.betteru",
      // Same idea as iOS buildNumber: incrementing versionCode forces Android to accept the update.
      versionCode: 5,
      adaptiveIcon: {
        // Android adaptive icons are split into:
        // - foreground: the logo (should have transparency)
        // - background: a solid color/image behind it
        // We generate this foreground from the same iOS icon by making near-black pixels transparent.
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000"
      }
    },
    plugins: [
      "expo-router",
      "expo-image-picker",
      "expo-av",
      [
        "expo-location",
        {
          "isIosBackgroundLocationEnabled": true,
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true,
          "locationAlwaysAndWhenInUsePermission": "BetterU uses your location to track runs and walks even when the app is in the background or screen is locked.",
          "locationAlwaysPermission": "BetterU uses your location to track your runs in the background.",
          "locationWhenInUsePermission": "BetterU uses your location to track your runs and show your position on the map."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/app-icon.png",
          "color": "#00ffff",
          "defaultChannel": "default"
        }
      ],
      "expo-apple-authentication",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#000000"
        }
      ],
      [
        "expo-build-properties",
        {
          "ios": {
            "newArchEnabled": false,
            "useFrameworks": "static",
            "deploymentTarget": "16.1",
            "swiftVersion": "5.9"
          }
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          // Android AdMob app IDs are separate from iOS — register the Android app in AdMob, then set EXPO_PUBLIC_ADMOB_ANDROID_APP_ID (or edit AndroidManifest meta-data).
          "androidAppId": process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713",
          "iosAppId": process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-9221552597487164~4144394214"
        }
      ]
      // [
      //   "@kingstinct/react-native-healthkit",
      //   {
      //     healthSharePermission: "This app reads health data to display your health statistics.",
      //     healthUpdatePermission: "This app writes workout data to Apple Health."
      //   }
      // ],  // Temporarily disabled for TestFlight
      // "expo-live-activity"  // Temporarily disabled for TestFlight
    ],
    experiments: {
      tsconfigPaths: true
    },
    // Keep the package installed in JS, but skip native iOS autolinking for
    // TestFlight until Nitro/HealthKit Swift symbol issues are resolved.
    autolinking: {
      ios: {
        exclude: ["@kingstinct/react-native-healthkit"]
      }
    },
    extra: {
      eas: {
        projectId: "57d27416-420d-4d92-8d6d-d1365c22f311"
      },
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL,
      admob: {
        // Banner *ad unit* IDs (with /) — created in AdMob console; Android still uses Google's sample test unit until that platform's ad unit is live.
        iosBannerAdUnitId: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID || "ca-app-pub-9221552597487164/1003410305",
        androidBannerAdUnitId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID || "ca-app-pub-3940256099942544/6300978111"
      }
    },
    env: {
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      EXPO_PUBLIC_ADMOB_IOS_APP_ID: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
      EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
      EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID,
      EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_AD_UNIT_ID,
      EXPO_PUBLIC_LIVEKIT_URL: process.env.EXPO_PUBLIC_LIVEKIT_URL
    },
    owner: "easbetteru",
    // Bare workflow requires a fixed runtime version string (policy-based runtimeVersion is unsupported).
    runtimeVersion: "1.1.6",
    updates: {
      url: "https://u.expo.dev/57d27416-420d-4d92-8d6d-d1365c22f311"
    }
  }
};
