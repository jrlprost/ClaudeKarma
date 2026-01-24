/**
 * ClaudeKarma - Service Worker
 *
 * Central orchestrator for the extension:
 * - Manages periodic data refresh via alarms
 * - Handles messages from content script and popup
 * - Updates the toolbar icon dynamically
 * - Stores usage data in chrome.storage.local
 */

import { ALARMS, TIMING, MESSAGE_TYPES, STORAGE_KEYS } from '../lib/constants.js';
import * as storage from '../lib/storage.js';
import { updateIcon } from '../lib/icon-renderer.js';

// ============================================
// Extension Lifecycle
// ============================================

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ClaudeKarma] Extension installed:', details.reason);

  // Initialize storage with defaults
  const existingData = await storage.getUsageData();
  if (!existingData.lastFetchedAt) {
    console.log('[ClaudeKarma] Initializing default storage');
    await storage.setUsageData(existingData);
  }

  // Set up periodic refresh alarm
  await setupAlarm();

  // Update icon with current data
  await refreshIcon();
});

/**
 * Handle extension startup (browser restart)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[ClaudeKarma] Extension started');

  // Ensure alarm is set up
  await setupAlarm();

  // Update icon with cached data
  await refreshIcon();
});

// ============================================
// Alarm Management
// ============================================

/**
 * Set up periodic refresh alarm
 */
async function setupAlarm() {
  // Clear existing alarm
  await chrome.alarms.clear(ALARMS.FETCH_USAGE);

  // Create new alarm
  chrome.alarms.create(ALARMS.FETCH_USAGE, {
    periodInMinutes: TIMING.REFRESH_INTERVAL_MINUTES
  });

  console.log(`[ClaudeKarma] Alarm set: refresh every ${TIMING.REFRESH_INTERVAL_MINUTES} minutes`);
}

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.FETCH_USAGE) {
    console.log('[ClaudeKarma] Alarm triggered: fetching usage data');
    await triggerDataFetch();
  }
});

// ============================================
// Data Fetching
// ============================================

/**
 * Trigger a data fetch by opening the usage page in background
 * The content script will scrape and send data back
 */
async function triggerDataFetch() {
  // Check if we fetched recently (avoid hammering)
  const lastFetch = await storage.getLastFetchTime();
  if (lastFetch && Date.now() - lastFetch < TIMING.MIN_FETCH_INTERVAL_MS) {
    console.log('[ClaudeKarma] Skipping fetch - too recent');
    return;
  }

  // Try to find an existing Claude tab
  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });

  if (tabs.length > 0) {
    // There's already a Claude tab - inject content script to scrape
    console.log('[ClaudeKarma] Found Claude tab, requesting data scrape');

    // Send message to content script (if it's the usage page)
    const usageTab = tabs.find(t => t.url?.includes('/settings/usage'));
    if (usageTab) {
      try {
        await chrome.tabs.sendMessage(usageTab.id, { type: MESSAGE_TYPES.REQUEST_REFRESH });
      } catch (e) {
        console.log('[ClaudeKarma] Content script not responding:', e.message);
      }
    }
  }
  // If no Claude tab, we'll wait for user to visit
}

// ============================================
// Message Handling
// ============================================

/**
 * Handle messages from content script and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ClaudeKarma] Received message:', message.type);

  switch (message.type) {
    case MESSAGE_TYPES.USAGE_DATA_SCRAPED:
      handleUsageDataScraped(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Async response

    case MESSAGE_TYPES.GET_USAGE_DATA:
      storage.getUsageData()
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Async response

    case MESSAGE_TYPES.REQUEST_REFRESH:
      triggerDataFetch()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Async response

    default:
      console.warn('[ClaudeKarma] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

/**
 * Handle scraped usage data from content script
 * @param {Object} data - Scraped usage data
 */
async function handleUsageDataScraped(data) {
  console.log('[ClaudeKarma] Processing scraped data:', data);

  // Validate data structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid usage data received');
  }

  // Merge with existing data and save
  const existingData = await storage.getUsageData();
  const mergedData = {
    ...existingData,
    ...data,
    lastFetchedAt: Date.now(),
    fetchSource: 'scrape'
  };

  await storage.setUsageData(mergedData);

  // Update the toolbar icon
  await refreshIcon();

  // Notify popup if open
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.USAGE_DATA_UPDATED,
      data: mergedData
    });
  } catch (e) {
    // Popup might not be open - ignore
  }

  console.log('[ClaudeKarma] Data saved and icon updated');
}

// ============================================
// Icon Updates
// ============================================

/**
 * Refresh the toolbar icon with current data
 */
async function refreshIcon() {
  try {
    const usageData = await storage.getUsageData();
    const percentage = usageData.currentSession?.percentage ?? 0;

    await updateIcon(percentage / 100);
    console.log(`[ClaudeKarma] Icon updated: ${percentage}%`);
  } catch (error) {
    console.error('[ClaudeKarma] Failed to update icon:', error);
  }
}

// ============================================
// Initial Setup
// ============================================

// Run initial setup
(async () => {
  console.log('[ClaudeKarma] Service worker initializing');
  await refreshIcon();
})();
