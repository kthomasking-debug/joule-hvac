@echo off
REM Windows-compatible pre-commit hook
REM Calls the Node.js script for consistent error handling across platforms
if "%HUSKY%"=="0" exit /b 0

REM Get the directory where this script is located
set "HOOK_DIR=%~dp0"
set "NODE_SCRIPT=%HOOK_DIR%pre-commit"

REM Call the Node.js script (which has graceful error handling for missing lint-staged)
node "%NODE_SCRIPT%"
if errorlevel 1 exit /b 1

