#!/usr/bin/env node
/**
 * Deploy Joule Dashboard to Raspberry Pi
 * 
 * Usage:
 *   node scripts/deploy-to-pi.js
 *   node scripts/deploy-to-pi.js --host joule.local
 *   node scripts/deploy-to-pi.js --host 192.168.1.100 --user pi
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const host = args.find(arg => arg.startsWith('--host='))?.split('=')[1] || 'joule.local';
const user = args.find(arg => arg.startsWith('--user='))?.split('=')[1] || 'pi';
const remotePath = args.find(arg => arg.startsWith('--path='))?.split('=')[1] || '/var/www/joule';

console.log('🚀 Deploying Joule Dashboard to Raspberry Pi');
console.log(`   Host: ${user}@${host}`);
console.log(`   Path: ${remotePath}`);
console.log('');

// Step 1: Check if dist/ exists
const distPath = join(projectRoot, 'dist');
if (!existsSync(distPath)) {
  console.error('❌ Error: dist/ folder not found!');
  console.error('   Run "npm run build" first to build the app.');
  process.exit(1);
}

// Step 2: Build the app (if not already built or if --build flag is set)
if (args.includes('--build') || !existsSync(join(distPath, 'index.html'))) {
  console.log('📦 Building the app...');
  try {
    execSync('npm run build', { 
      cwd: projectRoot, 
      stdio: 'inherit' 
    });
    console.log('✅ Build complete!\n');
  } catch (error) {
    console.error('❌ Build failed!');
    process.exit(1);
  }
}

// Step 3: Test SSH connection
console.log(`🔌 Testing SSH connection to ${user}@${host}...`);
try {
  execSync(`ssh -o ConnectTimeout=5 ${user}@${host} "echo 'Connection successful'"`, {
    stdio: 'pipe'
  });
  console.log('✅ SSH connection successful!\n');
} catch (error) {
  console.error(`❌ Cannot connect to ${user}@${host}`);
  console.error('   Make sure:');
  console.error('   - The Bridge is powered on and connected to network');
  console.error('   - SSH is enabled on the Bridge');
  console.error('   - You can reach the Bridge from this machine');
  console.error('   - SSH keys are set up (or password authentication is enabled)');
  process.exit(1);
}

// Step 4: Create remote directory if it doesn't exist
console.log(`📁 Ensuring remote directory exists...`);
try {
  execSync(`ssh ${user}@${host} "sudo mkdir -p ${remotePath} && sudo chown ${user}:${user} ${remotePath}"`, {
    stdio: 'inherit'
  });
  console.log('✅ Remote directory ready!\n');
} catch (error) {
  console.error('❌ Failed to create remote directory');
  process.exit(1);
}

// Step 5: Copy files
console.log('📤 Copying files to Bridge...');
try {
  execSync(`scp -r ${distPath}/* ${user}@${host}:${remotePath}/`, {
    stdio: 'inherit',
    cwd: projectRoot
  });
  console.log('✅ Files copied!\n');
} catch (error) {
  console.error('❌ Failed to copy files');
  process.exit(1);
}

// Step 6: Set permissions
console.log('🔐 Setting file permissions...');
try {
  execSync(`ssh ${user}@${host} "sudo chown -R www-data:www-data ${remotePath} && sudo chmod -R 755 ${remotePath}"`, {
    stdio: 'inherit'
  });
  console.log('✅ Permissions set!\n');
} catch (error) {
  console.error('❌ Failed to set permissions');
  process.exit(1);
}

// Step 7: Reload Nginx
console.log('🔄 Reloading Nginx...');
try {
  execSync(`ssh ${user}@${host} "sudo nginx -t && sudo systemctl reload nginx"`, {
    stdio: 'inherit'
  });
  console.log('✅ Nginx reloaded!\n');
} catch (error) {
  console.error('⚠️  Warning: Nginx reload failed (may not be configured yet)');
  console.error('   See docs/SELF-HOSTING-NGINX.md for Nginx setup instructions\n');
}

console.log('🎉 Deployment complete!');
console.log(`   Visit: http://${host}`);
console.log(`   Or: http://${host.replace('joule.local', '192.168.1.100')} (if mDNS doesn't work)`);
console.log('');









