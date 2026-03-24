/**
 * ClaudeKarma - Storage Abstraction
 *
 * Cross-browser storage wrapper using chrome.storage.local.
 * Uses storage.local (not session) for Firefox compatibility.
 */

import { STORAGE_KEYS, DEFAULT_USAGE_DATA, DEFAULT_SETTINGS, TIMING } from './constants.js';

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

// ============================================
// Usage History (rolling 2-week window)
// ============================================

/**
 * Append a usage snapshot to history with deltas and plan tier
 * Format: { t, s, sd, w, wd, m, md, mn, p }
 */
export async function appendUsageSnapshot(usageData, planTier) {
  const s = Math.round(usageData.currentSession?.percentage || 0);
  const w = Math.round(usageData.weeklyLimits?.allModels?.percentage || 0);
  const m = Math.round(usageData.weeklyLimits?.modelSpecific?.percentage || 0);

  // Get last snapshot to compute deltas
  const result = await get(STORAGE_KEYS.USAGE_HISTORY);
  const history = result[STORAGE_KEYS.USAGE_HISTORY] || [];
  const last = history.length > 0 ? history[history.length - 1] : null;

  // Compute deltas (positive only — a drop means a reset, delta = 0)
  const sd = last ? Math.max(0, s - last.s) : 0;
  const wd = last ? Math.max(0, w - last.w) : 0;
  const md = last ? Math.max(0, m - last.m) : 0;

  // Normalize plan tier to short key (e.g. "default_claude_max_20x" → "max_20x")
  const p = planTier ? planTier.replace(/^default_claude_/, '') : null;

  const snapshot = { t: Date.now(), s, sd, w, wd, m, md, mn: usageData.weeklyLimits?.modelSpecific?.modelName || null, p };

  history.push(snapshot);

  // Prune entries older than retention period
  const cutoff = Date.now() - (TIMING.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const pruned = history.filter(entry => entry.t >= cutoff);

  await set({ [STORAGE_KEYS.USAGE_HISTORY]: pruned });
}

/**
 * Get usage history within a date range
 * @param {number} [startDate] - Start timestamp (default: 14 days ago)
 * @param {number} [endDate] - End timestamp (default: now)
 * @returns {Promise<Array>} Array of usage snapshots
 */
export async function getUsageHistory(startDate, endDate) {
  const start = startDate || (Date.now() - (TIMING.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  const end = endDate || Date.now();

  const result = await get(STORAGE_KEYS.USAGE_HISTORY);
  const history = result[STORAGE_KEYS.USAGE_HISTORY] || [];

  return history.filter(entry => entry.t >= start && entry.t <= end);
}

/**
 * Clear all usage history
 * @returns {Promise<void>}
 */
export async function clearUsageHistory() {
  return set({ [STORAGE_KEYS.USAGE_HISTORY]: [] });
}

// ============================================
// Notification State
// ============================================

export async function getNotificationState() {
  const result = await get(STORAGE_KEYS.NOTIFICATION_STATE);
  return result[STORAGE_KEYS.NOTIFICATION_STATE] || { lastNotifiedThreshold: 0, lastNotifiedAt: null };
}

export async function setNotificationState(state) {
  const current = await getNotificationState();
  return set({ [STORAGE_KEYS.NOTIFICATION_STATE]: { ...current, ...state } });
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
  getLastFetchTime,
  appendUsageSnapshot,
  getUsageHistory,
  clearUsageHistory,
  getNotificationState,
  setNotificationState
};

export default storage;
