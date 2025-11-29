<#
build-android.ps1

Automates building a debug APK on Windows for the Capacitor/Android app.

Usage:
  # Full build and install APK (requires adb available in PATH)
  .\scripts\build-android.ps1 -InstallApk

  # Build only (no install)
  .\scripts\build-android.ps1

  # Skip npm install (if dependencies are already installed)
  .\scripts\build-android.ps1 -SkipNpmInstall

This script is intended for developer convenience. It does basic checks (JDK, Android SDK) and then runs a clean build.
It performs these main steps:
  1) Optional `npm install` (unless -SkipNpmInstall passed)
 2) `npm run build` (Vite)
 3) `npx cap sync android` + `npx cap copy android`
 4) Remove android/app/build & android/build (force clean)
 5) `gradlew clean` and `gradlew assembleDebug`
 6) Optionally install the APK using adb if -InstallApk is switched

# Requirements: PowerShell (x64), JDK 17+ on PATH or JAVA_HOME set, Android SDK/ADB on PATH (if installing APK)
#
Param(
    [switch]$InstallApk,
    [switch]$SkipNpmInstall
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-ErrorAndExit($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

function Run-Command($exe, $args) {
    $proc = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
    if ($proc.ExitCode -ne 0) {
        Write-ErrorAndExit "Command failed: $exe $args (exit $($proc.ExitCode))"
    }
}

Write-Info "Running build-android.ps1"

# Ensure script runs from repo root
$scriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$repoRoot = Resolve-Path "$scriptDir\.."
Set-Location $repoRoot

Write-Info "Working directory: $((Get-Location).Path)"

# Check Java
try {
    $javaVersion = & java -version 2>&1
    if ($LASTEXITCODE -ne 0 -or -not $javaVersion) {
        Write-Warn "Java not found in PATH. Please ensure JDK 17+ installed and JAVA_HOME set. See BUILD_ANDROID_WINDOWS.md"
    } else {
        Write-Info "Java detected: $($javaVersion -join ' | ')"
    }
} catch {
    Write-Warn "Failed to query java -version. Ensure JDK is installed and java is on PATH."
}

# Validate Android SDK presence (adb)
try {
    $adbVersion = & adb version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "adb not found in PATH. If installing APK, make sure Android SDK Platform-Tools are installed and adb is on PATH."
    } else {
        Write-Info "ADB detected: $($adbVersion -join ' | ')"
    }
} catch {
    Write-Warn "Failed to query adb; skip further evidence."
}

if (-not $SkipNpmInstall) {
    Write-Info "Running npm ci --legacy-peer-deps..."
    $exitCode = Run-Command "npm" "ci --legacy-peer-deps"
    if ($exitCode -ne 0) {
        Write-Warn "npm ci failed with exit $exitCode; attempting clean-node-install and retry"
        # Try our helper script to force-clean node_modules and retry install
        if (Test-Path "$repoRoot\scripts\clean-node-install.ps1") {
            try { powershell -ExecutionPolicy ByPass -File "$repoRoot\scripts\clean-node-install.ps1" } catch { Write-Warn "clean-node-install script failed; please run it manually" }
            # Retry once more after running cleanup
            $exitCode = Run-Command "npm" "ci --legacy-peer-deps"
            if ($exitCode -ne 0) {
                Write-ErrorAndExit "npm ci failed after cleanup (exit $exitCode). Check logs and try running clean-node-install.ps1 manually."
            }
        } else {
            Write-Warn "clean-node-install.ps1 not found; please run 'npm ci --legacy-peer-deps' manually"
            Write-ErrorAndExit "npm install failed"
        }
    }
} else {
    Write-Info "Skipping npm install (per -SkipNpmInstall)"
}

Write-Info "Building web assets (Vite)"
Run-Command "npm" "run build"

Write-Info "Syncing Capacitor / copying web assets to Android"
Run-Command "npx" "cap sync android"
Run-Command "npx" "cap copy android"

# Remove any stale legacy native Java sources that might be copied by capacitor sync
# Example: android/app/src/main/java/com/engineering/tools/MainActivity.java
# If you previously renamed or changed the package to com.joulehvac.app, this legacy
# file can cause the correct MainActivity to be overwritten during the copy/sync.
Write-Info "Cleaning up any legacy native Java sources under com/engineering/tools"
$legacyPath = Join-Path $repoRoot "android\app\src\main\java\com\engineering\tools"
if (Test-Path $legacyPath) {
    Write-Warn "Found legacy native sources at $legacyPath; removing to avoid capacitorsync restoring obsolete files."
    try {
        Remove-Item -Path $legacyPath -Recurse -Force -ErrorAction Stop
        Write-Info "Removed legacy native sources at $legacyPath"
    } catch {
        Write-Warn "Failed to remove legacy native sources at $legacyPath. Please inspect and manually remove if needed."
    }
}

# Clean Android build outputs
Write-Info "Cleaning Android build output directories (android/build and android/app/build)"
if (Test-Path "$repoRoot\android\app\build") { Remove-Item -Path "$repoRoot\android\app\build" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "$repoRoot\android\build") { Remove-Item -Path "$repoRoot\android\build" -Recurse -Force -ErrorAction SilentlyContinue }

Write-Info "Building Android (gradle)"
Push-Location "$repoRoot\android"

if (-not (Test-Path ".\gradlew")) { Write-ErrorAndExit "gradlew not found. Ensure you're in an Android Capacitor project." }

Run-Command ".\gradlew" "clean"
Run-Command ".\gradlew" "assembleDebug"

Pop-Location

if ($InstallApk) {
    $apkPath = Join-Path $repoRoot "android\app\build\outputs\apk\debug\app-debug.apk"
    if (-Not (Test-Path $apkPath)) { Write-ErrorAndExit "APK not found at $apkPath" }
    Write-Info "Attempting to install APK: $apkPath"
    # Ensure adb is available before attempting install
    try {
        $adbCheck = & adb version 2>&1
        if ($LASTEXITCODE -ne 0) { Write-ErrorAndExit "adb not found. Install Android SDK Platform-Tools and ensure 'adb' is on PATH to install APKs." }
    } catch { Write-ErrorAndExit "adb not found. Install Android SDK Platform-Tools and ensure 'adb' is on PATH to install APKs." }

    Run-Command "adb" "install -r $apkPath"
    Write-Info "Install complete."
}

Write-Info "Build (and optional install) finished successfully."
