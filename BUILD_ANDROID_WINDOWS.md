# Build & Run Android App (Windows)

This guide explains how to set up a Windows development environment for building the Android APK for the Joule HVAC app using Capacitor and Gradle.

Prerequisites
- Node.js (v18+ recommended) and npm installed
- Android Studio (with Android SDK and CLI tools)
- JDK 17+ (Temurin/Corretto/OpenJDK recommended)
- A USB-enabled Android device, or an emulator

1. Install JDK

- Download and install a JDK 17+ build (Adoptium Temurin, Amazon Corretto, or OpenJDK builds). Example: Temurin 17.
- After installation, set JAVA_HOME and update PATH (PowerShell example - adjust the path to your JDK install):

```powershell
setx JAVA_HOME "C:\Program Files\Adoptium\jdk-17.0.8.1-hotspot" -m
setx PATH "%PATH%;%JAVA_HOME%\bin" -m
```

- Close and reopen PowerShell to pick up environment variable changes. Verify with:

```powershell
java -version
echo $env:JAVA_HOME
```

2. Install Android Studio & SDK

- Download Android Studio and install the recommended SDK tools and platform(s). Also ensure Android SDK Tools and Platform Tools are installed. Use the SDK Manager in Android Studio to verify.

3. Prepare the repo

```powershell
cd C:\Users\Thomas\calculators\engineering-tools
npm install
```

Note: If you prefer reproducible installs and `npm ci` errors out due to peer dependency conflicts (for example, react vs. a plugin expecting an older React), use:

```powershell
npm ci --legacy-peer-deps
```
This will ignore peer conflicts and let the install finish (CI uses this option in the workflow).

4. Build the web assets (Vite)

```powershell
npm run build
```

Note: The build system now includes a Vite "legacy" build step which generates ES5/legacy-compatible chunks for older WebViews (e.g. Android 9). If you encounter runtime errors on Android 9, ensure dependencies are installed and re-run `npm ci`.

Behavior note: When a user accepts the Terms of Use on first run, the app now automatically navigates to the onboarding flow (Cost Forecaster), if onboarding hasn't already been completed. If you don't see onboarding after accepting Terms, check for `hasCompletedOnboarding` in localStorage (older installs may have this set already).

Debug Intent (Programmatic Accept - Debug builds only)
--------------------------------------------------
To aid CI and automated testing, debug builds of the Android app now include a dev-only intent that accepts the Terms programmatically and reloads the webview.

Use the following to simulate accepting Terms using adb (works with debug builds only):

```powershell
adb shell am broadcast -a com.joulehvac.app.ACTION_ACCEPT_TERMS
```

This is used by CI to reliably trigger the onboarding flow without relying on screen tap coordinates. It also reloads the webview so the JS-based flow picks up the modified localStorage value. Note: this intent is compiled only in debug builds (guarded by BuildConfig.DEBUG).

4a. Install Platform-Tools (adb) & set PATH (Windows)

The Android SDK Platform-Tools contain `adb` which is required to install APKs and interact with devices.

Option 1 — Android Studio (recommended):

- Open Android Studio -> Tools -> SDK Manager -> SDK Tools tab -> check "Android SDK Platform-Tools" -> Apply / OK.

Option 2 — Using sdkmanager (if you have command-line tools):

```powershell
# Path to sdkmanager may vary; adjust if you installed cmdline-tools elsewhere
$sdkManager = "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat"
& $sdkManager "platform-tools"
```

Option 3 — Manual download (standalone platform-tools):

1. Download the platform-tools ZIP from the official Android site:
  https://dl.google.com/android/repository/platform-tools-latest-windows.zip
2. Extract the ZIP to: `C:\Users\<YourUser>\AppData\Local\Android\Sdk` (create the folder if necessary).

Add platform-tools to PATH (permanently):

Open a new PowerShell window and run (replace `<YourUser>` if needed):

```powershell
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\Android\Sdk" -m
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk" -m
# Append to PATH for the current user
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools" -m
```

Notes:
- After running `setx`, you must open a new PowerShell window to pick up the new PATH values.
- If you prefer the GUI, open Start -> Search "Edit the system environment variables" -> Environment Variables and add or edit `ANDROID_SDK_ROOT` / `Path` accordingly.
- Verify installation:
```powershell
adb version
adb devices
```

