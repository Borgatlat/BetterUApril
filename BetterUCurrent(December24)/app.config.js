export default {
  expo: {
    name: "BetterU",
    slug: "betterutestflightv8",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/images/app-icon.png",
    userInterfaceStyle: "light",
    scheme: "betteru",
    jsEngine: "hermes",
    newArchEnabled: false,
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
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to let you take profile pictures.",
        NSPhotoLibraryUsageDescription: "This app uses the photo library to let you select profile pictures.",
        NSPhotoLibraryAddUsageDescription: "This app uses the photo library to save workout progress images.",
        NSLocationWhenInUseUsageDescription: "This app uses your location to track your runs and show your position on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app uses your location to track your runs in the background.",
        NSLocationAlwaysUsageDescription: "This app uses your location to track your runs in the background.",
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["remote-notification", "location"],
        NSSupportsLiveActivities: true,
        NSHealthShareUsageDescription: "This app reads health data to display your health statistics.",
        NSHealthUpdateUsageDescription: "This app writes workout data to Apple Health.",
        CFBundleAllowMixedLocalizations: true,
        SKAdNetworkItems: [
          {
            SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork"
          }
        ]
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      entitlements: {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.usernotifications.time-sensitive": true,
        "com.apple.developer.activity-kit": true
      }
    },
    android: {
      package: "com.enriqueortiz.betteru",
      versionCode: 3,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.jpg",
        backgroundColor: "#ffffff"
      }
    },
    plugins: [
      "@livekit/react-native-expo-plugin",
      "@config-plugins/react-native-webrtc",
      "expo-router",
      "expo-image-picker",
      "expo-av",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/app-icon.png",
          "color": "#00ffff",
          "defaultChannel": "default"
        }
      ],
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
        "@kingstinct/react-native-healthkit",
        {
          healthSharePermission: "This app reads health data to display your health statistics.",
          healthUpdatePermission: "This app writes workout data to Apple Health."
        }
      ],
      "expo-live-activity"
    ],
    experiments: {
      tsconfigPaths: true
    },
    extra: {
      eas: {
        projectId: "57d27416-420d-4d92-8d6d-d1365c22f311"
      },
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      anthropicApiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
      livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL,
      finetunedTrainerModel: process.env.EXPO_PUBLIC_FINETUNED_TRAINER_MODEL
    },
    env: {
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      EXPO_PUBLIC_ANTHROPIC_API_KEY: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
      EXPO_PUBLIC_FINETUNED_TRAINER_MODEL: process.env.EXPO_PUBLIC_FINETUNED_TRAINER_MODEL
    },
    
    owner: "easbetteru",
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/57d27416-420d-4d92-8d6d-d1365c22f311"
    }
  }
}; 