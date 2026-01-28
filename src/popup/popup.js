/**
 * ClaudeKarma - Popup Script
 *
 * Displays usage data in the popup UI with premium animations.
 * Features a circular gauge for session limit and stat cards for weekly limits.
 */

// Message types
const MESSAGE_TYPES = {
  GET_USAGE_DATA: 'getUsageData',
  REQUEST_REFRESH: 'requestRefresh',
  USAGE_DATA_UPDATED: 'usageDataUpdated'
};

// Quick tips for random display
const QUICK_TIPS = [
  // Prompting basics
  "Be specific and clear in your prompts for better results.",
  "Break complex tasks into smaller, manageable steps.",
  "Provide context and examples to help Claude understand.",
  "Ask Claude to explain its reasoning when needed.",
  "Request specific formats like bullets, tables, or code blocks.",
  "Iterate and refine your prompts based on responses.",
  "Use Claude for brainstorming before drafting.",
  "Set constraints for more focused outputs.",

  // Context management
  "Start new chats for unrelated topics to avoid confusion.",
  "Use Claude Projects for persistent context across sessions.",
  "Summarize long conversations to maintain focus.",
  "Reference earlier parts of the conversation explicitly.",

  // Advanced techniques
  "Ask Claude to think step-by-step for complex reasoning.",
  "Use role-playing: 'Act as a senior developer reviewing code'.",
  "Provide examples of desired output format.",
  "Ask for multiple alternatives, then pick the best one.",
  "Request pros and cons for decision-making help.",

  // Code assistance
  "Share error messages and stack traces for debugging help.",
  "Specify programming language and framework versions.",
  "Ask Claude to add comments explaining complex code.",
  "Request tests alongside new code implementations.",
  "Use Claude to refactor code for better readability.",

  // Writing assistance
  "Specify tone: formal, casual, technical, friendly.",
  "Ask Claude to match a specific writing style or author.",
  "Request different versions for A/B testing copy.",
  "Use Claude to simplify complex explanations.",

  // Productivity
  "Use Claude to create outlines before writing.",
  "Ask for checklists to ensure nothing is missed.",
  "Request summaries of long documents or articles.",
  "Use Claude to prepare meeting agendas and notes.",

  // Quality improvement
  "Ask Claude to critique its own response.",
  "Request a more concise version of long responses.",
  "Ask 'What am I missing?' for blind spot detection.",
  "Use Claude to proofread and improve your writing.",

  // Learning
  "Ask Claude to explain concepts at different levels.",
  "Request analogies to understand complex topics.",
  "Use Claude as a study partner for Q&A practice.",
  "Ask for recommended resources on any topic."
];

// Gauge configuration
const GAUGE_CIRCUMFERENCE = 327; // 2 * PI * 52 (radius)

// Color configurations for different usage levels
const STATUS_COLORS = {
  low: { start: '#22c55e', end: '#4ade80', glow: 'rgba(34, 197, 94, 0.5)' },
  medium: { start: '#eab308', end: '#facc15', glow: 'rgba(234, 179, 8, 0.5)' },
  high: { start: '#f97316', end: '#fb923c', glow: 'rgba(249, 115, 22, 0.5)' },
  critical: { start: '#ef4444', end: '#f87171', glow: 'rgba(239, 68, 68, 0.5)' }
};

// DOM Elements
const elements = {
  loadingState: document.getElementById('loading-state'),
  errorState: document.getElementById('error-state'),
  loginState: document.getElementById('login-state'),
  setupState: document.getElementById('setup-state'),
  mainContent: document.getElementById('main-content'),
  errorMessage: document.getElementById('error-message'),
  refreshBtn: document.getElementById('refresh-btn'),

  // Setup
  autoDetectBtn: document.getElementById('auto-detect-btn'),
  autoDetectBtnText: document.querySelector('#auto-detect-btn span'),
  orgIdInput: document.getElementById('org-id-input'),
  saveOrgBtn: document.getElementById('save-org-btn'),
  settingsBtn: document.getElementById('settings-btn'),

  // Tips
  tipsBtn: document.getElementById('tips-btn'),
  tipsNewDot: document.getElementById('tips-new-dot'),
  tipText: document.getElementById('tip-text'),
  seeMoreTips: document.getElementById('see-more-tips'),

  // Gauge
  gaugeProgress: document.getElementById('gauge-progress'),
  gaugeStop1: document.getElementById('gauge-stop-1'),
  gaugeStop2: document.getElementById('gauge-stop-2'),
  sessionPercentage: document.getElementById('session-percentage'),
  sessionReset: document.getElementById('session-reset'),

  // Weekly Stats
  allModelsProgress: document.getElementById('all-models-progress'),
  allModelsPercentage: document.getElementById('all-models-percentage'),
  modelLabel: document.getElementById('model-label'),
  modelProgress: document.getElementById('model-progress'),
  modelPercentage: document.getElementById('model-percentage'),
  weeklyReset: document.getElementById('weekly-reset'),

  // Footer
  lastUpdated: document.getElementById('last-updated')
};

