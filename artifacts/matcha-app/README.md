# MatchA App Commands

This app lives in:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
```

## Environment Files

Development commands use:

```sh
.env
```

Production release commands should use:

```sh
.env.production
```

## Install Dependencies

From the repo root:

```sh
pnpm install
```

Or from the app directory:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm install
```

## Run iOS

Run on the iOS simulator:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm ios
```

Run on a connected iPhone:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
set -a && . ./.env && set +a && pnpm exec expo run:ios --device
```

If CocoaPods need to be refreshed:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app/ios
pod install
```

## Run Android

Run on the active Android emulator or connected Android device:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm android
```

Check connected Android devices:

```sh
adb devices
```

## Build Android Release APK

Build release APK with production env:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
set -a && . ./.env.production && set +a && NODE_ENV=production pnpm exec expo prebuild -p android && cd android && ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a -Pexpo.useLegacyPackaging=true -Pandroid.enableMinifyInReleaseBuilds=true -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

Clean release build:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
set -a && . ./.env.production && set +a && NODE_ENV=production pnpm exec expo prebuild -p android --clean && cd android && ./gradlew clean assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a -Pexpo.useLegacyPackaging=true -Pandroid.enableMinifyInReleaseBuilds=true -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

Release APK output:

```sh
/Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app/android/app/build/outputs/apk/release/app-release.apk
```

## Install Android APK On A Device

Install the built release APK on a connected Android device:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

If the package is already installed and signing changed, uninstall then reinstall:

```sh
adb uninstall com.xylo.matcha
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Install iOS Build On A Device

For local device deployment during development:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
set -a && . ./.env && set +a && pnpm exec expo run:ios --device
```

If you need a distributable iOS build, open the workspace in Xcode and archive from there:

```sh
open /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app/ios/MatchA.xcworkspace
```

Then use:

1. Product > Archive
2. Distribute App

## Useful Checks

Typecheck the app:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm typecheck
```

Prebuild Android native files:

```sh
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm android:prebuild
```
