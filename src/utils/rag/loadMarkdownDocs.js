/**
 * Load all markdown files from docs/ and public/docs/ into the RAG system
 * This runs at app startup to make all documentation accessible via RAG
 */

import { addUserKnowledge } from './userKnowledge.js';

const DOCS_PATHS = [
  '/docs',
  '/public/docs',
];

const INDEXED_KEY = 'joule_markdown_indexed';
const INDEX_VERSION = '1.0'; // Increment to force re-indexing

/**
 * Load a markdown file from the public directory
 */
async function loadMarkdownFile(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    const content = await response.text();
    // Remove frontmatter if present
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
    return withoutFrontmatter.trim();
  } catch (error) {
    console.warn(`[RAG] Failed to load ${path}:`, error);
    return null;
  }
}

/**
 * Generate title from filename
 */
function generateTitle(filename) {
  const name = filename.replace(/\.md$/, '');
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get list of markdown files from a directory
 * Note: This requires a manifest file or API endpoint
 * For now, we'll use a predefined list of important docs
 */
const IMPORTANT_DOCS = [
  // Core documentation (served from public/docs/)
  { path: '/docs/USER_MANUAL.md', title: 'User Manual' },
  { path: '/docs/ADMIN_MANUAL.md', title: 'Admin Manual' },
  { path: '/docs/BRIDGE-INSTALLATION-GUIDE.md', title: 'Bridge Installation Guide' },
  { path: '/docs/BLUEAIR-SETUP-GUIDE.md', title: 'Blueair Setup Guide' },
  { path: '/docs/WIFI-SETUP-MINI-COMPUTER.md', title: 'WiFi Setup Guide' },
  { path: '/docs/BRIDGE-DEBUG-COMMANDS.md', title: 'Bridge Debug Commands' },
  { path: '/docs/BLUEAIR-CONNECTION-DEBUG.md', title: 'Blueair Connection Debug' },
  { path: '/docs/ANNUAL_COMPARISON_CALCULATIONS.md', title: 'Annual Comparison Calculations' },
  { path: '/docs/CARDS_DOCUMENTATION.md', title: 'Cards Documentation' },
  { path: '/docs/NAMING_REVIEW.md', title: 'Naming Review' },
  { path: '/docs/QUICK_START_GUIDE.md', title: 'Quick Start Guide' },
  { path: '/docs/PRE-CONFIGURATION-CHECKLIST.md', title: 'Pre-Configuration Checklist' },
  { path: '/docs/BRIDGE-TROUBLESHOOTING-MAINTENANCE.md', title: 'Bridge Troubleshooting' },
  { path: '/docs/TAILSCALE_KEY_TRACKER.md', title: 'Tailscale Key Tracker' },
  
  // Knowledge base (served from public/knowledge/)
  { path: '/knowledge/heat_pump_basics.md', title: 'Heat Pump Basics' },
  { path: '/knowledge/aux_heat_guide.md', title: 'Aux Heat Guide' },
  { path: '/knowledge/aux_heat_diagnostics.md', title: 'Aux Heat Diagnostics' },
  { path: '/knowledge/cold_weather_performance.md', title: 'Cold Weather Performance' },
  { path: '/knowledge/defrost_cycle.md', title: 'Defrost Cycle' },
  { path: '/knowledge/diagnostic_sensors.md', title: 'Diagnostic Sensors' },
  { path: '/knowledge/rapid_testing.md', title: 'Rapid Testing' },
  { path: '/knowledge/thermostat_settings.md', title: 'Thermostat Settings' },
];

/**
 * Index all markdown files into the RAG system
 */
export async function indexMarkdownDocs() {
  // Check if already indexed with current version
  try {
    const indexed = localStorage.getItem(INDEXED_KEY);
    if (indexed === INDEX_VERSION) {
      console.log('[RAG] Markdown docs already indexed');
      return { success: true, count: 0, message: 'Already indexed' };
    }
  } catch (error) {
    // Continue if localStorage check fails
  }

  console.log('[RAG] Indexing markdown documentation...');
  let indexedCount = 0;
  let errorCount = 0;

  for (const doc of IMPORTANT_DOCS) {
    try {
      const content = await loadMarkdownFile(doc.path);
      if (content && content.length > 100) {
        // Only index if content is substantial
        const result = addUserKnowledge(
          doc.title,
          content,
          `documentation:${doc.path}`
        );
        if (result.success) {
          indexedCount++;
        } else {
          errorCount++;
        }
      }
    } catch (error) {
      console.warn(`[RAG] Failed to index ${doc.path}:`, error);
      errorCount++;
    }
  }

  // Mark as indexed
  try {
    localStorage.setItem(INDEXED_KEY, INDEX_VERSION);
  } catch (error) {
    console.warn('[RAG] Failed to save index status:', error);
  }

  console.log(`[RAG] Indexed ${indexedCount} markdown files (${errorCount} errors)`);
  
  return {
    success: true,
    count: indexedCount,
    errors: errorCount,
  };
}

/**
 * Re-index all markdown files (force refresh)
 */
export async function reindexMarkdownDocs() {
  try {
    localStorage.removeItem(INDEXED_KEY);
  } catch (error) {
    // Ignore
  }
  return indexMarkdownDocs();
}

