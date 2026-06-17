#!/usr/bin/env node
/**
 * EAS Build hook: sync ios/BetterU/Info.plist from app.config.js + env (no prebuild required).
 * Wired via package.json → "eas-build-pre-install".
 *
 * Why: bare ios/ is committed with an empty GMSApiKey. EAS secrets are env vars at build
 * time but are not automatically written into Info.plist. AppDelegate reads env first, yet
 * TestFlight archives often lack scheme env — plist is the reliable source.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const plistPath = path.join(root, "ios", "BetterU", "Info.plist");

function readAppConfigFields() {
  const text = fs.readFileSync(path.join(root, "app.config.js"), "utf8");
  const version = text.match(/^\s*version:\s*"([^"]+)"/m)?.[1];
  const buildNumber = text.match(/buildNumber:\s*"(\d+)"/)?.[1];
  const readInfoPlistString = (key) => {
    const re = new RegExp(`${key}:\\s*\\n?\\s*"([^"]+)"`);
    return text.match(re)?.[1];
  };
  return {
    version,
    buildNumber,
    microphoneUsage: readInfoPlistString("NSMicrophoneUsageDescription"),
    speechRecognitionUsage: readInfoPlistString("NSSpeechRecognitionUsageDescription"),
  };
}

function setPlistString(plist, key, value) {
  const escaped = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const pair = `\t<key>${key}</key>\n\t<string>${escaped}</string>`;
  const re = new RegExp(`\\t<key>${key}</key>\\s*\\n\\t<string>[^<]*</string>`);
  if (re.test(plist)) {
    return plist.replace(re, pair);
  }
  const insertBefore = "\t<key>ITSAppUsesNonExemptEncryption</key>";
  if (plist.includes(insertBefore)) {
    return plist.replace(insertBefore, `${pair}\n${insertBefore}`);
  }
  return plist;
}

function main() {
  if (!fs.existsSync(plistPath)) {
    console.log("[eas-sync-ios-plist] No ios/BetterU/Info.plist — skipping (managed workflow?).");
    return;
  }

  const { version, buildNumber, microphoneUsage, speechRecognitionUsage } = readAppConfigFields();
  let plist = fs.readFileSync(plistPath, "utf8");

  if (microphoneUsage) {
    plist = setPlistString(plist, "NSMicrophoneUsageDescription", microphoneUsage);
  }
  if (speechRecognitionUsage) {
    plist = setPlistString(plist, "NSSpeechRecognitionUsageDescription", speechRecognitionUsage);
  }

  const mapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    "";

  if (mapsKey) {
    plist = setPlistString(plist, "GMSApiKey", mapsKey);
    console.log("[eas-sync-ios-plist] GMSApiKey set (length %d)", mapsKey.length);
  } else {
    console.warn("[eas-sync-ios-plist] WARN: no Google Maps API key in env — maps may fail on device.");
  }

  if (buildNumber) {
    plist = setPlistString(plist, "CFBundleVersion", String(buildNumber));
    console.log("[eas-sync-ios-plist] CFBundleVersion =", buildNumber);
  }

  if (version) {
    plist = setPlistString(plist, "CFBundleShortVersionString", String(version));
    console.log("[eas-sync-ios-plist] CFBundleShortVersionString =", version);
  }

  fs.writeFileSync(plistPath, plist, "utf8");
  console.log("[eas-sync-ios-plist] Done.");
}

main();
