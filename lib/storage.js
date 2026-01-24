/**
 * ClaudeKarma - Storage Abstraction
 *
 * Cross-browser storage wrapper using chrome.storage.local.
 * Uses storage.local (not session) for Firefox compatibility.
 */

import { STORAGE_KEYS, DEFAULT_USAGE_DATA, DEFAULT_SETTINGS } from './constants.js';

/**
 * Get data from storage
 * @param {string|string[]} keys - Key(s) to retrieve
 * @returns {Promise<Object>} Storage data
 */
export async function get(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Set data in storage
 * @param {Object} data - Key-value pairs to store
 * @returns {Promise<void>}
 */
export async function set(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Remove data from storage
 * @param {string|string[]} keys - Key(s) to remove
 * @returns {Promise<void>}
 */
export async function remove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clear all storage
 * @returns {Promise<void>}
 */
export async function clear() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// ============================================
// Usage Data Helpers
// ============================================

/**
 * Get current usage data
 * @returns {Promise<Object>} Usage data with defaults
 */
export async function getUsageData() {
  const result = await get(STORAGE_KEYS.USAGE_DATA);
  return result[STORAGE_KEYS.USAGE_DATA] || { ...DEFAULT_USAGE_DATA };
}

/**
 * Save usage data
 * @param {Object} usageData - Usage data to save
 * @returns {Promise<void>}
 */
export async function setUsageData(usageData) {
  return set({
    [STORAGE_KEYS.USAGE_DATA]: {
      ...usageData,
      lastFetchedAt: Date.now()
    }
  });
}

/**
 * Get settings
 * @returns {Promise<Object>} Settings with defaults
 */
export async function getSettings() {
  const result = await get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

/**
 * Save settings
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 */
export async function setSettings(settings) {
  const current = await getSettings();
  return set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings }
  });
}

/**
 * Get last fetch timestamp
 * @returns {Promise<number|null>} Timestamp or null
 */
export async function getLastFetchTime() {
  const usageData = await getUsageData();
  return usageData.lastFetchedAt || null;
}

// Export storage object for convenience
export const storage = {
  get,
  set,
  remove,
  clear,
  getUsageData,
  setUsageData,
  getSettings,
  setSettings,
  getLastFetchTime
};

export default storage;
