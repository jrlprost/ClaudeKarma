/**
 * ClaudeKarma - Service Worker
 *
 * Central orchestrator for the extension:
 * - Fetches usage data from Claude.ai API
 * - Manages periodic data refresh via alarms
 * - Updates the toolbar icon dynamically
 * - Stores usage data in chrome.storage.local
 */

import { ALARMS, TIMING, MESSAGE_TYPES, STORAGE_KEYS } from '../lib/constants.js';
import * as storage from '../lib/storage.js';
import { updateIcon } from '../lib/icon-renderer.js';

// ============================================
// Extension Lifecycle
// ============================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ClaudeKarma] Extension installed:', details.reason);

  const existingData = await storage.getUsageData();
  if (!existingData.lastFetchedAt) {
    await storage.setUsageData(existingData);
  }

  await setupAlarm();
  await fetchUsageData();
  await refreshIcon();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[ClaudeKarma] Extension started');
  await setupAlarm();
  await fetchUsageData();
  await refreshIcon();
});

// ============================================
// Alarm Management
// ============================================

async function setupAlarm() {
  await chrome.alarms.clear(ALARMS.FETCH_USAGE);
  chrome.alarms.create(ALARMS.FETCH_USAGE, {
    delayInMinutes: 0.1,
    periodInMinutes: TIMING.REFRESH_INTERVAL_MINUTES
  });
  console.log('[ClaudeKarma] Alarm set: refresh every ' + TIMING.REFRESH_INTERVAL_MINUTES + ' minutes');
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.FETCH_USAGE) {
    console.log('[ClaudeKarma] Alarm triggered');
    await fetchUsageData();
  }
});

// ============================================
// API Data Fetching
// ============================================

/**
 * Main fetch function - tries multiple strategies
 */
async function fetchUsageData() {
  console.log('[ClaudeKarma] Fetching usage data...');

  const lastFetch = await storage.getLastFetchTime();
  if (lastFetch && Date.now() - lastFetch < TIMING.MIN_FETCH_INTERVAL_MS) {
    console.log('[ClaudeKarma] Skipping - too recent');
    return;
  }

  // Strategy 1: Try the organization API (requires org ID)
  const settings = await storage.getSettings();
  if (settings.organizationId) {
    const success = await fetchFromOrgAPI(settings.organizationId);
    if (success) return;
  }

  // Strategy 2: Try to get org ID from bootstrap data
  const orgId = await fetchOrganizationId();
  if (orgId) {
    // Save for future use
    await storage.setSettings({ organizationId: orgId });
    const success = await fetchFromOrgAPI(orgId);
    if (success) return;
  }

  // Strategy 3: Fall back to content script
  await triggerContentScript();
}

/**
 * Fetch from Claude's organization usage API
 * Endpoint: https://claude.ai/api/organizations/{orgId}/usage
 */
async function fetchFromOrgAPI(orgId) {
  const url = 'https://claude.ai/api/organizations/' + orgId + '/usage';
  console.log('[ClaudeKarma] Fetching from:', url);

  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('[ClaudeKarma] API returned:', response.status);
      if (response.status === 401 || response.status === 403) {
        await handleNotAuthenticated();
      }
      return false;
    }

    const data = await response.json();
    console.log('[ClaudeKarma] API response:', data);

    const usageData = parseOrgUsageResponse(data);
    await saveUsageData(usageData, 'api');
    return true;

  } catch (error) {
    console.error('[ClaudeKarma] API fetch failed:', error);
    return false;
  }
}

/**
 * Parse the organization usage API response
 * Format: { five_hour: { utilization, resets_at }, seven_day: {...}, ... }
 */
function parseOrgUsageResponse(data) {
  console.log('[ClaudeKarma] Parsing org usage:', Object.keys(data));

  // Extract the relevant limits
  const fiveHour = data.five_hour || {};
  const sevenDay = data.seven_day || {};
  const sevenDayOpus = data.seven_day_opus || {};

  // Calculate percentages (utilization is a count, we need to estimate percentage)
  // For now, use utilization directly as percentage if < 100, otherwise cap at 100
  const sessionPct = Math.min(fiveHour.utilization || 0, 100);
  const weeklyPct = Math.min(sevenDay.utilization || 0, 100);
  const sonnetPct = Math.min(sevenDayOpus.utilization || 0, 100);

  return {
    currentSession: {
      percentage: sessionPct,
      resetTimestamp: fiveHour.resets_at ? new Date(fiveHour.resets_at).getTime() : null
    },
    weeklyLimits: {
      allModels: {
        percentage: weeklyPct,
        resetTimestamp: sevenDay.resets_at ? new Date(sevenDay.resets_at).getTime() : null,
        resetDay: null,
        resetTime: null
      },
      sonnetOnly: {
        percentage: sonnetPct,
        resetTimestamp: sevenDayOpus.resets_at ? new Date(sevenDayOpus.resets_at).getTime() : null,
        resetDay: null,
        resetTime: null
      }
    },
    _raw: data // Keep raw data for debugging
  };
}

