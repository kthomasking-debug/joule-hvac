# Capacitor Android Build Instructions

This file documents the steps and provides helpful npm scripts to build the web app and create an Android APK using Capacitor.

Prerequisites
- Node.js and npm
- Android Studio (with SDK & platform-tools)
- Java JDK 11+ (set JAVA_HOME and add %JAVA_HOME%\bin to PATH)
- A connected Android device with USB debugging enabled (or an emulator)

Useful npm scripts (from package.json)
- npm run cap:build    - Build the web app and sync into the Android project
- npm run cap:open     - Open the android project in Android Studio
- npm run cap:assemble - Run Gradle assembleDebug (requires Java on PATH)

Typical workflow
1. Build and sync web assets into the Android project:

   npm run cap:build

2. Open Android Studio and build/install the APK:

   npm run cap:open

   In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)

   Or build and install from the command line (requires Java and adb):

   cd android
   .\gradlew assembleDebug
   adb install -r .\app\build\outputs\apk\debug\app-debug.apk

Troubleshooting
- If `adb` is not found, add the Android SDK `platform-tools` folder to your PATH.
- If `java` is not found, install a JDK and set JAVA_HOME.
- If `npx cap open android` fails to open Android Studio, make sure Android Studio is installed and accessible, or set the environment variable `CAPACITOR_ANDROID_STUDIO_PATH` to the Android Studio executable path.

Notes
- Re-run `npm run cap:build` after each web code change to update the Android project's web assets.
- For release builds and Play Store publishing, follow Android Studio's guide for signing and generating an AAB.
