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

  // Open "What's New" page on extension update
  if (details.reason === 'update') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('update/update.html')
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
  const settings = await storage.getSettings();
  const interval = settings.refreshInterval || TIMING.REFRESH_INTERVAL_MINUTES;
  await chrome.alarms.clear(ALARMS.FETCH_USAGE);
  chrome.alarms.create(ALARMS.FETCH_USAGE, {
    delayInMinutes: 0.1,
    periodInMinutes: interval
  });
  console.log('[ClaudeKarma] Alarm set: refresh every ' + interval + ' minutes');
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

  const fiveHour = data.five_hour || {};
  const sevenDay = data.seven_day || {};

  // Extract ALL model-specific limits dynamically
  const modelKeys = Object.keys(data).filter(k => k.startsWith('seven_day_') && k !== 'seven_day');
  const models = modelKeys.map(key => {
    const raw = data[key];
    const name = key.replace('seven_day_', '').charAt(0).toUpperCase() + key.replace('seven_day_', '').slice(1);
    return {
      name: name,
      percentage: Math.min(raw.utilization || 0, 100),
      resetTimestamp: raw.resets_at ? new Date(raw.resets_at).getTime() : null
    };
  });

  // Keep backward-compatible modelSpecific (highest-priority model)
  const priorityOrder = ['Opus', 'Sonnet', 'Haiku'];
  const primaryModel = priorityOrder.reduce((found, name) =>
    found || models.find(m => m.name === name), null
  ) || models[0] || null;

  const sessionPct = Math.min(fiveHour.utilization || 0, 100);
  const weeklyPct = Math.min(sevenDay.utilization || 0, 100);

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
      modelSpecific: primaryModel ? {
        percentage: primaryModel.percentage,
        resetTimestamp: primaryModel.resetTimestamp,
        resetDay: null,
        resetTime: null,
        modelName: primaryModel.name
      } : { percentage: 0, resetTimestamp: null, resetDay: null, resetTime: null, modelName: null },
      models: models
    },
    _raw: data
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
  await storage.appendUsageSnapshot(mergedData);
  await refreshIcon();

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.USAGE_DATA_UPDATED,
      data: mergedData
    });
  } catch (e) { /* Popup not open */ }

  await checkAndNotify(mergedData);

  console.log('[ClaudeKarma] Data saved from ' + source);
}

// ============================================
// Notifications
// ============================================

const NOTIFICATION_THRESHOLDS = [75, 90, 100];

async function checkAndNotify(usageData) {
  const settings = await storage.getSettings();
  if (!settings.notifications?.enabled) return;

  const state = await storage.getNotificationState();
  const sessionPct = usageData.currentSession?.percentage || 0;
  const weeklyPct = usageData.weeklyLimits?.allModels?.percentage || 0;
  const maxPct = Math.max(sessionPct, weeklyPct);

  // Find the highest threshold crossed
  const crossedThreshold = NOTIFICATION_THRESHOLDS.filter(t => maxPct >= t).pop() || 0;

  // Only notify if we crossed a NEW threshold (higher than last notified)
  if (crossedThreshold <= 0 || crossedThreshold <= state.lastNotifiedThreshold) {
    // Reset if usage dropped below all thresholds
    if (maxPct < NOTIFICATION_THRESHOLDS[0] && state.lastNotifiedThreshold > 0) {
      await storage.setNotificationState({ lastNotifiedThreshold: 0 });
    }
    return;
  }

  // Determine which limit is higher
  const isSession = sessionPct >= weeklyPct;
  const pct = isSession ? sessionPct : weeklyPct;
  const body = isSession
    ? chrome.i18n.getMessage('notificationSessionHigh', [String(Math.round(pct))]) ||
      `Your 5-hour session usage has reached ${Math.round(pct)}%`
    : chrome.i18n.getMessage('notificationWeeklyHigh', [String(Math.round(pct))]) ||
      `Your 7-day weekly usage has reached ${Math.round(pct)}%`;

  const title = chrome.i18n.getMessage('notificationTitle') || 'ClaudeKarma — Usage Alert';

  try {
    chrome.notifications.create('usage-alert-' + crossedThreshold, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: title,
      message: body,
      priority: crossedThreshold >= 90 ? 2 : 1
    });

    await storage.setNotificationState({
      lastNotifiedThreshold: crossedThreshold,
      lastNotifiedAt: Date.now()
    });

    console.log('[ClaudeKarma] Notification sent: ' + crossedThreshold + '% threshold');
  } catch (error) {
    console.warn('[ClaudeKarma] Notification failed:', error.message);
  }
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

    case 'UPDATE_SETTINGS':
      setupAlarm()
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
