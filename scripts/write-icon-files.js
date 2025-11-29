const fs = require('fs');
const path = require('path');

const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const sizes = ['app-icon-16x16.png', 'app-icon-32x32.png', 'app-icon-180x180.png', 'app-icon-192.png', 'app-icon-512.png'];
for (const s of sizes) {
    const outPath = path.join(outDir, s);
    fs.writeFileSync(outPath, Buffer.from(base64Png, 'base64'));
    console.log('Wrote', outPath);
}
console.log('Done.');
