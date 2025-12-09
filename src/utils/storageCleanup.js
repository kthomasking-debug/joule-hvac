/**
 * Storage Cleanup Utility
 * Automatically cleans up old data from localStorage to prevent quota issues
 */

import logger from './logger';

const DEFAULT_RETENTION_DAYS = 90; // Keep data for 90 days by default

/**
 * Clean up old analysis results
 * @param {number} retentionDays - Number of days to keep data (default: 90)
 */
export function cleanupOldAnalyses(retentionDays = DEFAULT_RETENTION_DAYS) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Get all localStorage keys
    const keysToCheck = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('spa_resultsHistory') || key.includes('spa_parsedCsvData'))) {
        keysToCheck.push(key);
      }
    }

    let cleanedCount = 0;

    keysToCheck.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (Array.isArray(data)) {
          // Filter out old entries
          const filtered = data.filter(entry => {
            const entryDate = entry.timestamp || entry.date || entry.uploadedAt;
            if (!entryDate) return true; // Keep entries without dates
            return new Date(entryDate) >= cutoffDate;
          });

          if (filtered.length < data.length) {
            cleanedCount += data.length - filtered.length;
            if (filtered.length > 0) {
              localStorage.setItem(key, JSON.stringify(filtered));
            } else {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (e) {
        logger.warn(`Failed to cleanup ${key}:`, e);
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old analysis entries`);
    }

    return cleanedCount;
  } catch (error) {
    logger.error('Failed to cleanup old analyses:', error);
    return 0;
  }
}

/**
 * Get storage usage information
 * @returns {Object} Storage usage stats
 */
export function getStorageUsage() {
  try {
    let totalSize = 0;
    const items = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        totalSize += size;
        items[key] = {
          size,
          sizeKB: (size / 1024).toFixed(2),
          sizeMB: (size / (1024 * 1024)).toFixed(2),
        };
      }
    }

    return {
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      itemCount: localStorage.length,
      items,
    };
  } catch (error) {
    logger.error('Failed to get storage usage:', error);
    return { totalSize: 0, totalSizeKB: '0', totalSizeMB: '0', itemCount: 0, items: {} };
  }
}

/**
 * Initialize automatic cleanup
 * Runs cleanup on app load and sets up periodic cleanup
 */
export function initStorageCleanup(retentionDays = DEFAULT_RETENTION_DAYS) {
  // Run cleanup on initialization
  cleanupOldAnalyses(retentionDays);

  // Set up periodic cleanup (daily)
  if (typeof window !== 'undefined') {
    const lastCleanup = localStorage.getItem('lastStorageCleanup');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Only run if it's been more than a day since last cleanup
    if (!lastCleanup || (now - parseInt(lastCleanup)) > oneDay) {
      cleanupOldAnalyses(retentionDays);
      localStorage.setItem('lastStorageCleanup', String(now));
    }
  }
}






