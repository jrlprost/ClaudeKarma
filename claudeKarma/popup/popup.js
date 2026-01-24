/**
 * ClaudeKarma - Popup Script
 *
 * Displays usage data in the popup UI.
 * Reads data from storage and updates UI elements.
 * Handles refresh button and countdown timers.
 */

// Message types
const MESSAGE_TYPES = {
  GET_USAGE_DATA: 'getUsageData',
  REQUEST_REFRESH: 'requestRefresh',
  USAGE_DATA_UPDATED: 'usageDataUpdated'
};

// DOM Elements
const elements = {
  loadingState: document.getElementById('loading-state'),
  errorState: document.getElementById('error-state'),
  loginState: document.getElementById('login-state'),
  mainContent: document.getElementById('main-content'),
  errorMessage: document.getElementById('error-message'),
  refreshBtn: document.getElementById('refresh-btn'),

  // Session
  sessionProgress: document.getElementById('session-progress'),
  sessionPercentage: document.getElementById('session-percentage'),
  sessionReset: document.getElementById('session-reset'),

  // Weekly - All Models
  allModelsProgress: document.getElementById('all-models-progress'),
  allModelsPercentage: document.getElementById('all-models-percentage'),

  // Weekly - Sonnet
  sonnetProgress: document.getElementById('sonnet-progress'),
  sonnetPercentage: document.getElementById('sonnet-percentage'),
  weeklyReset: document.getElementById('weekly-reset'),

  // Footer
  lastUpdated: document.getElementById('last-updated')
};

// Timer for countdown updates
let countdownInterval = null;

// ============================================
// UI State Management
// ============================================

/**
 * Show loading state
 */
function showLoading() {
  elements.loadingState.classList.remove('hidden');
  elements.errorState.classList.add('hidden');
  elements.loginState.classList.add('hidden');
  elements.mainContent.classList.add('hidden');
}

/**
 * Show error state
 * @param {string} message - Error message to display
 */
function showError(message) {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.remove('hidden');
  elements.loginState.classList.add('hidden');
  elements.mainContent.classList.add('hidden');
  elements.errorMessage.textContent = message;
}

/**
 * Show login prompt
 */
function showLoginPrompt() {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.add('hidden');
  elements.loginState.classList.remove('hidden');
  elements.mainContent.classList.add('hidden');
}

/**
 * Show main content
 */
function showMainContent() {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.add('hidden');
  elements.loginState.classList.add('hidden');
  elements.mainContent.classList.remove('hidden');
}

// ============================================
// Progress Bar Updates
// ============================================

/**
 * Get CSS class for progress percentage
 * @param {number} percentage - 0-100
 * @returns {string} CSS class name
 */
function getProgressClass(percentage) {
  if (percentage < 50) return 'low';
  if (percentage < 75) return 'medium';
  if (percentage < 90) return 'high';
  return 'critical';
}

/**
 * Update a progress bar
 * @param {HTMLElement} progressEl - Progress fill element
 * @param {HTMLElement} percentageEl - Percentage text element
 * @param {number} percentage - 0-100
 */
function updateProgressBar(progressEl, percentageEl, percentage) {
  const pct = Math.min(100, Math.max(0, percentage || 0));
  progressEl.style.width = `${pct}%`;
  percentageEl.textContent = `${Math.round(pct)}%`;

  // Update color class
  progressEl.className = 'progress-fill ' + getProgressClass(pct);
}

// ============================================
// Time Formatting
// ============================================

/**
 * Format a countdown for display
 *
 * TODO: This is a user contribution opportunity!
 * Customize the format to match your preferences.
 *
 * @param {number} timestamp - Reset timestamp
 * @returns {string} Formatted countdown (e.g., "4h 39min")
 */
function formatCountdown(timestamp) {
  if (!timestamp) return '--';

  const now = Date.now();
  const diff = timestamp - now;

  if (diff <= 0) return 'Now';

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  return `${minutes}min`;
}

