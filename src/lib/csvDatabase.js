/**
 * IndexedDB Database for CSV Data Persistence
 *
 * Uses Dexie.js to store large CSV datasets that exceed localStorage limits.
 * This allows CSV data to survive page refreshes, navigation, and tab closures.
 *
 * Architecture:
 * - Stores parsed CSV rows in IndexedDB (handles MB+ datasets)
 * - Stores metadata (filename, upload date, row count) for quick queries
 * - Auto-restores last dataset on page load
 * - Supports multiple zones/analyses
 */

import Dexie from "dexie";

// Create database instance
export const db = new Dexie("jouleCSV");

// Define schema
db.version(1).stores({
  csvData: "++id, zoneId, uploadedAt, filename, rowCount", // Primary key: id, indexed by zoneId, uploadedAt, filename, rowCount
  csvMetadata: "++id, zoneId, uploadedAt, filename", // Separate table for metadata (smaller queries)
});

// Ensure database is open (Dexie auto-opens, but we can verify)
db.open().catch((err) => {
  console.error("[CSV Database] Failed to open database:", err);
});

/**
 * Save parsed CSV data to IndexedDB
 * @param {Array} rows - Parsed CSV rows (array of objects)
 * @param {string} zoneId - Zone identifier (e.g., 'default')
 * @param {string} filename - Original filename
 * @returns {Promise<number>} ID of saved record
 */
export async function saveCsvData(
  rows,
  zoneId = "default",
  filename = "uploaded.csv"
) {
  try {
    // Ensure database is open
    if (!db.isOpen()) {
      await db.open();
    }

    const uploadedAt = new Date().toISOString();
    const rowCount = rows.length;

    // Delete old data for this zone first (keep only most recent)
    try {
      await db.csvData.where("zoneId").equals(zoneId).delete();
      await db.csvMetadata.where("zoneId").equals(zoneId).delete();
      console.log(`[CSV Database] Cleared old data for zone ${zoneId}`);
    } catch (deleteError) {
      console.warn(
        "[CSV Database] Failed to clear old data (non-fatal):",
        deleteError
      );
    }

    // Save metadata first (for quick queries)
    const metadataId = await db.csvMetadata.add({
      zoneId,
      uploadedAt,
      filename,
      rowCount,
      createdAt: uploadedAt,
    });

    // Save actual data (can be large)
    const dataId = await db.csvData.add({
      zoneId,
      uploadedAt,
      filename,
      rowCount,
      data: rows, // Store full array
      metadataId, // Link to metadata
    });

    console.log(
      `[CSV Database] ✅ Saved ${rowCount} rows for zone ${zoneId} (ID: ${dataId})`
    );
    return dataId;
  } catch (error) {
    console.error("[CSV Database] Failed to save CSV data:", error);
    throw error;
  }
}

/**
 * Load CSV data from IndexedDB for a specific zone
 * @param {string} zoneId - Zone identifier
 * @param {boolean} mostRecent - If true, returns most recent upload; otherwise returns all
 * @returns {Promise<Array|null>} Parsed CSV rows or null if not found
 */
export async function loadCsvData(zoneId = "default", mostRecent = true) {
  try {
    // Ensure database is open
    if (!db.isOpen()) {
      await db.open();
    }

    // Filter by zoneId, then sort in memory (uploadedAt is not a primary index)
    const allRecords = await db.csvData
      .where("zoneId")
      .equals(zoneId)
      .toArray();

    if (!allRecords || allRecords.length === 0) {
      console.log(`[CSV Database] No CSV data found for zone ${zoneId}`);
      return null;
    }

    // Sort by uploadedAt descending (most recent first)
    allRecords.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || 0);
      const dateB = new Date(b.uploadedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    if (mostRecent) {
      // Get most recent record
      const record = allRecords[0];
      if (record && record.data) {
        console.log(
          `[CSV Database] Loaded ${record.data.length} rows for zone ${zoneId} (uploaded: ${record.uploadedAt})`
        );
        return record.data;
      }
      return null;
    } else {
      // Return all records
      return allRecords;
    }
  } catch (error) {
    console.error("[CSV Database] Failed to load CSV data:", error);
    return null;
  }
}

