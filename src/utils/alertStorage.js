/**
 * Alert Storage Utilities
 * Manages snoozed alerts in localStorage
 */

const SNOOZED_ALERTS_KEY = "systemHealthSnoozedAlerts";

/**
 * Load snoozed alerts from localStorage
 * @returns {Object} Map of muteKey -> snoozedUntil ISO string
 */
export function loadSnoozedAlerts() {
  try {
    const stored = localStorage.getItem(SNOOZED_ALERTS_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save snoozed alerts to localStorage
 * @param {Object} snoozedAlerts - Map of muteKey -> snoozedUntil ISO string
 */
export function saveSnoozedAlerts(snoozedAlerts) {
  try {
    localStorage.setItem(SNOOZED_ALERTS_KEY, JSON.stringify(snoozedAlerts));
  } catch (error) {
    console.warn("Failed to save snoozed alerts:", error);
  }
}

/**
 * Snooze an alert by muteKey
 * @param {string} muteKey - The mute key for the alert
 * @param {number} days - Number of days to snooze (14 for "Got it", 60 for "My tech is handling this")
 */
export function snoozeAlert(muteKey, days) {
  if (!muteKey) return;

  const snoozedAlerts = loadSnoozedAlerts();
  const snoozedUntil = new Date();
  snoozedUntil.setDate(snoozedUntil.getDate() + days);

  snoozedAlerts[muteKey] = snoozedUntil.toISOString();
  saveSnoozedAlerts(snoozedAlerts);
}

/**
 * Clear a snooze for a specific alert
 * @param {string} muteKey - The mute key for the alert
 */
export function clearSnooze(muteKey) {
  if (!muteKey) return;

  const snoozedAlerts = loadSnoozedAlerts();
  delete snoozedAlerts[muteKey];
  saveSnoozedAlerts(snoozedAlerts);
}
