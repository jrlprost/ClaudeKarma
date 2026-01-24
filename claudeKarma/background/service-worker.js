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
 * Fetch usage data - tries content script first (most reliable for SPAs)
 */
async function fetchUsageData() {
  console.log('[ClaudeKarma] Fetching usage data...');

  // Check if we fetched recently (avoid hammering)
  const lastFetch = await storage.getLastFetchTime();
  if (lastFetch && Date.now() - lastFetch < TIMING.MIN_FETCH_INTERVAL_MS) {
    console.log('[ClaudeKarma] Skipping fetch - too recent');
    return;
  }

  // Strategy 1: Try to inject content script into any open Claude tab
  // This is most reliable because it runs after React renders the page
  const injected = await injectContentScript();
  if (injected) {
    console.log('[ClaudeKarma] Content script injected, waiting for data...');
    return; // Data will come via message from content script
  }

  // Strategy 2: Try API endpoints that might return JSON
  const apiEndpoints = [
    'https://claude.ai/api/account',
    'https://claude.ai/api/usage',
    'https://claude.ai/api/settings'
  ];

  for (const endpoint of apiEndpoints) {
    try {
      console.log('[ClaudeKarma] Trying API:', endpoint);
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ClaudeKarma] API response:', Object.keys(data));

        if (data.usage || data.limits || data.account) {
          const usageData = normalizeAPIResponse(data);
          await saveUsageData(usageData, 'api');
          return;
        }
      }
    } catch (e) {
      console.log('[ClaudeKarma] API ' + endpoint + ' failed:', e.message);
    }
  }

  console.log('[ClaudeKarma] No data source available - open Claude.ai to fetch data');
}

/**
 * Normalize API response to our data format
 */
function normalizeAPIResponse(data) {
  const usage = data.usage || data.limits || data;
  return {
    currentSession: {
      percentage: usage.session_usage || usage.current || 0,
      resetTimestamp: usage.session_reset || null
    },
    weeklyLimits: {
      allModels: {
        percentage: usage.weekly_all || usage.all_models || 0,
        resetTimestamp: null, resetDay: null, resetTime: null
      },
      sonnetOnly: {
        percentage: usage.weekly_sonnet || usage.sonnet || 0,
        resetTimestamp: null, resetDay: null, resetTime: null
      }
    }
  };
}

/**
 * Inject content script into an open Claude tab
 */