/**
 * Get CSV metadata (without loading full data)
 * @param {string} zoneId - Zone identifier
 * @returns {Promise<Object|null>} Metadata object or null
 */
export async function getCsvMetadata(zoneId = "default") {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    // Filter by zoneId, then sort in memory
    const allMetadata = await db.csvMetadata
      .where("zoneId")
      .equals(zoneId)
      .toArray();

    if (!allMetadata || allMetadata.length === 0) {
      return null;
    }

    // Sort by uploadedAt descending (most recent first)
    allMetadata.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || 0);
      const dateB = new Date(b.uploadedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    return allMetadata[0] || null;
  } catch (error) {
    console.error("[CSV Database] Failed to load CSV metadata:", error);
    return null;
  }
}

/**
 * Delete CSV data for a specific zone
 * @param {string} zoneId - Zone identifier
 * @returns {Promise<number>} Number of records deleted
 */
export async function deleteCsvData(zoneId = "default") {
  try {
    // Delete from both tables
    const dataDeleted = await db.csvData
      .where("zoneId")
      .equals(zoneId)
      .delete();
    const metadataDeleted = await db.csvMetadata
      .where("zoneId")
      .equals(zoneId)
      .delete();

    console.log(
      `[CSV Database] Deleted CSV data for zone ${zoneId} (${dataDeleted} data records, ${metadataDeleted} metadata records)`
    );
    return dataDeleted + metadataDeleted;
  } catch (error) {
    console.error("[CSV Database] Failed to delete CSV data:", error);
    throw error;
  }
}

/**
 * Check if CSV data exists for a zone
 * @param {string} zoneId - Zone identifier
 * @returns {Promise<boolean>} True if data exists
 */
export async function hasCsvData(zoneId = "default") {
  try {
    const count = await db.csvData.where("zoneId").equals(zoneId).count();
    return count > 0;
  } catch (error) {
    console.error("[CSV Database] Failed to check CSV data:", error);
    return false;
  }
}

/**
 * Get storage statistics
 * @returns {Promise<Object>} Storage stats
 */
export async function getStorageStats() {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    const totalRecords = await db.csvData.count();
    const totalMetadata = await db.csvMetadata.count();

    // Estimate size (rough calculation)
    const allData = await db.csvData.toArray();
    let totalRows = 0;
    allData.forEach((record) => {
      totalRows += record.rowCount || 0;
    });

    return {
      totalRecords,
      totalMetadata,
      totalRows,
      zones: [...new Set(allData.map((r) => r.zoneId))],
      allRecords: allData.map((r) => ({
        id: r.id,
        zoneId: r.zoneId,
        filename: r.filename,
        rowCount: r.rowCount,
        uploadedAt: r.uploadedAt,
      })),
    };
  } catch (error) {
    console.error("[CSV Database] Failed to get storage stats:", error);
    return {
      totalRecords: 0,
      totalMetadata: 0,
      totalRows: 0,
      zones: [],
      allRecords: [],
    };
  }
}

/**
 * Debug function: List all CSV data records
 * @returns {Promise<Array>} All CSV records with metadata
 */
export async function listAllCsvData() {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    const allData = await db.csvData.toArray();
    return allData.map((r) => ({
      id: r.id,
      zoneId: r.zoneId,
      filename: r.filename,
      rowCount: r.rowCount,
      uploadedAt: r.uploadedAt,
      hasData: !!r.data,
      dataLength: r.data ? r.data.length : 0,
    }));
  } catch (error) {
    console.error("[CSV Database] Failed to list CSV data:", error);
    return [];
  }
}
