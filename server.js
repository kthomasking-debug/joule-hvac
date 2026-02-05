/**
 * Simple Express server for serving the built SPA
 * Handles client-side routing by serving index.html for all routes
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all non-file routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 App running at http://localhost:${PORT}`);
  console.log(`📱 Also available at http://192.168.0.108:${PORT}`);
  console.log(`\n✅ This server will keep running independently of Cursor`);
  console.log(`   Stop with: CTRL-C`);
});
