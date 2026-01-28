/**
 * ClaudeKarma - Content Script
 *
 * Scrapes usage data from claude.ai/settings/usage page.
 * Uses MutationObserver to wait for dynamic React content.
 * Sends data to service worker for storage and icon updates.
 */

// Constants
const MUTATION_OBSERVER_TIMEOUT_MS = 15000;
const MESSAGE_TYPES = {
  USAGE_DATA_SCRAPED: 'usageDataScraped',
  REQUEST_REFRESH: 'requestRefresh'
};

console.log('[ClaudeKarma] Content script loaded on:', window.location.href);

// ============================================
// Utility Functions
// ============================================

/**
 * Wait for an element to appear in the DOM
 *
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @param {Element} parent - Parent element to observe (default: document.body)
 * @returns {Promise<Element>} Resolved element
 */
function waitForElement(selector, timeout = MUTATION_OBSERVER_TIMEOUT_MS, parent = document.body) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = parent.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    // Set up MutationObserver
    const observer = new MutationObserver(() => {
      const el = parent.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent, {
      childList: true,
      subtree: true
    });

    // Timeout handler
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element "${selector}" not found after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Parse reset time text into a timestamp
 *
 * TODO: This is a user contribution opportunity!
 * Customize the parsing logic for different time formats.
 *
 * @param {string} text - Reset text (e.g., "Resets in 4h 39min", "Resets Friday at 10:00 AM")
 * @returns {Object} Parsed reset info
 */
function parseResetTimeText(text) {
  if (!text) return { resetTimestamp: null, resetDay: null, resetTime: null };

  const now = Date.now();

  // Pattern 1: "Resets in Xh Ymin" or "Xh Ymin"
  const durationMatch = text.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m(?:in(?:utes?)?)?/i);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1], 10) || 0;
    const minutes = parseInt(durationMatch[2], 10) || 0;
    const resetTimestamp = now + (hours * 60 + minutes) * 60 * 1000;
    return { resetTimestamp, resetDay: null, resetTime: null };
  }

  // Pattern 2: "Resets in Xmin" or "X minutes"
  const minutesMatch = text.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
  if (minutesMatch && !text.match(/\d+\s*h/i)) {
    const minutes = parseInt(minutesMatch[1], 10);
    const resetTimestamp = now + minutes * 60 * 1000;
    return { resetTimestamp, resetDay: null, resetTime: null };
  }

  // Pattern 3: "Resets Friday at 10:00 AM"
  const dayTimeMatch = text.match(/(?:resets?\s+)?(\w+)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (dayTimeMatch) {
    return {
      resetTimestamp: null,
      resetDay: dayTimeMatch[1],
      resetTime: dayTimeMatch[2]
    };
  }

  // Pattern 4: Just a day name
  const dayMatch = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
  if (dayMatch) {
    return { resetTimestamp: null, resetDay: dayMatch[1], resetTime: null };
  }

  console.log('[ClaudeKarma] Could not parse reset text:', text);
  return { resetTimestamp: null, resetDay: null, resetTime: null };
}

/**
 * Extract percentage from text
 *
 * @param {string} text - Text containing percentage (e.g., "45%", "45 %")
 * @returns {number|null} Percentage as number (0-100) or null
 */
