# Sets ANDROID_HOME and PATH so Expo/React Native can find the Android SDK and adb.
# Run this in PowerShell before "npx expo run:android" if you get "ANDROID_HOME" or "adb not recognized" errors.
# Usage: . .\scripts\set-android-env.ps1   (dot-source to apply in current session)

$locations = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:USERPROFILE\AppData\Local\Android\Sdk",
    "C:\Android\Sdk",
    "C:\Android\android-sdk"
)

$sdkRoot = $null
foreach ($loc in $locations) {
    if ($loc -and (Test-Path $loc) -and (Test-Path "$loc\platform-tools\adb.exe")) {
        $sdkRoot = $loc
        break
    }
}

if (-not $sdkRoot) {
    Write-Host ""
    Write-Host "Android SDK not found. To run the Android emulator:" -ForegroundColor Yellow
    Write-Host "1. Install Android Studio: https://developer.android.com/studio" -ForegroundColor White
    Write-Host "2. Open Android Studio -> Settings -> Languages & Frameworks -> Android SDK" -ForegroundColor White
    Write-Host "   Note the 'Android SDK Location' (e.g. $env:LOCALAPPDATA\Android\Sdk)" -ForegroundColor White
    Write-Host "3. Set system environment variable ANDROID_HOME to that path:" -ForegroundColor White
    Write-Host "   Win+R -> sysdm.cpl -> Advanced -> Environment Variables -> New (System or User):" -ForegroundColor White
    Write-Host "   ANDROID_HOME = $env:LOCALAPPDATA\Android\Sdk" -ForegroundColor Cyan
    Write-Host "4. Add to PATH: %ANDROID_HOME%\platform-tools" -ForegroundColor White
    Write-Host "5. Restart your terminal (or IDE), then run this script again." -ForegroundColor White
    Write-Host ""
    exit 1
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$platformTools = "$sdkRoot\platform-tools"
if ($env:PATH -notlike "*$platformTools*") {
    $env:PATH = "$platformTools;$env:PATH"
}
Write-Host "ANDROID_HOME set to: $sdkRoot" -ForegroundColor Green
Write-Host "You can now run: npx expo run:android" -ForegroundColor Green
