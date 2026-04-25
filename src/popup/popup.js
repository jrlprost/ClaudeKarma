/**
 * ClaudeKarma - Popup Script
 *
 * Displays usage data in the popup UI with premium animations.
 * Features a circular gauge for session limit and stat cards for weekly limits.
 */

import { getCurrentPeakState } from '../lib/peak-schedule.js';

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

  // Settings panel
  settingsPanel: document.getElementById('settings-panel'),
  settingsBack: document.getElementById('settings-back'),
  settingNotifications: document.getElementById('setting-notifications'),
  thresholdOptions: document.getElementById('threshold-options'),
  threshold75: document.getElementById('threshold-75'),
  threshold90: document.getElementById('threshold-90'),
  threshold100: document.getElementById('threshold-100'),
  settingRefreshInterval: document.getElementById('setting-refresh-interval'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  resetSetupBtn: document.getElementById('reset-setup-btn'),
  settingsVersion: document.getElementById('settings-version'),

  // Tips
  tipsBtn: document.getElementById('tips-btn'),
  tipsNewDot: document.getElementById('tips-new-dot'),

  // Gauge
  gaugeProgress: document.getElementById('gauge-progress'),
  gaugeStop1: document.getElementById('gauge-stop-1'),
  gaugeStop2: document.getElementById('gauge-stop-2'),
  sessionPercentage: document.getElementById('session-percentage'),
  sessionReset: document.getElementById('session-reset'),

  // Weekly Stats (v1.2)
  barsList: document.getElementById('bars-list'),
  weeklyReset: document.getElementById('weekly-reset'),

  // Plan badge
  planBadge: document.getElementById('plan-badge'),

  // Peak banner
  peakBanner: document.getElementById('peak-banner'),
  peakLabel: document.getElementById('peak-label'),
  peakDescription: document.getElementById('peak-description'),
  peakCountdown: document.getElementById('peak-countdown'),
  peakLearnMore: document.getElementById('peak-learn-more'),

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
  renderHeatmap();
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

/**
 * Render the stacked bar list: All models, per-model breakdown, routines.
 * Replaces the old tab-based UI with a unified vertical stack.
 */
function renderWeeklyBars(allModelsData, models, routines) {
  if (!elements.barsList) return;

  // Clear existing bars
  while (elements.barsList.firstChild) {
    elements.barsList.removeChild(elements.barsList.firstChild);
  }

  // Update top-right reset info (once for all weekly bars)
  if (elements.weeklyReset) {
    const resetTs = allModelsData?.resetTimestamp;
    elements.weeklyReset.textContent = resetTs
      ? `Resets ${formatResetDay(resetTs)}`
      : '--';
  }

  // Row 1: All models (overall weekly)
  elements.barsList.appendChild(createBarRow({
    label: 'All models',
    percentage: allModelsData?.percentage ?? 0
  }));

  // Rows: per-model breakdown (skip if all zero to avoid clutter?)
  // We render all of them in consistent order: Opus, Sonnet, Haiku, Claude Design, others
  const priorityOrder = ['Opus', 'Sonnet', 'Haiku', 'Claude Design'];
  const sortedModels = [...(models || [])].sort((a, b) => {
    const ai = priorityOrder.indexOf(a.name);
    const bi = priorityOrder.indexOf(b.name);
    const aIdx = ai === -1 ? 999 : ai;
    const bIdx = bi === -1 ? 999 : bi;
    return aIdx - bIdx;
  });

  sortedModels.forEach(model => {
    elements.barsList.appendChild(createBarRow({
      label: model.name,
      percentage: model.percentage,
      subtitle: model.percentage === 0 ? 'not used yet' : null
    }));
  });

  // Routines — no divider, part of the same list
  if (routines && routines.limit > 0) {
    const routinesPct = Math.min(100, (routines.used / routines.limit) * 100);
    elements.barsList.appendChild(createBarRow({
      label: 'Daily routines',
      percentage: routinesPct,
      valueText: `${routines.used} / ${routines.limit}`
    }));
  }
}

/**
 * Create a single bar row DOM node.
 */
function createBarRow({ label, percentage, subtitle, valueText }) {
  const pct = Math.max(0, Math.min(100, percentage));
  const isEmpty = pct === 0;

  const row = document.createElement('div');
  row.className = 'bar-row';

  const header = document.createElement('div');
  header.className = 'bar-row-header';

  const labelWrap = document.createElement('div');
  const labelEl = document.createElement('span');
  labelEl.className = 'bar-label';
  labelEl.textContent = label;
  labelWrap.appendChild(labelEl);

  if (subtitle) {
    const subEl = document.createElement('span');
    subEl.className = 'bar-subtitle';
    subEl.textContent = `· ${subtitle}`;
    labelWrap.appendChild(subEl);
  }

  const valueEl = document.createElement('span');
  valueEl.className = 'bar-value';
  valueEl.textContent = valueText || `${Math.round(pct)}%`;

  header.appendChild(labelWrap);
  header.appendChild(valueEl);

  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = `bar-fill ${getColorClass(pct)}`;
  fill.style.width = `${pct}%`;
  track.appendChild(fill);

  row.appendChild(header);
  row.appendChild(track);
  return row;
}

/**
 * Map percentage to color bucket (low / medium / high / critical).
 */
function getColorClass(pct) {
  if (pct < 50) return 'low';
  if (pct < 70) return 'medium';
  if (pct < 90) return 'high';
  return 'critical';
}

/**
 * Format a reset timestamp as a short weekday+time string.
 * E.g. "Sun 05:00" or "in 2d 4h" depending on distance.
 */
function formatResetDay(timestamp) {
  if (!timestamp) return '--';
  const date = new Date(timestamp);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${days[date.getDay()]} ${hh}:${mm}`;
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
// Plan Badge
// ============================================

const PLAN_DISPLAY = {
  'default_claude_free': 'Free',
  'default_claude_pro': 'Pro',
  'default_claude_max': 'Max 5x',
  'default_claude_max_20x': 'Max 20x',
  'default_claude_team': 'Team',
  'default_claude_enterprise': 'Enterprise'
};

function updatePlanBadge(planTier) {
  if (!elements.planBadge) return;
  const display = PLAN_DISPLAY[planTier];
  if (display) {
    elements.planBadge.textContent = display;
    elements.planBadge.classList.remove('hidden');
  } else {
    elements.planBadge.classList.add('hidden');
  }
}

// ============================================
// Peak / Off-Peak Banner
// ============================================

function updatePeakBanner() {
  const banner = elements.peakBanner;
  if (!banner) return;

  try {
    const now = new Date();
    const { state, nextChangeAt } = getCurrentPeakState(now);

    banner.classList.remove('hidden');
    banner.classList.toggle('peak', state === 'peak');

    if (state === 'peak') {
      elements.peakLabel.textContent = 'Peak hours';
      elements.peakDescription.textContent = '— session drains 3-5x faster';
      elements.peakCountdown.textContent = `Off-peak in ${formatDelta(nextChangeAt - now)}`;
    } else {
      elements.peakLabel.textContent = 'Off-peak hours';
      elements.peakDescription.textContent = '— standard rate';
      elements.peakCountdown.textContent = `Peak in ${formatDelta(nextChangeAt - now)}`;
    }
  } catch (e) {
    console.warn('[ClaudeKarma] Peak banner update failed:', e.message);
    banner.classList.add('hidden');
  }
}

function formatDelta(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rem = h % 24;
    return rem > 0 ? `${d}d ${rem}h` : `${d}d`;
  }
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

  // First run: data was saved but fetch never succeeded yet
  if (!data.fetchSource && data.currentSession?.percentage === 0) {
    showLoading();
    // Trigger a fresh fetch, then reload data when done
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_REFRESH }, () => {
      setTimeout(fetchData, 2000);
    });
    return;
  }

  showMainContent();

  // Session gauge
  const sessionPct = data.currentSession?.percentage ?? 0;
  updateGauge(sessionPct);
  if (elements.sessionReset) {
    elements.sessionReset.textContent = formatResetInfo(data.currentSession);
  }

  // Weekly - Build model tabs and show selected model
  // Handle both new format (models array) and legacy (modelSpecific/sonnetOnly)
  let models = data.weeklyLimits?.models || [];
  const allModelsData = data.weeklyLimits?.allModels || {};

  // If no models array, build from legacy modelSpecific/sonnetOnly
  if (models.length === 0) {
    const legacy = data.weeklyLimits?.modelSpecific || data.weeklyLimits?.sonnetOnly;
    if (legacy?.modelName && legacy.percentage > 0) {
      models = [{
        name: legacy.modelName,
        percentage: legacy.percentage,
        resetTimestamp: legacy.resetTimestamp
      }];
    }
  }

  renderWeeklyBars(allModelsData, models, data.routines);

  // Update plan badge (if available on data)
  updatePlanBadge(data.planTier);

  // Update peak/off-peak banner
  updatePeakBanner();

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

// ============================================
// Settings Panel
// ============================================

async function openSettings() {
  // Load current settings
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};

    if (elements.settingNotifications) {
      elements.settingNotifications.checked = settings.notifications?.enabled !== false;
    }

    const thresholds = settings.notifications?.thresholds || [75, 90, 100];
    if (elements.threshold75) elements.threshold75.checked = thresholds.includes(75);
    if (elements.threshold90) elements.threshold90.checked = thresholds.includes(90);
    if (elements.threshold100) elements.threshold100.checked = thresholds.includes(100);

    if (elements.thresholdOptions) {
      elements.thresholdOptions.style.opacity = elements.settingNotifications?.checked ? '1' : '0.4';
      elements.thresholdOptions.style.pointerEvents = elements.settingNotifications?.checked ? 'auto' : 'none';
    }

    if (elements.settingRefreshInterval) {
      elements.settingRefreshInterval.value = String(settings.refreshInterval || 5);
    }

    if (elements.settingsVersion) {
      const manifest = chrome.runtime.getManifest();
      elements.settingsVersion.textContent = `ClaudeKarma v${manifest.version}`;
    }
  } catch (e) {
    console.error('[ClaudeKarma Popup] Error loading settings:', e);
  }

  elements.settingsPanel?.classList.add('open');
}

function closeSettings() {
  elements.settingsPanel?.classList.remove('open');
}

async function saveSettings() {
  try {
    const thresholds = [];
    if (elements.threshold75?.checked) thresholds.push(75);
    if (elements.threshold90?.checked) thresholds.push(90);
    if (elements.threshold100?.checked) thresholds.push(100);

    const settings = {
      notifications: {
        enabled: elements.settingNotifications?.checked ?? true,
        thresholds: thresholds
      },
      refreshInterval: parseInt(elements.settingRefreshInterval?.value || '5', 10)
    };

    const current = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: { ...current.settings, ...settings }
    });

    // Notify service worker to update alarm interval
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  } catch (e) {
    console.error('[ClaudeKarma Popup] Error saving settings:', e);
  }
}

async function handleClearHistory() {
  if (confirm('Clear all usage history? This cannot be undone.')) {
    await chrome.storage.local.set({ usageHistory: [] });
    elements.clearHistoryBtn.textContent = 'Cleared!';
    setTimeout(() => {
      elements.clearHistoryBtn.textContent = 'Clear Usage History';
    }, 2000);
  }
}

async function handleResetSetup() {
  if (confirm('Reset account setup? You will need to reconnect.')) {
    await chrome.storage.local.remove(['settings']);
    closeSettings();
    showSetup();
  }
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
  // Open external tips hub hosted on tokenkarma.app
  chrome.tabs.create({ url: 'https://tokenkarma.app/tips?src=ext' });
  // Hide the new dot immediately
  elements.tipsNewDot?.classList.add('hidden');
}

// ============================================
// Random Tip Display
// ============================================

function displayRandomTip() {
  // Random tip box was removed in v1.2 — replaced by Tips CTA button.
  // Kept as a no-op to avoid breaking call sites.
}

// ============================================
// Heatmap
// ============================================

const heatmapGrid = document.getElementById('heatmap-grid');
const heatmapHours = document.getElementById('heatmap-hours');
const heatmapDays = document.getElementById('heatmap-days');
const heatmapTooltip = document.getElementById('heatmap-tooltip');
const heatmapWeekBtn = document.getElementById('heatmap-week');
const heatmapMonthBtn = document.getElementById('heatmap-month');

let heatmapPeriod = 'week';

const HEATMAP_COLORS = ['var(--heatmap-0)', 'var(--heatmap-1)', 'var(--heatmap-2)', 'var(--heatmap-3)', 'var(--heatmap-4)'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // indexed by getDay()
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getHeatmapLevel(percentage) {
  if (percentage <= 0) return 0;
  if (percentage < 25) return 1;
  if (percentage < 50) return 2;
  if (percentage < 75) return 3;
  return 4;
}

async function renderHeatmap() {
  if (!heatmapGrid) return;

  const days = heatmapPeriod === 'week' ? 7 : 30;
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  // Fetch history
  let history = [];
  try {
    const result = await chrome.storage.local.get('usageHistory');
    history = (result.usageHistory || []).filter(e => e.t >= startDate.getTime());
  } catch (e) {
    console.error('[ClaudeKarma] Error loading history:', e);
  }

  // Aggregate into 1-hour blocks per day (24 blocks)
  // grid[dayIndex][hour] = peak session percentage
  const BLOCKS = 24;
  const HOURS_PER_BLOCK = 1;
  const grid = Array.from({ length: days }, () => Array(BLOCKS).fill(0));

  history.forEach(entry => {
    const date = new Date(entry.t);
    const dayIndex = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (dayIndex >= 0 && dayIndex < days) {
      const block = Math.floor(date.getHours() / HOURS_PER_BLOCK);
      grid[dayIndex][block] = Math.max(grid[dayIndex][block], entry.s || 0);
    }
  });

  // Clear
  while (heatmapGrid.firstChild) heatmapGrid.removeChild(heatmapGrid.firstChild);
  while (heatmapHours.firstChild) heatmapHours.removeChild(heatmapHours.firstChild);
  while (heatmapDays.firstChild) heatmapDays.removeChild(heatmapDays.firstChild);

  // Render hour labels (X-axis, top) — show every 3rd to avoid crowding with 24 columns
  for (let b = 0; b < BLOCKS; b++) {
    const label = document.createElement('div');
    label.className = 'heatmap-hour-label';
    label.textContent = b % 3 === 0 ? `${String(b).padStart(2, '0')}` : '';
    heatmapHours.appendChild(label);
  }

  // Render grid rows (one per day) and day labels (Y-axis, left)
  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    // Day label
    const dayLabel = document.createElement('div');
    dayLabel.className = 'heatmap-day-label';
    const labelInterval = heatmapPeriod === 'week' ? 1 : 3;
    if (d % labelInterval === 0) {
      dayLabel.textContent = heatmapPeriod === 'week'
        ? DAY_NAMES[date.getDay()]
        : `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
    }
    heatmapDays.appendChild(dayLabel);

    // Row of cells
    const row = document.createElement('div');
    row.className = 'heatmap-row';

    for (let b = 0; b < BLOCKS; b++) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      const level = getHeatmapLevel(grid[d][b]);
      cell.style.background = HEATMAP_COLORS[level];

      const pct = grid[d][b];
      const dateStr = `${DAY_NAMES[date.getDay()]} ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
      const timeStr = `${String(b).padStart(2, '0')}:00`;

      cell.addEventListener('mouseenter', (e) => {
        heatmapTooltip.textContent = `${dateStr} ${timeStr} · ${pct}%`;
        heatmapTooltip.classList.add('visible');
        // Show first to measure, then position with edge detection
        heatmapTooltip.style.visibility = 'hidden';
        heatmapTooltip.style.left = '0px';
        heatmapTooltip.style.top = '0px';
        const ttRect = heatmapTooltip.getBoundingClientRect();
        const ttW = ttRect.width;
        const ttH = ttRect.height;
        const popupW = document.documentElement.clientWidth;
        const popupH = document.documentElement.clientHeight;
        const margin = 8;
        // Default: right of cursor
        let left = e.clientX + margin;
        let top = e.clientY - ttH - margin;
        // If overflowing right edge, flip to left of cursor
        if (left + ttW + margin > popupW) {
          left = e.clientX - ttW - margin;
        }
        // Clamp to popup bounds
        if (left < margin) left = margin;
        if (top < margin) top = e.clientY + margin;
        if (top + ttH + margin > popupH) top = popupH - ttH - margin;
        heatmapTooltip.style.left = `${left}px`;
        heatmapTooltip.style.top = `${top}px`;
        heatmapTooltip.style.visibility = '';
      });
      cell.addEventListener('mouseleave', () => {
        heatmapTooltip.classList.remove('visible');
      });

      row.appendChild(cell);
    }

    heatmapGrid.appendChild(row);
  }
}

heatmapWeekBtn?.addEventListener('click', () => {
  heatmapPeriod = 'week';
  heatmapWeekBtn.classList.add('active');
  heatmapMonthBtn?.classList.remove('active');
  renderHeatmap();
});

heatmapMonthBtn?.addEventListener('click', () => {
  heatmapPeriod = 'month';
  heatmapMonthBtn.classList.add('active');
  heatmapWeekBtn?.classList.remove('active');
  renderHeatmap();
});

// ============================================
// Event Listeners
// ============================================

elements.refreshBtn?.addEventListener('click', triggerRefresh);
elements.autoDetectBtn?.addEventListener('click', handleAutoDetect);
elements.saveOrgBtn?.addEventListener('click', handleSaveOrgId);
elements.settingsBtn?.addEventListener('click', openSettings);
elements.settingsBack?.addEventListener('click', closeSettings);
elements.tipsBtn?.addEventListener('click', handleTipsClick);
elements.clearHistoryBtn?.addEventListener('click', handleClearHistory);
elements.resetSetupBtn?.addEventListener('click', handleResetSetup);

// Settings auto-save on change
elements.settingNotifications?.addEventListener('change', () => {
  if (elements.thresholdOptions) {
    elements.thresholdOptions.style.opacity = elements.settingNotifications.checked ? '1' : '0.4';
    elements.thresholdOptions.style.pointerEvents = elements.settingNotifications.checked ? 'auto' : 'none';
  }
  saveSettings();
});
elements.threshold75?.addEventListener('change', saveSettings);
elements.threshold90?.addEventListener('change', saveSettings);
elements.threshold100?.addEventListener('change', saveSettings);
elements.settingRefreshInterval?.addEventListener('change', saveSettings);

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
    // Refresh peak banner countdown independently of fetch success
    updatePeakBanner();
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