// Timer for countdown updates
let countdownInterval = null;

// ============================================
// UI State Management
// ============================================

function hideAllStates() {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.add('hidden');
  elements.loginState.classList.add('hidden');
  elements.setupState.classList.add('hidden');
  elements.mainContent.classList.add('hidden');
}

function showLoading() {
  hideAllStates();
  elements.loadingState.classList.remove('hidden');
}

function showError(message) {
  hideAllStates();
  elements.errorState.classList.remove('hidden');
  elements.errorMessage.textContent = message;
}

function showLoginPrompt() {
  hideAllStates();
  elements.loginState.classList.remove('hidden');
}

function showSetup() {
  hideAllStates();
  elements.setupState.classList.remove('hidden');
}

function showMainContent() {
  hideAllStates();
  elements.mainContent.classList.remove('hidden');
  displayRandomTip();
}

// ============================================
// Progress & Gauge Updates
// ============================================

/**
 * Get status level based on percentage
 */
function getStatusLevel(percentage) {
  if (percentage < 50) return 'low';
  if (percentage < 70) return 'medium';
  if (percentage < 90) return 'high';
  return 'critical';
}

/**
 * Update the main circular gauge
 */
function updateGauge(percentage) {
  const pct = Math.min(100, Math.max(0, percentage || 0));
  const offset = GAUGE_CIRCUMFERENCE - (pct / 100) * GAUGE_CIRCUMFERENCE;

  // Animate the gauge
  if (elements.gaugeProgress) {
    elements.gaugeProgress.style.strokeDashoffset = offset;
  }

  // Update the percentage text
  if (elements.sessionPercentage) {
    elements.sessionPercentage.textContent = Math.round(pct);
  }

  // Update gradient colors based on status
  const status = getStatusLevel(pct);
  const colors = STATUS_COLORS[status];

  if (elements.gaugeStop1) {
    elements.gaugeStop1.setAttribute('stop-color', colors.start);
  }
  if (elements.gaugeStop2) {
    elements.gaugeStop2.setAttribute('stop-color', colors.end);
  }

  // Update gauge glow color
  const gaugeEl = document.querySelector('.gauge');
  if (gaugeEl) {
    gaugeEl.style.setProperty('--gauge-glow', colors.glow);
  }
}

/**
 * Update a stat bar
 */
function updateStatBar(progressEl, percentageEl, percentage) {
  const pct = Math.min(100, Math.max(0, percentage || 0));

  if (progressEl) {
    progressEl.style.width = `${pct}%`;
    progressEl.className = 'stat-fill ' + getStatusLevel(pct);
  }

  if (percentageEl) {
    percentageEl.textContent = `${Math.round(pct)}%`;
  }
}

// ============================================
// Time Formatting
// ============================================

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
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

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

function formatTimeAgo(timestamp) {
  if (!timestamp) return '--';

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

// ============================================
// Data Rendering
// ============================================

function renderUsageData(data) {
  if (!data) {
    showError('No data available');
    return;
  }

  if (data.error === 'not_authenticated') {
    showLoginPrompt();
    return;
  }

  if (data.error === 'needs_setup') {
    showSetup();
    return;
  }

  // Check if we have actual usage data
  if (!data.currentSession && !data.lastFetchedAt) {
    showSetup();
    return;
  }

  showMainContent();

  // Session gauge
  const sessionPct = data.currentSession?.percentage ?? 0;
  updateGauge(sessionPct);
  if (elements.sessionReset) {
    elements.sessionReset.textContent = formatResetInfo(data.currentSession);
  }

  // Weekly - All Models
  const allModelsPct = data.weeklyLimits?.allModels?.percentage ?? 0;
  updateStatBar(elements.allModelsProgress, elements.allModelsPercentage, allModelsPct);

  // Weekly - Model-specific (Sonnet/Opus/etc)
  const modelData = data.weeklyLimits?.modelSpecific || data.weeklyLimits?.sonnetOnly;
  const modelPct = modelData?.percentage ?? 0;
  const modelName = modelData?.modelName || 'Model';

  if (elements.modelLabel) {
    elements.modelLabel.textContent = modelName;
  }
  updateStatBar(elements.modelProgress, elements.modelPercentage, modelPct);

  // Weekly Reset
  if (elements.weeklyReset) {
    elements.weeklyReset.textContent = formatResetInfo(data.weeklyLimits?.allModels);
  }

  // Last Updated
  if (elements.lastUpdated) {
    elements.lastUpdated.textContent = `Updated ${formatTimeAgo(data.lastFetchedAt)}`;
  }
}

// ============================================
// Data Fetching
// ============================================

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

async function triggerRefresh() {
  elements.refreshBtn.classList.add('spinning');

  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_REFRESH });

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
// Setup Handlers
// ============================================

