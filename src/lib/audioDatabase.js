/**
 * IndexedDB Database for Audio File Persistence
 * 
 * Stores audio files (WAV, MP3, etc.) in IndexedDB so they persist across sessions.
 * Similar to csvDatabase.js but for audio files.
 */

const DB_NAME = "jouleAudio";
const STORE_NAME = "audioFiles";
const VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("filename", "filename", { unique: false });
        store.createIndex("uploadedAt", "uploadedAt", { unique: false });
      }
    };
  });
}

/**
 * Save an audio file to IndexedDB
 * @param {File} file - The audio file to save
 * @returns {Promise<number>} ID of saved record
 */
export async function saveAudioFile(file) {
  try {
    if (!db) await openDB();

    const fileData = {
      filename: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      blob: file, // Store the file as a Blob
    };

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(fileData);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`[Audio Database] ✅ Saved ${file.name} (ID: ${request.result})`);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[Audio Database] Failed to save audio file:", error);
    throw error;
  }
}

/**
 * Get all saved audio files
 * @returns {Promise<Array>} Array of audio file metadata
 */
export async function getAllAudioFiles() {
  try {
    if (!db) await openDB();

    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const files = request.result.map((file) => ({
          id: file.id,
          filename: file.filename,
          size: file.size,
          type: file.type,
          uploadedAt: file.uploadedAt,
          // Create object URL for the blob
          url: URL.createObjectURL(file.blob),
        }));
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[Audio Database] Failed to get audio files:", error);
    return [];
  }
}

/**
 * Get a specific audio file by ID
 * @param {number} id - File ID
 * @returns {Promise<Object|null>} Audio file data or null
 */
export async function getAudioFile(id) {
  try {
    if (!db) await openDB();

    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const file = request.result;
        if (file) {
          resolve({
            id: file.id,
            filename: file.filename,
            size: file.size,
            type: file.type,
            uploadedAt: file.uploadedAt,
            blob: file.blob,
            url: URL.createObjectURL(file.blob),
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[Audio Database] Failed to get audio file:", error);
    return null;
  }
}

/**
 * Delete an audio file by ID
 * @param {number} id - File ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteAudioFile(id) {
  try {
    if (!db) await openDB();

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`[Audio Database] ✅ Deleted file ID: ${id}`);
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[Audio Database] Failed to delete audio file:", error);
    throw error;
  }
}

/**
 * Delete all audio files
 * @returns {Promise<boolean>} Success status
 */
export async function deleteAllAudioFiles() {
  try {
    if (!db) await openDB();

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log("[Audio Database] ✅ Deleted all audio files");
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[Audio Database] Failed to delete all audio files:", error);
    throw error;
  }
}


