const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const androidRes = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
const src = path.join(publicDir, 'app-icon-source.png');

if (!fs.existsSync(src)) {
  console.error('Source icon not found at', src);
  console.error('Please place your icon at public/app-icon-source.png and re-run this script.');
  process.exit(2);
}

const sizes = [
  { name: 'app-icon-16x16.png', size: 16 },
  { name: 'app-icon-32x32.png', size: 32 },
  { name: 'app-icon-180x180.png', size: 180 },
  { name: 'app-icon-192.png', size: 192 },
  { name: 'app-icon-512.png', size: 512 }
];

const androidSizes = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 }
];

async function run() {
  for (const s of sizes) {
    const out = path.join(publicDir, s.name);
    await sharp(src).resize(s.size, s.size).png().toFile(out);
    console.log('Wrote', out);
  }

  // Install into Android mipmap folders
  for (const a of androidSizes) {
    const destDir = path.join(androidRes, a.dir);
    if (!fs.existsSync(destDir)) continue;
    const outPath = path.join(destDir, 'ic_launcher.png');
    const outFgPath = path.join(destDir, 'ic_launcher_foreground.png');
    await sharp(src).resize(a.size, a.size).png().toFile(outPath);
    await sharp(src).resize(a.size, a.size).png().toFile(outFgPath);
    console.log('Copied to', destDir);
  }
}

run().then(() => console.log('Done')).catch(err => { console.error(err); process.exit(1); });
