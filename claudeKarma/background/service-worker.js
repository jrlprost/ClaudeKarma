/**
 * ClaudeKarma - Service Worker
 *
 * Central orchestrator for the extension:
 * - Fetches usage data directly from Claude.ai API
 * - Manages periodic data refresh via alarms
 * - Updates the toolbar icon dynamically
 * - Stores usage data in chrome.storage.local
 */

import { ALARMS, TIMING, MESSAGE_TYPES } from '../lib/constants.js';
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

  // Fetch data immediately on install
  await fetchUsageData();

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

  // Fetch fresh data
  await fetchUsageData();

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

  // Create new alarm - fires immediately then every X minutes
  chrome.alarms.create(ALARMS.FETCH_USAGE, {
    delayInMinutes: 0.1, // Fire almost immediately
    periodInMinutes: TIMING.REFRESH_INTERVAL_MINUTES
  });

  console.log('[ClaudeKarma] Alarm set: refresh every ' + TIMING.REFRESH_INTERVAL_MINUTES + ' minutes');
}

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.FETCH_USAGE) {
    console.log('[ClaudeKarma] Alarm triggered: fetching usage data');
    await fetchUsageData();
  }
});

// ============================================
// API Data Fetching
// ============================================

/**
 * Fetch usage data from Claude.ai API
 * Tries multiple endpoints and parses the response
 */
async function fetchUsageData() {
  console.log('[ClaudeKarma] Fetching usage data from API...');

  // Check if we fetched recently (avoid hammering)
  const lastFetch = await storage.getLastFetchTime();
  if (lastFetch && Date.now() - lastFetch < TIMING.MIN_FETCH_INTERVAL_MS) {
    console.log('[ClaudeKarma] Skipping fetch - too recent');
    return;
  }

  // Try to fetch the usage page HTML and parse it
  try {
    const response = await fetch('https://claude.ai/settings/usage', {
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.log('[ClaudeKarma] User not authenticated');
        await handleNotAuthenticated();
        return;
      }
      throw new Error('HTTP ' + response.status);
    }

    const html = await response.text();
    console.log('[ClaudeKarma] Got usage page HTML, length:', html.length);

    // Try to extract __NEXT_DATA__ from the HTML
    const usageData = parseUsageFromHTML(html);

    if (usageData) {
      await saveUsageData(usageData, 'api');
      console.log('[ClaudeKarma] Usage data saved from API');
    } else {
      console.log('[ClaudeKarma] Could not parse usage data from HTML');
    }

  } catch (error) {
    console.error('[ClaudeKarma] API fetch failed:', error);

    // Try fallback to content script if there's an open Claude tab
    await fallbackToContentScript();
  }
}

/**
 * Parse usage data from the HTML page
 * Looks for __NEXT_DATA__ script tag or other data sources
 */
function parseUsageFromHTML(html) {
  // Try to find __NEXT_DATA__ JSON
  const scriptStart = html.indexOf('<script id="__NEXT_DATA__"');
  if (scriptStart !== -1) {
    const jsonStart = html.indexOf('>', scriptStart) + 1;
    const jsonEnd = html.indexOf('</script>', jsonStart);
    const jsonStr = html.substring(jsonStart, jsonEnd);

    try {
      const nextData = JSON.parse(jsonStr);
      console.log('[ClaudeKarma] Found __NEXT_DATA__');

      // Navigate to find usage data
      const pageProps = nextData?.props?.pageProps;

      if (pageProps) {
        return extractUsageFromPageProps(pageProps);
      }
    } catch (e) {
      console.error('[ClaudeKarma] Failed to parse __NEXT_DATA__:', e);
    }
  }

  // Fallback: Try to find usage percentages in the HTML directly
  const usageData = extractUsageFromHTML(html);
  if (usageData) {
    return usageData;
  }

  return null;
}

/**
 * Extract usage data from Next.js pageProps
 */
function extractUsageFromPageProps(pageProps) {
  // The structure may vary - try common patterns
  const usage = pageProps.usage || pageProps.usageData || pageProps.limits || pageProps;

  console.log('[ClaudeKarma] PageProps keys:', Object.keys(pageProps));

  return {
    currentSession: {
      percentage: usage.sessionUsage || usage.currentUsage || usage.current || 0,
      resetTimestamp: usage.sessionResetTime || usage.resetAt || null
    },
    weeklyLimits: {
      allModels: {
        percentage: usage.weeklyAllModels || usage.allModelsUsage || usage.weeklyUsage || 0,
        resetTimestamp: usage.weeklyResetTime || null,
        resetDay: null,
        resetTime: null
      },
      sonnetOnly: {
        percentage: usage.weeklySonnet || usage.sonnetUsage || 0,
        resetTimestamp: usage.weeklyResetTime || null,
        resetDay: null,
        resetTime: null
      }
    }
  };
}

/**
 * Extract usage data from raw HTML using smarter pattern matching
 */
