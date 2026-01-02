#!/usr/bin/env node
/**
 * Index all markdown files from docs/ and public/docs/ into the RAG system
 * This script reads all .md files and adds them to the user knowledge base
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Directories to index
const DOCS_DIRS = [
  path.join(projectRoot, 'docs'),
  path.join(projectRoot, 'public', 'docs'),
  path.join(projectRoot, 'public', 'knowledge'),
];

// Output file for indexed content
const OUTPUT_FILE = path.join(projectRoot, 'src', 'utils', 'rag', 'indexedDocs.json');

/**
 * Read markdown file and extract content
 */
function readMarkdownFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Remove frontmatter if present
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
    return withoutFrontmatter.trim();
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get all markdown files recursively
 */
function getAllMarkdownFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other build directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

/**
 * Generate a title from file path
 */
function generateTitle(filePath) {
  const relativePath = path.relative(projectRoot, filePath);
  const name = path.basename(filePath, '.md');
  // Convert kebab-case to Title Case
  const title = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return title;
}

/**
 * Main indexing function
 */
function indexAllMarkdownFiles() {
  console.log('📚 Indexing markdown files...\n');
  
  const indexedDocs = [];
  let totalFiles = 0;
  let totalSize = 0;
  
  for (const dir of DOCS_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  Directory not found: ${dir}`);
      continue;
    }
    
    console.log(`📁 Scanning: ${path.relative(projectRoot, dir)}`);
    const files = getAllMarkdownFiles(dir);
    
    for (const filePath of files) {
      const content = readMarkdownFile(filePath);
      if (!content || content.length < 50) {
        // Skip very short files (likely empty or just headers)
        continue;
      }
      
      const title = generateTitle(filePath);
      const relativePath = path.relative(projectRoot, filePath);
      const size = content.length;
      
      indexedDocs.push({
        title,
        path: relativePath,
        content,
        size,
        indexedAt: new Date().toISOString(),
      });
      
      totalFiles++;
      totalSize += size;
      
      console.log(`  ✓ ${path.basename(filePath)} (${(size / 1024).toFixed(1)} KB)`);
    }
  }
  
  // Save indexed documents
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(indexedDocs, null, 2), 'utf-8');
  
  console.log(`\n✅ Indexed ${totalFiles} markdown files (${(totalSize / 1024 / 1024).toFixed(2)} MB total)`);
  console.log(`💾 Saved to: ${path.relative(projectRoot, OUTPUT_FILE)}`);
  
  return indexedDocs;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  indexAllMarkdownFiles();
}

export { indexAllMarkdownFiles };






