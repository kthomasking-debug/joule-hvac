// Lightweight IndexedDB wrapper for storing a single custom welcome hero image
// Key design:
// - DB: 'user-assets', Store: 'images', Key: 'welcome-hero'
// - We store a Blob; expose a helper to get an object URL for rendering
// - If IndexedDB is unavailable, fall back to localStorage (base64 DataURL) with size guard

const DB_NAME = "user-assets";
const STORE = "images";
const KEY = "welcome-hero";

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(blob) {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(blob, KEY);
  });
}

async function idbGet() {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete() {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(KEY);
  });
}

// Fallback to localStorage (approx 5MB). We'll cap images at ~1.5MB dataURL size.
const LS_KEY = "custom_welcome_hero_dataurl";

export async function saveCustomHeroBlob(blob) {
  try {
    await idbPut(blob);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn(
      "idbPut failed; falling back to localStorage for custom hero blob",
      error
    );
    try {
      const dataUrl = await blobToDataURL(blob);
      if (dataUrl.length > 1.5 * 1024 * 1024) {
        throw new Error("Image too large for localStorage fallback");
      }
      localStorage.setItem(LS_KEY, dataUrl);
      return dataUrl;
    } catch (error) {
      console.warn(
        "Failed to convert blob to dataURL or store it in localStorage",
        error
      );
      return null;
    }
  }
}

export async function getCustomHeroUrl() {
  try {
    const blob = await idbGet();
    if (blob instanceof Blob) return URL.createObjectURL(blob);
  } catch (error) {
    console.warn("idbGet failed when retrieving custom hero blob", error);
  }
  try {
    const dataUrl = localStorage.getItem(LS_KEY);
    return dataUrl || null;
  } catch (error) {
    console.warn("Failed to read custom hero dataURL from localStorage", error);
    return null;
  }
}

export async function deleteCustomHero() {
  try {
    await idbDelete();
  } catch (error) {
    console.warn("idbDelete failed when deleting custom hero", error);
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch (error) {
    console.warn(
      "localStorage.removeItem failed when deleting custom hero",
      error
    );
  }
  return true;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