/**
 * Try to fetch the organization ID from Claude's bootstrap data
 */
async function fetchOrganizationId() {
  console.log('[ClaudeKarma] Trying to fetch organization ID...');

  try {
    // Try the bootstrap endpoint
    const response = await fetch('https://claude.ai/api/bootstrap', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[ClaudeKarma] Bootstrap data keys:', Object.keys(data));

      // Look for organization ID in various places
      const orgId = data.organization_id ||
                    data.organizationId ||
                    data.account?.organization_id ||
                    (data.organizations && data.organizations[0]?.id);

      if (orgId) {
        console.log('[ClaudeKarma] Found org ID:', orgId);
        return orgId;
      }
    }

    // Try account endpoint
    const accountResponse = await fetch('https://claude.ai/api/account', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log('[ClaudeKarma] Account data keys:', Object.keys(accountData));

      const orgId = accountData.organization_id ||
                    accountData.memberships?.[0]?.organization?.uuid;

      if (orgId) {
        console.log('[ClaudeKarma] Found org ID from account:', orgId);
        return orgId;
      }
    }

  } catch (error) {
    console.error('[ClaudeKarma] Failed to get org ID:', error);
  }

  return null;
}

/**
 * Trigger content script as fallback
 */
async function triggerContentScript() {
  console.log('[ClaudeKarma] Trying content script fallback...');

  try {
    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });

    if (tabs.length > 0) {
      const usageTab = tabs.find(t => t.url && t.url.includes('/settings/usage'));
      const targetTab = usageTab || tabs[0];

      if (usageTab) {
        try {
          await chrome.tabs.sendMessage(targetTab.id, { type: MESSAGE_TYPES.REQUEST_REFRESH });
          console.log('[ClaudeKarma] Sent refresh to content script');
          return;
        } catch (e) {
          console.log('[ClaudeKarma] Content script not responding');
        }
      }

      // Navigate to usage page
      await chrome.tabs.update(targetTab.id, { url: 'https://claude.ai/settings/usage' });
      console.log('[ClaudeKarma] Navigated to usage page');
    } else {
      console.log('[ClaudeKarma] No Claude tabs open');
    }
  } catch (error) {
    console.error('[ClaudeKarma] Content script fallback failed:', error);
  }
}

// ============================================
// Data Handling
// ============================================

async function handleNotAuthenticated() {
  const usageData = await storage.getUsageData();
  usageData.error = 'not_authenticated';
  usageData.lastFetchedAt = Date.now();
  await storage.setUsageData(usageData);
  await refreshIcon();
}

async function saveUsageData(data, source) {
  const existingData = await storage.getUsageData();
  const mergedData = {
    ...existingData,
    ...data,
    lastFetchedAt: Date.now(),
    fetchSource: source,
    error: null
  };

  await storage.setUsageData(mergedData);
  await refreshIcon();

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.USAGE_DATA_UPDATED,
      data: mergedData
    });
  } catch (e) { /* Popup not open */ }

  console.log('[ClaudeKarma] Data saved from ' + source);
}

// ============================================
// Message Handling
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ClaudeKarma] Message:', message.type);

  switch (message.type) {
    case MESSAGE_TYPES.USAGE_DATA_SCRAPED:
      saveUsageData(message.data, 'scrape')
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.GET_USAGE_DATA:
      storage.getUsageData()
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.REQUEST_REFRESH:
      fetchUsageData()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SET_ORG_ID':
      storage.setSettings({ organizationId: message.orgId })
        .then(() => fetchUsageData())
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message' });
      return false;
  }
});

// ============================================
// Icon Updates
// ============================================

async function refreshIcon() {
  try {
    const usageData = await storage.getUsageData();
    const percentage = usageData.currentSession?.percentage || 0;
    await updateIcon(percentage / 100);
    console.log('[ClaudeKarma] Icon: ' + percentage + '%');
  } catch (error) {
    console.error('[ClaudeKarma] Icon update failed:', error);
  }
}

// ============================================
// Initial Setup
// ============================================

(async () => {
  console.log('[ClaudeKarma] Service worker init');
  await refreshIcon();
  await fetchUsageData();
})();
