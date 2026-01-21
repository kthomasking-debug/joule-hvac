#!/usr/bin/env node
/**
 * Sync docs from root docs/ folder to public/docs/
 * This ensures markdown files are accessible via /docs/ path
 */

const fs = require("fs");
const path = require("path");

const sourceDir = path.join(process.cwd(), "docs");
const destDir = path.join(process.cwd(), "public", "docs");

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Get all markdown files from source
const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".md"));

console.log(
  `Syncing ${files.length} markdown files from docs/ to public/docs/...`
);

files.forEach((file) => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);

  // Copy file
  fs.copyFileSync(sourcePath, destPath);
  console.log(`  ✓ ${file}`);
});

console.log("Done!");