async function handleAutoDetect() {
  if (!elements.autoDetectBtn) return;

  elements.autoDetectBtn.disabled = true;
  if (elements.autoDetectBtnText) {
    elements.autoDetectBtnText.textContent = 'Detecting...';
  }

  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_REFRESH });

    setTimeout(async () => {
      await fetchData();
      elements.autoDetectBtn.disabled = false;
      if (elements.autoDetectBtnText) {
        elements.autoDetectBtnText.textContent = 'Auto-detect Account';
      }
    }, 3000);
  } catch (error) {
    console.error('[ClaudeKarma Popup] Auto-detect failed:', error);
    elements.autoDetectBtn.disabled = false;
    if (elements.autoDetectBtnText) {
      elements.autoDetectBtnText.textContent = 'Auto-detect Account';
    }
    showError('Auto-detect failed. Please enter your Org ID manually.');
  }
}

async function handleSaveOrgId() {
  if (!elements.orgIdInput || !elements.saveOrgBtn) return;

  const orgId = elements.orgIdInput.value.trim();

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    showError('Invalid Organization ID format');
    return;
  }

  elements.saveOrgBtn.disabled = true;
  elements.saveOrgBtn.textContent = 'Saving...';

  try {
    await chrome.runtime.sendMessage({ type: 'SET_ORG_ID', orgId: orgId });

    setTimeout(async () => {
      await fetchData();
      elements.saveOrgBtn.disabled = false;
      elements.saveOrgBtn.textContent = 'Save';
    }, 2000);
  } catch (error) {
    console.error('[ClaudeKarma Popup] Save org ID failed:', error);
    elements.saveOrgBtn.disabled = false;
    elements.saveOrgBtn.textContent = 'Save';
    showError('Failed to save Organization ID');
  }
}

function handleSettings() {
  showSetup();
}

// ============================================
// Tips Page Handler
// ============================================

async function checkTipsViewed() {
  try {
    const result = await chrome.storage.local.get('tipsPageViewed');
    if (result.tipsPageViewed) {
      // User has visited tips page, hide the new dot
      elements.tipsNewDot?.classList.add('hidden');
    }
  } catch (error) {
    console.error('[ClaudeKarma Popup] Error checking tips viewed:', error);
  }
}

function handleTipsClick() {
  // Open tips page in new tab
  chrome.tabs.create({ url: chrome.runtime.getURL('tips/tips.html') });
  // Hide the new dot immediately
  elements.tipsNewDot?.classList.add('hidden');
}

// ============================================
// Random Tip Display
// ============================================

function displayRandomTip() {
  if (elements.tipText) {
    const randomIndex = Math.floor(Math.random() * QUICK_TIPS.length);
    elements.tipText.textContent = QUICK_TIPS[randomIndex];
  }
}

// ============================================
// Event Listeners
// ============================================

elements.refreshBtn?.addEventListener('click', triggerRefresh);
elements.autoDetectBtn?.addEventListener('click', handleAutoDetect);
elements.saveOrgBtn?.addEventListener('click', handleSaveOrgId);
elements.settingsBtn?.addEventListener('click', handleSettings);
elements.tipsBtn?.addEventListener('click', handleTipsClick);
elements.seeMoreTips?.addEventListener('click', handleTipsClick);

elements.orgIdInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleSaveOrgId();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.USAGE_DATA_UPDATED) {
    renderUsageData(message.data);
  }
});

// ============================================
// Countdown Timer
// ============================================

function startCountdownTimer() {
  countdownInterval = setInterval(() => {
    fetchData();
  }, 60000);
}

function stopCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ============================================
// Initialization
// ============================================

fetchData();
startCountdownTimer();
checkTipsViewed();
window.addEventListener('unload', stopCountdownTimer);