async function injectContentScript() {
  try {
    // Find any Claude tab (not just usage page)
    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });

    if (tabs.length === 0) {
      console.log('[ClaudeKarma] No Claude tabs open');
      return false;
    }

    // Prefer usage page, but any Claude tab works
    const usageTab = tabs.find(function(t) {
      return t.url && t.url.includes('/settings/usage');
    });
    const targetTab = usageTab || tabs[0];

    console.log('[ClaudeKarma] Found Claude tab:', targetTab.url);

    // If it's the usage page, just request a refresh from existing content script
    if (targetTab.url.includes('/settings/usage')) {
      try {
        await chrome.tabs.sendMessage(targetTab.id, { type: MESSAGE_TYPES.REQUEST_REFRESH });
        return true;
      } catch (e) {
        console.log('[ClaudeKarma] Content script not loaded, injecting...');
      }
    }

    // Navigate to usage page to trigger content script
    await chrome.tabs.update(targetTab.id, { url: 'https://claude.ai/settings/usage' });
    console.log('[ClaudeKarma] Navigated tab to usage page');
    return true;

  } catch (error) {
    console.error('[ClaudeKarma] Failed to inject:', error);
    return false;
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
 * Extract usage data from Claude.ai HTML using specific patterns
 */
function extractUsageFromHTML(html) {
  const result = {
    currentSession: { percentage: 0, resetTimestamp: null },
    weeklyLimits: {
      allModels: { percentage: 0, resetTimestamp: null, resetDay: null, resetTime: null },
      sonnetOnly: { percentage: 0, resetTimestamp: null, resetDay: null, resetTime: null }
    }
  };

  // Strategy 1: Look for "X % utilisés" or "X% used" patterns (the actual usage text)
  // This is the most reliable - it's the displayed text
  const usedPatterns = [
    /(\d+)\s*%\s*(?:utilisés?|used)/gi,  // "39 % utilisés" or "39% used"
    /(\d+)\s*%\s*(?:of\s+)?(?:limit|quota)/gi  // "39% of limit"
  ];

  const usedValues = [];
  for (const pattern of usedPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      usedValues.push(parseInt(match[1], 10));
    }
  }

  console.log('[ClaudeKarma] Found "X% used" values:', usedValues);

  // Strategy 2: Look for progress bar widths in style="width: X%;"
  // These appear right before the percentage text
  const widthPattern = /style="width:\s*(\d+)%/gi;
  const widthValues = [];
  let match;
  while ((match = widthPattern.exec(html)) !== null) {
    widthValues.push(parseInt(match[1], 10));
  }

  console.log('[ClaudeKarma] Found progress bar widths:', widthValues);

  // Use "X% used" values if found, otherwise use progress bar widths
  const percentages = usedValues.length >= 3 ? usedValues : widthValues;

  if (percentages.length >= 3) {
    // Order in Claude's HTML: Current Session, All Models, Sonnet Only
    result.currentSession.percentage = percentages[0];
    result.weeklyLimits.allModels.percentage = percentages[1];
    result.weeklyLimits.sonnetOnly.percentage = percentages[2];

    console.log('[ClaudeKarma] Extracted: Session=' + percentages[0] +
                '%, AllModels=' + percentages[1] +
                '%, Sonnet=' + percentages[2] + '%');
  } else if (percentages.length > 0) {
    // Partial data
    result.currentSession.percentage = percentages[0] || 0;
    result.weeklyLimits.allModels.percentage = percentages[1] || 0;
    result.weeklyLimits.sonnetOnly.percentage = percentages[2] || 0;
  }

  // Strategy 3: Extract reset times
  // French: "Réinitialisation dans 2 h 5 min" or "Réinitialisation ven. 10:00"
  // English: "Resets in 2h 5min" or "Resets Friday 10:00"
  const resetPatterns = [
    /[Rr](?:é|e)initialis(?:ation|e)\s+(?:dans\s+)?(\d+)\s*h\s*(\d+)?\s*min/gi,  // "dans 2 h 5 min"
    /[Rr]esets?\s+(?:in\s+)?(\d+)\s*h\s*(\d+)?\s*m/gi,  // "Resets in 2h 5min"
  ];

  for (const pattern of resetPatterns) {
    const resetMatch = pattern.exec(html);
    if (resetMatch) {
      const hours = parseInt(resetMatch[1], 10) || 0;
      const minutes = parseInt(resetMatch[2], 10) || 0;
      result.currentSession.resetTimestamp = Date.now() + (hours * 60 + minutes) * 60 * 1000;
      console.log('[ClaudeKarma] Session reset in ' + hours + 'h ' + minutes + 'min');
      break;
    }
  }

  // Look for day-based resets (weekly)
  const dayResetPattern = /[Rr](?:é|e)initialis(?:ation|e)\s+(lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)[^\d]*(\d{1,2}:\d{2})/gi;
  const dayMatches = [];
  let dayMatch;
  while ((dayMatch = dayResetPattern.exec(html)) !== null) {
    dayMatches.push({ day: dayMatch[1], time: dayMatch[2] });
  }

  if (dayMatches.length >= 1) {
    result.weeklyLimits.allModels.resetDay = dayMatches[0].day;
    result.weeklyLimits.allModels.resetTime = dayMatches[0].time;
  }
  if (dayMatches.length >= 2) {
    result.weeklyLimits.sonnetOnly.resetDay = dayMatches[1].day;
    result.weeklyLimits.sonnetOnly.resetTime = dayMatches[1].time;
  }

  console.log('[ClaudeKarma] Weekly resets:', dayMatches);

  return result;
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