function extractPercentage(text) {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

// ============================================
// Data Extraction Methods
// ============================================

/**
 * Try to extract data from __NEXT_DATA__ script tag (faster)
 *
 * @returns {Object|null} Usage data or null if not available
 */
function extractFromNextData() {
  try {
    const scriptTag = document.getElementById('__NEXT_DATA__');
    if (!scriptTag) {
      console.log('[ClaudeKarma] __NEXT_DATA__ not found');
      return null;
    }

    const nextData = JSON.parse(scriptTag.textContent);
    console.log('[ClaudeKarma] __NEXT_DATA__ parsed:', Object.keys(nextData));

    // Navigate to usage data - structure depends on Claude's implementation
    const pageProps = nextData?.props?.pageProps;
    if (pageProps?.usage || pageProps?.usageData) {
      const usageData = pageProps.usage || pageProps.usageData;
      console.log('[ClaudeKarma] Found usage data in __NEXT_DATA__:', usageData);
      return normalizeUsageData(usageData);
    }

    return null;
  } catch (error) {
    console.error('[ClaudeKarma] Error parsing __NEXT_DATA__:', error);
    return null;
  }
}

/**
 * Extract usage data from DOM (fallback method)
 *
 * @returns {Promise<Object>} Scraped usage data
 */
async function extractFromDOM() {
  console.log('[ClaudeKarma] Extracting from DOM...');

  // Wait for the page to load dynamic content
  await new Promise(resolve => setTimeout(resolve, 1000));

  const usageData = {
    currentSession: { percentage: 0, resetTimestamp: null },
    weeklyLimits: {
      allModels: { percentage: 0, resetTimestamp: null, resetDay: null, resetTime: null },
      sonnetOnly: { percentage: 0, resetTimestamp: null, resetDay: null, resetTime: null }
    }
  };

  // Find all text containing percentages
  const allElements = document.querySelectorAll('*');
  const percentageElements = [];

  for (const el of allElements) {
    if (el.childElementCount === 0) { // Leaf nodes only
      const text = el.textContent?.trim();
      if (text && /\d+\s*%/.test(text)) {
        percentageElements.push({ element: el, text });
      }
    }
  }

  console.log('[ClaudeKarma] Found percentage elements:', percentageElements.length);

  // Look for progress bars
  const progressBars = document.querySelectorAll('[role="progressbar"], progress, [class*="progress"], [class*="Progress"]');
  console.log('[ClaudeKarma] Found progress bars:', progressBars.length);

  // Look for specific section headers
  const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"]'));

  // Try to find "Current Session" section
  for (const header of headers) {
    const text = header.textContent?.toLowerCase() || '';
    if (text.includes('session') || text.includes('current')) {
      console.log('[ClaudeKarma] Found session header:', header.textContent);
      const section = header.closest('section, div, article') || header.parentElement;
      const sectionData = extractSectionData(section);
      if (sectionData.percentage !== null) {
        usageData.currentSession = sectionData;
      }
    }
  }

  // Try to find "Weekly" section
  for (const header of headers) {
    const text = header.textContent?.toLowerCase() || '';
    if (text.includes('weekly') || text.includes('limit')) {
      console.log('[ClaudeKarma] Found weekly header:', header.textContent);
      const section = header.closest('section, div, article') || header.parentElement;

      // Look for "All Models" and "Sonnet Only" subsections
      const subsections = section.querySelectorAll('[class*="card"], [class*="row"], [class*="item"]');
      for (const subsection of subsections) {
        const subsectionText = subsection.textContent?.toLowerCase() || '';
        const subsectionData = extractSectionData(subsection);

        if (subsectionText.includes('all model')) {
          usageData.weeklyLimits.allModels = subsectionData;
        } else if (subsectionText.includes('sonnet')) {
          usageData.weeklyLimits.sonnetOnly = subsectionData;
        }
      }
    }
  }

  // Fallback: use first percentage found as current session
  if (usageData.currentSession.percentage === 0 && percentageElements.length > 0) {
    const firstPercentage = extractPercentage(percentageElements[0].text);
    if (firstPercentage !== null) {
      usageData.currentSession.percentage = firstPercentage;
    }
  }

  console.log('[ClaudeKarma] Extracted usage data:', usageData);
  return usageData;
}

/**
 * Extract data from a section element
 *
 * @param {Element} section - Section element
 * @returns {Object} Section data with percentage and reset info
 */
function extractSectionData(section) {
  if (!section) return { percentage: null, resetTimestamp: null, resetDay: null, resetTime: null };

  const text = section.textContent || '';

  // Find percentage
  const percentage = extractPercentage(text);

  // Find reset time
  const resetInfo = parseResetTimeText(text);

  return {
    percentage: percentage ?? 0,
    ...resetInfo
  };
}

/**
 * Normalize usage data to expected format
 *
 * @param {Object} rawData - Raw usage data from API or scraping
 * @returns {Object} Normalized usage data
 */
function normalizeUsageData(rawData) {
  // Handle different possible formats from __NEXT_DATA__
  return {
    currentSession: {
      percentage: rawData.sessionUsage ?? rawData.current ?? 0,
      resetTimestamp: rawData.sessionResetTime ?? rawData.resetAt ?? null
    },
    weeklyLimits: {
      allModels: {
        percentage: rawData.weeklyAllModels ?? rawData.allModelsUsage ?? 0,
        resetTimestamp: rawData.weeklyResetTime ?? null,
        resetDay: null,
        resetTime: null
      },
      sonnetOnly: {
        percentage: rawData.weeklySonnet ?? rawData.sonnetUsage ?? 0,
        resetTimestamp: rawData.weeklyResetTime ?? null,
        resetDay: null,
        resetTime: null
      }
    }
  };
}

// ============================================
// Authentication Check
// ============================================

/**
 * Check if user is logged in
 *
 * @returns {boolean} True if user appears to be logged in
 */
function isUserLoggedIn() {
  // Check for login-related elements
  const pageText = document.body.textContent?.toLowerCase() || '';

  // Indicators of NOT being logged in
  if (pageText.includes('sign in') || pageText.includes('log in') || pageText.includes('create account')) {
    // Make sure it's a prompt, not just text about signing in
    const signInButton = document.querySelector('button[class*="sign"], a[href*="login"], a[href*="signin"]');
    if (signInButton) {
      console.log('[ClaudeKarma] User appears to be logged out');
      return false;
    }
  }

  // Indicators of being logged in
  const logoutButton = document.querySelector('[class*="logout"], [aria-label*="log out"], [data-testid*="logout"]');
  const userMenu = document.querySelector('[class*="user"], [class*="profile"], [class*="avatar"]');

  if (logoutButton || userMenu) {
    return true;
  }

  // If we're on the usage page and see percentages, likely logged in
  if (document.body.textContent?.match(/\d+\s*%/)) {
    return true;
  }

  return true; // Assume logged in if unsure
}

// ============================================
// Main Scraping Logic
// ============================================

/**
 * Scrape usage data and send to service worker
 */
async function scrapeAndSend() {
  console.log('[ClaudeKarma] Starting data scrape...');

  // Check authentication
  if (!isUserLoggedIn()) {
    console.log('[ClaudeKarma] User not logged in, skipping scrape');
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.USAGE_DATA_SCRAPED,
      data: { error: 'not_authenticated' }
    });
    return;
  }

  try {
    // Try __NEXT_DATA__ first (faster)
    let usageData = extractFromNextData();

    // Fall back to DOM scraping
    if (!usageData) {
      usageData = await extractFromDOM();
    }

    // Send to service worker
    console.log('[ClaudeKarma] Sending data to service worker:', usageData);
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.USAGE_DATA_SCRAPED,
      data: usageData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[ClaudeKarma] Failed to send message:', chrome.runtime.lastError);
      } else {
        console.log('[ClaudeKarma] Service worker response:', response);
      }
    });

  } catch (error) {
    console.error('[ClaudeKarma] Scraping failed:', error);
  }
}

// ============================================
// Message Listener
// ============================================

/**
 * Listen for messages from service worker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ClaudeKarma] Received message:', message);

  if (message.type === MESSAGE_TYPES.REQUEST_REFRESH) {
    scrapeAndSend()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Async response
  }

  return false;
});

// ============================================
// Auto-run on Page Load
// ============================================

// Wait for DOM to be ready, then scrape
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(scrapeAndSend, 1500); // Wait for React hydration
  });
} else {
  setTimeout(scrapeAndSend, 1500); // Wait for React hydration
}

// Also re-scrape if the URL changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (location.href.includes('/settings/usage')) {
      setTimeout(scrapeAndSend, 1500);
    }
  }
}).observe(document, { subtree: true, childList: true });