function extractUsageFromHTML(html) {
  // Strategy 1: Look for percentages near usage-related keywords
  const usagePatterns = [
    // Pattern: "X% of your limit" or "X% used"
    /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:your\s+)?limit|used|usage)/gi,
    // Pattern: "used X%" or "usage: X%"
    /(?:used|usage)[:\s]+(\d+(?:\.\d+)?)\s*%/gi,
    // Pattern: percentage in aria-label or title containing "usage"
    /(?:aria-label|title)="[^"]*?(\d+(?:\.\d+)?)\s*%[^"]*?"/gi
  ];

  let usagePercentages = [];

  for (const pattern of usagePatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const value = parseFloat(match[1]);
      if (value >= 0 && value <= 100) {
        usagePercentages.push(value);
      }
    }
  }

  console.log('[ClaudeKarma] Usage-related percentages:', usagePercentages);

  // Strategy 2: If no specific patterns found, look for percentages
  // that are NOT common CSS values (0, 50, 100)
  if (usagePercentages.length === 0) {
    const allPercentages = [];
    const percentRegex = /(\d+(?:\.\d+)?)\s*%/g;
    let match;

    while ((match = percentRegex.exec(html)) !== null) {
      const value = parseFloat(match[1]);
      if (value >= 0 && value <= 100) {
        allPercentages.push(value);
      }
    }

    // Filter out common CSS values and duplicates
    const cssCommon = new Set([0, 50, 100, 25, 75, 33, 66, 10, 20, 30, 40, 60, 70, 80, 90]);
    const uniqueNonCss = allPercentages.filter(function(v) {
      // Keep values that have decimals (like 99.99) or are not common CSS
      return v % 1 !== 0 || !cssCommon.has(v);
    });

    console.log('[ClaudeKarma] Non-CSS percentages:', uniqueNonCss);
    console.log('[ClaudeKarma] All percentages count:', allPercentages.length);

    // Use unique non-CSS values, or fall back to looking for specific ranges
    if (uniqueNonCss.length > 0) {
      usagePercentages = uniqueNonCss;
    } else {
      // Last resort: find percentages that appear only a few times (likely actual data)
      const counts = {};
      allPercentages.forEach(function(v) { counts[v] = (counts[v] || 0) + 1; });

      // Get values that appear 1-3 times (not repeated CSS patterns)
      usagePercentages = Object.keys(counts)
        .filter(function(k) { return counts[k] <= 3 && counts[k] >= 1; })
        .map(function(k) { return parseFloat(k); })
        .sort(function(a, b) { return a - b; });

      console.log('[ClaudeKarma] Low-frequency percentages:', usagePercentages);
    }
  }

  if (usagePercentages.length > 0) {
    // Take the first meaningful percentage as current session usage
    const sessionPct = usagePercentages[0] || 0;

    return {
      currentSession: {
        percentage: sessionPct,
        resetTimestamp: null
      },
      weeklyLimits: {
        allModels: {
          percentage: usagePercentages[1] || sessionPct,
          resetTimestamp: null,
          resetDay: null,
          resetTime: null
        },
        sonnetOnly: {
          percentage: usagePercentages[2] || 0,
          resetTimestamp: null,
          resetDay: null,
          resetTime: null
        }
      }
    };
  }

  return null;
}

/**
 * Fallback to content script scraping
 */
async function fallbackToContentScript() {
  console.log('[ClaudeKarma] Trying content script fallback...');

  try {
    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });

    if (tabs.length > 0) {
      const usageTab = tabs.find(function(t) {
        return t.url && t.url.includes('/settings/usage');
      });
      if (usageTab) {
        await chrome.tabs.sendMessage(usageTab.id, { type: MESSAGE_TYPES.REQUEST_REFRESH });
        console.log('[ClaudeKarma] Sent refresh request to content script');
      }
    }
  } catch (e) {
    console.log('[ClaudeKarma] Content script fallback failed:', e.message);
  }
}

/**
 * Handle unauthenticated state
 */
async function handleNotAuthenticated() {
  const usageData = await storage.getUsageData();
  usageData.error = 'not_authenticated';
  usageData.lastFetchedAt = Date.now();
  await storage.setUsageData(usageData);
  await refreshIcon();
}

/**
 * Save usage data and update UI
 */
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

  // Notify popup if open
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.USAGE_DATA_UPDATED,
      data: mergedData
    });
  } catch (e) {
    // Popup might not be open - ignore
  }
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
      saveUsageData(message.data, 'scrape')
        .then(function() { sendResponse({ success: true }); })
        .catch(function(err) { sendResponse({ success: false, error: err.message }); });
      return true;

    case MESSAGE_TYPES.GET_USAGE_DATA:
      storage.getUsageData()
        .then(function(data) { sendResponse({ success: true, data: data }); })
        .catch(function(err) { sendResponse({ success: false, error: err.message }); });
      return true;

    case MESSAGE_TYPES.REQUEST_REFRESH:
      fetchUsageData()
        .then(function() { sendResponse({ success: true }); })
        .catch(function(err) { sendResponse({ success: false, error: err.message }); });
      return true;

    default:
      console.warn('[ClaudeKarma] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// ============================================
// Icon Updates
// ============================================

/**
 * Refresh the toolbar icon with current data
 */
async function refreshIcon() {
  try {
    const usageData = await storage.getUsageData();
    const percentage = usageData.currentSession?.percentage || 0;

    await updateIcon(percentage / 100);
    console.log('[ClaudeKarma] Icon updated: ' + percentage + '%');
  } catch (error) {
    console.error('[ClaudeKarma] Failed to update icon:', error);
  }
}

// ============================================
// Initial Setup
// ============================================

// Run initial setup when service worker starts
(async () => {
  console.log('[ClaudeKarma] Service worker initializing');
  await refreshIcon();
  // Fetch data on startup
  await fetchUsageData();
})();