/**
 * Format reset info for display
 * @param {Object} resetInfo - Reset info object
 * @returns {string} Formatted reset text
 */
function formatResetInfo(resetInfo) {
  if (!resetInfo) return '--';

  if (resetInfo.resetTimestamp) {
    const countdown = formatCountdown(resetInfo.resetTimestamp);
    return `Resets in ${countdown}`;
  }

  if (resetInfo.resetDay && resetInfo.resetTime) {
    return `Resets ${resetInfo.resetDay} at ${resetInfo.resetTime}`;
  }

  if (resetInfo.resetDay) {
    return `Resets ${resetInfo.resetDay}`;
  }

  return '--';
}

/**
 * Format "last updated" time
 * @param {number} timestamp - Last fetch timestamp
 * @returns {string} Formatted time ago
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '--';

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

// ============================================
// Data Rendering
// ============================================

/**
 * Render usage data to UI
 * @param {Object} data - Usage data object
 */
function renderUsageData(data) {
  if (!data) {
    showError('No data available');
    return;
  }

  if (data.error === 'not_authenticated') {
    showLoginPrompt();
    return;
  }

  showMainContent();

  // Current Session
  const sessionPct = data.currentSession?.percentage ?? 0;
  updateProgressBar(elements.sessionProgress, elements.sessionPercentage, sessionPct);
  elements.sessionReset.textContent = formatResetInfo(data.currentSession);

  // Weekly - All Models
  const allModelsPct = data.weeklyLimits?.allModels?.percentage ?? 0;
  updateProgressBar(elements.allModelsProgress, elements.allModelsPercentage, allModelsPct);

  // Weekly - Sonnet Only
  const sonnetPct = data.weeklyLimits?.sonnetOnly?.percentage ?? 0;
  updateProgressBar(elements.sonnetProgress, elements.sonnetPercentage, sonnetPct);

  // Weekly Reset
  elements.weeklyReset.textContent = formatResetInfo(data.weeklyLimits?.allModels);

  // Last Updated
  elements.lastUpdated.textContent = `Last updated: ${formatTimeAgo(data.lastFetchedAt)}`;
}

// ============================================
// Data Fetching
// ============================================

/**
 * Fetch usage data from storage
 */
async function fetchData() {
  showLoading();

  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_USAGE_DATA });

    if (response?.success && response.data) {
      renderUsageData(response.data);
    } else {
      showError(response?.error || 'Failed to load data');
    }
  } catch (error) {
    console.error('[ClaudeKarma Popup] Error fetching data:', error);
    showError('Failed to communicate with extension');
  }
}

/**
 * Trigger a refresh
 */
async function triggerRefresh() {
  elements.refreshBtn.classList.add('spinning');

  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_REFRESH });

    // Wait a moment then refresh display
    setTimeout(() => {
      fetchData();
      elements.refreshBtn.classList.remove('spinning');
    }, 2000);
  } catch (error) {
    console.error('[ClaudeKarma Popup] Error triggering refresh:', error);
    elements.refreshBtn.classList.remove('spinning');
    showError('Failed to refresh data');
  }
}

// ============================================
// Event Listeners
// ============================================

// Refresh button
elements.refreshBtn.addEventListener('click', triggerRefresh);

// Listen for data updates from service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.USAGE_DATA_UPDATED) {
    renderUsageData(message.data);
  }
});

// ============================================
// Countdown Timer
// ============================================

/**
 * Start countdown update interval
 */
function startCountdownTimer() {
  // Update every minute
  countdownInterval = setInterval(() => {
    fetchData();
  }, 60000);
}

/**
 * Stop countdown timer
 */
function stopCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ============================================
// Initialization
// ============================================

// Initial fetch
fetchData();

// Start countdown timer
startCountdownTimer();

// Clean up on popup close
window.addEventListener('unload', stopCountdownTimer);
