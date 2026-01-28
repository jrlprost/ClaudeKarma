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
import { updateIcon, startAnimation, stopAnimation } from '../lib/icon-renderer.js';

// ============================================
// Extension Lifecycle
// ============================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ClaudeKarma] Extension installed:', details.reason);

  // Open welcome page on first install
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome/welcome.html')
    });
  }

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

  // Start spinning animation while loading
  startAnimation('spin');

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

  // If we still have no org ID after all strategies, mark as needs setup
  const finalSettings = await storage.getSettings();
  if (!finalSettings.organizationId) {
    const usageData = await storage.getUsageData();
    usageData.error = 'needs_setup';
    usageData.lastFetchedAt = Date.now();
    await storage.setUsageData(usageData);

    // Stop animation and show empty state
    await stopAnimation(0, 0);
  }
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
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('[ClaudeKarma] Cannot reach claude.ai — are you logged in?');
    } else {
      console.warn('[ClaudeKarma] API fetch failed:', error.message);
    }
    return false;
  }
}

/**
 * Parse the organization usage API response
 * Format: { five_hour: { utilization, resets_at }, seven_day: {...}, ... }
 *
 * The API may return different model-specific limits based on subscription:
 * - seven_day_opus: Opus usage limit
 * - seven_day_sonnet: Sonnet usage limit
 * - etc.
 */
function parseOrgUsageResponse(data) {
  console.log('[ClaudeKarma] Parsing org usage:', Object.keys(data));
  console.log('[ClaudeKarma] Full API response:', JSON.stringify(data, null, 2));

  // Extract the relevant limits
  const fiveHour = data.five_hour || {};
  const sevenDay = data.seven_day || {};

  // Detect which model-specific limit is available
  // Priority: opus > sonnet > haiku > any other seven_day_* field
  let modelLimit = null;
  let modelName = null;

  if (data.seven_day_opus) {
    modelLimit = data.seven_day_opus;
    modelName = 'Opus';
  } else if (data.seven_day_sonnet) {
    modelLimit = data.seven_day_sonnet;
    modelName = 'Sonnet';
  } else if (data.seven_day_haiku) {
    modelLimit = data.seven_day_haiku;
    modelName = 'Haiku';
  } else {
    // Try to find any seven_day_* field
    const modelKeys = Object.keys(data).filter(k => k.startsWith('seven_day_') && k !== 'seven_day');
    if (modelKeys.length > 0) {
      const key = modelKeys[0];
      modelLimit = data[key];
      // Extract model name from key (e.g., "seven_day_sonnet" -> "Sonnet")
      modelName = key.replace('seven_day_', '').charAt(0).toUpperCase() + key.replace('seven_day_', '').slice(1);
    }
  }

  // Calculate percentages (utilization is a count, we need to estimate percentage)
  // For now, use utilization directly as percentage if < 100, otherwise cap at 100
  const sessionPct = Math.min(fiveHour.utilization || 0, 100);
  const weeklyPct = Math.min(sevenDay.utilization || 0, 100);
  const modelPct = modelLimit ? Math.min(modelLimit.utilization || 0, 100) : 0;

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
      modelSpecific: {
        percentage: modelPct,
        resetTimestamp: modelLimit?.resets_at ? new Date(modelLimit.resets_at).getTime() : null,
        resetDay: null,
        resetTime: null,
        modelName: modelName
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
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('[ClaudeKarma] Cannot reach claude.ai — are you logged in?');
    } else {
      console.warn('[ClaudeKarma] Could not auto-detect org ID:', error.message);
    }
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

  // Stop animation and show empty state
  await stopAnimation(0, 0);
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

    // Get both session and weekly percentages
    const sessionPct = usageData.currentSession?.percentage || 0;
    const weeklyPct = usageData.weeklyLimits?.allModels?.percentage || 0;

    const sessionProgress = sessionPct / 100;
    const weeklyProgress = weeklyPct / 100;

    // Stop any running animation and update with both values
    await stopAnimation(sessionProgress, weeklyProgress);

    // Optional: Start pulse animation for high usage (>70%)
    if (sessionPct >= 70 || weeklyPct >= 70) {
      startAnimation('pulse', sessionProgress, weeklyProgress);
    }

    console.log('[ClaudeKarma] Icon: session=' + sessionPct + '%, weekly=' + weeklyPct + '%');
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
