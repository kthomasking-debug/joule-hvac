#!/usr/bin/env bash
set -euo pipefail

# build-android.sh
# Automates building a debug APK on macOS/Linux for the Capacitor/Android app.
#
# Usage:
#   # Full build and install APK (requires adb available in PATH)
#   ./scripts/build-android.sh -i
#
#   # Build only (no install)
#   ./scripts/build-android.sh
#
#   # Skip npm install (if dependencies are already installed)
#   ./scripts/build-android.sh -s

INSTALL_APK=false
SKIP_NPM_INSTALL=false

usage() {
  echo "Usage: $0 [-i] [-s]"
  echo "  -i   Install APK via adb after building (requires adb)"
  echo "  -s   Skip npm install (faster when dependencies are installed)"
}

while getopts "is" opt; do
  case ${opt} in
    i ) INSTALL_APK=true;;
    s ) SKIP_NPM_INSTALL=true;;
    * ) usage; exit 1;;
  esac
done

function info() { echo "[INFO] $*"; }
function warn() { echo "[WARN] $*"; }
function error_exit() { echo "[ERROR] $*"; exit 1; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
info "Working directory: $(pwd)"

# Check Java
if command -v java >/dev/null 2>&1; then
  info "Java found: $(java -version 2>&1 | head -n 1)"
else
  warn "Java not found. Install JDK 17+ and set JAVA_HOME / PATH. See BUILD_ANDROID_WINDOWS.md or README." 
fi

# Check adb
if command -v adb >/dev/null 2>&1; then
  info "adb found: $(adb version 2>&1 | head -n 1)"
else
  warn "adb not found. If you want to install the APK via adb, install Android Platform Tools and add adb to PATH."
fi

if [ "$SKIP_NPM_INSTALL" = false ]; then
  info "Running npm install..."
  npm install
else
  info "Skipping npm install (flag -s used)"
fi

info "Building web assets (Vite)"
npm run build

info "Syncing Capacitor / copying web assets to Android"
npx cap sync android
npx cap copy android

info "Cleaning Android build output directories (android/build and android/app/build)"
rm -rf android/build || true
rm -rf android/app/build || true

info "Building Android (gradle)"
pushd android >/dev/null
if [ ! -f ./gradlew ]; then
  error_exit "gradlew not found in android/. Are you in a Capacitor project?"
fi
./gradlew clean
./gradlew assembleDebug
popd >/dev/null

if [ "$INSTALL_APK" = true ]; then
  apk_path="$repo_root/android/app/build/outputs/apk/debug/app-debug.apk"
  if [ ! -f "$apk_path" ]; then
    error_exit "APK not found at $apk_path"
  fi
  info "Installing APK: $apk_path"
  adb install -r "$apk_path"
  info "APK installed successfully."
fi

info "Build script completed successfully."
