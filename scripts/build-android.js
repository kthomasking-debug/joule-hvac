#!/usr/bin/env node
// Cross-platform wrapper for building Android using platform-specific scripts
// Usage examples:
//   npm run build:android    -- full build + install
//   npm run build:android -- -s   -- skip npm install
//   npm run build:android -- -i   -- install APK (if possible)

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2); // forward flags

function run(cmd, argsArray) {
  const proc = spawn(cmd, argsArray, { stdio: 'inherit', shell: true });
  proc.on('exit', (code) => {
    process.exit(code);
  });
}

const platform = os.platform();
if (platform === 'win32') {
  // Windows: execute PowerShell script
  const psPath = path.join(root, 'scripts', 'build-android.ps1');
  const psArgs = ['-ExecutionPolicy', 'ByPass', '-File', `"${psPath}"`].concat(args);
  // Ensure we call powershell if available
  run('powershell', psArgs);
} else {
  // macOS/Linux: execute bash script
  const shPath = path.join(root, 'scripts', 'build-android.sh');
  const shArgs = [shPath].concat(args);
  run('bash', shArgs);
}