5. Copy and sync web assets to Android (Capacitor)

```powershell
npx cap sync android
npx cap copy android
```

6. Clean Android build artifacts (important - removes stale package and resource artifacts)

```powershell
cd android
Remove-Item -Recurse -Force build
Remove-Item -Recurse -Force app\build
```

7. Build the debug APK

```powershell
cd android
.\gradlew clean
.\gradlew assembleDebug
```

Notes:
- If the build fails with a 'JAVA_HOME not set' or 'java not found' message, verify step 1 above.
- If any 'packaged manifests' or resource files still show references to the old package (com.engineering.tools), delete the app build directories in step 6 and re-run steps 4-7.
- If Gradle outputs large chunk warnings for the web assets (Vite), you can consider code splitting or configuring manual chunking in `vite.config.js`.

CI: Automated onboarding test
---------------------------
Our GitHub Actions CI includes an emulator job that validates the Android 9 (API 28) runtime. It also runs a small integration check:
- Installs the debug APK on a fresh emulator
- Starts the app and simulates tapping "Accept" on the Terms modal
- Asserts that the app navigated to the Cost Forecaster onboarding flow by checking the app's runtime logs

This protects the first-run experience from regressions. If you want to reproduce locally, clear app data/uninstall and run the app, then accept the terms — you should be taken to the Cost Forecaster onboarding flow.

8. Install APK on a device (optional)

```powershell
adb devices # verify a device is connected
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

9. Verify app branding & package

- Confirm the installed app name is 'Joule HVAC'.
- Confirm the Android package is `com.joulehvac.app`.
- Inspect `android/app/src/main/res/values/strings.xml` for the `app_name` value.
- Inspect `android/app/build.gradle` for `namespace` and `applicationId`.

10. Troubleshooting
- If you see 'Engineering Tools' anywhere in the final APK:
  - Ensure step 6 (clean build) is performed to purge stale artifacts.
  - Use `Find`/`Select-String` to search the repo for stray strings:

```powershell
Select-String -Path **\* -Pattern "Engineering Tools" -SimpleMatch
```

- If Gradle warns about deprecated property assignment styles in plugin build files: this is a warning only, and safe to ignore for now.

- If `npm ci --legacy-peer-deps` fails during install (for example `ENOTEMPTY` while removing node_modules or other install errors), try the helper script to forcibly clean and reinstall modules (Windows PowerShell):

```powershell
# Remove node_modules and try reinstall (retry-friendly):
npm run clean-install
```

This script will remove `node_modules`, clear npm cache, and run `npm ci --legacy-peer-deps` with retries. If it still fails, inspect the npm logs listed in the message (e.g., under %LOCALAPPDATA%\npm-cache\_logs) and try deleting broken folders or file locks. If you're in an editor or terminal that may be holding file handles, close it and retry.

11. Optional: Building a release APK
PowerShell Automation Script
---------------------------

We include a convenience script that automates the debug build flow on Windows. Run from the repo root as an Administrator or regular terminal (PowerShell):

```powershell
# Full build + install (requires adb on PATH):
.\scripts\build-android.ps1 -InstallApk

# Build only, skip npm install:
.\scripts\build-android.ps1 -SkipNpmInstall
```

Or use the convenience npm scripts from the repo root:

```powershell
# Full build + install (uses PowerShell to run the build script):
npm run build:android

# Fast build (no npm install):
npm run build:android:no-install

For macOS / Linux users, run the shell script or the npm shortcuts:

```bash
# Full build + install (Linux/macOS):
npm run build:android:unix

# Fast build (skip npm install):
npm run build:android:unix:no-install

Cross-platform command:

```powershell
# On any platform, run the platform-appropriate build flow with one command
npm run build:android
```
```
```

The script performs the commands listed above and exits if a command fails. It checks for `java` and `adb` availability and attempts a sensible clean build flow.

- See the React/Capacitor and Android Studio docs for signing and upload to Google Play. You'll need to create a keystore and configure `signingConfigs` in `android/app/build.gradle`.

Feel free to paste any error logs here if you get blocked; I can help interpret them and suggest the next steps.
