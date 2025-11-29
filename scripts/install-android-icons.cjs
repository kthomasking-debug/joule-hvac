const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const androidRes = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const src192 = path.join(publicDir, 'app-icon-192.png');
const src512 = path.join(publicDir, 'app-icon-512.png');

const mipmapDirs = ['mipmap-mdpi','mipmap-hdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi'];
for (const dir of mipmapDirs) {
  const destDir = path.join(androidRes, dir);
  if (!fs.existsSync(destDir)) continue;
  const copyDest = path.join(destDir, 'ic_launcher.png');
  fs.copyFileSync(src192, copyDest);
  const copyForeground = path.join(destDir, 'ic_launcher_foreground.png');
  fs.copyFileSync(src192, copyForeground);
  const copyRound = path.join(destDir, 'ic_launcher_round.png');
  fs.copyFileSync(src192, copyRound);
  console.log('copied to', destDir);
}
// Also copy to mipmap-anydpi-v26 xml files use foreground ref, so keep them.
console.log('Android icon installation script finished.');
