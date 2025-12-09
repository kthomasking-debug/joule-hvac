/**
 * Recently Viewed Utility
 * Tracks and manages recently viewed pages/analyses
 */

const STORAGE_KEY = 'recentlyViewed';
const MAX_ITEMS = 10;

/**
 * Get recently viewed items
 * @returns {Array} Array of recently viewed items
 */
export function getRecentlyViewed() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to get recently viewed:', error);
    return [];
  }
}

/**
 * Add a page to recently viewed
 * @param {string} path - The page path
 * @param {string} title - The page title
 * @param {string} icon - Optional icon name
 */
export function addToRecentlyViewed(path, title, icon = null) {
  try {
    const items = getRecentlyViewed();
    
    // Remove if already exists (to move to top)
    const filtered = items.filter(item => item.path !== path);
    
    // Add to beginning
    const newItem = {
      path,
      title,
      icon,
      timestamp: Date.now(),
      date: new Date().toISOString(),
    };
    
    const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('recentlyViewedUpdated'));
  } catch (error) {
    console.warn('Failed to add to recently viewed:', error);
  }
}

/**
 * Clear recently viewed
 */
export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear recently viewed:', error);
  }
}

/**
 * Remove a specific item from recently viewed
 * @param {string} path - The path to remove
 */
export function removeFromRecentlyViewed(path) {
  try {
    const items = getRecentlyViewed();
    const filtered = items.filter(item => item.path !== path);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('recentlyViewedUpdated'));
  } catch (error) {
    console.warn('Failed to remove from recently viewed:', error);
  }
}

